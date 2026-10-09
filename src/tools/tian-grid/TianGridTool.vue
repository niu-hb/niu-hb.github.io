<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElButton } from 'element-plus/es/components/button/index'
import { ElInput } from 'element-plus/es/components/input/index'
import { ElInputNumber } from 'element-plus/es/components/input-number/index'
import { ElCheckbox } from 'element-plus/es/components/checkbox/index'
import { ElColorPicker } from 'element-plus/es/components/color-picker/index'
import { createPracticeGrid } from './logic'

const rows = ref<number | undefined>(12)
const columns = ref<number | undefined>(8)
const content = ref('春眠不觉晓\n处处闻啼鸟\n夜来风雨声\n花落知多少')
const showDashes = ref(true)
const tracing = ref(false)
const textColor = ref<string | null>('#ff0000')
const dashColor = ref<string | null>('#999999')
const printError = ref('')
const preview = computed(() => {
  try {
    const grid = createPracticeGrid({
      rows: rows.value ?? NaN,
      columns: columns.value ?? NaN,
      content: content.value,
    })
    return { grid, error: '' }
  } catch (cause) {
    return { grid: null, error: cause instanceof Error ? cause.message : '生成失败，请检查输入' }
  }
})

/** 打印当前 A4 预览；无参数、无返回值，通过浏览器打印对话框打印或保存 PDF，失败时显示错误。 */
function printPage(): void {
  if (!preview.value.grid) return
  try {
    printError.value = ''
    window.print()
  } catch {
    printError.value = '无法打开打印对话框，请使用浏览器菜单中的打印功能'
  }
}
</script>
<template>
  <section class="tian-tool">
    <div class="tool-surface grid-controls">
      <div class="grid-dimensions">
        <label class="form-field">行数（1–20）<ElInputNumber
          v-model="rows"
          :min="1"
          :max="20"
          :step="1"
          :precision="0"
          controls-position="right"
          aria-label="田字格行数"
        /></label>
        <label class="form-field">列数（1–15）<ElInputNumber
          v-model="columns"
          :min="1"
          :max="15"
          :step="1"
          :precision="0"
          controls-position="right"
          aria-label="田字格列数"
        /></label>
      </div>
      <ElCheckbox
        v-model="showDashes"
      >
        显示内部虚线
      </ElCheckbox>
      <ElCheckbox
        v-model="tracing"
      >
        描红模式（浅灰文字与虚线）
      </ElCheckbox>
      <div class="form-field">
        <label for="grid-text-color">文字颜色</label><ElColorPicker
          id="grid-text-color"
          v-model="textColor"
          :disabled="tracing"
          aria-label="田字格文字颜色"
        />
      </div>
      <div class="form-field">
        <label for="grid-dash-color">虚线颜色</label><ElColorPicker
          id="grid-dash-color"
          v-model="dashColor"
          :disabled="tracing || !showDashes"
          aria-label="田字格虚线颜色"
        />
      </div>
      <label class="form-field">练习内容<ElInput
        v-model="content"
        type="textarea"
        :rows="6"
        aria-label="田字格练习内容"
      /></label>
      <ElButton
        type="primary"
        :disabled="!preview.grid"
        @click="printPage"
      >
        打印 / 保存 PDF
      </ElButton>
      <div class="tool-notes">
        <p>设置行列数并输入练习内容，预览会实时更新。每行文字对应一行格子；内容留空可生成空白练习纸。</p>
        <p>描红模式使用浅灰文字与虚线。清空颜色时使用默认红色文字、灰色虚线。文字优先使用设备上的楷体，未安装时使用系统衬线字体。</p>
        <p>每次生成一张 A4 页面，页边距 10mm。打印请选择 A4、100% 缩放，并关闭页眉页脚；也可在打印对话框中保存 PDF。</p>
      </div>
      <p
        v-if="preview.error || printError"
        class="error-message"
        role="alert"
      >
        {{ preview.error || printError }}
      </p>
      <p
        v-if="preview.grid?.truncated"
        class="error-message"
        role="status"
      >
        部分文字超出当前行列数，未放入预览；请增加行列数或分次打印。
      </p>
    </div>
    <div
      v-if="preview.grid"
      class="paper-preview"
    >
      <svg
        class="practice-paper"
        viewBox="0 0 210 297"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="A4 田字格预览"
      >
        <rect
          width="210"
          height="297"
          fill="white"
        />
        <g
          v-for="(cell, index) in preview.grid.cells"
          :key="index"
        >
          <rect
            :x="cell.x"
            :y="cell.y"
            :width="preview.grid.cellSize"
            :height="preview.grid.cellSize"
            fill="none"
            stroke="#000000"
            stroke-width="0.3"
          />
          <g
            v-if="showDashes"
            :stroke="tracing ? '#eeeeee' : (dashColor ?? '#999999')"
            stroke-width="0.2"
            stroke-dasharray="1 1"
          >
            <line
              :x1="cell.x"
              :y1="cell.y + preview.grid.cellSize / 2"
              :x2="cell.x + preview.grid.cellSize"
              :y2="cell.y + preview.grid.cellSize / 2"
            />
            <line
              :x1="cell.x + preview.grid.cellSize / 2"
              :y1="cell.y"
              :x2="cell.x + preview.grid.cellSize / 2"
              :y2="cell.y + preview.grid.cellSize"
            />
          </g>
          <text
            :x="cell.x + preview.grid.cellSize / 2"
            :y="cell.y + preview.grid.cellSize / 2"
            text-anchor="middle"
            dominant-baseline="central"
            :font-size="Math.min(preview.grid.cellSize * 0.75, 60)"
            :fill="tracing ? '#d9d9d9' : (textColor ?? '#ff0000')"
            font-family="KaiTi, STKaiti, 楷体, serif"
          >{{ cell.text }}</text>
        </g>
      </svg>
    </div>
  </section>
</template>
<style scoped>
.tian-tool { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 24px; align-items: start; }
.grid-dimensions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.grid-controls .el-input-number { width: 100%; }
.grid-controls .el-checkbox { display: flex; margin: 0 0 12px; height: auto; }
.grid-controls :deep(.el-checkbox__label) { white-space: normal; line-height: 1.6; }
.paper-preview { padding: 16px; background: #edf0e5; min-width: 0; border-radius: 12px; }
.practice-paper { display: block; width: 100%; height: auto; box-shadow: 0 3px 15px #24362f20; }
@media (max-width: 800px) { .tian-tool { grid-template-columns: 1fr; } }
@media print {
  @page { size: A4 portrait; margin: 0; }
  :global(body:has(.tian-tool)) { background: white; }
  :global(body:has(.tian-tool) .site-header), :global(body:has(.tian-tool) .site-footer), :global(body:has(.tian-tool) .back-link), :global(body:has(.tian-tool) .tool-heading) { display: none !important; }
  :global(body:has(.tian-tool) .site-main) { margin: 0; padding: 0; max-width: none; min-height: 0; }
  .grid-controls { display: none !important; }
  .tian-tool { display: block; }
  .paper-preview { padding: 0; border-radius: 0; background: white; }
  .practice-paper { width: 210mm; height: 297mm; box-shadow: none; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
}
</style>
