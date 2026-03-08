import fs from 'node:fs/promises'
import path from 'node:path'
import { access } from 'node:fs/promises'
import type { HostPlatform } from '../../../entities/widget/model/types'
import { DEFAULT_GEMINI_MODEL, FALLBACK_GEMINI_MODEL, MOCK_GEMINI_MODEL, SUPPORTED_AUDIO_EXTENSIONS } from './constants'
import type { BrowserEntry, ResolvedSelection } from './types'

export function toSseEvent(event: string, payload: Record<string, unknown>) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function parseClockToSeconds(value: string) {
  const [hours, minutes, seconds] = value.split(':')
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds)
}

export function escapeConcatPath(filePath: string) {
  return filePath.replace(/'/g, "'\\''")
}

export function normalizePath(inputPath: string) {
  const cleaned = inputPath.trim()
  const platformNative = process.platform === 'win32'
    ? cleaned.replace(/\//g, '\\')
    : cleaned.replace(/\\/g, '/')

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
  const candidates = normalizedPrimary === MOCK_GEMINI_MODEL
    ? [MOCK_GEMINI_MODEL]
    : [normalizedPrimary, DEFAULT_GEMINI_MODEL, FALLBACK_GEMINI_MODEL]

  return [...new Set(candidates)]
}

export function resolveConfiguredModel(storedModel?: string | null) {
  const fromDb = storedModel?.trim()
  const fromEnv = process.env.GEMINI_MODEL?.trim()
  const value = fromDb || fromEnv || DEFAULT_GEMINI_MODEL

  if (value === MOCK_GEMINI_MODEL && !import.meta.env.DEV) {
    return DEFAULT_GEMINI_MODEL
  }

  return value
}

export function buildAvailableModels(storedModel?: string | null) {
  const models = [
    storedModel?.trim() ?? '',
    process.env.GEMINI_MODEL?.trim() ?? '',
    DEFAULT_GEMINI_MODEL,
    FALLBACK_GEMINI_MODEL
  ]

  if (import.meta.env.DEV) {
    models.push(MOCK_GEMINI_MODEL)
  }

  return [...new Set(models.filter(Boolean))]
}

export async function findBinary(searchRoot: string, fileName: string): Promise<string | null> {
  const directCandidate = path.join(searchRoot, fileName)
  try {
    await access(directCandidate)
    return directCandidate
  } catch {
    // ignored
  }

  const pathEntries = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)
  for (const pathEntry of pathEntries) {
    const candidate = path.join(pathEntry, fileName)
    try {
      await access(candidate)
      return candidate
    } catch {
      // ignored
    }
  }

  const stack: string[] = [searchRoot]

  while (stack.length > 0) {
    const current = stack.pop() as string
    let entries: import('node:fs').Dirent[] = []

    try {
      entries = await fs.readdir(current, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name)
      if (entry.isFile() && entry.name.toLowerCase() === fileName.toLowerCase()) {
        return fullPath
      }
      if (entry.isDirectory()) {
        stack.push(fullPath)
      }
    }
  }

  return null
}

export async function resolveSelection(folderPath: string, filePath: string, filePaths: string[]): Promise<ResolvedSelection> {
  const normalizedPaths = filePaths
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean)

  const requestedPaths = normalizedPaths.length > 0 ? normalizedPaths : filePath ? [filePath] : []

  if (requestedPaths.length === 0) {
    if (!folderPath) {
      throw new Error('folderPath or filePaths is required.')
    }

    const resolvedFolder = normalizePath(folderPath)
    const folderStat = await fs.stat(resolvedFolder)
    if (!folderStat.isDirectory()) {
      throw new Error('Selected path is not a folder.')
    }

    const entries = await fs.readdir(resolvedFolder, { withFileTypes: true })
    const firstAudio = entries
      .filter((entry) => entry.isFile() && isSupportedAudioPath(entry.name))
      .map((entry) => path.join(resolvedFolder, entry.name))
      .sort((a, b) => a.localeCompare(b, 'ru'))[0]

    if (!firstAudio) {
      throw new Error('No supported audio files in selected folder.')
    }

    return {
      filePaths: [firstAudio],
      canonicalSourceFile: firstAudio,
      resolvedFolderPath: resolvedFolder
    }
  }

  const validatedPaths: string[] = []
  let resolvedFolderPath = ''

  for (const currentPathRaw of requestedPaths) {
    const currentPath = normalizePath(currentPathRaw)
    const stat = await fs.stat(currentPath)
    if (!stat.isFile()) {
      throw new Error(`Selected file is not valid: ${currentPath}`)
    }
    if (!isSupportedAudioPath(currentPath)) {
      throw new Error(`Selected file must be .m4a or .opus: ${currentPath}`)
    }

    const currentFolder = path.dirname(currentPath)
    if (!resolvedFolderPath) {
      resolvedFolderPath = currentFolder
    } else if (currentFolder.toLowerCase() !== resolvedFolderPath.toLowerCase()) {
      throw new Error('All selected files must be in the same folder.')
    }

    if (!validatedPaths.some((value) => value.toLowerCase() === currentPath.toLowerCase())) {
      validatedPaths.push(currentPath)
    }
  }

  if (validatedPaths.length === 0) {
    throw new Error('No input file selected.')
  }

  return {
    filePaths: validatedPaths,
    canonicalSourceFile: validatedPaths[0],
    resolvedFolderPath
  }
}

export async function resolveDefaultBrowsePath() {
  const candidates = [
    path.join(process.env.USERPROFILE ?? process.env.HOME ?? process.cwd(), 'OneDrive'),
    path.join(process.env.USERPROFILE ?? process.env.HOME ?? process.cwd(), 'Desktop'),
    process.env.USERPROFILE ?? process.env.HOME ?? process.cwd(),
    process.cwd()
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
    .map((entry) => ({
      name: entry.name,
      path: path.join(targetPath, entry.name),
      type: entry.isDirectory() ? 'dir' : 'file'
    } as BrowserEntry))
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
      return a.name.localeCompare(b.name, 'ru')
    })

  return {
    path: targetPath,
    parentPath: path.dirname(targetPath),
    entries
  }
}

export async function resolveTranscriptPath(input: { sourceFile?: string; txtPath?: string; folderPath?: string }) {
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
