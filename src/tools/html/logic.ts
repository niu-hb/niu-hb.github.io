import { format } from 'prettier/standalone'
import * as htmlPlugin from 'prettier/plugins/html'

export const htmlExample = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>示例</title></head><body><main><h1>你好 🌏</h1><input disabled><br><p>HTML5 示例</p></main></body></html>'

/** 格式化 HTML5 文档或片段；text 为源码、indent 为缩进，返回格式化文本，不执行输入代码。 */
export async function formatHtml(text: string, indent: 2 | 4): Promise<string> {
  if (!text.trim()) throw new Error('请输入 HTML 文本')
  if (text.length > 200000) throw new Error('HTML 最多支持 200,000 字符，请分段处理')
  return format(text, {
    parser: 'html', plugins: [htmlPlugin], tabWidth: indent,
    // 按元素默认 display 判断空白：块级内容可缩进换行，行内文本仍保留有意义的间距。
    htmlWhitespaceSensitivity: 'css', embeddedLanguageFormatting: 'off',
  })
}
