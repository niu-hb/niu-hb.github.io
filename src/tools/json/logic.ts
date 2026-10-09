/** 解析并序列化 JSON；text 为输入，indent 为缩进（0 表示压缩）；返回结果，语法错误时抛出异常。 */
export function formatJson(text: string, indent: 0 | 2 | 4): string {
  if (!text.trim()) throw new Error('请输入 JSON 内容')
  try {
    const parsed: unknown = JSON.parse(text)
    return JSON.stringify(parsed, null, indent)
  } catch (error) {
    throw new Error(`JSON 语法错误：${error instanceof Error ? error.message : '请检查输入'}`)
  }
}
