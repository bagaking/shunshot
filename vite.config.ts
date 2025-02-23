import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        // Main-Process entry file of the Electron App.
        entry: 'src/main/index.ts',
        vite: {
          build: {
            outDir: 'dist/main',
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
        electron: { type: 'esm' }
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
    rollupOptions: {
      input: {
        mainWindow: resolve(__dirname, 'src/renderer/mainWindow.html'),
        captureWindow: resolve(__dirname, 'src/renderer/captureWindow.html'),
        settingsWindow: resolve(__dirname, 'src/renderer/settingsWindow.html')
      },
      output: {
        dir: 'dist'
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
    port: 5173,
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
}) 