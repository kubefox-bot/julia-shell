import { handleAgentTranscribeStream } from './agent-transcribe-stream'

export async function handleTranscribeStream(
  body: {
    folderPath?: string
    filePath?: string
    filePaths?: string[]
  },
  request: Request,
  agentId: string
) {
  return handleAgentTranscribeStream(body, request, agentId)
}
