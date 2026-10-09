export interface RegexMatch {
  text: string
  index: number
  groups: (string | undefined)[]
  namedGroups: Record<string, string | undefined>
}

export const regexExamples = [
  { name: '整数', pattern: '-?\\d+', flags: 'g', text: '数量：12，余额：-35' },
  { name: '中文', pattern: '\\p{Script=Han}+', flags: 'gu', text: 'Hello 世界，𠮷野' },
  { name: '邮箱（常用简化规则）', pattern: '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}', flags: 'g', text: '联系：demo@example.com' },
  { name: '日期与捕获组（不校验日历）', pattern: '(?<year>\\d{4})-(?<month>\\d{2})-(?<day>\\d{2})', flags: 'g', text: '日期：2026-10-09' },
  { name: 'HTTP/HTTPS 地址（简化规则）', pattern: 'https?://[^\\s<>]+', flags: 'gi', text: '访问 https://example.com/path?q=1' },
  { name: '小数', pattern: '(?<![\\w.])-?\\d+\\.\\d+(?![\\w.])', flags: 'g', text: '价格：12.50，温度：-3.25，整数：8' },
  { name: '英文字母单词', pattern: '\\b[A-Za-z]+\\b', flags: 'g', text: 'Hello 世界，JavaScript regex test 123' },
  { name: 'IPv4 地址', pattern: '(?<![\\d.])(?:25[0-5]|2[0-4]\\d|1\\d{2}|[1-9]?\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d{2}|[1-9]?\\d)){3}(?![\\d.])', flags: 'g', text: '示例地址：192.0.2.1、203.0.113.10；无效：256.1.1.1' },
  { name: '十六进制颜色', pattern: '#(?:[\\da-f]{6}|[\\da-f]{3})(?![\\da-f])\\b', flags: 'gi', text: '颜色：#205c46、#FFF、#a1b2c3；无效：#12、#12345' },
  { name: '24 小时时间（HH:mm）', pattern: '(?<![\\d:])(?:[01]\\d|2[0-3]):[0-5]\\d(?![\\d:])', flags: 'g', text: '开始 09:30，结束 23:59；无效 24:00、12:60' },
  { name: '空白字符', pattern: '\\s+', flags: 'g', text: '普通空格 制表符\t换行\n全角空格　结束' },
  { name: '重复单词（忽略大小写）', pattern: '\\b([A-Za-z]+)\\s+\\1\\b', flags: 'gi', text: 'This this is a test test. Hello hello!' },
  { name: '行首与行尾（多行模式）', pattern: '^TODO:.*$', flags: 'gm', text: 'TODO: 补充测试\n已完成：页面布局\nTODO: 更新说明' },
]

/** 使用 JavaScript 引擎匹配；参数为表达式、标志和文本，返回匹配及截断状态；调用方必须在 Worker 中执行。 */
export function matchRegex(pattern: string, flags: string, text: string): { matches: RegexMatch[]; truncated: boolean } {
  if (pattern.length > 10000 || text.length > 200000) throw new Error('表达式最多 10,000 字符，文本最多 200,000 字符')
  if (!/^[gimsuy]*$/.test(flags) || new Set(flags).size !== flags.length) throw new Error('匹配标志无效或重复')
  const regex = new RegExp(pattern, flags)
  const matches: RegexMatch[] = []
  let result: RegExpExecArray | null
  while ((result = regex.exec(text)) !== null) {
    if (matches.length === 1000) return { matches, truncated: true }
    matches.push({ text: result[0], index: result.index, groups: result.slice(1), namedGroups: { ...result.groups } })
    if (!regex.global && !regex.sticky) break
    // 空匹配必须按 Unicode 模式推进，否则会死循环或落入代理对中间。
    if (result[0] === '') {
      const code = text.codePointAt(regex.lastIndex)
      regex.lastIndex += regex.unicode && code !== undefined && code > 0xffff ? 2 : 1
    }
  }
  return { matches, truncated: false }
}

/** 按匹配位置拆分原文；text 为原文、matches 为匹配，返回可用插值安全渲染的片段。 */
export function highlightMatches(text: string, matches: RegexMatch[]): { text: string; matched: boolean }[] {
  const parts: { text: string; matched: boolean }[] = []
  let offset = 0
  for (const match of matches) {
    if (match.index > offset) parts.push({ text: text.slice(offset, match.index), matched: false })
    if (match.text) parts.push({ text: match.text, matched: true })
    offset = match.index + match.text.length
  }
  if (offset < text.length) parts.push({ text: text.slice(offset), matched: false })
  return parts
}
