import { UserConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import legacy from '@vitejs/plugin-legacy'
import path from 'path'

const root = path.resolve(__dirname, './src')

const config: UserConfig = {
  root,
  resolve: {
    alias: [{ find: '@', replacement: root }],
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.vue', '.json', '.less', '.css'],
  },
  build: {
    outDir: path.join(__dirname, 'dist'),
    sourcemap: false,
    emptyOutDir: true,
    // assetsDir: './',
  },
  css: {
    preprocessorOptions: {
      less: {
        javascriptEnabled: true,
        modifyVars: {
          'preprocess-custom-color': 'green',
        },
      },
    },
  },
  server: {
    port: +process.env.PORT,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:33001/',
        changeOrigin: true,
      },
    },
  },

  plugins: [
    vue(),
    vueJsx(),
    legacy({
      targets: ['defaults', 'not IE 11'],
    }),
  ],
  optimizeDeps: {
    exclude: ['electron-is-dev', 'electron-store'],
  },
}

module.exports = config
