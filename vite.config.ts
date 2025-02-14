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
        entry: 'electron/main/index.ts',
        vite: {
          build: {
            outDir: 'dist/electron/main',
            rollupOptions: {
              external: ['electron']
            }
          }
        }
      },
      {
        entry: 'electron/preload/index.ts',
        onstart(options) {
          // Notify the Renderer-Process to reload the page when the Preload-Scripts build is complete, 
          // instead of restarting the entire Electron App.
          options.reload()
        },
        vite: {
          build: {
            outDir: 'dist/electron/preload',
            rollupOptions: {
              external: ['electron']
            }
          }
        }
      },
    ]),
    renderer(),
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
    outDir: 'dist/renderer',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/renderer/mainWindow.html'),
        capture: resolve(__dirname, 'src/renderer/captureWindow.html'),
      },
      external: ['electron'],
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