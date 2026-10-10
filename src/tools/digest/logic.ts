import {
  createMD4, createMD5, createSHA1, createSHA224, createSHA256, createSHA384, createSHA512,
  createSHA3, createKeccak, createBLAKE2b, createBLAKE2s, createBLAKE3,
  createRIPEMD160, createSM3, createWhirlpool, createCRC32, createAdler32, createXXHash64,
  type IHasher,
} from 'hash-wasm'

export const digestAlgorithms = [
  { id: 'md4', label: 'MD4', group: 'MD 系列', bits: 128, note: '旧系统兼容' },
  { id: 'md5', label: 'MD5', group: 'MD 系列', bits: 128, note: '旧系统兼容' },
  { id: 'sha1', label: 'SHA-1', group: 'SHA-1 / SHA-2', bits: 160, note: '旧系统兼容' },
  { id: 'sha224', label: 'SHA-224', group: 'SHA-1 / SHA-2', bits: 224, note: '' },
  { id: 'sha256', label: 'SHA-256', group: 'SHA-1 / SHA-2', bits: 256, note: '' },
  { id: 'sha384', label: 'SHA-384', group: 'SHA-1 / SHA-2', bits: 384, note: '' },
  { id: 'sha512', label: 'SHA-512', group: 'SHA-1 / SHA-2', bits: 512, note: '' },
  { id: 'sha3-224', label: 'SHA3-224', group: 'SHA-3 / Keccak', bits: 224, note: '' },
  { id: 'sha3-256', label: 'SHA3-256', group: 'SHA-3 / Keccak', bits: 256, note: '' },
  { id: 'sha3-384', label: 'SHA3-384', group: 'SHA-3 / Keccak', bits: 384, note: '' },
  { id: 'sha3-512', label: 'SHA3-512', group: 'SHA-3 / Keccak', bits: 512, note: '' },
  { id: 'keccak256', label: 'Keccak-256', group: 'SHA-3 / Keccak', bits: 256, note: '与 SHA3-256 不同' },
  { id: 'blake2b', label: 'BLAKE2b-512', group: 'BLAKE 系列', bits: 512, note: '' },
  { id: 'blake2s', label: 'BLAKE2s-256', group: 'BLAKE 系列', bits: 256, note: '' },
  { id: 'blake3', label: 'BLAKE3-256', group: 'BLAKE 系列', bits: 256, note: '' },
  { id: 'ripemd160', label: 'RIPEMD-160', group: '其他摘要', bits: 160, note: '' },
  { id: 'sm3', label: 'SM3', group: '其他摘要', bits: 256, note: '' },
  { id: 'whirlpool', label: 'Whirlpool', group: '其他摘要', bits: 512, note: '' },
  { id: 'crc32', label: 'CRC32', group: '非密码学校验', bits: 32, note: 'IEEE' },
  { id: 'crc32c', label: 'CRC32C', group: '非密码学校验', bits: 32, note: 'Castagnoli' },
  { id: 'adler32', label: 'Adler32', group: '非密码学校验', bits: 32, note: '' },
  { id: 'xxhash64', label: 'xxHash64', group: '非密码学校验', bits: 64, note: '种子为 0' },
] as const

export type DigestId = typeof digestAlgorithms[number]['id']
export type DigestFormat = 'hex' | 'hex-upper' | 'base64'
export interface DigestInput { source: string | Blob; algorithms: string[] }
export interface DigestResult { id: DigestId; hex: string }
export interface DigestOutput { results: DigestResult[]; bytes: number }
export type DigestMessage =
  | { type: 'progress'; processed: number; total: number }
  | { type: 'done'; output: DigestOutput }
  | { type: 'error'; error: string }

export const maxTextBytes = 1024 * 1024
export const maxFileBytes = 512 * 1024 * 1024
export const digestChunkBytes = 1024 * 1024

const factories: Record<DigestId, () => Promise<IHasher>> = {
  md4: createMD4, md5: createMD5, sha1: createSHA1, sha224: createSHA224,
  sha256: createSHA256, sha384: createSHA384, sha512: createSHA512,
  'sha3-224': () => createSHA3(224), 'sha3-256': () => createSHA3(256),
  'sha3-384': () => createSHA3(384), 'sha3-512': () => createSHA3(512),
  keccak256: () => createKeccak(256), blake2b: () => createBLAKE2b(512),
  blake2s: () => createBLAKE2s(256), blake3: () => createBLAKE3(256),
  ripemd160: createRIPEMD160, sm3: createSM3, whirlpool: createWhirlpool,
  crc32: createCRC32, crc32c: () => createCRC32(0x82f63b78), adler32: createAdler32,
  xxhash64: () => createXXHash64(0, 0),
}

/** 校验算法选择；ids 为所选标识，返回类型安全的标识列表，拒绝空列表、重复或未知算法。 */
export function validateAlgorithms(ids: readonly string[]): DigestId[] {
  if (!ids.length) throw new Error('请至少选择一种算法')
  if (ids.length > digestAlgorithms.length || new Set(ids).size !== ids.length) throw new Error('算法选择无效或重复')
  return ids.map(id => {
    const algorithm = digestAlgorithms.find(item => item.id === id)
    if (!algorithm) throw new Error('包含不支持的摘要算法')
    return algorithm.id
  })
}

/** 校验输入并取得字节数；source 为原始文本或文件，返回 UTF-8 文本字节或文件大小，允许空输入。 */
export function digestSourceSize(source: string | Blob): number {
  if (typeof source === 'string') {
    // 先限制字符长度，避免超大文本在 UTF-8 编码阶段占用过多内存。
    if (source.length > maxTextBytes) throw new Error('文本 UTF-8 编码后最多 1 MiB')
    const size = new TextEncoder().encode(source).length
    if (size > maxTextBytes) throw new Error('文本 UTF-8 编码后最多 1 MiB')
    return size
  }
  if (!(source instanceof Blob)) throw new Error('请选择有效文件或输入文本')
  if (source.size > maxFileBytes) throw new Error('文件最大支持 512 MiB')
  return source.size
}

/** 分块计算摘要；input 为输入及算法，onProgress 接收已读与总字节数，返回按选择顺序排列的结果和输入大小。 */
export async function calculateDigests(input: DigestInput, onProgress?: (processed: number, total: number) => void): Promise<DigestOutput> {
  const ids = validateAlgorithms(input.algorithms)
  const total = digestSourceSize(input.source)
  const hashers = await Promise.all(ids.map(id => factories[id]()))
  for (const hasher of hashers) hasher.init()
  onProgress?.(0, total)
  if (typeof input.source === 'string') {
    const bytes = new TextEncoder().encode(input.source)
    for (const hasher of hashers) hasher.update(bytes)
  } else {
    // 一次读取一个分块，所有算法复用同一字节块，避免将整个文件或多份副本载入内存。
    for (let offset = 0; offset < total; offset += digestChunkBytes) {
      let bytes: Uint8Array
      try {
        bytes = new Uint8Array(await input.source.slice(offset, offset + digestChunkBytes).arrayBuffer())
      } catch {
        throw new Error('读取文件失败，请重新选择文件后重试')
      }
      for (const hasher of hashers) hasher.update(bytes)
      onProgress?.(Math.min(offset + bytes.length, total), total)
    }
  }
  onProgress?.(total, total)
  return { results: ids.map((id, index) => ({ id, hex: hashers[index]!.digest('hex') })), bytes: total }
}

/** 格式化摘要；hex 为完整十六进制摘要、format 为输出格式，返回 Hex 或原始摘要字节的 Base64。 */
export function formatDigest(hex: string, format: DigestFormat): string {
  if (!/^(?:[0-9a-fA-F]{2})+$/.test(hex)) throw new Error('摘要结果不是有效十六进制字节')
  if (format === 'hex') return hex.toLowerCase()
  if (format === 'hex-upper') return hex.toUpperCase()
  if (format !== 'base64') throw new Error('输出格式无效')
  const bytes = hex.match(/.{2}/g)!.map(byte => String.fromCharCode(parseInt(byte, 16))).join('')
  return btoa(bytes)
}
