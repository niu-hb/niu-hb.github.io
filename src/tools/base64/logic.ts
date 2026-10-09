export type Base64Mode = 'standard' | 'url-safe'

/** 将 UTF-8 文本编码为 Base64；text 为原文，mode 为字母表；返回编码结果。 */
export function encodeBase64(text: string, mode: Base64Mode): string {
  const bytes = new TextEncoder().encode(text)
  // 逐字节组装避免大文本展开成函数参数时触发浏览器参数数量限制。
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  const encoded = btoa(binary)
  return mode === 'url-safe' ? encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : encoded
}

/** 将 Base64 解码为严格 UTF-8 文本；text 为编码，mode 为字母表；返回原文，非法内容或填充位时抛错。 */
export function decodeBase64(text: string, mode: Base64Mode): string {
  const clean = text.replace(/\s/g, '')
  if (!clean) return ''
  const alphabet = mode === 'standard' ? /^[A-Za-z0-9+/]*={0,2}$/ : /^[A-Za-z0-9_-]*={0,2}$/
  const raw = clean.replace(/=+$/, '')
  const remainder = raw.length % 4
  if (!alphabet.test(clean) || remainder === 1 || (mode === 'standard' && clean.length % 4 !== 0) || (clean.includes('=') && clean.length % 4 !== 0)) {
    throw new Error('Base64 格式无效，请检查字符、长度、填充和所选模式')
  }
  try {
    const normalized = raw.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(normalized + '='.repeat((4 - remainder) % 4))
    // 重编码校验确保非零填充位不会被宽松的 atob 静默接受。
    if (btoa(binary).replace(/=+$/, '') !== normalized) throw new Error('填充位无效')
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
  } catch {
    throw new Error('解码失败：输入不是规范 Base64 或有效的 UTF-8 文本')
  }
}
