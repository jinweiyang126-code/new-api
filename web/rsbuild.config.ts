import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig, loadEnv } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'
import { pluginTailwindcss } from '@rsbuild/plugin-tailwindcss'
import { tanstackRouter } from '@tanstack/router-plugin/rspack'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ envMode }) => {
  const env = loadEnv({ mode: envMode, prefixes: ['VITE_'] })
  const serverUrl =
    process.env.VITE_REACT_APP_SERVER_URL ||
    env.rawPublicVars.VITE_REACT_APP_SERVER_URL ||
    'http://localhost:3000'

  const isProd = envMode === 'production'
  const devProxy = Object.fromEntries(
    (['/api', '/mj', '/pg'] as const).map((key) => [
      key,
      { target: serverUrl, changeOrigin: true },
    ])
  ) as Record<string, { target: string; changeOrigin: boolean }>

  return {
    plugins: [pluginReact(), pluginTailwindcss({ optimize: false })],
    // Rsbuild 2: replaces deprecated `performance.chunkSplit` (RSPack 2 aligned)
    // Plan D: isolate heavy vendors for parallel download; never merge all
    // @lobehub/icons into one async mega-chunk (that regressed to ~5MB earlier).
    splitChunks: {
      preset: 'default',
      cacheGroups: {
        'vendor-react': {
          test: /node_modules[\\/](react|react-dom)[\\/]/,
          name: 'vendor-react',
          chunks: 'all',
          priority: 0,
          enforce: true,
        },
        'vendor-ui-primitives': {
          test: /node_modules[\\/](@base-ui|@radix-ui)[\\/]/,
          name: 'vendor-ui-primitives',
          chunks: 'all',
          priority: 0,
          enforce: true,
        },
        'vendor-tanstack': {
          test: /node_modules[\\/]@tanstack[\\/]/,
          name: 'vendor-tanstack',
          chunks: 'all',
          priority: 0,
          enforce: true,
        },
        // Homepage ModelsStrip statically imports these brands. Home is an async
        // route chunk in prod, so use `chunks: 'async'` + fixed name to merge only
        // this short allowlist into one parallel download (not the whole icon set).
        'vendor-lobehub-icons-home': {
          test: /node_modules[\\/]@lobehub[\\/]icons[\\/]es[\\/](Claude|Cline|DeepSeek|Doubao|Gemini|Github|OpenAI|Qwen)[\\/]/,
          name: 'vendor-lobehub-icons-home',
          chunks: 'async',
          priority: 35,
          enforce: true,
          reuseExistingChunk: true,
        },
        // Other icon `import()`s (LobeIcon): name by brand folder so icons stay
        // separate. A single fixed `name` for all icons merges into one ~5MB chunk.
        'vendor-lobehub-icons-async': {
          test: /node_modules[\\/]@lobehub[\\/]icons[\\/]/,
          chunks: 'async',
          priority: 25,
          enforce: true,
          reuseExistingChunk: true,
          name(module: {
            nameForCondition?: () => string | undefined
            identifier?: () => string
          }) {
            const id = module.nameForCondition?.() ?? module.identifier?.() ?? ''
            const match = /[\\/]@lobehub[\\/]icons[\\/]es[\\/]([^\\/]+)/i.exec(id)
            const key = match?.[1]
            if (key && key !== 'components' && key !== 'features' && key !== 'utils') {
              return `lobe-icon-${key}`
            }
            return 'vendor-lobehub-icons-shared'
          },
        },
        // KaTeX only loads via dynamic import in katex-loader (plan C).
        'vendor-katex': {
          test: /node_modules[\\/]katex[\\/]/,
          name: 'vendor-katex',
          chunks: 'async',
          priority: 20,
          enforce: true,
        },
        // Stable names for lazy locale JSON (plan B).
        'locale-json': {
          test: /[\\/]i18n[\\/]locales[\\/].+\.json$/,
          chunks: 'async',
          priority: 30,
          enforce: true,
          name(module: {
            nameForCondition?: () => string | undefined
            identifier?: () => string
          }) {
            const id = module.nameForCondition?.() ?? module.identifier?.() ?? ''
            const match = /locales[\\/]([^\\/?]+)\.json/.exec(id)
            return match?.[1]
              ? `locale-${match[1].replaceAll(/[^a-zA-Z0-9_-]/g, '')}`
              : 'locale-unknown'
          },
        },
      },
    },
    source: {
      entry: {
        index: './src/main.tsx',
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    html: {
      template: './index.html',
      favicon: './public/favicon.e86aaa02.ico',
    },
    server: {
      // '::' so localhost (IPv6 ::1) works on Windows; dual-stack also covers IPv4
      host: '::',
      strictPort: false,
      proxy: devProxy,
    },
    output: {
      // Production optimizations
      minify: isProd,
      target: 'web',
      distPath: {
        root: 'dist',
      },
      // Rely on Rsbuild default legalComments ("linked" → per-chunk *.LICENSE.txt) in all modes.
      // Do not set "none" in production: that strips minifier-preserved third-party notices and
      // extracted license files, which some distributions require for open-source compliance.
    },
    performance: {
      // Remove console in production
      removeConsole: isProd ? ['log'] : false,
      buildCache: false,
    },
    tools: {
      rspack: {
        plugins: [
          tanstackRouter({
            target: 'react',
            // Dev: avoid per-route async chunks (reduces white flash on navigation + faster HMR feedback).
            // Prod: keep route-based code splitting.
            autoCodeSplitting: isProd,
          }),
        ],
      },
    },
  }
})
