import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import {
  calculateDigests, digestAlgorithms, digestChunkBytes, digestSourceSize,
  formatDigest, maxFileBytes, maxTextBytes, validateAlgorithms,
} from './logic'

describe('摘要算法参考向量', () => {
  it('MD4、Keccak、BLAKE3 与公开 abc 向量一致', async () => {
    const output = await calculateDigests({ source: 'abc', algorithms: ['md4', 'keccak256', 'blake3'] })
    expect(output.results.map(result => result.hex)).toEqual([
      'a448017aaf21d8525fc10ae87aa6729d',
      '4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45',
      '6437b3ac38465133ffb63b75273a8db548c558465d79db03fd359c6cd5bd9d85',
    ])
  })
  it('SHA、MD5、BLAKE2、RIPEMD 和 SM3 与 Node 独立实现一致', async () => {
    const names = {
      md5: 'md5', sha1: 'sha1', sha224: 'sha224', sha256: 'sha256', sha384: 'sha384', sha512: 'sha512',
      'sha3-224': 'sha3-224', 'sha3-256': 'sha3-256', 'sha3-384': 'sha3-384', 'sha3-512': 'sha3-512',
      blake2b: 'blake2b512', blake2s: 'blake2s256', ripemd160: 'ripemd160', sm3: 'sm3',
    }
    const source = '中文😀\r\n e\u0301\0 '
    const output = await calculateDigests({ source, algorithms: Object.keys(names) })
    for (const result of output.results) {
      const name = names[result.id as keyof typeof names]
      expect(result.hex).toBe(createHash(name).update(source, 'utf8').digest('hex'))
    }
    expect(output.bytes).toBe(Buffer.byteLength(source, 'utf8'))
  })
  it('CRC 与 Adler 检查向量一致，CRC32 与 CRC32C 不混用', async () => {
    const output = await calculateDigests({ source: '123456789', algorithms: ['crc32', 'crc32c', 'adler32'] })
    expect(output.results.map(result => result.hex)).toEqual(['cbf43926', 'e3069283', '091e01de'])
  })
  it('空文本与空文件一致，Whirlpool 和 xxHash64 空向量正确，所有算法位数准确', async () => {
    const algorithms = digestAlgorithms.map(item => item.id)
    const text = await calculateDigests({ source: '', algorithms })
    const file = await calculateDigests({ source: new Blob([]), algorithms })
    expect(file).toEqual(text)
    expect(text.results.find(result => result.id === 'whirlpool')?.hex).toBe('19fa61d75522a4669b44e39c1d2e1726c530232130d407f89afee0964997f7a73e83be698b288febcf88e3e03c4f0757ea8964e59b63d93708b138cc42a66eb3')
    expect(text.results.find(result => result.id === 'xxhash64')?.hex).toBe('ef46db3751d8e999')
    for (const [index, result] of text.results.entries()) expect(result.hex).toHaveLength(digestAlgorithms[index]!.bits / 4)
  })
})

describe('文件分块、边界和格式', () => {
  it('二进制文件跨块读取不会截断，多个算法共享读取并报告进度', async () => {
    const bytes = new Uint8Array(digestChunkBytes + 17)
    for (let index = 0; index < bytes.length; index++) bytes[index] = index % 256
    const file = new Blob([bytes])
    const slice = vi.spyOn(file, 'slice')
    const progress = vi.fn()
    const output = await calculateDigests({ source: file, algorithms: ['sha256', 'md5'] }, progress)
    expect(slice).toHaveBeenCalledTimes(2)
    expect(output.bytes).toBe(bytes.length)
    for (const result of output.results) expect(result.hex).toBe(createHash(result.id).update(bytes).digest('hex'))
    expect(progress).toHaveBeenCalledWith(digestChunkBytes, bytes.length)
    expect(progress).toHaveBeenLastCalledWith(bytes.length, bytes.length)
  })
  it('输入保留空白、换行与 Unicode 形式，不能把摘要当作规范化文本结果', async () => {
    const inputs = ['abc', 'abc ', 'abc\n', 'abc\r\n', 'é', 'e\u0301']
    const outputs = await Promise.all(inputs.map(source => calculateDigests({ source, algorithms: ['sha256'] })))
    expect(new Set(outputs.map(output => output.results[0]!.hex)).size).toBe(inputs.length)
  })
  it('拒绝无算法、未知或重复算法；文本按 UTF-8 字节限制，文件按大小限制', () => {
    for (const algorithms of [[], ['constructor'], ['md5', 'md5']]) expect(() => validateAlgorithms(algorithms)).toThrow()
    expect(digestSourceSize('a'.repeat(maxTextBytes))).toBe(maxTextBytes)
    expect(() => digestSourceSize('a'.repeat(maxTextBytes + 1))).toThrow('1 MiB')
    expect(() => digestSourceSize('中'.repeat(Math.floor(maxTextBytes / 3) + 1))).toThrow('1 MiB')
    class OversizedBlob extends Blob { get size() { return maxFileBytes + 1 } }
    expect(() => digestSourceSize(new OversizedBlob())).toThrow('512 MiB')
    expect(() => digestSourceSize(null as unknown as Blob)).toThrow('有效文件')
  })
  it('读取文件失败提供明确错误', async () => {
    const file = new Blob(['abc'])
    vi.spyOn(file, 'slice').mockReturnValue({ arrayBuffer: () => Promise.reject(new Error('read failed')) } as Blob)
    await expect(calculateDigests({ source: file, algorithms: ['md5'] })).rejects.toThrow('读取文件失败')
  })
  it('大小写与 Base64 对应原始字节并保留前导零，拒绝非法 Hex', () => {
    expect(formatDigest('00AbFF', 'hex')).toBe('00abff')
    expect(formatDigest('00abff', 'hex-upper')).toBe('00ABFF')
    expect(formatDigest('00abff', 'base64')).toBe('AKv/')
    for (const hex of ['', '0', '0g', ' 00']) expect(() => formatDigest(hex, 'hex')).toThrow()
  })
})
