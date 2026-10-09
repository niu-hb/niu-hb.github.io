import { describe, expect, it } from 'vitest'
import { formatJson } from './json/logic'
import { transformUrl } from './url/logic'
import { encodeBase64, decodeBase64 } from './base64/logic'
import { countCharacters } from './characters/logic'
import { parseDate, parseTimestamp, formatDate } from './time/logic'

describe('JSON', () => {
  it('格式化、压缩和顶层值', () => {
    expect(formatJson('{"中文":[1,true,null]}', 2)).toBe('{\n  "中文": [\n    1,\n    true,\n    null\n  ]\n}')
    expect(formatJson(' { "a" : 1 } ', 0)).toBe('{"a":1}')
    expect(formatJson('null', 4)).toBe('null')
    expect(formatJson('"hello"', 2)).toBe('"hello"')
  })
  it('拒绝空值和非法语法', () => {
    for (const text of ['', ' ', '{"a":}', '{"a":1,}', 'undefined']) expect(() => formatJson(text, 2)).toThrow()
  })
})

describe('URL', () => {
  it('区分完整 URL 与参数值', () => {
    const text = 'https://example.com/中文?q=a&b=1'
    expect(transformUrl(text, 'uri', false)).toBe('https://example.com/%E4%B8%AD%E6%96%87?q=a&b=1')
    const encoded = transformUrl(text, 'component', false)
    expect(encoded).toContain('%3Fq%3Da%26b%3D1')
    expect(transformUrl(encoded, 'component', true)).toBe(text)
    expect(transformUrl('%2F+a', 'uri', true)).toBe('%2F+a')
    expect(transformUrl('%2F+a', 'component', true)).toBe('/+a')
  })
  it('拒绝不完整和非法 UTF-8 转义', () => {
    for (const text of ['%', '%GG', '%FF', '%E4%B8']) expect(() => transformUrl(text, 'component', true)).toThrow()
    expect(() => transformUrl('\uD800', 'uri', false)).toThrow()
  })
})

describe('Base64', () => {
  it('两种字母表支持 UTF-8 中文、表情与 BOM', () => {
    for (const mode of ['standard', 'url-safe'] as const) {
      for (const text of ['', '你好，世界🌏', '\uFEFFabc', 'a'.repeat(100000)]) expect(decodeBase64(encodeBase64(text, mode), mode)).toBe(text)
    }
    expect(encodeBase64('a', 'url-safe')).toBe('YQ')
    expect(encodeBase64('࠾࠿', 'standard')).toBe('4KC+4KC/')
    expect(encodeBase64('࠾࠿', 'url-safe')).toBe('4KC-4KC_')
    expect(decodeBase64('4KC-4KC_', 'url-safe')).toBe('࠾࠿')
    expect(decodeBase64(' YQ==\n', 'standard')).toBe('a')
  })
  it('拒绝非法长度、填充、非零填充位、二进制和混合字母表', () => {
    for (const text of ['YQ', 'YQ=', 'A===', 'A', 'Y===', 'YR==', '/w==', 'YWJj!']) expect(() => decodeBase64(text, 'standard')).toThrow()
    for (const text of ['A', 'YQ=', 'YR', '+w==']) expect(() => decodeBase64(text, 'url-safe')).toThrow()
    expect(decodeBase64('YQ==', 'url-safe')).toBe('a')
  })
})

describe('字符统计', () => {
  it('码点分类互斥、CRLF 归一且支持扩展汉字', () => {
    const counts = countCharacters('中𠮷Az09 \t\r\n😀!')
    expect(counts).toEqual({ total: 11, chinese: 2, english: 2, digits: 2, spaces: 1, whitespace: 2, other: 2 })
    expect(Object.entries(counts).filter(([key]) => key !== 'total').reduce((sum, [, value]) => sum + value, 0)).toBe(counts.total)
  })
  it('空文本、组合字符和全角空格', () => {
    expect(countCharacters('').total).toBe(0)
    expect(countCharacters('e\u0301').total).toBe(2)
    expect(countCharacters('\u3000').whitespace).toBe(1)
  })
})

describe('时间转换', () => {
  it('秒、毫秒、纪元和负数', () => {
    expect(parseTimestamp('0', 'seconds').toISOString()).toBe('1970-01-01T00:00:00.000Z')
    expect(parseTimestamp('1700000000', 'seconds').getTime()).toBe(1700000000000)
    expect(parseTimestamp('-1', 'milliseconds').getTime()).toBe(-1)
  })
  it('严格验证时间戳', () => {
    for (const text of ['', '1.5', '1e3', 'abc', '9007199254740992', '8640000000000001']) expect(() => parseTimestamp(text, 'milliseconds')).toThrow()
  })
  it('严格验证日期、闰年和早期年份', () => {
    expect(parseDate('2024-02-29 12:34:56.1', 'utc').toISOString()).toBe('2024-02-29T12:34:56.100Z')
    expect(parseDate('0001-01-01 00:00:00', 'utc').getUTCFullYear()).toBe(1)
    for (const text of ['2023-02-29 00:00:00', '2024-04-31 00:00:00', '2024-01-01 24:00:00', '2024-13-01 00:00:00', '2024-00-01 00:00:00', '2024-01-00 00:00:00', '2024-01-01']) expect(() => parseDate(text, 'utc')).toThrow()
  })
  it('本地时间与 UTC 各自往返一致', () => {
    const date = new Date('2024-06-15T12:34:56.789Z')
    for (const zone of ['local', 'utc'] as const) expect(parseDate(formatDate(date, zone), zone).getTime()).toBe(date.getTime())
  })
})
