import MarkdownIt from 'markdown-it'
import taskLists from 'markdown-it-task-lists'
import { h, type VNode, type VNodeChild } from 'vue'
import example from './example.md?raw'

const parser = new MarkdownIt('commonmark', { html: false }).enable(['table', 'strikethrough']).use(taskLists)
type Token = ReturnType<typeof parser.parse>[number]
const allowedTags = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'ul', 'ol', 'li', 'em', 'strong', 's', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td'])

export const markdownExample = example

/** 验证 Markdown 资源地址；url 为解析后地址，仅返回允许的 HTTP/HTTPS 或页内锚点，其他返回空串。 */
export function safeMarkdownUrl(url: string): string {
  if (/^#[^\s]*$/.test(url)) return url
  try {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : ''
  } catch {
    return ''
  }
}

/** 将解析器 token 转成 Vue 节点；tokens 为语法节点、loadImages 控制外部图片加载，返回安全预览节点。 */
function renderTokens(tokens: Token[], loadImages: boolean): VNodeChild[] {
  const root: VNodeChild[] = []
  const stack: { tag: string; props: Record<string, unknown>; children: VNodeChild[] }[] = []
  const append = (node: VNodeChild): void => { (stack.at(-1)?.children ?? root).push(node) }
  for (const token of tokens) {
    if (token.hidden) continue
    if (token.nesting === 1 && allowedTags.has(token.tag)) {
      const props: Record<string, unknown> = {}
      if (token.tag === 'a') {
        const href = safeMarkdownUrl(String(token.attrGet('href') ?? ''))
        if (href) Object.assign(props, { href, target: href.startsWith('#') ? undefined : '_blank', rel: 'noopener noreferrer' })
        const title = token.attrGet('title')
        if (title) props.title = String(title)
      }
      if (token.tag === 'ol' && /^\d+$/.test(String(token.attrGet('start') ?? ''))) props.start = token.attrGet('start')
      const alignment = String(token.attrGet('style') ?? '').match(/^text-align:(left|center|right)$/)?.[1]
      if (alignment) props.style = { textAlign: alignment }
      stack.push({ tag: token.tag, props, children: [] })
    } else if (token.nesting === -1 && allowedTags.has(token.tag)) {
      const entry = stack.pop()
      if (entry) append(h(entry.tag, entry.props, entry.children))
    } else if (token.type === 'inline') {
      for (const node of renderTokens(token.children ?? [], loadImages)) append(node)
    } else if (token.type === 'text' || token.type === 'html_block') {
      append(token.content)
    } else if (token.type === 'html_inline') {
      // 只识别任务列表插件生成的固定 checkbox；用户 HTML 已在解析器中禁用。
      if (/^<input class="task-list-item-checkbox"(?: checked="")? disabled="" type="checkbox">$/.test(token.content)) {
        append(h('input', { type: 'checkbox', disabled: true, checked: token.content.includes('checked=""'), 'aria-label': '任务状态' }))
      } else append(token.content)
    } else if (token.type === 'code_inline') append(h('code', token.content))
    else if (token.type === 'fence' || token.type === 'code_block') append(h('pre', [h('code', token.content)]))
    else if (token.type === 'softbreak') append('\n')
    else if (token.type === 'hardbreak') append(h('br'))
    else if (token.type === 'hr') append(h('hr'))
    else if (token.type === 'image') {
      const source = safeMarkdownUrl(String(token.attrGet('src') ?? ''))
      const alt = token.children?.map(child => child.content).join('') ?? token.content
      if (loadImages && /^https?:/.test(source)) append(h('img', { src: source, alt, title: token.attrGet('title') ?? undefined, loading: 'lazy', referrerpolicy: 'no-referrer', onError: (event: Event) => { (event.target as HTMLImageElement).alt = `图片加载失败：${alt}` } }))
      else append(h('span', { class: 'image-placeholder' }, `[图片：${alt || '无说明'}${source ? '，未加载' : '，地址不支持'}]`))
    }
  }
  return root
}

/** 按 CommonMark 及表格/删除线/任务列表规则生成预览；text 为源码，返回 Vue 节点，不插入原始 HTML。 */
export function renderMarkdown(text: string, loadImages = false): VNode {
  if (text.length > 100000) throw new Error('Markdown 最多支持 100,000 字符')
  return h('div', { class: 'markdown-body' }, renderTokens(parser.parse(text, {}), loadImages))
}
