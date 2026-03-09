import fs from 'node:fs/promises'
import path from 'node:path'
import { readRuntimeEnv } from '@core/env'
import type { HostPlatform } from '../../../entities/widget/model/types'
import {
  DEFAULT_GEMINI_MODEL,
  FALLBACK_GEMINI_MODEL,
  MOCK_GEMINI_MODEL,
  SUPPORTED_AUDIO_EXTENSIONS,
} from './constants'
import type { BrowserEntry } from './types'
import { findBinary } from './utils/findBinary'
import { resolveSelection } from './utils/resolveSelection'

const SECONDS_PER_HOUR = 3600
const SECONDS_PER_MINUTE = 60

export function toSseEvent(event: string, payload: Record<string, unknown>) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function parseClockToSeconds(value: string) {
  const [hours, minutes, seconds] = value.split(':')
  return Number(hours) * SECONDS_PER_HOUR + Number(minutes) * SECONDS_PER_MINUTE + Number(seconds)
}

export function escapeConcatPath(filePath: string) {
  return filePath.replace(/'/g, "'\\''")
}

export function normalizePath(inputPath: string) {
  const cleaned = inputPath.trim()
  const platformNative =
    process.platform === 'win32' ? cleaned.replace(/\//g, '\\') : cleaned.replace(/\\/g, '/')

  return path.resolve(platformNative)
}

export function getHostPlatform(): HostPlatform {
  if (process.platform === 'win32') return 'windows'
  if (process.platform === 'darwin') return 'macos'
  return 'linux'
}

export function isSupportedAudioPath(filePath: string) {
  const normalized = filePath.toLowerCase()
  return SUPPORTED_AUDIO_EXTENSIONS.some((extension) => normalized.endsWith(extension))
}

export function toTranscriptPath(filePath: string) {
  return filePath.replace(/\.(m4a|opus)$/i, '.txt')
}

export function buildGeminiModelCandidates(primary: string) {
  const normalizedPrimary = primary.trim() || DEFAULT_GEMINI_MODEL
  const candidates =
    normalizedPrimary === MOCK_GEMINI_MODEL
      ? [MOCK_GEMINI_MODEL]
      : [normalizedPrimary, DEFAULT_GEMINI_MODEL, FALLBACK_GEMINI_MODEL]

  return [...new Set(candidates)]
}

export function resolveConfiguredModel(storedModel?: string | null) {
  const runtimeEnv = readRuntimeEnv()
  const fromDb = storedModel?.trim()
  const fromEnv = runtimeEnv.geminiModel
  const value = fromDb || fromEnv || DEFAULT_GEMINI_MODEL

  if (value === MOCK_GEMINI_MODEL && !runtimeEnv.isDevelopment) {
    return DEFAULT_GEMINI_MODEL
  }

  return value
}

export function buildAvailableModels(storedModel?: string | null) {
  const runtimeEnv = readRuntimeEnv()
  const models = [
    storedModel?.trim() ?? '',
    runtimeEnv.geminiModel ?? '',
    DEFAULT_GEMINI_MODEL,
    FALLBACK_GEMINI_MODEL,
  ]

  if (runtimeEnv.isDevelopment) {
    models.push(MOCK_GEMINI_MODEL)
  }

  return [...new Set(models.filter(Boolean))]
}

export { findBinary, resolveSelection }

export async function resolveDefaultBrowsePath() {
  const candidates = [
    path.join(process.env.USERPROFILE ?? process.env.HOME ?? process.cwd(), 'OneDrive'),
    path.join(process.env.USERPROFILE ?? process.env.HOME ?? process.cwd(), 'Desktop'),
    process.env.USERPROFILE ?? process.env.HOME ?? process.cwd(),
    process.cwd(),
  ].filter(Boolean) as string[]

  for (const candidate of candidates) {
    try {
      const stat = await fs.stat(candidate)
      if (stat.isDirectory()) {
        return candidate
      }
    } catch {
      // ignored
    }
  }

  return process.cwd()
}

export async function listPathEntries(rawPath: string) {
  const requestedPath = typeof rawPath === 'string' ? rawPath.trim() : ''
  const targetPath = requestedPath ? normalizePath(requestedPath) : await resolveDefaultBrowsePath()

  const stat = await fs.stat(targetPath)
  if (!stat.isDirectory()) {
    throw new Error('Path is not a directory.')
  }

  const dirEntries = await fs.readdir(targetPath, { withFileTypes: true })
  const entries = dirEntries
    .map(
      (entry) =>
        ({
          name: entry.name,
          path: path.join(targetPath, entry.name),
          type: entry.isDirectory() ? 'dir' : 'file',
        }) as BrowserEntry
    )
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
      return a.name.localeCompare(b.name, 'ru')
    })

  return {
    path: targetPath,
    parentPath: path.dirname(targetPath),
    entries,
  }
}

export async function resolveTranscriptPath(input: {
  sourceFile?: string
  txtPath?: string
  folderPath?: string
}) {
  const sourceFile = typeof input.sourceFile === 'string' ? input.sourceFile.trim() : ''
  const txtPathFromBody = typeof input.txtPath === 'string' ? input.txtPath.trim() : ''
  const folderPath = typeof input.folderPath === 'string' ? input.folderPath.trim() : ''

  if (txtPathFromBody) {
    if (!txtPathFromBody.toLowerCase().endsWith('.txt')) {
      throw new Error('txtPath must point to a .txt file.')
    }
    return normalizePath(txtPathFromBody)
  }

  if (!sourceFile) {
    throw new Error('sourceFile or txtPath is required.')
  }

  if (!isSupportedAudioPath(sourceFile)) {
    throw new Error('sourceFile must point to a .m4a or .opus file.')
  }

  if (sourceFile.includes('\\') || sourceFile.includes('/')) {
    return normalizePath(toTranscriptPath(sourceFile))
  }

  if (!folderPath) {
    throw new Error('folderPath is required when sourceFile is a basename.')
  }

  return path.join(normalizePath(folderPath), toTranscriptPath(sourceFile))
}
