import type { APIRoute } from 'astro';
import fs from 'node:fs/promises';
import path from 'node:path';

export const POST: APIRoute = async ({ request }) => {
	const body = await request.json().catch(() => ({}));
	const sourceFile = typeof body.sourceFile === 'string' ? body.sourceFile.trim() : '';
	const txtPathFromBody = typeof body.txtPath === 'string' ? body.txtPath.trim() : '';

	if (!sourceFile && !txtPathFromBody) {
		return new Response(JSON.stringify({ error: 'sourceFile or txtPath is required.' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	if (sourceFile && !sourceFile.toLowerCase().endsWith('.m4a')) {
		return new Response(JSON.stringify({ error: 'sourceFile must point to a .m4a file.' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	if (txtPathFromBody && !txtPathFromBody.toLowerCase().endsWith('.txt')) {
		return new Response(JSON.stringify({ error: 'txtPath must point to a .txt file.' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const txtPath = txtPathFromBody || sourceFile.replace(/\.m4a$/i, '.txt');

	try {
		const stat = await fs.stat(txtPath);
		if (!stat.isFile()) {
			throw new Error('Transcript txt path is not a file.');
		}

		const transcript = await fs.readFile(txtPath, 'utf8');
		return new Response(JSON.stringify({
			sourceFile: sourceFile || null,
			txtPath,
			transcript
		}), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch {
		return new Response(JSON.stringify({
			error: `Не найден файл стенограммы: ${path.basename(txtPath)}`
		}), {
			status: 404,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
