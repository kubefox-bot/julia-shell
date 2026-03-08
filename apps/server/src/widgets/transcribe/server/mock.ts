import fs from 'node:fs/promises'
import path from 'node:path'
import { MOCK_GEMINI_MODEL } from './constants'
import type { SsePayload } from './types'
import { sleep } from './utils'

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

  input.sendProgress(8, 'progressMockPreparing')
  await sleep(120)
  input.sendProgress(24, 'progressMockMetadata')
  await sleep(150)
  input.sendProgress(48, 'progressMockGenerating')

  const chunks = transcript.match(/.{1,48}(\s|$)/g) ?? [transcript]
  for (const chunk of chunks) {
    input.send('token', {
      text: chunk,
      model: MOCK_GEMINI_MODEL,
      jobId: input.jobId
    })
    await sleep(55)
  }

  input.sendProgress(84, 'progressMockFinalizing')
  const savePath = path.join(input.resolvedFolderPath, `${input.primaryBaseName}.txt`)
  await fs.writeFile(savePath, transcript, 'utf8')
  input.sendProgress(100, 'progressMockDone')

  return {
    transcript,
    savePath
  }
}
