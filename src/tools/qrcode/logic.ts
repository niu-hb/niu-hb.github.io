import type { Options } from 'qr-code-styling'

export interface QrSettings {
  text: string
  size: number
  foreground: string
  background: string
  dots: 'square' | 'dots' | 'rounded'
  corners: 'square' | 'dot' | 'extra-rounded'
  correction: 'L' | 'M' | 'Q' | 'H'
}

/** 将六位颜色转成相对亮度；color 为十六进制颜色，返回 WCAG 亮度，仅用于扫码对比提示。 */
function luminance(color: string): number {
  const channels = [1, 3, 5].map(offset => {
    const value = parseInt(color.slice(offset, offset + 2), 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722
}

/** 校验二维码设置并生成库选项；settings 为内容与样式，返回选项和扫码风险提示。 */
export function createQrOptions(settings: QrSettings): { options: Options; warning: string } {
  if (!settings.text.trim()) throw new Error('请输入二维码内容')
  if (new TextEncoder().encode(settings.text).length > 2000) throw new Error('二维码内容最多支持 2,000 UTF-8 字节；高纠错级别可能需要进一步缩短')
  if (!Number.isInteger(settings.size) || settings.size < 128 || settings.size > 1024) throw new Error('尺寸必须为 128–1024 的整数')
  for (const color of [settings.foreground, settings.background]) {
    if (!/^#[\da-f]{6}$/i.test(color)) throw new Error('请选择有效的六位十六进制颜色')
  }
  if (!['square', 'dots', 'rounded'].includes(settings.dots) || !['square', 'dot', 'extra-rounded'].includes(settings.corners) || !['L', 'M', 'Q', 'H'].includes(settings.correction)) throw new Error('二维码样式或纠错级别无效')
  const dark = luminance(settings.foreground)
  const light = luminance(settings.background)
  const warning = dark >= light || (light + 0.05) / (dark + 0.05) < 4.5 ? '建议使用深色码点、浅色背景并提高对比度，当前颜色可能影响扫码。' : ''
  return {
    options: {
      // 该浏览器版编码器按字符低八位读取 Byte 模式，先转成 UTF-8 字节串以正确编码中文与表情。
      type: 'svg', width: settings.size, height: settings.size,
      data: Array.from(new TextEncoder().encode(settings.text), byte => String.fromCharCode(byte)).join(''),
      // 按最小 21 模块矩阵预留至少四模块静区；更高密度时留白更宽，不允许关闭。
      margin: Math.ceil(settings.size * 4 / 29),
      qrOptions: { errorCorrectionLevel: settings.correction, mode: 'Byte' },
      dotsOptions: { type: settings.dots, color: settings.foreground },
      cornersSquareOptions: { type: settings.corners, color: settings.foreground },
      cornersDotOptions: { type: settings.corners === 'square' ? 'square' : 'dot', color: settings.foreground },
      backgroundOptions: { color: settings.background },
    }, warning,
  }
}
