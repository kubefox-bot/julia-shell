import { createPartFromUri, type GoogleGenAI } from '@google/genai'
import { GEMINI_TRANSCRIBE_MESSAGE, GEMINI_UPLOAD_MIME } from './constants'
import type { UploadedGeminiFile } from './types'

export async function startGeminiStream(
  ai: GoogleGenAI,
  prompt: string,
  uploadedFile: UploadedGeminiFile,
  modelCandidates: string[]
) {
  if (!uploadedFile.uri) {
    throw new Error('Gemini upload did not return a file URI.')
  }

  const contents = [
    {
      role: 'user',
      parts: [
        createPartFromUri(uploadedFile.uri, uploadedFile.mimeType ?? GEMINI_UPLOAD_MIME),
        { text: GEMINI_TRANSCRIBE_MESSAGE }
      ]
    }
  ]

  const errors: string[] = []

  for (const model of modelCandidates) {
    try {
      const response = await ai.models.generateContentStream({
        model,
        config: {
          systemInstruction: prompt
        },
        contents
      })

      return { model, response }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push(`${model}: ${message}`)
    }
  }

  throw new Error(`Gemini did not accept the configured models. ${errors.join(' | ')}`)
}
