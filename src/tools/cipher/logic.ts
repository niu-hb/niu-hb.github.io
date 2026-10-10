export const cipherAlgorithms = [
  { value: 'AES-GCM', label: 'AES-GCM · 认证加密', description: '12 字节 IV，128 bit 认证标签，支持附加认证数据 AAD。' },
  { value: 'AES-CBC', label: 'AES-CBC · PKCS#7', description: '16 字节 IV，自动 PKCS#7 填充；本模式不提供完整性认证。' },
  { value: 'AES-CTR', label: 'AES-CTR · 64 bit 计数器', description: '16 字节初始计数块，低 64 bit 递增，无填充、不提供完整性认证。' },
  { value: 'RSA-OAEP', label: 'RSA-OAEP · SHA-256', description: '公钥加密、私钥解密，OAEP 与 MGF1 均使用 SHA-256。' },
] as const

export type CipherAlgorithm = typeof cipherAlgorithms[number]['value']
export type CipherFormat = 'base64' | 'hex'
export type CipherOperation = 'encrypt' | 'decrypt'
export interface CipherInput {
  algorithm: CipherAlgorithm
  operation: CipherOperation
  format: CipherFormat
  text: string
  keyHex: string
  ivHex: string
  aad: string
  rsaKey: string
  label: string
}
export interface CipherOutput { text: string; inputBytes: number; outputBytes: number; operation: CipherOperation }
export interface RsaKeys { publicKey: string; privateKey: string }
export type CipherTask = { type: 'transform'; input: CipherInput } | { type: 'generate-rsa'; bits: number }
export type CipherMessage = { type: 'result'; output: CipherOutput } | { type: 'keys'; keys: RsaKeys } | { type: 'error'; error: string }
export const maxPlaintextBytes = 64 * 1024
const maxEncodedCharacters = (maxPlaintextBytes + 16) * 2 + 4096

/** 获取浏览器原生密码学接口；无参数，返回支持随机数和 SubtleCrypto 的接口，不支持时抛出提示。 */
function cryptoApi(): Crypto {
  if (!globalThis.crypto?.subtle) throw new Error('浏览器不支持 Web Crypto，请使用现代浏览器及 HTTPS 或 localhost')
  return globalThis.crypto
}

/** 将字节编码为 Hex 或标准 Base64；bytes 为原始字节、format 为格式，返回保留前导零的文本。 */
export function encodeCipherBytes(bytes: Uint8Array, format: CipherFormat): string {
  if (format === 'hex') return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  if (format !== 'base64') throw new Error('密文格式无效')
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

/** 解码 Hex 或标准 Base64；text 为编码文本、format 为格式，返回字节，忽略空白但拒绝非法字符及非规范填充。 */
export function decodeCipherBytes(text: string, format: CipherFormat): Uint8Array<ArrayBuffer> {
  if (text.length > maxEncodedCharacters) throw new Error('编码内容过长，请缩短输入')
  const clean = text.replace(/\s/g, '')
  if (format === 'hex') {
    if (!/^(?:[0-9a-fA-F]{2})*$/.test(clean)) throw new Error('Hex 需为偶数位十六进制字符，不含 0x 前缀')
    return Uint8Array.from(clean.match(/.{2}/g) ?? [], byte => parseInt(byte, 16))
  }
  if (format !== 'base64') throw new Error('密文格式无效')
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(clean)) throw new Error('请输入规范标准 Base64，保留末尾填充，不使用 URL-safe 字母表')
  let binary: string
  try { binary = atob(clean) }
  catch { throw new Error('Base64 解码失败，请检查密文格式') }
  if (btoa(binary) !== clean) throw new Error('Base64 填充位无效')
  return Uint8Array.from(binary, character => character.charCodeAt(0))
}

/** 编码原始文本并限制大小；text 为原文、max 为字节上限、name 为错误字段名称，返回 UTF-8 字节。 */
function textBytes(text: string, max: number, name: string): Uint8Array<ArrayBuffer> {
  if (text.length > max) throw new Error(`${name}超出 ${max.toLocaleString()} 字节限制`)
  const bytes = new TextEncoder().encode(text)
  if (bytes.length > max) throw new Error(`${name}超出 ${max.toLocaleString()} 字节限制`)
  return bytes
}

/** 生成 AES 随机密钥；bits 为 128、192 或 256，返回 Hex 密钥，不使用口令直接替代密钥。 */
export function generateAesKey(bits: number): string {
  if (![128, 192, 256].includes(bits)) throw new Error('AES 密钥长度需为 128、192 或 256 bit')
  return encodeCipherBytes(cryptoApi().getRandomValues(new Uint8Array(bits / 8)), 'hex')
}

/** 生成随机 IV 或计数块；algorithm 为 AES 模式，返回符合模式长度的 Hex 参数。 */
export function generateCipherIv(algorithm: CipherAlgorithm): string {
  if (algorithm === 'RSA-OAEP') throw new Error('RSA-OAEP 不使用 AES IV')
  if (!cipherAlgorithms.some(item => item.value === algorithm)) throw new Error('加密算法无效')
  return encodeCipherBytes(cryptoApi().getRandomValues(new Uint8Array(algorithm === 'AES-GCM' ? 12 : 16)), 'hex')
}

/** 解析 SPKI 公钥或 PKCS#8 私钥；pem 为文本、privateKey 决定类型，返回 DER 字节，拒绝其他 PEM 包装。 */
export function parseRsaPem(pem: string, privateKey: boolean): Uint8Array<ArrayBuffer> {
  if (pem.length > 8192) throw new Error('RSA PEM 最多 8,192 个字符')
  const label = privateKey ? 'PRIVATE KEY' : 'PUBLIC KEY'
  const pattern = new RegExp(`^-----BEGIN ${label}-----\\s*([A-Za-z0-9+/=\\s]+)\\s*-----END ${label}-----$`)
  const match = pattern.exec(pem.trim())
  if (!match) throw new Error(privateKey ? '请提供未加密 PKCS#8 PEM 私钥（PRIVATE KEY）' : '请提供 SPKI PEM 公钥（PUBLIC KEY）')
  const bytes = decodeCipherBytes(match[1]!, 'base64')
  if (!bytes.length) throw new Error('RSA PEM 内容为空')
  return bytes
}

/** 将 DER 包装为 PEM；bytes 为导出字节、privateKey 决定标记，返回每行 64 字符的 PEM 文本。 */
function rsaPem(bytes: Uint8Array, privateKey: boolean): string {
  const label = privateKey ? 'PRIVATE KEY' : 'PUBLIC KEY'
  const body = encodeCipherBytes(bytes, 'base64').match(/.{1,64}/g)!.join('\n')
  return `-----BEGIN ${label}-----\n${body}\n-----END ${label}-----`
}

/** 生成 RSA-OAEP 公私钥；bits 为 2048、3072 或 4096，返回可复制的 SPKI / PKCS#8 PEM，仅供当前页面使用。 */
export async function generateRsaKeys(bits: number): Promise<RsaKeys> {
  if (![2048, 3072, 4096].includes(bits)) throw new Error('RSA 密钥长度需为 2048、3072 或 4096 bit')
  const subtle = cryptoApi().subtle
  try {
    const keys = await subtle.generateKey({ name: 'RSA-OAEP', modulusLength: bits, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['encrypt', 'decrypt'])
    const [publicBytes, privateBytes] = await Promise.all([subtle.exportKey('spki', keys.publicKey), subtle.exportKey('pkcs8', keys.privateKey)])
    return { publicKey: rsaPem(new Uint8Array(publicBytes), false), privateKey: rsaPem(new Uint8Array(privateBytes), true) }
  } catch {
    throw new Error('RSA 密钥生成失败，请检查浏览器支持并重试')
  }
}

/** 校验算法、方向和输入；input 为加解密配置，返回原文字节或密文字节，提前拒绝非法输入。 */
export function validateCipherInput(input: CipherInput): Uint8Array<ArrayBuffer> {
  if (!cipherAlgorithms.some(item => item.value === input.algorithm)) throw new Error('请选择支持的加密算法')
  if (!['encrypt', 'decrypt'].includes(input.operation)) throw new Error('加解密方向无效')
  if (!['base64', 'hex'].includes(input.format)) throw new Error('密文格式无效')
  const data = input.operation === 'encrypt' ? textBytes(input.text, maxPlaintextBytes, '明文') : decodeCipherBytes(input.text, input.format)
  if (data.length > maxPlaintextBytes + 16) throw new Error('密文过长，本工具明文最多 64 KiB')
  if (input.algorithm === 'RSA-OAEP') {
    parseRsaPem(input.rsaKey, input.operation === 'decrypt')
    textBytes(input.label, 4096, 'OAEP Label')
  } else {
    if (input.keyHex.length > 256) throw new Error('AES 密钥需为 16、24 或 32 字节 Hex')
    const key = decodeCipherBytes(input.keyHex, 'hex')
    if (![16, 24, 32].includes(key.length)) throw new Error('AES 密钥需为 16、24 或 32 字节 Hex，不是普通口令')
    if (input.ivHex.length > 128) throw new Error('IV 或计数块过长')
    const iv = decodeCipherBytes(input.ivHex, 'hex')
    const ivLength = input.algorithm === 'AES-GCM' ? 12 : 16
    if (iv.length !== ivLength) throw new Error(`${input.algorithm} 的 IV / 计数块需为 ${ivLength} 字节 Hex`)
    if (input.algorithm === 'AES-GCM') {
      textBytes(input.aad, 4096, 'AAD')
      if (input.operation === 'decrypt' && data.length < 16) throw new Error('GCM 密文需包含末尾 16 字节认证标签')
    }
    if (input.algorithm === 'AES-CBC' && input.operation === 'decrypt' && (!data.length || data.length % 16)) throw new Error('CBC 密文需为非空的 16 字节整数倍')
  }
  return data
}

/** 使用原生接口加解密；input 为原文、编码及密钥参数，返回文本和字节统计，不保存或记录敏感内容。 */
export async function transformCipher(input: CipherInput): Promise<CipherOutput> {
  const data = validateCipherInput(input)
  const subtle = cryptoApi().subtle
  let key: CryptoKey
  let parameters: AesGcmParams | AesCbcParams | AesCtrParams | RsaOaepParams
  if (input.algorithm === 'RSA-OAEP') {
    try {
      key = await subtle.importKey(input.operation === 'encrypt' ? 'spki' : 'pkcs8', parseRsaPem(input.rsaKey, input.operation === 'decrypt'), { name: 'RSA-OAEP', hash: 'SHA-256' }, false, [input.operation])
    } catch { throw new Error('RSA 密钥导入失败，请检查 PEM 类型及密钥内容') }
    const modulus = (key.algorithm as RsaHashedKeyAlgorithm).modulusLength
    if (modulus < 2048 || modulus > 4096) throw new Error('RSA 导入密钥需为 2048–4096 bit')
    const modulusBytes = Math.ceil(modulus / 8)
    if (input.operation === 'encrypt' && data.length > modulusBytes - 66) throw new Error(`此 RSA-OAEP 密钥最多加密 ${modulusBytes - 66} 个 UTF-8 字节，请改用 AES 处理长文本`)
    if (input.operation === 'decrypt' && data.length !== modulusBytes) throw new Error(`RSA 密文需为 ${modulusBytes} 字节`)
    parameters = { name: 'RSA-OAEP', label: textBytes(input.label, 4096, 'OAEP Label') }
  } else {
    try { key = await subtle.importKey('raw', decodeCipherBytes(input.keyHex, 'hex'), input.algorithm, false, [input.operation]) }
    catch { throw new Error('AES 密钥导入失败，请检查密钥格式及长度') }
    const iv = decodeCipherBytes(input.ivHex, 'hex')
    if (input.algorithm === 'AES-GCM') parameters = { name: 'AES-GCM', iv, tagLength: 128, additionalData: textBytes(input.aad, 4096, 'AAD') }
    else if (input.algorithm === 'AES-CBC') parameters = { name: 'AES-CBC', iv }
    else parameters = { name: 'AES-CTR', counter: iv, length: 64 }
  }
  let bytes: Uint8Array<ArrayBuffer>
  try {
    bytes = new Uint8Array(await subtle[input.operation](parameters, key, data))
  } catch {
    throw new Error(input.operation === 'decrypt' ? '解密失败：请检查密钥、算法、IV、AAD / Label 及密文是否一致或完整' : '加密失败：请检查算法参数及浏览器支持')
  }
  let text: string
  if (input.operation === 'encrypt') text = encodeCipherBytes(bytes, input.format)
  else {
    try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes) }
    catch { throw new Error('解密后的数据不是有效 UTF-8 文本，本工具仅展示文本明文') }
  }
  return { text, inputBytes: data.length, outputBytes: bytes.length, operation: input.operation }
}
