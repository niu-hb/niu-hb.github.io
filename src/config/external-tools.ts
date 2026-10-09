export interface ExternalTool {
  id: string
  url: string
  name: string
  icon: string
  description: string
  category: string
  order: number
}

/** 判断外链是否为 HTTP(S) 绝对网址；url 为配置值，返回是否允许导航。 */
export function isWebUrl(url: string): boolean {
  try { return ['https:', 'http:'].includes(new URL(url).protocol) }
  catch { return false }
}

/** 判断图标是否为站内绝对路径或 HTTPS 图片；icon 为配置值，返回是否允许展示。 */
export function isSafeIcon(icon: string): boolean {
  return /^\/(?!\/)[^\\]*$/.test(icon) || (isWebUrl(icon) && new URL(icon).protocol === 'https:')
}

/** 校验外链配置并排序；value 为 JSON 数据，返回合法清单，配置有误时抛出可定位的错误。 */
export function parseExternalTools(value: unknown): ExternalTool[] {
  if (!Array.isArray(value)) throw new Error('外链配置必须为数组')
  const ids = new Set<string>()
  return value.map((item: unknown, index) => {
    if (typeof item !== 'object' || item === null) throw new Error(`第 ${index + 1} 项必须为对象`)
    const row = item as Record<string, unknown>
    for (const field of ['id', 'url', 'name', 'icon', 'description', 'category']) {
      if (typeof row[field] !== 'string' || !(row[field] as string).trim()) throw new Error(`第 ${index + 1} 项缺少有效的 ${field}`)
    }
    const tool = row as unknown as ExternalTool
    if (!isWebUrl(tool.url)) throw new Error(`第 ${index + 1} 项网址必须使用 HTTP 或 HTTPS`)
    if (!isSafeIcon(tool.icon)) throw new Error(`第 ${index + 1} 项图标必须为站内路径或 HTTPS 图片`)
    if (ids.has(tool.id)) throw new Error(`外链 id 重复：${tool.id}`)
    if (tool.order !== undefined && (typeof tool.order !== 'number' || !Number.isFinite(tool.order))) throw new Error(`第 ${index + 1} 项 order 必须是有限数字`)
    ids.add(tool.id)
    return { ...tool, order: tool.order ?? index }
  }).sort((a, b) => a.order - b.order)
}
