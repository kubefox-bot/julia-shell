import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { listRecentTranscribeJobs } from '../src/core/db/transcribe-repository'
import { resetDbCache } from '../src/core/db/shared'
import { transcribeServerModule } from '../src/widgets/transcribe/server/module'

let tempDir = ''
let audioDir = ''

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'julia-transcribe-module-'))
  audioDir = path.join(tempDir, 'audio')
  fs.mkdirSync(audioDir, { recursive: true })
  fs.writeFileSync(path.join(audioDir, 'clip.opus'), 'fake-audio')
  process.env.JULIAAPP_DATA_DIR = tempDir
  process.env.GEMINI_MODEL = 'mock'
  delete process.env.GEMINI_API_KEY
})

afterEach(() => {
  resetDbCache()
  fs.rmSync(tempDir, { recursive: true, force: true })
  delete process.env.JULIAAPP_DATA_DIR
  delete process.env.GEMINI_MODEL
  delete process.env.GEMINI_API_KEY
})

describe('transcribe server module', () => {
  it('handles mock transcription for .opus and resolves txt by basename', async () => {
    const transcribeResponse = await transcribeServerModule.handlers['POST transcribe-stream']({
      request: new Request('http://localhost/api/widget/com.yulia.transcribe/transcribe-stream', {
        method: 'POST',
        body: JSON.stringify({
          folderPath: audioDir,
          filePaths: [path.join(audioDir, 'clip.opus')]
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      }),
      action: 'transcribe-stream',
      actionSegments: ['transcribe-stream'],
      params: {
        id: 'com.yulia.transcribe'
      }
    })

    expect(transcribeResponse.status).toBe(200)
    const body = await transcribeResponse.text()
    expect(body).toContain('event: token')
    expect(body).toContain('event: done')
    expect(fs.existsSync(path.join(audioDir, 'clip.txt'))).toBe(true)
    expect(listRecentTranscribeJobs(1)[0]?.model).toBe('mock')

    const readResponse = await transcribeServerModule.handlers['POST transcript-read']({
      request: new Request('http://localhost/api/widget/com.yulia.transcribe/transcript-read', {
        method: 'POST',
        body: JSON.stringify({
          sourceFile: 'clip.opus',
          folderPath: audioDir
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      }),
      action: 'transcript-read',
      actionSegments: ['transcript-read'],
      params: {
        id: 'com.yulia.transcribe'
      }
    })

    expect(readResponse.status).toBe(200)
    const readPayload = await readResponse.json() as { transcript: string; txtPath: string }
    expect(readPayload.txtPath.endsWith('clip.txt')).toBe(true)
    expect(readPayload.transcript).toContain('Mock transcription mode is active.')
  })
})
