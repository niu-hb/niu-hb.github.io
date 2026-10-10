import { createCipheriv, createDecipheriv, publicEncrypt, privateDecrypt, constants } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  decodeCipherBytes, encodeCipherBytes, generateAesKey, generateCipherIv, generateRsaKeys,
  maxPlaintextBytes, parseRsaPem, transformCipher, validateCipherInput, type CipherAlgorithm, type CipherInput,
} from './logic'

/** 创建一次性测试配置；algorithm 为模式、keyBits 为 AES 位数，返回随机参数，不使用固定真实密钥。 */
function aesInput(algorithm: CipherAlgorithm = 'AES-GCM', keyBits = 256): CipherInput {
  return { algorithm, operation: 'encrypt', format: 'base64', text: '中文😀\n e\u0301\0 ', keyHex: generateAesKey(keyBits), ivHex: generateCipherIv(algorithm), aad: '测试 AAD', rsaKey: '', label: '' }
}

describe('AES 与独立接口兼容', () => {
  it('GCM / CBC / CTR 在全部 AES 密钥长度下与 Node 密文一致，双向解密保留文本', async () => {
    for (const algorithm of ['AES-GCM', 'AES-CBC', 'AES-CTR'] as const) {
      for (const bits of [128, 192, 256] as const) {
        const input = aesInput(algorithm, bits)
        const key = Buffer.from(input.keyHex, 'hex')
        const iv = Buffer.from(input.ivHex, 'hex')
        const name = `aes-${bits}-${algorithm.slice(4).toLowerCase()}`
        const gcm = algorithm === 'AES-GCM' ? createCipheriv(`aes-${bits}-gcm`, key, iv) : undefined
        const cipher = gcm ?? createCipheriv(name, key, iv)
        gcm?.setAAD(Buffer.from(input.aad, 'utf8'))
        let independent = Buffer.concat([cipher.update(input.text, 'utf8'), cipher.final()])
        if (gcm) independent = Buffer.concat([independent, gcm.getAuthTag()])
        const encrypted = await transformCipher(input)
        expect(encrypted.text).toBe(independent.toString('base64'))
        expect(encrypted.inputBytes).toBe(Buffer.byteLength(input.text))
        const decrypted = await transformCipher({ ...input, operation: 'decrypt', text: encrypted.text })
        expect(decrypted.text).toBe(input.text)
        const gcmDecipher = algorithm === 'AES-GCM' ? createDecipheriv(`aes-${bits}-gcm`, key, iv) : undefined
        const decipher = gcmDecipher ?? createDecipheriv(name, key, iv)
        if (gcmDecipher) {
          gcmDecipher.setAAD(Buffer.from(input.aad, 'utf8'))
          gcmDecipher.setAuthTag(independent.subarray(-16))
          independent = independent.subarray(0, -16)
        }
        expect(Buffer.concat([decipher.update(independent), decipher.final()]).toString('utf8')).toBe(input.text)
      }
    }
  })
  it('空明文、BOM、Unicode、空白与换行完整往返，CTR 空密文也可解密', async () => {
    for (const algorithm of ['AES-GCM', 'AES-CBC', 'AES-CTR'] as const) {
      for (const text of ['', '\uFEFF中文😀\r\n ', ' a\n\n']) {
        const input = { ...aesInput(algorithm), text, format: 'hex' as const }
        const encrypted = await transformCipher(input)
        expect((await transformCipher({ ...input, operation: 'decrypt', text: encrypted.text })).text).toBe(text)
      }
    }
  })
  it('GCM 的错误密钥、IV、AAD 和篡改标签均失败，不返回原文', async () => {
    const input = aesInput()
    const encrypted = await transformCipher(input)
    const bytes = decodeCipherBytes(encrypted.text, 'base64')
    bytes[bytes.length - 1] = bytes[bytes.length - 1]! ^ 1
    for (const change of [{ keyHex: generateAesKey(256) }, { ivHex: generateCipherIv('AES-GCM') }, { aad: '不同' }, { text: encodeCipherBytes(bytes, 'base64') }]) {
      await expect(transformCipher({ ...input, operation: 'decrypt', text: encrypted.text, ...change })).rejects.toThrow('解密失败')
    }
  })
  it('CTR 的非 UTF-8 明文反馈明确，CBC 非整块密文提前拒绝', async () => {
    const input = aesInput('AES-CTR')
    const cipher = createCipheriv('aes-256-ctr', Buffer.from(input.keyHex, 'hex'), Buffer.from(input.ivHex, 'hex'))
    const bytes = Buffer.concat([cipher.update(Buffer.from([255, 254])), cipher.final()])
    await expect(transformCipher({ ...input, operation: 'decrypt', text: bytes.toString('base64') })).rejects.toThrow('不是有效 UTF-8')
    expect(() => validateCipherInput({ ...aesInput('AES-CBC'), operation: 'decrypt', text: 'YQ==' })).toThrow('16 字节整数倍')
  })
})

describe('RSA-OAEP', () => {
  it('PEM 生成、导入和 Node RSA-OAEP / SHA-256 双向兼容', async () => {
    const keys = await generateRsaKeys(2048)
    expect(keys.publicKey).toContain('BEGIN PUBLIC KEY')
    expect(keys.privateKey).toContain('BEGIN PRIVATE KEY')
    const input: CipherInput = { ...aesInput(), algorithm: 'RSA-OAEP', rsaKey: keys.publicKey, label: '标签' }
    const encrypted = await transformCipher(input)
    const decrypted = privateDecrypt({ key: keys.privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256', oaepLabel: Buffer.from(input.label) }, Buffer.from(encrypted.text, 'base64'))
    expect(decrypted.toString('utf8')).toBe(input.text)
    const independent = publicEncrypt({ key: keys.publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256', oaepLabel: Buffer.from(input.label) }, Buffer.from(input.text))
    expect((await transformCipher({ ...input, operation: 'decrypt', rsaKey: keys.privateKey, text: independent.toString('base64') })).text).toBe(input.text)
    await expect(transformCipher({ ...input, operation: 'decrypt', rsaKey: keys.privateKey, text: encrypted.text, label: '错误' })).rejects.toThrow('解密失败')
    await expect(transformCipher({ ...input, text: 'a'.repeat(191) })).rejects.toThrow('190')
    const boundary = await transformCipher({ ...input, text: 'a'.repeat(190) })
    expect(boundary.outputBytes).toBe(256)
    await expect(transformCipher({ ...input, text: '中'.repeat(64) })).rejects.toThrow('190')
    await expect(transformCipher({ ...input, operation: 'decrypt', rsaKey: keys.privateKey, text: 'YQ==' })).rejects.toThrow('256 字节')
  })
  it('拒绝错误 PEM 类型、格式、生成长度及伪造 DER 内容', async () => {
    for (const pem of ['', '-----BEGIN RSA PRIVATE KEY-----\nYQ==\n-----END RSA PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----\nZh==\n-----END PRIVATE KEY-----']) expect(() => parseRsaPem(pem, true)).toThrow()
    await expect(generateRsaKeys(1024)).rejects.toThrow('2048')
    const input = { ...aesInput(), algorithm: 'RSA-OAEP' as const, rsaKey: '-----BEGIN PUBLIC KEY-----\nYQ==\n-----END PUBLIC KEY-----' }
    await expect(transformCipher(input)).rejects.toThrow('密钥导入失败')
  })
})

describe('格式、参数和边界', () => {
  it('二进制 Hex / Base64 保留前导零，拒绝非法填充与编码', () => {
    const bytes = new Uint8Array([0, 171, 255])
    expect(encodeCipherBytes(bytes, 'base64')).toBe('AKv/')
    expect(encodeCipherBytes(bytes, 'hex')).toBe('00abff')
    expect(decodeCipherBytes(' 00 AB ff\n', 'hex')).toEqual(bytes)
    expect(decodeCipherBytes(' AKv/\n', 'base64')).toEqual(bytes)
    for (const text of ['0', '0x00', 'gg', '😀']) expect(() => decodeCipherBytes(text, 'hex')).toThrow()
    for (const text of ['Zh==', 'YQ', 'YQ===', 'AKv_', '=YQ=']) expect(() => decodeCipherBytes(text, 'base64')).toThrow()
  })
  it('长度按 UTF-8 字节校验，非法 AES 参数和未知模式提前拒绝', () => {
    const input = aesInput()
    expect(validateCipherInput({ ...input, text: 'a'.repeat(maxPlaintextBytes) })).toHaveLength(maxPlaintextBytes)
    for (const change of [{ text: 'a'.repeat(maxPlaintextBytes + 1) }, { text: '中'.repeat(Math.floor(maxPlaintextBytes / 3) + 1) }, { keyHex: 'abc' }, { keyHex: '00'.repeat(15) }, { ivHex: '00'.repeat(16) }, { aad: 'a'.repeat(4097) }, { algorithm: 'DES' as CipherAlgorithm }]) expect(() => validateCipherInput({ ...input, ...change })).toThrow()
    expect(() => validateCipherInput({ ...input, operation: 'decrypt', text: '' })).toThrow('认证标签')
    expect(() => generateAesKey(64)).toThrow()
    expect(generateAesKey(192)).toHaveLength(48)
    expect(generateCipherIv('AES-GCM')).not.toBe(generateCipherIv('AES-GCM'))
  })
})
