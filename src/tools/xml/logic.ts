/** 检查 XML 1.0 语法；text 为 XML，返回浏览器解析文档，结构或深度错误时抛出异常。 */
function parseXml(text: string): Document {
  if (!text.trim()) throw new Error('请输入 XML 文本')
  if (text.length > 200000) throw new Error('XML 最多支持 200,000 字符，请分段处理')
  // 不加载或展开 DTD/外部实体；本工具只检查 XML 结构，不做模式校验。
  const declarations = text.replace(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>/g, '')
  if (/<!DOCTYPE\s/i.test(declarations)) throw new Error('暂不支持包含 DOCTYPE/DTD 的 XML，请移除声明后再处理')
  if (/^\s*<\?xml\s[^?]*version\s*=\s*['"](?!1\.0['"])/.test(text)) throw new Error('仅支持 XML 1.0')
  const document = new DOMParser().parseFromString(text, 'application/xml')
  // Firefox/jsdom 使用专用错误命名空间；Chrome/WebKit 在 XHTML 命名空间插入错误节点。
  const parseError = Array.from(document.getElementsByTagName('parsererror')).find(node =>
    node.namespaceURI === 'http://www.mozilla.org/newlayout/xml/parsererror.xml' || node.namespaceURI === 'http://www.w3.org/1999/xhtml',
  )
  if (parseError) throw new Error(`XML 语法错误：${parseError.textContent}`)
  if (!document.documentElement) throw new Error('XML 缺少根元素')
  const stack: { element: Element; depth: number }[] = [{ element: document.documentElement, depth: 1 }]
  while (stack.length) {
    const { element, depth } = stack.pop()!
    if (depth > 100) throw new Error('XML 嵌套最多支持 100 层')
    for (const child of Array.from(element.children)) stack.push({ element: child, depth: depth + 1 })
  }
  return document
}

/** 校验 XML 是否格式良好；text 为输入，成功返回中文说明，非法输入抛出异常。 */
export function validateXml(text: string): string {
  parseXml(text)
  return 'XML 语法检查通过（未进行 XSD/DTD 校验）'
}

/** 格式化或压缩 XML；text 为输入、indent 为 0/2/4，返回保留文本和注释的 XML。 */
export function formatXml(text: string, indent: 0 | 2 | 4): string {
  const document = parseXml(text)
  const serializer = new XMLSerializer()
  const separator = indent ? '\n' : ''

  /** 递归排版节点；node 为节点、depth 为层级，返回 XML；有文本的子树整体保留空白。 */
  function render(node: Node, depth: number): string {
    if (node.nodeType !== 1) return serializer.serializeToString(node)
    const element = node as Element
    const children = Array.from(element.childNodes)
    const hasContent = children.some(child => child.nodeType === 4 || (child.nodeType === 3 && (child.nodeValue ?? '').trim()))
    const hasElements = children.some(child => child.nodeType === 1)
    if (hasContent || element.getAttribute('xml:space') === 'preserve' || !hasElements) return serializer.serializeToString(element)
    const meaningful = children.filter(child => child.nodeType !== 3 || (child.nodeValue ?? '').trim())
    const opening = serializer.serializeToString(element.cloneNode(false)).replace(/\/>$/, '>')
    const content = meaningful.map(child => ' '.repeat(indent * (depth + 1)) + render(child, depth + 1)).join(separator)
    return `${opening}${separator}${content}${separator}${' '.repeat(indent * depth)}</${element.tagName}>`
  }

  const content = Array.from(document.childNodes)
    .filter(node => node.nodeType !== 3 || (node.nodeValue ?? '').trim())
    .map(node => render(node, 0)).join(separator)
  // 浏览器不把 XML 声明保留为 DOM 节点，单独保留原声明，避免输出丢失版本或编码说明。
  const declaration = text.match(/^\s*(<\?xml\s[^?]*\?>)/)?.[1]
  return declaration ? `${declaration}${separator}${content}` : content
}
