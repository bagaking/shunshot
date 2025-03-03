import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  const isServe = command === 'serve'
  const isBuild = command === 'build'
  const sourcemap = isServe || !!process.env.VSCODE_DEBUG

  return {
    plugins: [
      react(),
      electron([
        {
          // Main-Process entry file of the Electron App.
          entry: 'src/main/index.ts',
          vite: {
            build: {
              outDir: 'dist/main',
              sourcemap,
              minify: isBuild,
              rollupOptions: {
                external: [
                  'electron',
                  'electron-store',
                  'electron-devtools-installer',
                  'ajv',
                  ...Object.keys(require('./package.json').dependencies || {})
                ]
              }
            }
          }
        },
        {
          entry: 'src/preload/index.ts',
          onstart(options) {
            // Notify the Renderer-Process to reload the page when the Preload-Scripts build is complete, 
            // instead of restarting the entire Electron App.
            options.reload()
          },
          vite: {
            build: {
              outDir: 'dist/preload',
              sourcemap,
              minify: isBuild,
              rollupOptions: {
                external: [
                  'electron',
                  ...Object.keys(require('./package.json').dependencies || {})
                ]
              }
            }
          }
        },
      ]),
      renderer({
        resolve: {
          electron: { type: 'cjs' }
        }
      }),
    ],
    css: {
      postcss: {
        plugins: [
          require('tailwindcss'),
          require('autoprefixer'),
        ],
      },
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
      conditions: ['node', 'import', 'module', 'default'],
    },
    build: {
      minify: true,
      outDir: 'dist',
      sourcemap,
      assetsDir: '',
      rollupOptions: {
        input: {
          mainWindow: resolve(__dirname, 'src/renderer/mainWindow.html'),
          captureWindow: resolve(__dirname, 'src/renderer/captureWindow.html'),
          settingsWindow: resolve(__dirname, 'src/renderer/settingsWindow.html'),
          mainWindowJs: resolve(__dirname, 'src/renderer/mainWindow.tsx'),
          captureWindowJs: resolve(__dirname, 'src/renderer/captureWindow.tsx'),
          settingsWindowJs: resolve(__dirname, 'src/renderer/settingsWindow.tsx')
        },
        output: {
          dir: 'dist',
          entryFileNames: 'src/renderer/[name].js',
          chunkFileNames: 'src/renderer/chunks/[name]-[hash].js',
          assetFileNames: 'src/renderer/assets/[name]-[hash][extname]',
          inlineDynamicImports: false,
          manualChunks(id) {
            if (id.includes('node_modules')) {
              return 'vendor';
            }
          }
        },
        external: [
          'electron',
          'electron-store',
          ...Object.keys(require('./package.json').dependencies || {})
        ]
      },
      commonjsOptions: {
        include: [/node_modules/],
        transformMixedEsModules: true,
      },
    },
    server: {
      port: 5190,
      strictPort: true,
      open: false,
    },
    root: process.cwd(),
    publicDir: 'public',
    base: './',
    optimizeDeps: {
      include: [
        'react', 
        'react-dom',
        '@tanstack/react-query',
        'react-router-dom',
      ],
      exclude: ['electron']
    }
  }
}) 