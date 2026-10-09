# 个人工具站

一个基于 Vue 3 的日常工具站，集中展示站内工具与第三方网站。站内工具在浏览器本地处理输入，无需登录。

主页：[niu-hb.github.io](https://niu-hb.github.io/#/)

## 支持的工具类型与清单

| 类型 | 工具 | 功能 | 地址 |
| --- | --- | --- | --- |
| 开发工具 | 正则表达式测试 | JavaScript 引擎，匹配高亮、位置、捕获组、常用示例与超时终止 | [打开](https://niu-hb.github.io/#/tools/regex) |
| 开发工具 | XML 格式化 / 校验 | 2/4 空格缩进、压缩、XML 语法检查 | [打开](https://niu-hb.github.io/#/tools/xml) |
| 开发工具 | HTML 格式化 | HTML5 文档及片段，2/4 空格缩进 | [打开](https://niu-hb.github.io/#/tools/html) |
| 文本工具 | Markdown 编辑 / 预览 | 手动编辑、实时预览，CommonMark 基础语法及表格、删除线、任务列表 | [打开](https://niu-hb.github.io/#/tools/markdown) |
| 编码转换 | 二维码生成 | 尺寸、颜色、码点与定位角样式、纠错级别、PNG/SVG 下载 | [打开](https://niu-hb.github.io/#/tools/qrcode) |
| 安全工具 | 密码生成器 | 加密随机数，长度、字符类型、排除易混淆字符 | [打开](https://niu-hb.github.io/#/tools/password) |
| 开发工具 | JSON 格式化 / 校验 | 2/4 空格缩进、压缩、语法校验、复制结果 | [打开](https://niu-hb.github.io/#/tools/json) |
| 时间工具 | 时间 / 时间戳 | 当前本地与 UTC 时间，秒/毫秒时间戳，日期互转 | [打开](https://niu-hb.github.io/#/tools/time) |
| 编码转换 | URL 编解码 | 完整 URL 与参数值两种模式 | [打开](https://niu-hb.github.io/#/tools/url) |
| 编码转换 | Base64 编解码 | UTF-8 文本，标准与 URL-safe Base64 | [打开](https://niu-hb.github.io/#/tools/base64) |
| 文本工具 | 字符统计 | 总字符、中文、英文、数字、普通空格、其他空白、其他字符 | [打开](https://niu-hb.github.io/#/tools/characters) |
| 文本工具 | 文本对比 | 合并 / 左右拆分视图，按行显示差异与双侧行号 | [打开](https://niu-hb.github.io/#/tools/diff) |
| 学习工具 | 田字格生成 | A4 预览，行列、虚线、颜色、描红，打印 / 保存 PDF | [打开](https://niu-hb.github.io/#/tools/tian-grid) |
| PDF 工具（第三方） | iLovePDF | 在线 PDF 合并、拆分、压缩、格式转换、编辑、水印与 OCR | [打开](https://www.ilovepdf.com/zh-cn) |

主页支持名称、描述、分类搜索和分类筛选，适配桌面与手机。

站内工具免费使用。第三方网站在新标签页打开，其功能限制及收费规则以对应网站为准。

### 统计与转换规则

- JSON 使用标准 `JSON.parse` / `JSON.stringify`；大于 JavaScript 安全整数范围的数字可能损失精度，建议用字符串保存。
- 时间来自设备时钟，每秒刷新；时间戳明确选择秒或毫秒，不按位数猜测。日期输入为 `YYYY-MM-DD HH:mm:ss[.SSS]`，按本地时区或 UTC 解释，拒绝无效日期。夏令时重复时段采用浏览器较早时间；秒结果向下取整。
- URL 参数值对应 `encodeURIComponent` / `decodeURIComponent`，完整网址对应 `encodeURI` / `decodeURI`；完整模式保留 `/ ? & = #` 等结构，中文和空格会被编码，纯英文网址可能不变。`+` 不自动转换为空格。
- Base64 仅处理 UTF-8 文本，支持中文与表情；不是加密。URL-safe 编码将 `+` 换成 `-`、`/` 换成 `_`，去掉末尾 `=`；解码接受省略或完整填充。标准解码要求完整填充；解码忽略空白，拒绝非法格式、填充位及无效 UTF-8。
- 文本对比按行计算共同内容；修改表示为删除旧行、新增新行。保留空格、空行和末尾换行差异，统一 CRLF / CR / LF；不是逐字符高亮。两段文本合计上限 200,000 个 UTF-16 单元，行数矩阵上限 1,000,000 个单元，超限提示分段处理。
- 字符统计按 Unicode 码点计数，CRLF 按一个换行计算。中文为 Han 字符，英文为 A–Z/a–z，数字为 0–9，普通空格为半角空格；其他空白含换行、制表符和全角空格。分类互斥，组合表情可能包含多个码点。

### 田字格生成与打印

田字格参考提供的 A4 生成器：实时更新预览，每行输入对应一行格子，空文本生成空白纸。支持 1–20 行、1–15 列，文字按 Unicode 码点放入方格；超出行列时明确提示未显示内容。描红模式使用浅灰文字和虚线。打印使用 A4、100% 缩放、关闭页眉页脚，可在浏览器打印对话框保存 PDF；字体取决于设备是否安装楷体。一次生成一页。

### 新增工具规则与限制

- 正则采用当前浏览器的 JavaScript 引擎，表达式无需两侧 `/`；支持 g/i/m/s/u/y，位置按从 0 开始的 UTF-16 单元计算。常用示例通过页面内可展开的按钮列表选择，可随页面滚动。表达式上限 10,000 字符、文本上限 200,000 字符，最多展示 1,000 项；独立 Worker 超过 2 秒会终止。示例中的邮箱、网址用于常见提取，不替代完整业务校验。
- XML 检查格式是否良好，不做 XSD/DTD 校验，不接受 DOCTYPE。格式化/压缩保留注释、CDATA、混合文本及 `xml:space="preserve"`；含文本的子树保持原布局，压缩不保证去掉所有换行。最多 200,000 字符、100 层嵌套。
- HTML5 与 XML 的标签、属性规则不同，因此使用单独页面。HTML 格式化按元素默认显示方式换行缩进，保留 `pre` 与行内文本的有意义空白；自定义 CSS 改变元素显示方式时需检查空白效果。只处理源码，不执行脚本或加载资源；内嵌 JavaScript/CSS 保留，不处理 Vue/JSX 模板。最多 200,000 字符，格式化不等于完整 HTML 规范校验。
- Markdown 支持源码手动编辑与实时预览，桌面双栏、手机切换。按 CommonMark 基础规则处理并支持表格、删除线、任务列表，内置示例只展示已支持的语法；原始 HTML 显示为文本，外部链接和图片只允许 HTTP/HTTPS，外部图片默认不加载，主动启用才访问图片地址。暂不提供所见即所得编辑、代码着色、数学公式、Mermaid、脚注或自动标题锚点；最多 100,000 字符，不自动保存源码。
- 二维码整体为常规方形，支持方形/圆点/圆角码点及定位角样式。尺寸 128–1024 px，内容最多 2,000 UTF-8 字节；纠错越高容量越低。保留至少四模块留白，提示低对比颜色；复杂内容建议增大尺寸，导出后实际扫码确认。PNG/SVG 下载不访问输入的网址。
- 密码长度 1–128，选中类型至少各出现一次，长度不能小于类型数量。符号仅使用 `!@#$%^&*_-`，不含引号、括号、斜杠或空格；不同网站允许的符号范围可能不同，应按目标网站规则选择是否启用符号。使用 `crypto.getRandomValues`、拒绝取模偏差并整体拒绝采样；可排除 `I l 1 O 0 o`。密码仅在页面内存显示，修改设置清空旧结果，不保存、不上传。

功能依赖均精确锁定并按工具路由懒加载：XML 使用浏览器标准 `DOMParser`/`XMLSerializer`，HTML 使用 Prettier 浏览器版及 HTML 插件，Markdown 使用 `markdown-it` 和任务列表插件并通过 Vue 节点渲染，二维码使用 `qr-code-styling`。二维码选择 1.6.0，以避免较新版本声明引入 Node 原生 canvas/jsdom 类型依赖，显式转换 UTF-8 字节以支持中文与表情；保留严格类型检查。新增工具测试使用 jsdom 验证浏览器 XML 解析行为。

## 本地开发

技术栈：Vue 3、Vite、TypeScript、Vue Router 4、Element Plus、pnpm。使用 `.node-version` 中的 Node 22.23.1，pnpm 版本由 `package.json` 的 `packageManager` 固定。

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

`typecheck` 同时运行 `tsc --noEmit` 与 `vue-tsc --noEmit`。Vitest 覆盖核心工具逻辑和外链配置校验。

Element Plus 固定为 2.11.8。`@types/web-bluetooth`、`@types/w3c-screen-orientation`、`csstype`、`type-fest` 和与 Vue 同版本的 `@vue/runtime-core` 用于组件库声明检查；`src/types/element-plus.d.ts` 将旧类型名称映射为 Vue/CSS 标准类型并补齐 Vue 标准 JSX 属性，`src/env.d.ts` 将旧屏幕方向类型名称映射到标准声明。项目保留严格检查，不跳过依赖声明检查。升级组件库时同步复查这些兼容声明是否仍需要。

## 配置第三方网站

编辑 `src/config/external-tools.json`，当前已收录 iLovePDF，名称、功能介绍及图标来自其官方网站。以下仅为配置格式示例，不是已收录网站：

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

修改后推送到 `main` 即可重新构建发布。配置错误会在主页提示，测试也会阻止错误配置发布。第三方网站在新标签页打开；外部图标加载会访问对应图片网站。

## 添加站内工具

1. 在 `src/tools/<工具标识>/` 新建页面和 `logic.ts`。
2. 在 `src/tools/registry.ts` 添加名称、描述、分类、路径、图标和懒加载组件。主页与路由共用此注册表。
3. 为处理逻辑补充 Vitest 测试，更新本文件的清单，执行全部验证命令。

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
  tools/        注册表、工具页面、处理逻辑与测试
  views/        首页与未找到页面
  styles/       全局响应式样式
.github/workflows/ 自动检查与发布
```
