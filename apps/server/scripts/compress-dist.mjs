import fs from 'node:fs/promises';
import path from 'node:path';
import { brotliCompress, constants, gzip } from 'node:zlib';
import { promisify } from 'node:util';

const gzipAsync = promisify(gzip);
const brotliCompressAsync = promisify(brotliCompress);

const CLIENT_DIST_DIR = path.join(process.cwd(), 'dist', 'client');
const MIN_SIZE_BYTES = 1024;
const COMPRESSIBLE_EXTENSIONS = new Set([
  '.js',
  '.mjs',
  '.css',
  '.html',
  '.svg',
  '.json',
  '.webmanifest',
  '.txt',
  '.xml'
]);

async function listFiles(rootDir) {
  const queue = [rootDir];
  const files = [];

  while (queue.length > 0) {
    const current = queue.pop();
    const entries = await fs.readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

async function writeIfSmaller(targetPath, compressedBuffer, originalSize) {
  if (compressedBuffer.length >= originalSize) {
    return false;
  }

  await fs.writeFile(targetPath, compressedBuffer);
  return true;
}

async function main() {
  try {
    await fs.access(CLIENT_DIST_DIR);
  } catch {
    console.log('[compress-dist] dist/client not found. Skipping compression step.');
    return;
  }

  const files = await listFiles(CLIENT_DIST_DIR);
  let processed = 0;
  let gzipCreated = 0;
  let brotliCreated = 0;

  for (const filePath of files) {
    if (filePath.endsWith('.gz') || filePath.endsWith('.br')) {
      continue;
    }

    const ext = path.extname(filePath).toLowerCase();
    if (!COMPRESSIBLE_EXTENSIONS.has(ext)) {
      continue;
    }

    const content = await fs.readFile(filePath);
    if (content.length < MIN_SIZE_BYTES) {
      continue;
    }

    processed += 1;

    const [gzBuffer, brBuffer] = await Promise.all([
      gzipAsync(content, { level: 9 }),
      brotliCompressAsync(content, {
        params: {
          [constants.BROTLI_PARAM_QUALITY]: 11,
          [constants.BROTLI_PARAM_LGWIN]: 22
        }
      })
    ]);

    if (await writeIfSmaller(`${filePath}.gz`, gzBuffer, content.length)) {
      gzipCreated += 1;
    }

    if (await writeIfSmaller(`${filePath}.br`, brBuffer, content.length)) {
      brotliCreated += 1;
    }
  }

  console.log(`[compress-dist] processed=${processed}, gzip=${gzipCreated}, brotli=${brotliCreated}`);
}

await main();
