// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import type { VNode } from 'vue'
import { matchRegex, highlightMatches, regexExamples } from './regex/logic'
import { formatXml, validateXml } from './xml/logic'
import { formatHtml, htmlExample } from './html/logic'
import { renderMarkdown, safeMarkdownUrl, markdownExample } from './markdown/logic'
import { generatePassword, type PasswordOptions } from './password/logic'
import { createQrOptions, type QrSettings } from './qrcode/logic'

/** 收集预览树的节点；node 为 Vue 节点，返回扁平节点列表以检查语义与安全属性。 */
function descendants(node: VNode): VNode[] {
  const children = Array.isArray(node.children) ? node.children.filter((child): child is VNode => typeof child === 'object' && child !== null && '__v_isVNode' in child) : []
  return [node, ...children.flatMap(descendants)]
}

describe('JavaScript 正则测试', () => {
  it('匹配位置、捕获组与标志', () => {
    const result = matchRegex('(?<word>[a-z]+)(\\d)?', 'gi', 'A1 b')
    expect(result.matches[0]).toEqual({ text: 'A1', index: 0, groups: ['A', '1'], namedGroups: { word: 'A' } })
    expect(result.matches[1]?.groups[1]).toBeUndefined()
    expect(matchRegex('a', '', 'aa').matches).toHaveLength(1)
    expect(matchRegex('a', 'y', 'aa b').matches).toHaveLength(2)
    expect(matchRegex('^a.b$', 'ms', 'x\na\nb\ny').matches).toHaveLength(1)
  })
  it('处理空文本、空匹配和 Unicode 代理对', () => {
    expect(matchRegex('a', 'g', '').matches).toEqual([])
    expect(matchRegex('(?:)', 'gu', '😀').matches.map(match => match.index)).toEqual([0, 2])
    expect(matchRegex('(?:)', 'g', '').matches).toHaveLength(1)
    expect(matchRegex('\\p{Script=Han}+', 'gu', '中𠮷').matches[0]?.text).toBe('中𠮷')
  })
  it('限制结果、输入，并拒绝非法表达式与标志', () => {
    expect(matchRegex('a', 'g', 'a'.repeat(1001))).toMatchObject({ truncated: true })
    for (const flags of ['gg', 'z']) expect(() => matchRegex('a', flags, 'a')).toThrow()
    expect(() => matchRegex('[', 'g', '')).toThrow()
    expect(() => matchRegex('a', 'g', 'a'.repeat(200001))).toThrow()
    expect(() => matchRegex('a'.repeat(10001), 'g', '')).toThrow()
    for (const example of regexExamples) expect(matchRegex(example.pattern, example.flags, example.text).matches.length).toBeGreaterThan(0)
  })
  it('高亮片段保持原文，用户标签仅为文本', () => {
    const text = '<script>中文😀</script>'
    const parts = highlightMatches(text, matchRegex('中文😀', 'gu', text).matches)
    expect(parts.map(part => part.text).join('')).toBe(text)
    expect(parts.filter(part => part.matched).map(part => part.text)).toEqual(['中文😀'])
  })
  it('新增预选项正确提取有效内容并排除非法边界', () => {
    const cases = [
      { name: '小数', matches: ['12.50', '-3.25'] },
      { name: '英文字母单词', matches: ['Hello', 'JavaScript', 'regex', 'test'] },
      { name: 'IPv4 地址', matches: ['192.0.2.1', '203.0.113.10'] },
      { name: '十六进制颜色', matches: ['#205c46', '#FFF', '#a1b2c3'] },
      { name: '24 小时时间（HH:mm）', matches: ['09:30', '23:59'] },
      { name: '空白字符', matches: [' ', '\t', '\n', '　'] },
      { name: '重复单词（忽略大小写）', matches: ['This this', 'test test', 'Hello hello'] },
      { name: '行首与行尾（多行模式）', matches: ['TODO: 补充测试', 'TODO: 更新说明'] },
    ]
    for (const item of cases) {
      const example = regexExamples.find(example => example.name === item.name)
      expect(example, item.name).toBeDefined()
      expect(matchRegex(example!.pattern, example!.flags, example!.text).matches.map(match => match.text), item.name).toEqual(item.matches)
    }
  })
})

describe('XML 格式化、压缩与语法检查', () => {
  it('格式化缩进，压缩元素间空白，并保留声明、注释', () => {
    const input = '<?xml version="1.0"?><root><item/><item/></root>'
    expect(formatXml(input, 2)).toContain('\n  <item/>')
    expect(formatXml(input, 2)).toMatch(/^<\?xml version="1.0"\?>/)
    expect(formatXml(input, 4)).toContain('\n    <item/>')
    expect(formatXml('<root>\n  <!-- 注释 -->\n <item/>\n</root>', 0)).toBe('<root><!-- 注释 --><item/></root>')
    expect(validateXml(input)).toContain('通过')
  })
  it('保留 Unicode、CDATA、混合文本及指定空白', () => {
    for (const input of ['<p>  你好 🌏  </p>', '<p>前\n <b>中</b> 后</p>', '<p><![CDATA[<文本>\n ]]></p>', '<p xml:space="preserve">\n <b/> \n</p>']) {
      for (const indent of [0, 2, 4] as const) expect(formatXml(input, indent)).toBe(input)
    }
    expect(validateXml('<r xmlns="urn:test" xmlns:a="urn:a"><a:item/></r>')).toContain('通过')
    expect(validateXml('<r><!-- <!DOCTYPE example> --><![CDATA[<!DOCTYPE example>]]></r>')).toContain('通过')
  })
  it('拒绝空文档、非法结构、属性、实体与超限输入', () => {
    for (const input of ['', ' ', '<a>', '<a></b>', '<a/><b/>', '<a x="1" x="2"/>', '<a>&unknown;</a>', '<a x=1/>', '<!DOCTYPE a><a/>', '<a>\u0000</a>']) expect(() => validateXml(input), input).toThrow()
    expect(() => validateXml('<a>'.repeat(101) + '</a>'.repeat(101))).toThrow()
    expect(() => validateXml('a'.repeat(200001))).toThrow()
  })
  it('拒绝裸露实体起始符、非法字符引用和未声明命名空间', () => {
    for (const input of ['<r>a & b</r>', '<r>&#0;</r>', '<r>&#x110000;</r>', '<r><a:b/></r>', '<r a:x="1"/>', '<r xmlns:a="urn:a" xmlns:b="urn:a" a:x="1" b:x="2"/>']) expect(() => validateXml(input), input).toThrow()
  })
})

describe('HTML5 格式化', () => {
  it('示例按块级层次换行，并正确应用 2/4 空格缩进', async () => {
    for (const indent of [2, 4] as const) {
      const result = await formatHtml(htmlExample, indent)
      expect(result).toContain(`\n${' '.repeat(indent)}<head>\n`)
      expect(result).toContain(`\n${' '.repeat(indent)}<body>\n`)
      expect(result).toContain(`\n${' '.repeat(indent * 2)}<main>\n`)
      expect(result).toContain(`\n${' '.repeat(indent * 3)}<h1>你好 🌏</h1>\n`)
      expect(await formatHtml(result, indent)).toBe(result)
    }
  })
  it('支持空元素、布尔属性、片段和 Unicode', async () => {
    const result = await formatHtml('<div><input disabled><br><p>你好 🌏</p></div>', 2)
    expect(result).toContain('<input disabled')
    expect(result).toContain('<br')
    expect(result).toContain('你好 🌏')
    expect(await formatHtml(result, 2)).toBe(result)
  })
  it('保留 pre、脚本及内联文本间空格', async () => {
    const result = await formatHtml('<pre>  a\n b  </pre><script>const x=1;</script><p>a <b>b</b> c</p>', 4)
    expect(result).toContain('  a\n b  ')
    expect(result).toContain('const x=1;')
    expect(result).toContain('a <b>b</b> c')
  })
  it('拒绝空输入、解析错误和超限文本', async () => {
    for (const input of ['', ' ', '<div></span>', 'a'.repeat(200001)]) await expect(formatHtml(input, 2)).rejects.toThrow()
  })
})

describe('Markdown 安全预览', () => {
  it('内置示例只展示已支持的语法', () => {
    expect(markdownExample).not.toMatch(/脚注|锚点|\[\^\d+\]|\]\(#|<br>/)
  })
  it('完整示例覆盖常见语法，链接均为站内地址或示例网址', () => {
    const tree = descendants(renderMarkdown(markdownExample))
    for (const tag of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'strong', 'em', 'blockquote', 'ol', 'ul', 'pre', 'table', 's', 'br']) expect(tree.some(node => node.type === tag), tag).toBe(true)
    expect(tree.filter(node => node.type === 'input')).toHaveLength(3)
    expect(tree.filter(node => node.type === 'blockquote')).toHaveLength(4)
    expect(tree.filter(node => node.type === 'td').slice(0, 3).map(node => node.props?.style)).toEqual([{ textAlign: 'left' }, { textAlign: 'center' }, { textAlign: 'right' }])
    const links = tree.filter(node => node.type === 'a')
    expect(links.length).toBeGreaterThanOrEqual(5)
    for (const node of links) expect(['niu-hb.github.io', 'example.com']).toContain(new URL(String(node.props?.href)).hostname)
    expect(tree.some(node => node.type === 'img')).toBe(false)
    expect(markdownExample).not.toContain('markdown.com.cn')
  })
  it('保留链接和图片的标题说明', () => {
    const tree = descendants(renderMarkdown('[工具站](https://example.com "链接说明")\n\n![图片](https://example.com/a.png "图片说明")', true))
    expect(tree.find(node => node.type === 'a')?.props?.title).toBe('链接说明')
    expect(tree.find(node => node.type === 'img')?.props?.title).toBe('图片说明')
  })
  it('渲染标准语法、表格、删除线、任务列表和 Unicode', () => {
    const tree = descendants(renderMarkdown('# 你好 🌏\n\n**粗体** *强调* `代码`\n\n> 引用\n\n1. 项目\n\n~~删除~~\n\n|a|b|\n|-|-|\n|1|2|\n\n- [x] 完成\n- [ ] 待办\n\n```js\n<代码>\n```'))
    for (const tag of ['h1', 'strong', 'em', 'code', 'blockquote', 'ol', 's', 'table', 'pre']) expect(tree.some(node => node.type === tag), tag).toBe(true)
    expect(tree.filter(node => node.type === 'input').map(node => node.props?.checked)).toEqual([true, false])
    expect(tree.filter(node => node.type === 'input').every(node => node.props?.disabled)).toBe(true)
  })
  it('禁止用户 HTML、危险链接与默认图片请求', () => {
    const tree = descendants(renderMarkdown('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[x](javascript:alert(1))\n\n![图片](https://example.com/image.png)'))
    expect(tree.some(node => ['script', 'img'].includes(String(node.type)))).toBe(false)
    expect(tree.some(node => node.props?.innerHTML !== undefined)).toBe(false)
    for (const url of ['javascript:alert(1)', 'data:text/html,hello', 'file:///a', '//example.com']) expect(safeMarkdownUrl(url)).toBe('')
    expect(safeMarkdownUrl('https://example.com')).toBe('https://example.com/')
    expect(safeMarkdownUrl('#section')).toBe('#section')
    const image = descendants(renderMarkdown('![你好](https://example.com/a.png)', true)).find(node => node.type === 'img')
    expect(image?.props?.alt).toBe('你好')
    expect(image?.props?.referrerpolicy).toBe('no-referrer')
  })
  it('空文档与输入长度边界', () => {
    expect(renderMarkdown('').children).toEqual([])
    expect(() => renderMarkdown('a'.repeat(100001))).toThrow()
  })
})

describe('密码生成', () => {
  const options: PasswordOptions = { length: 16, lowercase: true, uppercase: true, digits: true, symbols: true, excludeSimilar: false }
  it('仅符号密码限制在常用符号范围', () => {
    const password = generatePassword({ ...options, length: 128, lowercase: false, uppercase: false, digits: false })
    expect(password).toMatch(/^[!@#$%^&*_-]+$/)
  })
  it('满足长度和每种选中的字符类型', () => {
    for (const length of [4, 16, 128]) {
      for (let count = 0; count < 20; count++) {
        const password = generatePassword({ ...options, length })
        expect(password).toHaveLength(length)
        for (const pattern of [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z0-9]/]) expect(password).toMatch(pattern)
      }
    }
  })
  it('排除易混淆字符并支持仅数字', () => {
    expect(generatePassword({ ...options, length: 128, excludeSimilar: true })).not.toMatch(/[Il1O0o]/)
    expect(generatePassword({ ...options, length: 1, lowercase: false, uppercase: false, symbols: false })).toMatch(/^\d$/)
  })
  it('拒绝不合法长度和空字符集', () => {
    for (const length of [0, -1, 1.5, NaN, 129, 3]) expect(() => generatePassword({ ...options, length })).toThrow()
    expect(() => generatePassword({ ...options, lowercase: false, uppercase: false, digits: false, symbols: false })).toThrow()
  })
})

describe('二维码设置', () => {
  const settings: QrSettings = { text: '你好 🌏', size: 256, foreground: '#000000', background: '#ffffff', dots: 'square', corners: 'square', correction: 'M' }
  it('按设置生成选项并保留足够留白', () => {
    const result = createQrOptions(settings)
    expect(result.warning).toBe('')
    const bytes = Uint8Array.from(result.options.data ?? '', character => character.charCodeAt(0))
    expect(new TextDecoder().decode(bytes)).toBe('你好 🌏')
    expect(result.options).toMatchObject({ width: 256, height: 256, type: 'svg', qrOptions: { errorCorrectionLevel: 'M' } })
    expect(result.options.margin).toBeGreaterThanOrEqual(256 * 4 / 29)
    for (const dots of ['square', 'dots', 'rounded'] as const) expect(createQrOptions({ ...settings, dots }).options.dotsOptions?.type).toBe(dots)
    expect(createQrOptions({ ...settings, corners: 'dot', correction: 'H' }).options.cornersDotOptions?.type).toBe('dot')
  })
  it('提示低对比与反色', () => {
    expect(createQrOptions({ ...settings, foreground: '#eeeeee' }).warning).toBeTruthy()
    expect(createQrOptions({ ...settings, foreground: '#ffffff', background: '#000000' }).warning).toBeTruthy()
  })
  it('拒绝空内容、非法颜色、尺寸和超容量 Unicode', () => {
    for (const text of ['', ' ', '中'.repeat(667)]) expect(() => createQrOptions({ ...settings, text })).toThrow()
    for (const size of [0, 127, 1025, 128.5, NaN]) expect(() => createQrOptions({ ...settings, size })).toThrow()
    for (const foreground of ['', '#fff', 'red']) expect(() => createQrOptions({ ...settings, foreground })).toThrow()
    for (const size of [128, 1024]) expect(createQrOptions({ ...settings, size }).options.width).toBe(size)
  })
})
