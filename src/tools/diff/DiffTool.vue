<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElButton } from 'element-plus/es/components/button/index'
import { ElInput } from 'element-plus/es/components/input/index'
import { ElSelect, ElOption } from 'element-plus/es/components/select/index'
import { compareTexts, splitDiffLines, type DiffLine } from './logic'

const left = ref('')
const right = ref('')
const lines = ref<DiffLine[] | null>(null)
const error = ref('')
const view = ref<'merged' | 'split'>('merged')
const splitRows = computed(() => splitDiffLines(lines.value ?? []))
const added = computed(() => lines.value?.filter(line => line.kind === 'added').length ?? 0)
const removed = computed(() => lines.value?.filter(line => line.kind === 'removed').length ?? 0)
watch([left, right], () => {
  lines.value = null
  error.value = ''
})

/** 对比当前两侧文本并更新结果；无参数、无返回值，失败原因展示在界面。 */
function compare(): void {
  try {
    lines.value = compareTexts(left.value, right.value)
    error.value = ''
  } catch (cause) {
    lines.value = null
    error.value = cause instanceof Error ? cause.message : '文本对比失败，请缩小文本后重试'
  }
}
</script>
<template>
  <section class="tool-surface">
    <div class="toolbar">
      <ElButton
        type="primary"
        @click="compare"
      >
        对比文本
      </ElButton>
      <ElButton @click="left = ''; right = ''">
        清空
      </ElButton>
      <label for="diff-view">结果视图</label>
      <ElSelect
        id="diff-view"
        v-model="view"
        aria-label="文本对比视图"
      >
        <ElOption
          label="合并视图"
          value="merged"
        />
        <ElOption
          label="左右拆分视图"
          value="split"
        />
      </ElSelect>
    </div>
    <div class="workbench">
      <label class="editor-panel">
        <span class="panel-header">原文（左侧）</span>
        <ElInput
          v-model="left"
          type="textarea"
          :rows="10"
          aria-label="对比原文"
          placeholder="输入原文…"
        />
      </label>
      <label class="editor-panel">
        <span class="panel-header">新文本（右侧）</span>
        <ElInput
          v-model="right"
          type="textarea"
          :rows="10"
          aria-label="对比新文本"
          placeholder="输入新文本…"
        />
      </label>
    </div>
    <div class="tool-notes">
      <p>输入原文和新文本，点击“对比文本”。合并视图按顺序展示差异；左右拆分视图对齐两侧内容，缺少的行留空。</p>
      <p>按行显示差异：删除为红色，新增为绿色。修改一行会显示为删除旧行并新增新行，不做逐字符高亮。</p>
      <p>保留空格、空行和末尾换行差异，统一 CRLF、CR、LF 换行风格。大文本请分段对比。</p>
    </div>
    <p
      v-if="error"
      class="error-message"
      role="alert"
    >
      {{ error }}
    </p>
    <section
      v-if="lines !== null"
      class="diff-result"
      aria-label="文本对比结果"
      aria-live="polite"
    >
      <p class="feedback">
        {{ added === 0 && removed === 0 ? '两段文本一致' : `新增 ${added} 行，删除 ${removed} 行` }}
      </p>
      <p class="tool-note">
        行号依次为原文 / 新文本；∅ 表示空行。
      </p>
      <div
        v-if="view === 'merged'"
        class="diff-lines"
      >
        <div
          v-for="(line, index) in lines"
          :key="index"
          class="diff-line"
          :class="`diff-${line.kind}`"
        >
          <span class="diff-number">{{ line.leftLine ?? '—' }}</span>
          <span class="diff-number">{{ line.rightLine ?? '—' }}</span>
          <span>{{ line.kind === 'added' ? '+' : line.kind === 'removed' ? '−' : ' ' }}</span>
          <code>{{ line.text === '' ? '∅' : line.text }}</code>
        </div>
      </div>
      <div
        v-else
        class="split-lines"
        aria-label="左右拆分对比"
      >
        <div class="split-title">
          原文
        </div><div class="split-title">
          新文本
        </div>
        <template
          v-for="(row, index) in splitRows"
          :key="index"
        >
          <div
            v-for="side in (['left', 'right'] as const)"
            :key="side"
            class="split-cell"
            :class="row[side] ? `diff-${row[side].kind}` : 'diff-gap'"
          >
            <span class="diff-number">{{ (side === 'left' ? row[side]?.leftLine : row[side]?.rightLine) ?? '—' }}</span>
            <code>{{ row[side] ? (row[side].text === '' ? '∅' : row[side].text) : '' }}</code>
          </div>
        </template>
      </div>
    </section>
  </section>
</template>
<style scoped>
.diff-result { margin-top: 24px; }
.diff-lines { margin-top: 12px; border: 1px solid #e0e6db; border-radius: 8px; overflow: hidden; }
.diff-line { display: grid; grid-template-columns: 3em 3em 1em minmax(0, 1fr); gap: 8px; padding: 7px 10px; font-size: 13px; line-height: 1.7; }
.diff-number { color: #667660; text-align: right; user-select: none; }
.diff-line code { white-space: pre-wrap; overflow-wrap: anywhere; tab-size: 4; }
.diff-added { background: #e8f4e9; color: #225c35; }
.diff-removed { background: #fcebea; color: #96342f; }
.diff-equal { background: #f8f9f5; }
.split-lines { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 12px; border: 1px solid #e0e6db; border-radius: 8px; overflow: hidden; }
.split-title { padding: 12px; background: #205c46; color: white; font-size: 13px; }
.split-cell { display: grid; grid-template-columns: 2.5em minmax(0, 1fr); gap: 8px; padding: 7px; font-size: 13px; line-height: 1.7; border-right: 1px solid #dfe5d9; }
.split-cell code { white-space: pre-wrap; overflow-wrap: anywhere; tab-size: 4; }
.diff-gap { background: #ecefe9; }
</style>
