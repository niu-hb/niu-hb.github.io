<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { ElButton } from 'element-plus/es/components/button/index'
import { ElInput } from 'element-plus/es/components/input/index'
import { ElInputNumber } from 'element-plus/es/components/input-number/index'
import { ElCheckbox } from 'element-plus/es/components/checkbox/index'
import { ElSelect, ElOption } from 'element-plus/es/components/select/index'
import { barcodeFormats, type BarcodeSettings } from './logic'
import { createBarcode } from './render'

const settings = reactive<BarcodeSettings>({ text: 'HELLO2026', format: 'CODE128', width: 2, height: 100, displayValue: true })
const svgText = ref('')
const preview = ref('')
const error = ref('')
const downloading = ref(false)
watch(settings, () => {
  svgText.value = ''
  preview.value = ''
  error.value = ''
})

/** 生成当前内容的预览；无参数、无返回值，失败时清除旧图片并显示原因。 */
function generate(): void {
  svgText.value = ''
  preview.value = ''
  error.value = ''
  try {
    svgText.value = new window.XMLSerializer().serializeToString(createBarcode(settings))
    preview.value = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText.value)}`
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '生成失败，请重试'
  }
}

/** 下载条形码；format 为 SVG 或 PNG，无返回值，转换或下载失败显示错误并释放对象 URL。 */
async function download(format: 'svg' | 'png'): Promise<void> {
  if (!svgText.value || downloading.value) return
  downloading.value = true
  let url = ''
  try {
    let blob = new window.Blob([svgText.value], { type: 'image/svg+xml;charset=utf-8' })
    if (format === 'png') {
      const image = new window.Image()
      image.src = preview.value
      await image.decode()
      const canvas = window.document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext('2d')
      if (!context) throw new Error('浏览器无法创建图片画布')
      context.drawImage(image, 0, 0)
      blob = await new Promise<InstanceType<typeof window.Blob>>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('PNG 导出失败')), 'image/png'))
    }
    url = window.URL.createObjectURL(blob)
    const link = window.document.createElement('a')
    link.href = url
    link.download = `barcode.${format}`
    link.click()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '下载失败，请重试'
  } finally {
    if (url) window.setTimeout(() => window.URL.revokeObjectURL(url), 1000)
    downloading.value = false
  }
}
generate()
</script>

<template>
  <section class="tool-surface">
    <div class="barcode-layout">
      <form
        class="barcode-controls"
        @submit.prevent="generate"
      >
        <label class="form-field">条形码内容<ElInput
          v-model="settings.text"
          aria-label="条形码内容"
          placeholder="输入编码内容"
        /></label>
        <label class="form-field">编码格式<ElSelect
          v-model="settings.format"
          aria-label="编码格式"
        ><ElOption
          v-for="format in barcodeFormats"
          :key="format"
          :value="format"
          :label="format"
        /></ElSelect></label>
        <div class="barcode-sizes">
          <label class="form-field">条宽（px）<ElInputNumber
            v-model="settings.width"
            :min="1"
            :max="4"
            :precision="0"
            aria-label="条宽"
          /></label>
          <label class="form-field">条高（px）<ElInputNumber
            v-model="settings.height"
            :min="40"
            :max="200"
            :precision="0"
            aria-label="条高"
          /></label>
        </div>
        <ElCheckbox v-model="settings.displayValue">
          显示内容文字
        </ElCheckbox>
        <ElButton
          type="primary"
          native-type="submit"
        >
          生成条形码
        </ElButton>
      </form>
      <div class="barcode-output">
        <h2>条形码预览</h2>
        <div class="barcode-preview">
          <img
            v-if="preview"
            :src="preview"
            alt="生成的条形码"
          ><p v-else>
            设置完成后点击生成
          </p>
        </div>
        <div class="toolbar">
          <ElButton
            :disabled="!preview || downloading"
            @click="download('svg')"
          >
            下载 SVG
          </ElButton>
          <ElButton
            :disabled="!preview || downloading"
            @click="download('png')"
          >
            下载 PNG
          </ElButton>
        </div>
      </div>
    </div>
    <p
      v-if="error"
      class="error-message"
      role="alert"
    >
      {{ error }}
    </p>
    <div class="tool-notes">
      <p>CODE128 支持可打印 ASCII；CODE39 使用大写字母与数字；ITF 使用偶数位数字。EAN13、EAN8、UPC 可输入完整编码以校验，或少输入最后一位由工具自动补校验位。</p>
      <p>默认黑条白底，两侧保留至少 10 倍条宽的静区。预览可横向滚动；图片按实际尺寸导出，打印时请保持比例，并用实际扫描设备验证。所有内容在浏览器本地处理。</p>
    </div>
  </section>
</template>

<style scoped>
.barcode-layout { display: grid; grid-template-columns: minmax(260px, 1fr) minmax(0, 1.4fr); gap: 28px; }
.barcode-controls { display: grid; align-content: start; gap: 16px; }
.barcode-sizes { display: flex; flex-wrap: wrap; gap: 16px; }
.barcode-output { min-width: 0; }
.barcode-output h2 { font-size: 16px; }
.barcode-preview { min-height: 210px; display: grid; align-items: center; overflow-x: auto; padding: 20px; margin: 16px 0; background: #fff; border: 1px solid #dfe7d6; border-radius: 12px; }
.barcode-preview img { max-width: none; }
.barcode-preview p { color: #657361; text-align: center; }
@media (max-width: 700px) { .barcode-layout { grid-template-columns: 1fr; } }
</style>
