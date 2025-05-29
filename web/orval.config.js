// orval.config.js
module.exports = {
    // 你可以定义多个生成器配置，这里我们只定义一个名为 'api' 的
    api: {
      // 输入配置：指定 OpenAPI 规范来源
      input: {
        // target: 'http://localhost:8000/openapi.json', // 替换成你 FastAPI 应用的 openapi.json URL
        // 或者，如果你下载了 openapi.json 文件到本地:
        target: './openapi.json', // 假设文件在项目根目录
      },
      // 输出配置：指定生成代码的位置和方式
      output: {
        // target: './src/api/generated.ts', // 生成代码的目标文件路径（单文件模式）
        target: './src/api/endpoints', // 或者指定一个目录，配合 mode:'tags' 使用
        schemas: './src/api/schemas',   // 可选：将 TS 类型/接口输出到单独目录
        client: 'axios',                // 指定使用 axios 作为 HTTP 客户端 ('fetch' 也可以)
                                        // 如果想用 React Query Hooks: 'react-query'
        mode: 'tags',                   // 按 tag 分割文件，推荐！(如果你不需要分割，可以省略或设为'single')
        clean: true,                    // 可选：每次生成前清理 output.target 和 output.schemas 目录
      },
      // 可选：配置 Hooks (如果 client 设置为 'react-query' 或 'swr')
      hooks: {
         after: '// eslint-disable-next-line\n', // 可选：在生成的 hook 文件顶部添加注释，例如禁用 eslint 检查
      },
      // 可选：配置 Mutator (非常重要，用于自定义请求，例如添加认证头)
      /*
      output: {
         // ... 其他输出配置
         override: {
           mutator: {
             path: './src/api/axiosInstance.ts', // 指向一个包含你的自定义 axios 实例的文件
             name: 'axiosInstance',            // 该文件中导出的 axios 实例的名称
             // 或者，如果是一个函数:
             // path: './src/api/customFetcher.ts',
             // name: 'customFetcher', // 该文件中导出的 fetcher 函数名
           },
         },
      },
      */
       // 可选: 添加之前讨论过的过滤器，如果只需要生成特定 tag
       /*
       input: {
           target: 'http://localhost:8000/openapi.json',
           filters: {
               tags: ['users', 'items'], // 只生成 'users' 和 'items' tag
           }
       },
       */
    },
  };