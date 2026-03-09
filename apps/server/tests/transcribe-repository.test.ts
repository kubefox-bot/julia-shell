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
  listSpeakerAliases,
  saveSpeakerAliases,
  saveTranscribeWidgetSettings,
  touchRecentFolder
} from '../src/widgets/transcribe/server/repository'
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
    const agentId = 'agent-a'
    expect(getTranscribeWidgetSettings(agentId, 'com.yulia.transcribe').geminiModel).toBe('')

    saveTranscribeWidgetSettings({
      agentId,
      widgetId: 'com.yulia.transcribe',
      geminiModel: 'mock',
      localApiKey: 'local-key'
    })

    touchRecentFolder(agentId, 'com.yulia.transcribe', 'C:\\OneDrive\\A')
    touchRecentFolder(agentId, 'com.yulia.transcribe', 'C:\\OneDrive\\B')
    touchRecentFolder(agentId, 'com.yulia.transcribe', 'C:\\OneDrive\\A')
    touchRecentFolder(agentId, 'com.yulia.transcribe', 'C:\\OneDrive\\C')
    touchRecentFolder(agentId, 'com.yulia.transcribe', 'C:\\OneDrive\\D')
    touchRecentFolder(agentId, 'com.yulia.transcribe', 'C:\\OneDrive\\E')
    touchRecentFolder(agentId, 'com.yulia.transcribe', 'C:\\OneDrive\\F')

    expect(getTranscribeWidgetSettings(agentId, 'com.yulia.transcribe')).toMatchObject({
      geminiModel: 'mock',
      localApiKey: 'local-key'
    })
    expect(listRecentFolders(agentId, 'com.yulia.transcribe').map((entry) => entry.folderPath)).toEqual([
      'C:\\OneDrive\\F',
      'C:\\OneDrive\\E',
      'C:\\OneDrive\\D',
      'C:\\OneDrive\\C',
      'C:\\OneDrive\\A',
    ])
  })

  it('stores jobs and outbox events with extended schema', () => {
    const agentId = 'agent-a'
    const jobId = createTranscribeJob({
      agentId,
      widgetId: 'com.yulia.transcribe',
      folderPath: 'C:\\Audio',
      filePaths: ['C:\\Audio\\clip.opus'],
      primarySourceFile: 'C:\\Audio\\clip.opus',
      platform: 'windows',
      model: 'mock'
    })

    appendTranscribeOutboxEvent({
      agentId,
      widgetId: 'com.yulia.transcribe',
      jobId,
      eventType: 'job_created',
      state: 'queued',
      payload: {
        model: 'mock'
      }
    })
    completeTranscribeJob(jobId, 'C:\\Audio\\clip.txt')

    expect(listRecentTranscribeJobs(agentId, 1)[0]).toMatchObject({
      id: jobId,
      agentId,
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

  it('normalizes, upserts and deletes speaker aliases per widget', () => {
    const agentA = 'agent-a'
    const agentB = 'agent-b'
    saveSpeakerAliases(agentA, 'com.yulia.transcribe', [
      { speakerKey: '  Спикер   2 ', aliasName: 'Анна' },
      { speakerKey: 'speaker 1', aliasName: 'John' }
    ])

    saveSpeakerAliases(agentB, 'com.yulia.weather', [
      { speakerKey: 'speaker 1', aliasName: 'Weather bot' }
    ])

    expect(listSpeakerAliases(agentA, 'com.yulia.transcribe')).toEqual([
      { speakerKey: 'speaker 1', aliasName: 'John' },
      { speakerKey: 'спикер 2', aliasName: 'Анна' }
    ])

    saveSpeakerAliases(agentA, 'com.yulia.transcribe', [
      { speakerKey: 'Спикер 2', aliasName: '' }
    ])

    expect(listSpeakerAliases(agentA, 'com.yulia.transcribe')).toEqual([
      { speakerKey: 'speaker 1', aliasName: 'John' }
    ])
    expect(listSpeakerAliases(agentB, 'com.yulia.weather')).toEqual([
      { speakerKey: 'speaker 1', aliasName: 'Weather bot' }
    ])
  })
})
