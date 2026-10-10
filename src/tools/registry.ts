import type { Component } from 'vue'

export interface InternalTool {
  id: string
  name: string
  icon: string
  description: string
  category: string
  path: string
  component: () => Promise<{ default: Component }>
}

export const internalTools: InternalTool[] = [
  {
    id: 'digest', name: '摘要算法', icon: '#', category: '开发工具',
    description: '计算文本或文件的 MD、SHA、BLAKE、SM3 等摘要，支持多算法和校验值复制。',
    path: '/tools/digest', component: () => import('./digest/DigestTool.vue'),
  },
  {
    id: 'barcode', name: '条形码生成', icon: '▥', category: '编码转换',
    description: '生成 CODE128、EAN、UPC 等条形码，调整尺寸，下载 SVG 或 PNG。',
    path: '/tools/barcode', component: () => import('./barcode/BarcodeTool.vue'),
  },
  {
    id: 'cron', name: 'Cron 表达式生成 / 测试', icon: '⏱', category: '开发工具',
    description: '按 Linux、node-cron、Spring、Quartz 方言生成和校验 5/6/7 段表达式，预览执行时间。',
    path: '/tools/cron', component: () => import('./cron/CronTool.vue'),
  },
  {
    id: 'lottery', name: '趣味抽签', icon: '✦', category: '趣味工具',
    description: '转盘、翻牌、滚动与签筒抽选，分组维护项目，设置数量与重复规则，按顺序记录结果。',
    path: '/tools/lottery', component: () => import('./lottery/LotteryTool.vue'),
  },
  {
    id: 'todo', name: '待办事项', icon: '✓', category: '生活工具',
    description: '录入与编辑待办，按状态配色，一键切换、筛选与删除，自动本地保存。',
    path: '/tools/todo', component: () => import('./todo/TodoTool.vue'),
  },
  {
    id: 'what-to-eat', name: '今天吃什么', icon: '♨', category: '趣味工具',
    description: '按口味、地区和类别筛选餐食，添加自己的菜单，让随机抽选决定吃什么。',
    path: '/tools/what-to-eat', component: () => import('./what-to-eat/WhatToEatTool.vue'),
  },
  {
    id: 'regex', name: '正则表达式测试', icon: '.*', category: '开发工具',
    description: '使用 JavaScript 引擎测试正则，查看匹配、捕获组与常用示例。',
    path: '/tools/regex', component: () => import('./regex/RegexTool.vue'),
  },
  {
    id: 'xml', name: 'XML 格式化 / 校验', icon: '</>', category: '开发工具',
    description: '格式化、压缩和检查 XML 语法，保留混合文本与注释。',
    path: '/tools/xml', component: () => import('./xml/XmlTool.vue'),
  },
  {
    id: 'html', name: 'HTML 格式化', icon: 'H5', category: '开发工具',
    description: '格式化 HTML5 文档与片段，支持 2 或 4 空格缩进。',
    path: '/tools/html', component: () => import('./html/HtmlTool.vue'),
  },
  {
    id: 'markdown', name: 'Markdown 编辑 / 预览', icon: 'M↓', category: '文本工具',
    description: '手动编辑 Markdown 并实时预览，支持标准语法与表格、任务列表。',
    path: '/tools/markdown', component: () => import('./markdown/MarkdownTool.vue'),
  },
  {
    id: 'qrcode', name: '二维码生成', icon: '▦', category: '编码转换',
    description: '生成二维码，设置尺寸、颜色和码点形状，下载 PNG 或 SVG。',
    path: '/tools/qrcode', component: () => import('./qrcode/QrcodeTool.vue'),
  },
  {
    id: 'password', name: '密码生成器', icon: '※', category: '安全工具',
    description: '通过加密随机数生成密码，可设置长度、字符类型和排除易混淆字符。',
    path: '/tools/password', component: () => import('./password/PasswordTool.vue'),
  },
  {
    id: 'json', name: 'JSON 格式化 / 校验', icon: '{ }', category: '开发工具',
    description: '格式化、压缩和校验 JSON，支持 2 或 4 空格缩进。',
    path: '/tools/json', component: () => import('./json/JsonTool.vue'),
  },
  {
    id: 'time', name: '时间 / 时间戳', icon: '◷', category: '时间工具',
    description: '查看本地与 UTC 时间，转换秒或毫秒时间戳。',
    path: '/tools/time', component: () => import('./time/TimeTool.vue'),
  },
  {
    id: 'url', name: 'URL 编解码', icon: '↗', category: '编码转换',
    description: '编码或解码完整网址与单个参数值，处理中文和特殊字符。',
    path: '/tools/url', component: () => import('./url/UrlTool.vue'),
  },
  {
    id: 'base64', name: 'Base64 编解码', icon: '64', category: '编码转换',
    description: '转换 UTF-8 文本与 Base64，支持标准和 URL-safe 模式。',
    path: '/tools/base64', component: () => import('./base64/Base64Tool.vue'),
  },
  {
    id: 'characters', name: '字符统计', icon: 'Aa', category: '文本工具',
    description: '实时统计总字符及中文、英文、数字、空格等分类数量。',
    path: '/tools/characters', component: () => import('./characters/CharactersTool.vue'),
  },
  {
    id: 'diff', name: '文本对比', icon: '±', category: '文本工具',
    description: '按行比较两段文本，支持合并与左右拆分视图。',
    path: '/tools/diff', component: () => import('./diff/DiffTool.vue'),
  },
  {
    id: 'tian-grid', name: '田字格生成', icon: '田', category: '学习工具',
    description: '生成一页 A4 田字格练习纸，支持描红、打印和保存 PDF。',
    path: '/tools/tian-grid', component: () => import('./tian-grid/TianGridTool.vue'),
  },
]
