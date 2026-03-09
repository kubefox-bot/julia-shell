import fs from 'node:fs/promises'
import path from 'node:path'
import { MOCK_GEMINI_MODEL } from './constants'
import type { SsePayload } from './types'
import { sleep } from './utils'

const PREPARE_PROGRESS_PERCENT = 8
const METADATA_PROGRESS_PERCENT = 24
const GENERATING_PROGRESS_PERCENT = 48
const FINALIZING_PROGRESS_PERCENT = 84
const DONE_PROGRESS_PERCENT = 100
const PREPARE_DELAY_MS = 120
const METADATA_DELAY_MS = 150
const TOKEN_DELAY_MS = 55
const MAX_CHUNK_LENGTH = 48

export async function runMockTranscription(input: {
  selectedFiles: string[]
  resolvedFolderPath: string
  primaryBaseName: string
  convertedAudioPath: string
  sendProgress: (percent: number, stage: string) => void
  send: (event: string, payload: SsePayload) => void
  jobId: string
}) {
  const transcript = [
    'Mock transcription mode is active.',
    `Primary file: ${path.basename(input.selectedFiles[0])}.`,
    `Merged files count: ${input.selectedFiles.length}.`,
    `Prepared opus file: ${path.basename(input.convertedAudioPath)}.`,
    'This text simulates Gemini token streaming for local development.',
    'Use it to verify progress, save flow, outbox entries, and the txt reader.'
  ].join('\n')

  input.sendProgress(PREPARE_PROGRESS_PERCENT, 'progressMockPreparing')
  await sleep(PREPARE_DELAY_MS)
  input.sendProgress(METADATA_PROGRESS_PERCENT, 'progressMockMetadata')
  await sleep(METADATA_DELAY_MS)
  input.sendProgress(GENERATING_PROGRESS_PERCENT, 'progressMockGenerating')

  const chunks = transcript.match(new RegExp(`.{1,${MAX_CHUNK_LENGTH}}(\\s|$)`, 'g')) ?? [transcript]
  for (const chunk of chunks) {
    input.send('token', {
      text: chunk,
      model: MOCK_GEMINI_MODEL,
      jobId: input.jobId
    })
    await sleep(TOKEN_DELAY_MS)
  }

  input.sendProgress(FINALIZING_PROGRESS_PERCENT, 'progressMockFinalizing')
  const savePath = path.join(input.resolvedFolderPath, `${input.primaryBaseName}.txt`)
  await fs.writeFile(savePath, transcript, 'utf8')
  input.sendProgress(DONE_PROGRESS_PERCENT, 'progressMockDone')

  return {
    transcript,
    savePath
  }
}
