import path from 'node:path'
import { getDataDir } from '@core/db/shared'
import { transcribeManifest } from '../manifest'

export const TOOLS_ROOT = path.join(process.cwd(), 'tools')
export const TMP_ROOT = path.join(getDataDir(), 'transcribe-tmp')
export const PROMPT_PATH = path.join(process.cwd(), 'Transcript.md')
export const GEMINI_UPLOAD_MIME = 'audio/ogg'
export const GEMINI_TRANSCRIBE_MESSAGE = 'Транскрибируй этот аудиофайл строго по системной инструкции. Верни только итоговую стенограмму.'
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'
export const FALLBACK_GEMINI_MODEL = 'gemini-2.0-flash'
export const MOCK_GEMINI_MODEL = 'mock'
export const SUPPORTED_AUDIO_EXTENSIONS = ['.m4a', '.opus']
export const WIDGET_ID = transcribeManifest.id
export const WIDGET_ENV_NAME = transcribeManifest.envName ?? 'transcribe'
