import fs from 'node:fs/promises'
import path from 'node:path'
import type { ResolvedSelection } from '../types'
import { SUPPORTED_AUDIO_EXTENSIONS } from '../constants'

function normalizePath(inputPath: string) {
  const cleaned = inputPath.trim()
  const platformNative =
    process.platform === 'win32' ? cleaned.replace(/\//g, '\\') : cleaned.replace(/\\/g, '/')

  return path.resolve(platformNative)
}

function isSupportedAudioPath(filePath: string) {
  const normalized = filePath.toLowerCase()
  return SUPPORTED_AUDIO_EXTENSIONS.some((extension) => normalized.endsWith(extension))
}

function getRequestedPaths(filePath: string, filePaths: string[]) {
  const normalizedPaths = filePaths
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean)

  return normalizedPaths.length > 0 ? normalizedPaths : filePath ? [filePath] : []
}

async function resolveFromFolder(folderPath: string): Promise<ResolvedSelection> {
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
    resolvedFolderPath: resolvedFolder,
  }
}

function assertFileEntry(currentPath: string, stat: import('node:fs').Stats) {
  if (!stat.isFile()) {
    throw new Error(`Selected file is not valid: ${currentPath}`)
  }
  if (!isSupportedAudioPath(currentPath)) {
    throw new Error(`Selected file must be .m4a or .opus: ${currentPath}`)
  }
}

function ensureSameFolder(currentPath: string, resolvedFolderPath: string) {
  const currentFolder = path.dirname(currentPath)
  if (!resolvedFolderPath) {
    return currentFolder
  }
  if (currentFolder.toLowerCase() !== resolvedFolderPath.toLowerCase()) {
    throw new Error('All selected files must be in the same folder.')
  }

  return resolvedFolderPath
}

function pushUniquePath(validatedPaths: string[], currentPath: string) {
  if (!validatedPaths.some((value) => value.toLowerCase() === currentPath.toLowerCase())) {
    validatedPaths.push(currentPath)
  }
}

async function resolveFromRequestedPaths(requestedPaths: string[]): Promise<ResolvedSelection> {
  const validatedPaths: string[] = []
  let resolvedFolderPath = ''

  for (const currentPathRaw of requestedPaths) {
    const currentPath = normalizePath(currentPathRaw)
    const stat = await fs.stat(currentPath)
    assertFileEntry(currentPath, stat)
    resolvedFolderPath = ensureSameFolder(currentPath, resolvedFolderPath)
    pushUniquePath(validatedPaths, currentPath)
  }

  if (validatedPaths.length === 0) {
    throw new Error('No input file selected.')
  }

  return {
    filePaths: validatedPaths,
    canonicalSourceFile: validatedPaths[0],
    resolvedFolderPath,
  }
}

export async function resolveSelection(
  folderPath: string,
  filePath: string,
  filePaths: string[]
): Promise<ResolvedSelection> {
  const requestedPaths = getRequestedPaths(filePath, filePaths)
  if (requestedPaths.length === 0) {
    return resolveFromFolder(folderPath)
  }

  return resolveFromRequestedPaths(requestedPaths)
}
