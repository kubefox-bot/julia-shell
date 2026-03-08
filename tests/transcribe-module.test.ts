import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { listRecentTranscribeJobs } from '../src/core/db/transcribe-repository'
import { resetDbCache } from '../src/core/db/shared'
import { transcribeServerModule } from '../src/widgets/transcribe/server/module'

let tempDir = ''
let audioDir = ''
let originalPath = ''
let ffmpegStubDir = ''

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'julia-transcribe-module-'))
  audioDir = path.join(tempDir, 'audio')
  ffmpegStubDir = path.join(tempDir, 'bin')
  fs.mkdirSync(audioDir, { recursive: true })
  fs.mkdirSync(ffmpegStubDir, { recursive: true })
  fs.writeFileSync(path.join(audioDir, 'clip-1.opus'), 'fake-audio-1')
  fs.writeFileSync(path.join(audioDir, 'clip-2.opus'), 'fake-audio-2')
  const ffmpegStubPath = path.join(ffmpegStubDir, 'ffmpeg')
  fs.writeFileSync(
    ffmpegStubPath,
    `#!/bin/sh
set -eu
log_file="${tempDir.replace(/"/g, '\\"')}/ffmpeg.log"
printf '%s\n' "$*" >> "$log_file"
output=""
for last in "$@"; do
  output="$last"
done
printf 'Duration: 00:00:02.00\\ntime=00:00:02.00\\n' >&2
printf 'stub-audio' > "$output"
`,
    'utf8'
  )
  fs.chmodSync(ffmpegStubPath, 0o755)
  originalPath = process.env.PATH ?? ''
  process.env.PATH = `${ffmpegStubDir}${path.delimiter}${originalPath}`
  process.env.JULIAAPP_DATA_DIR = tempDir
  process.env.GEMINI_MODEL = 'mock'
  delete process.env.GEMINI_API_KEY
})

afterEach(() => {
  resetDbCache()
  fs.rmSync(tempDir, { recursive: true, force: true })
  process.env.PATH = originalPath
  delete process.env.JULIAAPP_DATA_DIR
  delete process.env.GEMINI_MODEL
  delete process.env.GEMINI_API_KEY
})

describe('transcribe server module', () => {
  it('handles mock transcription through ffmpeg pipeline for multiple .opus files', async () => {
    const transcribeResponse = await transcribeServerModule.handlers['POST transcribe-stream']({
      request: new Request('http://localhost/api/widget/com.yulia.transcribe/transcribe-stream', {
        method: 'POST',
        body: JSON.stringify({
          folderPath: audioDir,
          filePaths: [path.join(audioDir, 'clip-1.opus'), path.join(audioDir, 'clip-2.opus')]
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
    expect(body).not.toContain('event: error')
    const ffmpegLog = fs.readFileSync(path.join(tempDir, 'ffmpeg.log'), 'utf8')
    expect(ffmpegLog).toContain('-f concat -safe 0')
    expect(ffmpegLog).toContain('-c:a libopus -b:a 24k')
    expect(body).toContain('event: token')
    expect(body).toContain('event: done')
    expect(body).toContain('Prepared opus file:')
    expect(fs.existsSync(path.join(audioDir, 'clip-1.txt'))).toBe(true)
    expect(listRecentTranscribeJobs(1)[0]?.model).toBe('mock')

    const readResponse = await transcribeServerModule.handlers['POST transcript-read']({
      request: new Request('http://localhost/api/widget/com.yulia.transcribe/transcript-read', {
        method: 'POST',
        body: JSON.stringify({
          sourceFile: 'clip-1.opus',
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
    expect(readPayload.txtPath.endsWith('clip-1.txt')).toBe(true)
    expect(readPayload.transcript).toContain('Mock transcription mode is active.')
    expect(readPayload.transcript).toContain('Prepared opus file:')

    const saveResponse = await transcribeServerModule.handlers['POST transcript-save']({
      request: new Request('http://localhost/api/widget/com.yulia.transcribe/transcript-save', {
        method: 'POST',
        body: JSON.stringify({
          txtPath: readPayload.txtPath,
          transcript: '[01:45:06] Анна: Привет'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      }),
      action: 'transcript-save',
      actionSegments: ['transcript-save'],
      params: {
        id: 'com.yulia.transcribe'
      }
    })

    expect(saveResponse.status).toBe(200)
    const savePayload = await saveResponse.json() as { txtPath: string }
    expect(savePayload.txtPath.endsWith('clip-1.txt')).toBe(true)
    expect(fs.readFileSync(savePayload.txtPath, 'utf8')).toBe('[01:45:06] Анна: Привет')

    const saveAliasesResponse = await transcribeServerModule.handlers['POST speaker-aliases']({
      request: new Request('http://localhost/api/widget/com.yulia.transcribe/speaker-aliases', {
        method: 'POST',
        body: JSON.stringify({
          aliases: [
            { speakerKey: ' Спикер   2 ', aliasName: 'Анна' },
            { speakerKey: 'Speaker 1', aliasName: 'John' }
          ]
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      }),
      action: 'speaker-aliases',
      actionSegments: ['speaker-aliases'],
      params: {
        id: 'com.yulia.transcribe'
      }
    })

    expect(saveAliasesResponse.status).toBe(200)
    const saveAliasesPayload = await saveAliasesResponse.json() as {
      aliases: Array<{ speakerKey: string; aliasName: string }>
    }
    expect(saveAliasesPayload.aliases).toEqual([
      { speakerKey: 'speaker 1', aliasName: 'John' },
      { speakerKey: 'спикер 2', aliasName: 'Анна' }
    ])

    const deleteAliasResponse = await transcribeServerModule.handlers['POST speaker-aliases']({
      request: new Request('http://localhost/api/widget/com.yulia.transcribe/speaker-aliases', {
        method: 'POST',
        body: JSON.stringify({
          aliases: [{ speakerKey: 'speaker 1', aliasName: '' }]
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      }),
      action: 'speaker-aliases',
      actionSegments: ['speaker-aliases'],
      params: {
        id: 'com.yulia.transcribe'
      }
    })

    const deleteAliasPayload = await deleteAliasResponse.json() as {
      aliases: Array<{ speakerKey: string; aliasName: string }>
    }
    expect(deleteAliasPayload.aliases).toEqual([
      { speakerKey: 'спикер 2', aliasName: 'Анна' }
    ])

    const getAliasesResponse = await transcribeServerModule.handlers['GET speaker-aliases']({
      request: new Request('http://localhost/api/widget/com.yulia.transcribe/speaker-aliases'),
      action: 'speaker-aliases',
      actionSegments: ['speaker-aliases'],
      params: {
        id: 'com.yulia.transcribe'
      }
    })

    expect(getAliasesResponse.status).toBe(200)
    const getAliasesPayload = await getAliasesResponse.json() as {
      aliases: Array<{ speakerKey: string; aliasName: string }>
    }
    expect(getAliasesPayload.aliases).toEqual([
      { speakerKey: 'спикер 2', aliasName: 'Анна' }
    ])
  })
})
