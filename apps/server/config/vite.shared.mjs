import { fileURLToPath } from 'node:url'

const BUILD_MINIFIER_TERSER = 'terser'
const BUILD_MINIFIER_ESBUILD = 'esbuild'

function resolvePath(importMetaUrl, relativePath) {
  return fileURLToPath(new URL(relativePath, importMetaUrl))
}

export function resolveServerAliases(importMetaUrl) {
  return {
    '@': resolvePath(importMetaUrl, './src'),
    '@app': resolvePath(importMetaUrl, './src/app'),
    '@core': resolvePath(importMetaUrl, './src/core'),
    '@passport': resolvePath(importMetaUrl, './src/domains/passport'),
    '@lls': resolvePath(importMetaUrl, './src/domains/llm'),
    '@shared': resolvePath(importMetaUrl, './src/shared'),
  }
}

function resolveBuildMinifier(env = process.env) {
  return env.JULIAAPP_BUILD_MINIFIER === BUILD_MINIFIER_TERSER
    ? BUILD_MINIFIER_TERSER
    : BUILD_MINIFIER_ESBUILD
}

function resolveTerserOptions(minifier) {
  if (minifier !== BUILD_MINIFIER_TERSER) {
    return undefined
  }

  return {
    compress: {
      passes: 2,
      drop_debugger: true,
    },
    format: {
      comments: false,
    },
  }
}

export function resolveServerBuildConfig(env = process.env) {
  const minify = resolveBuildMinifier(env)

  return {
    minify,
    cssMinify: 'lightningcss',
    sourcemap: false,
    reportCompressedSize: false,
    target: 'es2022',
    terserOptions: resolveTerserOptions(minify),
  }
}
