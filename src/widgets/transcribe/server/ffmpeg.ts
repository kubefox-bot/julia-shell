import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn, type ChildProcess } from 'node:child_process'
import { TMP_ROOT } from './constants'
import { escapeConcatPath, parseClockToSeconds } from './utils'

type ProgressHandler = (percent: number, stage: string) => void
type ChildSetter = (child: ChildProcess | null) => void

export async function prepareAudioForTranscription(input: {
  ffmpegExe: string
  selectedFiles: string[]
  primaryBaseName: string
  sendProgress: ProgressHandler
  setActiveChild: ChildSetter
}) {
  const { ffmpegExe, selectedFiles, primaryBaseName, sendProgress, setActiveChild } = input
  let mergedAudioPath = ''
  let concatListPath = ''
  let convertedAudioPath = ''
  let inputFilePath = selectedFiles[0]

  await fs.mkdir(TMP_ROOT, { recursive: true })

  if (selectedFiles.length > 1) {
    concatListPath = path.join(TMP_ROOT, `${primaryBaseName}_merged.concat.txt`)
    await fs.writeFile(
      concatListPath,
      selectedFiles.map((value) => `file '${escapeConcatPath(value)}'`).join('\n'),
      'utf8'
    )
  }

  const convertBaseName = selectedFiles.length > 1 ? `${primaryBaseName}_merged` : primaryBaseName
  convertedAudioPath = path.join(TMP_ROOT, `${convertBaseName}.mono16k.ogg`)
  const conversionStart = selectedFiles.length > 1 ? 6 : 5
  const conversionEnd = selectedFiles.length > 1 ? 52 : 40

  sendProgress(conversionStart, selectedFiles.length > 1 ? 'progressMerging' : 'progressConverting')
  await runFfmpeg({
    ffmpegExe,
    args: selectedFiles.length > 1
      ? [
          '-y',
          '-f',
          'concat',
          '-safe',
          '0',
          '-i',
          concatListPath,
          '-vn',
          '-ac',
          '1',
          '-ar',
          '16000',
          '-c:a',
          'libopus',
          '-b:a',
          '24k',
          '-vbr',
          'on',
          '-compression_level',
          '10',
          convertedAudioPath
        ]
      : [
          '-y',
          '-i',
          inputFilePath,
          '-vn',
          '-ac',
          '1',
          '-ar',
          '16000',
          '-c:a',
          'libopus',
          '-b:a',
          '24k',
          '-vbr',
          'on',
          '-compression_level',
          '10',
          convertedAudioPath
        ],
    onStderr: ({ stderrBuffer, chunk }) => {
      let durationSeconds = 0
      const durationMatch = stderrBuffer.match(/Duration:\s(\d{2}:\d{2}:\d{2}\.\d+)/)
      if (durationMatch) {
        durationSeconds = parseClockToSeconds(durationMatch[1])
      }

      const timeMatches = [...chunk.matchAll(/time=(\d{2}:\d{2}:\d{2}\.\d+)/g)]
      if (durationSeconds > 0 && timeMatches.length > 0) {
        const currentSeconds = parseClockToSeconds(timeMatches[timeMatches.length - 1][1])
        const ratio = Math.max(0, Math.min(1, currentSeconds / durationSeconds))
        const stage = selectedFiles.length > 1 && ratio < 0.35
          ? 'progressMerging'
          : 'progressConverting'
        sendProgress(conversionStart + ratio * (conversionEnd - conversionStart), stage)
      }
    },
    setActiveChild
  })
  sendProgress(conversionEnd, 'progressConversionComplete')

  return {
    mergedAudioPath,
    concatListPath,
    convertedAudioPath
  }
}

async function runFfmpeg(input: {
  ffmpegExe: string
  args: string[]
  setActiveChild: ChildSetter
  onStderr?: (payload: { stderrBuffer: string; chunk: string }) => void
}) {
  const { ffmpegExe, args, setActiveChild, onStderr } = input

  await new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn(ffmpegExe, args, {
      windowsHide: true,
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe']
    })

    setActiveChild(ffmpeg)
    let stderrBuffer = ''

    ffmpeg.stderr.setEncoding('utf8')
    ffmpeg.stderr.on('data', (chunk: string) => {
      stderrBuffer += chunk
      onStderr?.({ stderrBuffer, chunk })
    })

    ffmpeg.on('error', (error) => reject(error))
    ffmpeg.on('close', (code) => {
      setActiveChild(null)
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(stderrBuffer.trim() || `ffmpeg exited with code ${code}`))
    })
  })
}
