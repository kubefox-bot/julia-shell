import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  appendTranscribeOutboxEvent,
  completeTranscribeJob,
  createTranscribeJob,
  getTranscribeWidgetSettings,
  listRecentFolders,
  listRecentTranscribeJobs,
  saveTranscribeWidgetSettings,
  touchRecentFolder
} from '../src/core/db/transcribe-repository'
import { openDb, resetDbCache } from '../src/core/db/shared'

let tempDir = ''

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'julia-transcribe-db-'))
  process.env.JULIAAPP_DATA_DIR = tempDir
})

afterEach(() => {
  resetDbCache()
  fs.rmSync(tempDir, { recursive: true, force: true })
  delete process.env.JULIAAPP_DATA_DIR
})

describe('transcribe repository', () => {
  it('persists widget settings and keeps recent folders as a 5-item stack', () => {
    expect(getTranscribeWidgetSettings('com.yulia.transcribe').geminiModel).toBe('')

    saveTranscribeWidgetSettings({
      widgetId: 'com.yulia.transcribe',
      geminiModel: 'mock',
      localApiKey: 'local-key'
    })

    touchRecentFolder('com.yulia.transcribe', 'C:\\OneDrive\\A')
    touchRecentFolder('com.yulia.transcribe', 'C:\\OneDrive\\B')
    touchRecentFolder('com.yulia.transcribe', 'C:\\OneDrive\\A')
    touchRecentFolder('com.yulia.transcribe', 'C:\\OneDrive\\C')
    touchRecentFolder('com.yulia.transcribe', 'C:\\OneDrive\\D')
    touchRecentFolder('com.yulia.transcribe', 'C:\\OneDrive\\E')
    touchRecentFolder('com.yulia.transcribe', 'C:\\OneDrive\\F')

    expect(getTranscribeWidgetSettings('com.yulia.transcribe')).toMatchObject({
      geminiModel: 'mock',
      localApiKey: 'local-key'
    })
    expect(listRecentFolders('com.yulia.transcribe').map((entry) => entry.folderPath)).toEqual([
      'C:\\OneDrive\\F',
      'C:\\OneDrive\\E',
      'C:\\OneDrive\\D',
      'C:\\OneDrive\\C',
      'C:\\OneDrive\\A',
    ])
  })

  it('stores jobs and outbox events with extended schema', () => {
    const jobId = createTranscribeJob({
      widgetId: 'com.yulia.transcribe',
      folderPath: 'C:\\Audio',
      filePaths: ['C:\\Audio\\clip.opus'],
      primarySourceFile: 'C:\\Audio\\clip.opus',
      platform: 'windows',
      model: 'mock'
    })

    appendTranscribeOutboxEvent({
      widgetId: 'com.yulia.transcribe',
      jobId,
      eventType: 'job_created',
      state: 'queued',
      payload: {
        model: 'mock'
      }
    })
    completeTranscribeJob(jobId, 'C:\\Audio\\clip.txt')

    expect(listRecentTranscribeJobs(1)[0]).toMatchObject({
      id: jobId,
      widgetId: 'com.yulia.transcribe',
      primarySourceFile: 'C:\\Audio\\clip.opus',
      platform: 'windows',
      model: 'mock',
      savePath: 'C:\\Audio\\clip.txt',
      status: 'completed'
    })

    const db = openDb('transcribe.db')
    const outboxCount = db.prepare('SELECT COUNT(*) as count FROM transcribe_outbox').get() as { count: number }
    expect(outboxCount.count).toBe(1)
  })
})
