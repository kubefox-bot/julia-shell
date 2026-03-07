import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'

const envFiles = ['.env', '.env.local', '.env.infisical.local']

export function loadEnvFiles() {
  for (const fileName of envFiles) {
    const fullPath = path.join(process.cwd(), fileName)
    if (!fs.existsSync(fullPath)) {
      continue
    }

    dotenv.config({
      path: fullPath,
      override: false,
    })
  }
}
