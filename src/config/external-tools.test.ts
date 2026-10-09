import { describe, expect, it } from 'vitest'
import config from './external-tools.json'
import { isSafeIcon, parseExternalTools } from './external-tools'

const example = { id: 'example', name: '示例网站', url: 'https://example.com', icon: '/favicon.svg', description: '配置示例', category: '其他' }
describe('第三方配置', () => {
  it('实际 JSON 配置有效', () => { expect(() => parseExternalTools(config)).not.toThrow() })
  it('支持空配置、默认排序和显式排序', () => {
    expect(parseExternalTools([])).toEqual([])
    expect(parseExternalTools([example])[0]?.order).toBe(0)
    expect(parseExternalTools([{ ...example, order: 2 }, { ...example, id: 'another', order: 1 }])[0]?.id).toBe('another')
  })
  it('拒绝缺失字段、重复标识与危险网址', () => {
    expect(() => parseExternalTools({})).toThrow()
    expect(() => parseExternalTools([{}])).toThrow()
    expect(() => parseExternalTools([example, example])).toThrow()
    expect(() => parseExternalTools([{ ...example, url: 'javascript:alert(1)' }])).toThrow()
    expect(() => parseExternalTools([{ ...example, icon: '//example.com/icon' }])).toThrow()
    expect(() => parseExternalTools([{ ...example, order: '1' }])).toThrow()
    expect(isSafeIcon('/\\example.com')).toBe(false)
    expect(isSafeIcon('data:image/svg+xml,test')).toBe(false)
  })
})
