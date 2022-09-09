import { defineConfig } from 'vite'
import vueJsx from '@vitejs/plugin-vue-jsx'
import legacy from '@vitejs/plugin-legacy'
import path from 'path'
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'

const root = path.resolve(__dirname, './src')

export default defineConfig({
  root,
  base: '',
  resolve: {
    alias: [{ find: '@', replacement: root }],
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.vue', '.json', '.less', '.css'],
  },
  build: {
    outDir: path.join(__dirname, 'dist'),
    sourcemap: false,
    emptyOutDir: true,
    assetsDir: '',
    minify: 'esbuild',
    reportCompressedSize: false,
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
    port: +process.env.PORT || 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:33001/',
        changeOrigin: true,
      },
    },
  },

  plugins: [
    vueJsx(),
    // legacy({
    //   targets: ['defaults', 'not IE 11'],
    // }),
    Components({
      resolvers: [
        AntDesignVueResolver({
          importStyle: true,
        }),
      ],
    }),
  ],
  optimizeDeps: {
    exclude: [],
  },
})
