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
