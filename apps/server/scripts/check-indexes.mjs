import fs from 'node:fs'
import path from 'node:path'

const SRC_DIR = path.resolve('src')
const INDEX_FILE_NAME = 'index.ts'
const EMPTY_COUNT = 0

function toPosix(value) {
  return value.split(path.sep).join('/')
}

function isExcluded(relativeDir) {
  return (
    relativeDir === 'pages' ||
    relativeDir.startsWith('pages/') ||
    relativeDir === 'tests' ||
    relativeDir.endsWith('/tests') ||
    relativeDir.includes('/tests/')
  )
}

function hasRuntimeTypeScriptFile(entries) {
  return entries.some((entry) => {
    if (!entry.isFile()) {
      return false
    }

    if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) {
      return false
    }

    return !entry.name.endsWith('.d.ts')
  })
}

function walk(dir, missingDirs) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.isDirectory()) {
      walk(path.join(dir, entry.name), missingDirs)
    }
  }

  const relativeDir = toPosix(path.relative(SRC_DIR, dir))
  if (isExcluded(relativeDir)) {
    return
  }

  if (!hasRuntimeTypeScriptFile(entries)) {
    return
  }

  const hasIndex = entries.some((entry) => entry.isFile() && entry.name === INDEX_FILE_NAME)
  if (!hasIndex) {
    missingDirs.push(relativeDir || '.')
  }
}

function main() {
  const missingDirs = []
  walk(SRC_DIR, missingDirs)

  if (missingDirs.length === EMPTY_COUNT) {
    console.log('[check-indexes] OK')
    return
  }

  console.error('[check-indexes] Missing index.ts in directories:')
  for (const entry of missingDirs) {
    console.error(`- src/${entry}`)
  }

  process.exitCode = 1
}

main()
