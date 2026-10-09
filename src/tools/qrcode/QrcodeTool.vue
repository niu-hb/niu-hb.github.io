<script setup lang="ts">
import { onBeforeUnmount, reactive, ref, shallowRef, watch } from 'vue'
import QRCodeStyling from 'qr-code-styling'
import { ElButton } from 'element-plus/es/components/button/index'
import { ElInput } from 'element-plus/es/components/input/index'
import { ElInputNumber } from 'element-plus/es/components/input-number/index'
import { ElColorPicker } from 'element-plus/es/components/color-picker/index'
import { ElSelect, ElOption } from 'element-plus/es/components/select/index'
import { createQrOptions, type QrSettings } from './logic'

const settings = reactive<QrSettings>({ text: '', size: 256, foreground: '#000000', background: '#ffffff', dots: 'square', corners: 'square', correction: 'M' })
const imageUrl = ref('')
const qr = shallowRef<QRCodeStyling>()
const error = ref('')
const warning = ref('')
const busy = ref(false)
const downloading = ref(false)
let revision = 0
let timer: number | undefined

/** 清理预览资源；无参数、无返回值，释放对象 URL 并使旧异步任务失效。 */
function clear(): void {
  revision++
  if (imageUrl.value) window.URL.revokeObjectURL(imageUrl.value)
  imageUrl.value = ''
  qr.value = undefined
  busy.value = false
  error.value = ''
  warning.value = ''
}

/** 根据当前设置生成二维码预览；无参数、无返回值，结果过期时不更新界面。 */
async function generate(): Promise<void> {
  clear()
  const current = revision
  busy.value = true
  try {
    const result = createQrOptions(settings)
    const code = new QRCodeStyling(result.options)
    const blob = await code.getRawData('svg')
    if (current !== revision) return
    if (!(blob instanceof window.Blob)) throw new Error('浏览器未生成有效的二维码图片')
    imageUrl.value = window.URL.createObjectURL(blob)
    qr.value = code
    warning.value = result.warning
  } catch (cause) {
    if (current === revision) error.value = cause instanceof Error ? `生成失败：${cause.message}` : '生成失败，内容可能超过当前纠错级别容量，请缩短内容'
  } finally {
    if (current === revision) busy.value = false
  }
}

watch(settings, () => {
  window.clearTimeout(timer)
  clear()
  if (settings.text) timer = window.setTimeout(() => { void generate() }, 300)
}, { flush: 'sync' })
onBeforeUnmount(() => {
  window.clearTimeout(timer)
  clear()
})

/** 下载二维码图片；extension 为 PNG 或 SVG，无返回值，导出失败显示原因。 */
async function download(extension: 'png' | 'svg'): Promise<void> {
  const code = qr.value
  if (!code) return
  downloading.value = true
  try {
    await code.download({ name: 'qrcode', extension })
  } catch (cause) {
    error.value = cause instanceof Error ? `下载失败：${cause.message}` : '下载失败，请重试'
  } finally {
    downloading.value = false
  }
}
</script>

<template>
  <section class="tool-surface">
    <div class="qr-layout">
      <div class="qr-controls">
        <label class="form-field">二维码内容<ElInput
          v-model="settings.text"
          type="textarea"
          :rows="5"
          aria-label="二维码内容"
          placeholder="输入文本或网址…"
        /></label>
        <div class="qr-fields">
          <label class="form-field">尺寸（128–1024 px）<ElInputNumber
            v-model="settings.size"
            :min="128"
            :max="1024"
            :precision="0"
            aria-label="二维码尺寸"
          /></label>
          <label class="form-field">纠错级别<ElSelect
            v-model="settings.correction"
            aria-label="二维码纠错级别"
          ><ElOption
            v-for="level in ['L', 'M', 'Q', 'H']"
            :key="level"
            :label="level"
            :value="level"
          /></ElSelect></label>
          <label class="form-field">码点形状<ElSelect
            v-model="settings.dots"
            aria-label="码点形状"
          ><ElOption
            label="方形"
            value="square"
          /><ElOption
            label="圆点"
            value="dots"
          /><ElOption
            label="圆角"
            value="rounded"
          /></ElSelect></label>
          <label class="form-field">定位角样式<ElSelect
            v-model="settings.corners"
            aria-label="定位角样式"
          ><ElOption
            label="方形"
            value="square"
          /><ElOption
            label="圆形"
            value="dot"
          /><ElOption
            label="圆角"
            value="extra-rounded"
          /></ElSelect></label>
          <div class="form-field">
            <label for="qr-foreground">码点颜色</label><ElColorPicker
              id="qr-foreground"
              v-model="settings.foreground"
              color-format="hex"
              aria-label="码点颜色"
            />
          </div>
          <div class="form-field">
            <label for="qr-background">背景颜色</label><ElColorPicker
              id="qr-background"
              v-model="settings.background"
              color-format="hex"
              aria-label="背景颜色"
            />
          </div>
        </div>
        <div class="toolbar">
          <ElButton
            type="primary"
            :loading="busy"
            @click="generate"
          >
            生成二维码
          </ElButton>
          <ElButton
            :disabled="!qr || downloading"
            @click="download('png')"
          >
            下载 PNG
          </ElButton>
          <ElButton
            :disabled="!qr || downloading"
            @click="download('svg')"
          >
            下载 SVG
          </ElButton>
        </div>
      </div>
      <div class="qr-preview">
        <img
          v-if="imageUrl"
          :src="imageUrl"
          alt="生成的二维码"
          :width="settings.size"
          :height="settings.size"
        >
        <p
          v-else
          class="muted"
        >
          {{ busy ? '正在生成…' : '输入内容后显示二维码预览' }}
        </p>
      </div>
    </div>
    <p
      v-if="error"
      class="error-message"
      role="alert"
    >
      {{ error }}
    </p>
    <p
      v-if="warning"
      class="error-message"
      role="status"
    >
      {{ warning }}
    </p>
    <div class="tool-notes">
      <p>输入内容后自动更新，也可点击生成。支持尺寸、颜色、码点和定位角样式，整体保持常规方形二维码并保留扫码留白。</p>
      <p>纠错 L/M/Q/H 依次增强，但容量随之降低。内容最多 2,000 UTF-8 字节，高纠错时可能需要缩短；复杂内容建议增大尺寸，使用深色码点与浅色背景，并在使用前实际扫码确认。</p>
      <p>PNG 用于普通图片，SVG 可无损缩放。不添加 Logo 或复杂外形；内容本地处理，不会访问输入的网址。</p>
    </div>
  </section>
</template>

<style scoped>
.qr-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 24px; align-items: start; }
.qr-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin: 18px 0; }
.qr-fields .el-input-number { width: 100%; }
.qr-preview { min-height: 300px; display: grid; place-items: center; padding: 20px; background: #f8f9f5; border-radius: 10px; }
.qr-preview img { max-width: 100%; height: auto; }
@media (max-width: 700px) { .qr-layout { grid-template-columns: 1fr; } }
</style>
