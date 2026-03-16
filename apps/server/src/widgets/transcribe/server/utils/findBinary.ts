import fs, { access } from 'node:fs/promises'
import path from 'node:path'

async function canAccess(filePath: string) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

async function findInPathEntries(fileName: string) {
  const pathEntries = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)
  for (const pathEntry of pathEntries) {
    const candidate = path.join(pathEntry, fileName)
    if (await canAccess(candidate)) {
      return candidate
    }
  }

  return null
}

async function findRecursively(searchRoot: string, fileName: string) {
  const stack: string[] = [searchRoot]
  const expectedName = fileName.toLowerCase()

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
      if (entry.isFile() && entry.name.toLowerCase() === expectedName) {
        return fullPath
      }
      if (entry.isDirectory()) {
        stack.push(fullPath)
      }
    }
  }

  return null
}

export async function findBinary(searchRoot: string, fileName: string): Promise<string | null> {
  const directCandidate = path.join(searchRoot, fileName)
  if (await canAccess(directCandidate)) {
    return directCandidate
  }

  const pathCandidate = await findInPathEntries(fileName)
  if (pathCandidate) {
    return pathCandidate
  }

  return findRecursively(searchRoot, fileName)
}
