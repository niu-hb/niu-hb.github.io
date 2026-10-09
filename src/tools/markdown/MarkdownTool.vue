<script setup lang="ts">
import { computed, defineComponent, ref } from 'vue'
import { ElButton } from 'element-plus/es/components/button/index'
import { ElInput } from 'element-plus/es/components/input/index'
import { ElCheckbox } from 'element-plus/es/components/checkbox/index'
import { markdownExample, renderMarkdown } from './logic'

const input = ref('')
const loadImages = ref(false)
const mobileView = ref<'edit' | 'preview'>('edit')
const feedback = ref('')
const preview = computed(() => {
  try {
    return { node: renderMarkdown(input.value, loadImages.value), error: '' }
  } catch (cause) {
    return { node: null, error: cause instanceof Error ? cause.message : '预览失败' }
  }
})
const Preview = defineComponent({ setup: () => () => preview.value.node })

/** 复制当前 Markdown 源码；无参数、无返回值，失败时提供手动复制提示。 */
async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(input.value)
    feedback.value = '已复制 Markdown 源码'
  } catch {
    feedback.value = '复制失败，请手动选择源码复制'
  }
}
</script>

<template>
  <section class="tool-surface markdown-tool">
    <div class="toolbar">
      <ElButton @click="input = markdownExample">
        填入示例
      </ElButton>
      <ElButton @click="input = ''; feedback = ''">
        清空
      </ElButton>
      <ElButton
        :disabled="!input"
        @click="copy"
      >
        复制源码
      </ElButton>
      <ElCheckbox v-model="loadImages">
        加载外部图片（会访问图片地址）
      </ElCheckbox>
    </div>
    <div class="toolbar mobile-switch">
      <ElButton
        :type="mobileView === 'edit' ? 'primary' : 'default'"
        @click="mobileView = 'edit'"
      >
        编辑
      </ElButton>
      <ElButton
        :type="mobileView === 'preview' ? 'primary' : 'default'"
        @click="mobileView = 'preview'"
      >
        预览
      </ElButton>
    </div>
    <div class="workbench">
      <div
        class="editor-panel"
        :class="{ 'mobile-hidden': mobileView !== 'edit' }"
      >
        <div class="panel-header">
          <label for="markdown-input">Markdown 源码（支持手动编辑）</label>
        </div>
        <ElInput
          id="markdown-input"
          v-model="input"
          type="textarea"
          :rows="22"
          aria-label="Markdown 源码"
          placeholder="在这里输入 Markdown…"
        />
      </div>
      <div
        class="editor-panel"
        :class="{ 'mobile-hidden': mobileView !== 'preview' }"
      >
        <div class="panel-header">
          实时预览
        </div>
        <div class="markdown-preview">
          <Preview /><p
            v-if="!input"
            class="muted"
          >
            输入 Markdown 后显示预览
          </p>
        </div>
      </div>
    </div>
    <p
      v-if="preview.error"
      class="error-message"
      role="alert"
    >
      {{ preview.error }}
    </p>
    <p
      v-if="feedback"
      class="feedback"
      role="status"
    >
      {{ feedback }}
    </p>
    <div class="tool-notes">
      <p>按 CommonMark 规则解析标题、段落、强调、引用、列表、链接、图片、行内代码和代码块，并补充表格、删除线、任务列表。普通换行按标准规则处理，行尾两个空格可强制换行。</p>
      <p>支持源码手动编辑与实时预览，不支持直接编辑预览。原始 HTML 显示为文本；外部链接和图片只允许 HTTP/HTTPS，外部图片默认不加载。内置示例只展示当前支持的语法。</p>
      <p>代码块保留文本，不提供语法着色；暂不支持数学公式、Mermaid、脚注或自动标题锚点。最多 100,000 字符，源码不自动保存。</p>
    </div>
  </section>
</template>

<style scoped>
.mobile-switch { display: none; }
.markdown-preview { min-height: 550px; max-height: 750px; overflow: auto; padding: 18px; border: 1px solid #dcdfe6; border-radius: 8px; overflow-wrap: anywhere; }
:deep(.markdown-body) { line-height: 1.8; }
:deep(.markdown-body h1), :deep(.markdown-body h2), :deep(.markdown-body h3) { margin: 1em 0 .5em; line-height: 1.4; }
:deep(.markdown-body pre) { padding: 12px; background: #f3f5ef; overflow: auto; }
:deep(.markdown-body code) { font-family: Consolas, monospace; background: #f3f5ef; }
:deep(.markdown-body blockquote) { border-left: 3px solid #90ad9f; padding-left: 14px; margin-left: 0; color: #667660; }
:deep(.markdown-body a) { color: #205c46; text-decoration: underline; }
:deep(.markdown-body table) { border-collapse: collapse; display: block; overflow: auto; }
:deep(.markdown-body th), :deep(.markdown-body td) { border: 1px solid #dcdfe6; padding: 6px 12px; }
:deep(.markdown-body img) { max-width: 100%; }
:deep(.image-placeholder) { color: #71806f; font-size: 13px; }
@media (max-width: 700px) { .workbench { grid-template-columns: 1fr; } .mobile-switch { display: flex; } .mobile-hidden { display: none; } .markdown-preview { min-height: 350px; } }
</style>
