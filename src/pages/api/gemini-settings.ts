import type { APIRoute } from 'astro';
import {
	DEFAULT_GEMINI_MODEL,
	readGeminiSettings,
	toPublicGeminiSettings,
	writeGeminiSettings
} from '../../lib/gemini-settings';

export const GET: APIRoute = async () => {
	const settings = await readGeminiSettings();
	return new Response(JSON.stringify(toPublicGeminiSettings(settings)), {
		status: 200,
		headers: { 'Content-Type': 'application/json' }
	});
};

export const POST: APIRoute = async ({ request }) => {
	const body = await request.json().catch(() => ({}));
	const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
	const model = typeof body.model === 'string' && body.model.trim()
		? body.model.trim()
		: DEFAULT_GEMINI_MODEL;

	const settings = await writeGeminiSettings({
		apiKey: apiKey || undefined,
		model
	});

	return new Response(JSON.stringify({
		message: 'Gemini settings saved.',
		...toPublicGeminiSettings(settings)
	}), {
		status: 200,
		headers: { 'Content-Type': 'application/json' }
	});
};
