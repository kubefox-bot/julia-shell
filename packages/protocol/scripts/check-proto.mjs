import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import protobuf from 'protobufjs'

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const protoFile = path.join(rootDir, 'proto', 'agent_control.proto')

const raw = fs.readFileSync(protoFile, 'utf8')
protobuf.loadSync(protoFile)

const hash = crypto.createHash('sha256').update(raw, 'utf8').digest('hex')
console.log(`[protocol] proto ok: ${path.relative(process.cwd(), protoFile)}`)
console.log(`[protocol] sha256: ${hash}`)
