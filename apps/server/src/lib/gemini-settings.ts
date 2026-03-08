import fs from 'node:fs/promises';
import path from 'node:path';

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
export const FALLBACK_GEMINI_MODEL = 'gemini-2.0-flash';
export const GEMINI_SETTINGS_PATH = path.join(process.cwd(), 'data', 'gemini-settings.json');

const ALLOWED_GEMINI_MODELS = new Set([
	DEFAULT_GEMINI_MODEL,
	FALLBACK_GEMINI_MODEL,
	'gemini-2.5-pro'
]);

export type GeminiSettings = {
	apiKey: string;
	model: string;
};

function normalizeModel(model: unknown) {
	if (typeof model !== 'string') return DEFAULT_GEMINI_MODEL;
	const trimmed = model.trim();
	return ALLOWED_GEMINI_MODELS.has(trimmed) ? trimmed : DEFAULT_GEMINI_MODEL;
}

export async function readGeminiSettings(): Promise<GeminiSettings> {
	try {
		const raw = await fs.readFile(GEMINI_SETTINGS_PATH, 'utf8');
		const parsed = JSON.parse(raw) as Partial<GeminiSettings>;
		return {
			apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey.trim() : '',
			model: normalizeModel(parsed.model)
		};
	} catch {
		return {
			apiKey: '',
			model: DEFAULT_GEMINI_MODEL
		};
	}
}

export async function writeGeminiSettings(next: Partial<GeminiSettings>) {
	const current = await readGeminiSettings();
	const apiKey = typeof next.apiKey === 'string' && next.apiKey.trim()
		? next.apiKey.trim()
		: current.apiKey;
	const model = normalizeModel(next.model ?? current.model);

	await fs.mkdir(path.dirname(GEMINI_SETTINGS_PATH), { recursive: true });
	await fs.writeFile(
		GEMINI_SETTINGS_PATH,
		JSON.stringify({ apiKey, model }, null, 2),
		'utf8'
	);

	return { apiKey, model };
}

export function buildGeminiModelCandidates(primaryModel: string) {
	const unique = new Set<string>();
	for (const model of [normalizeModel(primaryModel), DEFAULT_GEMINI_MODEL, FALLBACK_GEMINI_MODEL]) {
		unique.add(model);
	}
	return [...unique];
}

export function toPublicGeminiSettings(settings: GeminiSettings) {
	return {
		hasApiKey: Boolean(settings.apiKey),
		model: settings.model
	};
}
