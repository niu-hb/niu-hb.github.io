import JsBarcode from 'jsbarcode'
import { barcodeOptions, type BarcodeSettings } from './logic'

/** 生成独立 SVG；settings 为条形码设置，返回 SVG 节点，编码或校验位错误时抛出中文反馈。 */
export function createBarcode(settings: BarcodeSettings): SVGSVGElement {
  const options = barcodeOptions(settings)
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  try {
    JsBarcode(svg, settings.text, options)
  } catch {
    throw new Error('内容不符合所选条形码格式，请检查字符、位数及校验位')
  }
  return svg
}
