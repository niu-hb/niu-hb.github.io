// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { barcodeOptions, type BarcodeSettings } from './logic'
import { createBarcode } from './render'

const settings: BarcodeSettings = { text: 'HELLO2026', format: 'CODE128', width: 2, height: 100, displayValue: true }
// jsdom 没有画布测字能力；只替换文字测量，实际编码与 SVG 渲染仍由编码器完成。
beforeEach(() => vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ measureText: (text: string) => ({ width: text.length * 10 }) } as unknown as CanvasRenderingContext2D))
afterEach(() => vi.restoreAllMocks())
describe('条形码编码与边界', () => {
  it('生成真实 SVG 条纹及文字，保留静区且可关闭文字', () => {
    const svg = createBarcode(settings)
    expect(svg.querySelectorAll('rect').length).toBeGreaterThan(20)
    expect(svg.querySelector('text')?.textContent).toBe(settings.text)
    expect(barcodeOptions(settings).margin).toBe(20)
    expect(createBarcode({ ...settings, displayValue: false }).querySelector('text')).toBeNull()
  })
  it('支持六种格式，EAN/UPC 自动补校验位且拒绝错误校验位', () => {
    for (const [format, text] of [['EAN13', '590123412345'], ['EAN8', '9638507'], ['UPC', '03600029145'], ['CODE39', 'ABC-123'], ['ITF', '123456']] as const) {
      expect(createBarcode({ ...settings, format, text }).querySelector('rect')).not.toBeNull()
    }
    expect(createBarcode({ ...settings, format: 'EAN13', text: '590123412345' }).querySelector('text')?.textContent).toBeDefined()
    expect(() => createBarcode({ ...settings, format: 'EAN13', text: '5901234123458' })).toThrow('校验位')
  })
  it('拒绝空输入、中文表情、非法字符、长度和尺寸，接受边界值', () => {
    for (const text of ['', '你好', '😀', 'A'.repeat(81)]) expect(() => createBarcode({ ...settings, text })).toThrow()
    expect(() => createBarcode({ ...settings, format: 'CODE39', text: 'abc' })).toThrow('大写')
    expect(() => createBarcode({ ...settings, format: 'ITF', text: '123' })).toThrow('偶数')
    expect(() => createBarcode({ ...settings, format: 'EAN8', text: '123456' })).toThrow('位')
    for (const width of [0, 5, NaN, 1.5]) expect(() => barcodeOptions({ ...settings, width })).toThrow('条宽')
    for (const height of [39, 201, NaN]) expect(() => barcodeOptions({ ...settings, height })).toThrow('条高')
    expect(createBarcode({ ...settings, text: 'A'.repeat(80), width: 4, height: 200 }).getAttribute('width')).toBeTruthy()
    expect(() => createBarcode({ ...settings, text: '<SCRIPT>' })).not.toThrow()
    expect(createBarcode({ ...settings, text: '<SCRIPT>' }).querySelector('script')).toBeNull()
  })
})
