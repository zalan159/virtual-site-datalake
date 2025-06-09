import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import viteCompression from 'vite-plugin-compression'
import { axiosPre } from './src/settings/httpSetting'
import { viteMockServe } from 'vite-plugin-mock'
import monacoEditorPlugin from 'vite-plugin-monaco-editor'

// 内联构建常量，避免导入问题
const prefix = `monaco-editor/esm/vs`
const chunkSizeWarningLimit = 2000
const rollupOptions = {
  output: {
    chunkFileNames: 'static/js/[name]-[hash].js',
    entryFileNames: 'static/js/[name]-[hash].js',
    assetFileNames: (chunkInfo: any) => {
      const ext = '.' + (chunkInfo.name?.split('.').pop() || '')
      if(['.png', '.jpg', '.jpeg'].includes(ext)) {
        return `static/[ext]/[name].[ext]`
      }
      return `static/[ext]/[name]-[hash].[ext]`
    },
    manualChunks: {
      jsonWorker: [`${prefix}/language/json/json.worker`],
      cssWorker: [`${prefix}/language/css/css.worker`],
      htmlWorker: [`${prefix}/language/html/html.worker`],
      tsWorker: [`${prefix}/language/typescript/ts.worker`],
      editorWorker: [`${prefix}/editor/editor.worker`]
    }
  }
}

function pathResolve(dir: string) {
  return resolve(process.cwd(), '.', dir)
}

export default ({ mode }) => defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/goview/' : '/',
  // 路径重定向
  resolve: {
    alias: [
      {
        find: /\/#\//,
        replacement: pathResolve('types')
      },
      {
        find: '@',
        replacement: pathResolve('src')
      },
      {
        find: 'vue-i18n',
        replacement: 'vue-i18n/dist/vue-i18n.cjs.js', //解决i8n警告
      }
    ],
    dedupe: ['vue']
  },
  // 全局 css 注册
  css: {
    preprocessorOptions: {
      scss: {
        javascriptEnabled: true,
        additionalData: `@use "src/styles/common/style.scss" as *;`
      }
    }
  },
  // 开发服务器配置
  server: {
    host: true,
    open: true,
    port: 3001,
    proxy: {
      // 统一的API代理规则 - 将所有/api请求代理到后端并去除/api前缀
      '/api': {
        target: loadEnv(mode, process.cwd()).VITE_DEV_PATH || 'http://127.0.0.1:8000',
        changeOrigin: true,
        ws: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
      }
    }
  },
  plugins: [
    vue(),
    monacoEditorPlugin({
      languageWorkers: ['editorWorkerService', 'typescript', 'json', 'html'],
      customWorkers: [
        {
          label: 'editorWorkerService',
          entry: 'monaco-editor/esm/vs/editor/editor.worker.js'
        }
      ]
    }),
    viteMockServe({
      mockPath: '/src/api/mock',
      // 开发打包开关
      localEnabled: true,
      // 生产打包开关
      prodEnabled: true,
      // 打开后，可以读取 ts 文件模块。 请注意，打开后将无法监视.js 文件
      supportTs: true,
      // 监视文件更改
      watchFiles: true
    }),
    // 压缩
    viteCompression({
      verbose: true,
      disable: false,
      threshold: 10240,
      algorithm: 'gzip',
      ext: '.gz'
    })
  ],
  build: {
    target: 'es2020',
    outDir: '../dist/goview',
    reportCompressedSize: false,
    // minify: 'terser', // 如果需要用terser混淆，可打开这两行
    // terserOptions: {
    //   compress: {
    //     keep_infinity: true,
    //     drop_console: true,
    //     drop_debugger: true
    //   }
    // },
    rollupOptions: rollupOptions,
    chunkSizeWarningLimit: chunkSizeWarningLimit
  }
})
