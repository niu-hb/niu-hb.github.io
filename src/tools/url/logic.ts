export type UrlMode = 'component' | 'uri'

/** 转换 URL；text 为输入，mode 区分参数值与完整 URL，decode 控制解码；返回转换结果，非法序列时抛错。 */
export function transformUrl(text: string, mode: UrlMode, decode: boolean): string {
  try {
    if (decode) return mode === 'component' ? decodeURIComponent(text) : decodeURI(text)
    return mode === 'component' ? encodeURIComponent(text) : encodeURI(text)
  } catch {
    throw new Error('URL 转换失败：请检查百分号转义、UTF-8 编码或无效 Unicode 字符')
  }
}
