import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'

const envFilePath = path.join(process.cwd(), '.env.infisical.local')

let isSecretsInitialized = false

export function initSecrets() {
  if (isSecretsInitialized) {
    return
  }

  if (fs.existsSync(envFilePath)) {
    dotenv.config({
      path: envFilePath,
      override: false,
    })
  }

  isSecretsInitialized = true
}
