import type JsBarcode from 'jsbarcode'

export const barcodeFormats = ['CODE128', 'CODE39', 'EAN13', 'EAN8', 'UPC', 'ITF'] as const
export type BarcodeFormat = typeof barcodeFormats[number]
export interface BarcodeSettings { text: string; format: BarcodeFormat; width: number; height: number; displayValue: boolean }

/** 校验条形码设置；settings 为内容、格式和尺寸，返回编码器选项，拒绝不适合当前格式的字符与尺寸。 */
export function barcodeOptions(settings: BarcodeSettings): JsBarcode.Options {
  if (!barcodeFormats.includes(settings.format)) throw new Error('请选择支持的条形码格式')
  if (!settings.text || settings.text.length > 80) throw new Error('条形码内容需为 1–80 个字符')
  if (!Number.isInteger(settings.width) || settings.width < 1 || settings.width > 4) throw new Error('条宽需为 1–4 px 的整数')
  if (!Number.isInteger(settings.height) || settings.height < 40 || settings.height > 200) throw new Error('条高需为 40–200 px 的整数')
  if (settings.format === 'CODE128' && !/^[\x20-\x7e]+$/.test(settings.text)) throw new Error('CODE128 支持可打印 ASCII 字符，不支持中文或表情')
  if (settings.format === 'CODE39' && !/^[0-9A-Z .\-$/+%]+$/.test(settings.text)) throw new Error('CODE39 支持数字、大写英文字母及空格 . - $ / + %')
  const lengths = { EAN13: [12, 13], EAN8: [7, 8], UPC: [11, 12] }
  if (settings.format in lengths) {
    const allowed = lengths[settings.format as keyof typeof lengths]
    if (!/^\d+$/.test(settings.text) || !allowed.includes(settings.text.length)) throw new Error(`${settings.format} 需输入 ${allowed.join(' 或 ')} 位数字；少一位时自动补校验位`)
  }
  if (settings.format === 'ITF' && (!/^\d+$/.test(settings.text) || settings.text.length % 2)) throw new Error('ITF 需输入偶数位数字')
  return { format: settings.format, width: settings.width, height: settings.height, displayValue: settings.displayValue, margin: settings.width * 10, fontSize: 18, background: '#ffffff', lineColor: '#000000' }
}
