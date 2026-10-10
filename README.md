# 个人工具站

基于 Vue 3 的日常工具站，提供站内工具和第三方网站入口。站内工具在浏览器本地处理输入，无需登录；主页支持搜索、分类筛选和桌面 / 手机布局。

主页：[niu-hb.github.io](https://niu-hb.github.io/#/)

## 工具清单

点击工具名称查看详细说明，点击访问地址使用工具。

| 工具（详细说明） | 简要说明 | 访问地址 |
| --- | --- | --- |
| [摘要算法](src/tools/digest/README.md) | 计算文本或文件摘要，支持多种算法 | [`/#/tools/digest`](https://niu-hb.github.io/#/tools/digest) |
| [条形码生成](src/tools/barcode/README.md) | 生成常见条形码，下载 SVG / PNG | [`/#/tools/barcode`](https://niu-hb.github.io/#/tools/barcode) |
| [Cron 表达式生成 / 测试](src/tools/cron/README.md) | 按工具方言生成、校验并预览执行时间 | [`/#/tools/cron`](https://niu-hb.github.io/#/tools/cron) |
| [趣味抽签](src/tools/lottery/README.md) | 多种抽签模式、分组和结果记录 | [`/#/tools/lottery`](https://niu-hb.github.io/#/tools/lottery) |
| [待办事项](src/tools/todo/README.md) | 编辑待办、切换状态并本地保存 | [`/#/tools/todo`](https://niu-hb.github.io/#/tools/todo) |
| [今天吃什么](src/tools/what-to-eat/README.md) | 筛选餐食或自定义菜单，随机抽选 | [`/#/tools/what-to-eat`](https://niu-hb.github.io/#/tools/what-to-eat) |
| [正则表达式测试](src/tools/regex/README.md) | 测试匹配、捕获组与常用示例 | [`/#/tools/regex`](https://niu-hb.github.io/#/tools/regex) |
| [XML 格式化 / 校验](src/tools/xml/README.md) | 格式化、压缩并检查 XML 语法 | [`/#/tools/xml`](https://niu-hb.github.io/#/tools/xml) |
| [HTML 格式化](src/tools/html/README.md) | 格式化 HTML5 文档与片段 | [`/#/tools/html`](https://niu-hb.github.io/#/tools/html) |
| [Markdown 编辑 / 预览](src/tools/markdown/README.md) | 编辑源码、实时预览并手动保存 | [`/#/tools/markdown`](https://niu-hb.github.io/#/tools/markdown) |
| [二维码生成](src/tools/qrcode/README.md) | 设置尺寸与样式，下载 PNG / SVG | [`/#/tools/qrcode`](https://niu-hb.github.io/#/tools/qrcode) |
| [密码生成器](src/tools/password/README.md) | 设置长度与字符类型，随机生成密码 | [`/#/tools/password`](https://niu-hb.github.io/#/tools/password) |
| [JSON 格式化 / 校验](src/tools/json/README.md) | 格式化、压缩并校验 JSON | [`/#/tools/json`](https://niu-hb.github.io/#/tools/json) |
| [时间 / 时间戳](src/tools/time/README.md) | 查看时间，转换秒或毫秒时间戳 | [`/#/tools/time`](https://niu-hb.github.io/#/tools/time) |
| [URL 编解码](src/tools/url/README.md) | 转换完整网址或单个参数值 | [`/#/tools/url`](https://niu-hb.github.io/#/tools/url) |
| [Base64 编解码](src/tools/base64/README.md) | 转换 UTF-8 文本与两种 Base64 格式 | [`/#/tools/base64`](https://niu-hb.github.io/#/tools/base64) |
| [字符统计](src/tools/characters/README.md) | 统计总字符及各类字符数量 | [`/#/tools/characters`](https://niu-hb.github.io/#/tools/characters) |
| [文本对比](src/tools/diff/README.md) | 按行对比，支持合并与左右视图 | [`/#/tools/diff`](https://niu-hb.github.io/#/tools/diff) |
| [田字格生成](src/tools/tian-grid/README.md) | 生成 A4 练习纸，打印或保存 PDF | [`/#/tools/tian-grid`](https://niu-hb.github.io/#/tools/tian-grid) |
| iLovePDF（第三方） | 在线 PDF 合并、拆分与转换等 | [www.ilovepdf.com](https://www.ilovepdf.com/zh-cn) |

站内工具免费使用。第三方网站在新标签页打开，其功能限制与收费规则以对应网站为准。使用本地保存的工具不会跨设备同步；清除网站数据会删除存档。Markdown 外部图片需主动启用加载，第三方图标会访问对应图片网站。

## 本地开发

技术栈：Vue 3、Vite、TypeScript、Vue Router 4、Element Plus、pnpm。Node 版本以 [`.node-version`](.node-version) 为准，pnpm 版本由 [`package.json`](package.json) 的 `packageManager` 固定。

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

使用 Vite 默认开发端口 5173；预览默认端口为 4173。端口仅影响本地访问，GitHub Pages 发布 `dist/` 静态文件，不运行 Vite 服务，因此不受这些端口影响。

验证与预览：

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm lint
pnpm preview
```

`typecheck` 同时运行 `tsc --noEmit` 与 `vue-tsc --noEmit`。Vitest 覆盖工具逻辑、部分页面交互和外链配置校验。

Element Plus 按需导入，依赖版本精确锁定。项目保留严格类型检查；升级组件库时复查 [`src/types/element-plus.d.ts`](src/types/element-plus.d.ts) 和 [`src/env.d.ts`](src/env.d.ts) 中的兼容声明。

## 配置第三方网站

编辑 `src/config/external-tools.json`，当前已收录 iLovePDF，配置集中维护名称、功能介绍、链接和图标。以下仅为配置格式示例，不是已收录网站：

```json
[
  {
    "id": "example",
    "url": "https://example.com",
    "name": "示例网站",
    "icon": "/favicon.svg",
    "description": "一句话介绍这个网站的用途",
    "category": "其他工具",
    "order": 10
  }
]
```

| 字段 | 要求 |
| --- | --- |
| `id` | 必填，唯一的非空标识 |
| `url` | 必填，HTTP/HTTPS 绝对网址，推荐 HTTPS |
| `name` | 必填，显示名称 |
| `icon` | 必填，站内绝对路径（文件放在 `public/`）或 HTTPS 图片网址 |
| `description` | 必填，简短描述 |
| `category` | 必填，主页分类名称 |
| `order` | 可选，有限数字；数值越小越靠前，省略时使用数组索引 |

修改后推送到 `main` 即可重新构建发布。配置校验失败时，主页提示错误并停止展示第三方清单；站内工具仍可使用。配置校验测试用于阻止错误配置发布。

## 添加站内工具

1. 在 `src/tools/<工具标识>/` 新建页面和 `logic.ts`，编写模块 `README.md` 说明用法与限制。
2. 在 `src/tools/registry.ts` 添加名称、描述、分类、路径、图标和懒加载组件。主页与路由共用此注册表。
3. 为处理逻辑补充 Vitest 测试，更新本文件的工具清单、模块说明链接和访问地址，执行全部验证命令。

## 自动发布

工作流：`.github/workflows/deploy.yml`。

1. 在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
2. 将完成的功能推送或合并到 `main`。
3. 在 Actions 查看检查与部署结果。

每次推送到 `main` 都会安装锁定依赖、检查类型、运行测试、构建、lint，然后发布 `dist/`。PR 到 `main` 仅检查；`dev` 分支推送不发布。支持从 Actions 手动触发，手动发布也仅允许 `main`。发布使用 GitHub 提供的令牌，不需要配置个人令牌。

使用 Hash 路由确保 GitHub Pages 上直接访问、刷新工具页正常。当前为用户主页仓库，Vite `base` 为 `/`；若迁移到项目子路径部署，需要同步调整 `base` 和文档地址。

## 目录

```text
src/
  components/   通用文本工作台
  config/       第三方 JSON 配置、校验与测试
  router/       Hash 路由
  tools/        注册表、工具页面、逻辑、测试与模块说明
  views/        首页与未找到页面
  styles/       全局响应式样式
.github/workflows/ 自动检查与发布
```
