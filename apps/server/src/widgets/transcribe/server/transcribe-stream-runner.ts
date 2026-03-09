import { appendTranscribeOutboxEvent, failTranscribeJob } from '@core/db/transcribe-repository'
import { MOCK_GEMINI_MODEL, WIDGET_ID } from './constants'
import { createJobContext, prepareAudio } from './transcribe-stream-job'
import { cleanupArtifacts, handleGemini, handleMock } from './transcribe-stream-modes'
import type { RunTranscribeStreamInput, TempArtifacts } from './transcribe-stream-types'

export async function runTranscribeStream(input: RunTranscribeStreamInput) {
  let jobId = ''
  const runtimeInput: RunTranscribeStreamInput = {
    ...input,
    setJobId: (id) => {
      jobId = id
      input.setJobId(id)
    },
  }
  const artifacts: TempArtifacts = {
    mergedAudioPath: '',
    concatListPath: '',
    convertedAudioPath: '',
    uploadedFile: null,
  }

  try {
    const jobContext = await createJobContext(runtimeInput)
    const preparedAudio = await prepareAudio(runtimeInput, jobContext)
    artifacts.mergedAudioPath = preparedAudio.mergedAudioPath
    artifacts.concatListPath = preparedAudio.concatListPath
    artifacts.convertedAudioPath = preparedAudio.convertedAudioPath

    if (runtimeInput.runtime.isAborted()) {
      return
    }

    if (runtimeInput.selectedModel === MOCK_GEMINI_MODEL) {
      await handleMock(runtimeInput, jobContext, artifacts.convertedAudioPath)
      return
    }

    await handleGemini(runtimeInput, jobContext, artifacts)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Transcription failed.'
    if (jobId) {
      failTranscribeJob(jobId, message)
    }
    appendTranscribeOutboxEvent({
      agentId: input.agentId,
      widgetId: WIDGET_ID,
      jobId: jobId || null,
      eventType: 'job_failed',
      state: 'failed',
      payload: { message },
    })
    if (!input.runtime.isAborted()) {
      input.runtime.send('error', { message, jobId })
    }
  } finally {
    await cleanupArtifacts(artifacts, input.apiKey)
    input.runtime.close()
  }
}
