import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { brotliCompress, constants, gzip } from 'node:zlib';
import { promisify } from 'node:util';

const gzipAsync = promisify(gzip);
const brotliCompressAsync = promisify(brotliCompress);

const CLIENT_DIST_DIR = path.join(process.cwd(), 'dist', 'client');
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

const DEFAULT_MIN_SIZE_BYTES = 1024;
const DEFAULT_GZIP_LEVEL = 8;
const DEFAULT_BROTLI_QUALITY = 9;
const DEFAULT_BROTLI_WINDOW = 22;
const MAX_DEFAULT_CONCURRENCY = 8;
const DEFAULT_CONCURRENCY = Math.max(1, Math.min(os.cpus().length, MAX_DEFAULT_CONCURRENCY));

function parseNumericEnv(name, fallback) {
  const rawValue = process.env[name];
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isCompressionEnabled() {
  const raw = process.env.JULIAAPP_BUILD_COMPRESS;
  if (!raw) {
    return true;
  }

  return raw !== '0' && raw.toLowerCase() !== 'false';
}

const buildCompressionConfig = {
  enabled: isCompressionEnabled(),
  minSizeBytes: parseNumericEnv('JULIAAPP_BUILD_COMPRESS_MIN_SIZE_BYTES', DEFAULT_MIN_SIZE_BYTES),
  gzipLevel: parseNumericEnv('JULIAAPP_BUILD_COMPRESS_GZIP_LEVEL', DEFAULT_GZIP_LEVEL),
  brotliQuality: parseNumericEnv('JULIAAPP_BUILD_COMPRESS_BROTLI_QUALITY', DEFAULT_BROTLI_QUALITY),
  brotliWindow: parseNumericEnv('JULIAAPP_BUILD_COMPRESS_BROTLI_WINDOW', DEFAULT_BROTLI_WINDOW),
  concurrency: Math.max(1, parseNumericEnv('JULIAAPP_BUILD_COMPRESS_CONCURRENCY', DEFAULT_CONCURRENCY))
};

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

async function processFile(filePath) {
  if (filePath.endsWith('.gz') || filePath.endsWith('.br')) {
    return { processed: 0, gzipCreated: 0, brotliCreated: 0 };
  }

  const ext = path.extname(filePath).toLowerCase();
  if (!COMPRESSIBLE_EXTENSIONS.has(ext)) {
    return { processed: 0, gzipCreated: 0, brotliCreated: 0 };
  }

  const content = await fs.readFile(filePath);
  if (content.length < buildCompressionConfig.minSizeBytes) {
    return { processed: 0, gzipCreated: 0, brotliCreated: 0 };
  }

  const [gzBuffer, brBuffer] = await Promise.all([
    gzipAsync(content, { level: buildCompressionConfig.gzipLevel }),
    brotliCompressAsync(content, {
      params: {
        [constants.BROTLI_PARAM_QUALITY]: buildCompressionConfig.brotliQuality,
        [constants.BROTLI_PARAM_LGWIN]: buildCompressionConfig.brotliWindow
      }
    })
  ]);

  const gzipCreated = (await writeIfSmaller(`${filePath}.gz`, gzBuffer, content.length)) ? 1 : 0;
  const brotliCreated = (await writeIfSmaller(`${filePath}.br`, brBuffer, content.length)) ? 1 : 0;

  return { processed: 1, gzipCreated, brotliCreated };
}

async function processFilesWithConcurrency(filePaths) {
  const workers = Array.from({ length: Math.min(buildCompressionConfig.concurrency, filePaths.length) }, async (_, workerIndex) => {
    let processed = 0;
    let gzipCreated = 0;
    let brotliCreated = 0;

    for (let index = workerIndex; index < filePaths.length; index += buildCompressionConfig.concurrency) {
      const result = await processFile(filePaths[index]);
      processed += result.processed;
      gzipCreated += result.gzipCreated;
      brotliCreated += result.brotliCreated;
    }

    return { processed, gzipCreated, brotliCreated };
  });

  const results = await Promise.all(workers);
  return results.reduce(
    (accumulator, entry) => ({
      processed: accumulator.processed + entry.processed,
      gzipCreated: accumulator.gzipCreated + entry.gzipCreated,
      brotliCreated: accumulator.brotliCreated + entry.brotliCreated
    }),
    { processed: 0, gzipCreated: 0, brotliCreated: 0 }
  );
}

async function main() {
  if (!buildCompressionConfig.enabled) {
    console.log('[compress-dist] disabled via JULIAAPP_BUILD_COMPRESS. Skipping compression step.');
    return;
  }

  try {
    await fs.access(CLIENT_DIST_DIR);
  } catch {
    console.log('[compress-dist] dist/client not found. Skipping compression step.');
    return;
  }

  const files = await listFiles(CLIENT_DIST_DIR);
  const { processed, gzipCreated, brotliCreated } = await processFilesWithConcurrency(files);

  console.log(
    `[compress-dist] processed=${processed}, gzip=${gzipCreated}, brotli=${brotliCreated}, concurrency=${buildCompressionConfig.concurrency}`
  );
}

await main();
