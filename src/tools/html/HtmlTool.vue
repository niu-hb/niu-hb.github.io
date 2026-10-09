<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { ElButton } from 'element-plus/es/components/button/index'
import { ElSelect, ElOption } from 'element-plus/es/components/select/index'
import TextWorkbench from '../../components/TextWorkbench.vue'
import { formatHtml, htmlExample } from './logic'

const input = ref('')
const indent = ref<2 | 4>(2)
const output = ref('')
const error = ref('')
const busy = ref(false)
let revision = 0
watch([input, indent], () => {
  revision++
  output.value = ''
  error.value = ''
  busy.value = false
}, { flush: 'sync' })
onBeforeUnmount(() => { revision++ })

/** 格式化当前 HTML；无参数、无返回值，异步失败显示错误，输入变更后丢弃旧结果。 */
async function run(): Promise<void> {
  const current = ++revision
  busy.value = true
  error.value = ''
  try {
    const result = await formatHtml(input.value, indent.value)
    if (current === revision) output.value = result
  } catch (cause) {
    if (current === revision) {
      output.value = ''
      error.value = cause instanceof Error ? cause.message : '格式化失败'
    }
  } finally {
    if (current === revision) busy.value = false
  }
}
</script>

<template>
  <section class="tool-surface">
    <div class="toolbar">
      <ElButton
        type="primary"
        :loading="busy"
        @click="run"
      >
        格式化
      </ElButton>
      <label for="html-indent">缩进</label>
      <ElSelect
        id="html-indent"
        v-model="indent"
        class="small-select"
        aria-label="HTML 缩进"
      >
        <ElOption
          label="2 空格"
          :value="2"
        /><ElOption
          label="4 空格"
          :value="4"
        />
      </ElSelect>
      <ElButton @click="input = htmlExample">
        填入示例
      </ElButton>
    </div>
    <TextWorkbench
      v-model="input"
      :output="output"
      :error="error"
      placeholder="请输入 HTML5 文档或代码片段…"
    />
    <div class="tool-notes">
      <p>支持 HTML5 文档与片段，按元素默认显示方式换行缩进，并保留 pre 与行内文本的有意义空白。自定义 CSS 改变元素显示方式时，请检查格式化后的空白效果。</p>
      <p>HTML5 允许 br、input 等空元素和布尔属性，不能直接使用 XML 格式化。此页只处理源码，不运行脚本、不加载资源，也不提供网页预览。</p>
      <p>script/style 内的代码保留，不单独格式化 JavaScript/CSS；不处理 Vue/JSX 模板。最多 200,000 字符，解析错误会显示提示，格式化不等同于完整 HTML 规范校验。</p>
    </div>
  </section>
</template>
