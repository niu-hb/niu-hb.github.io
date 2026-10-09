<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElButton } from 'element-plus/es/components/button/index'
import { ElInput } from 'element-plus/es/components/input/index'
import { countCharacters, type CharacterCounts } from './logic'
const input = ref('')
const counts = computed(() => countCharacters(input.value))
const labels: { key: keyof CharacterCounts; label: string; hint: string }[] = [
  { key: 'total', label: '总字符', hint: 'Unicode 码点' },
  { key: 'chinese', label: '中文', hint: '汉字字符' },
  { key: 'english', label: '英文', hint: 'A–Z / a–z' },
  { key: 'digits', label: '数字', hint: '0–9' },
  { key: 'spaces', label: '普通空格', hint: '半角空格' },
  { key: 'whitespace', label: '其他空白', hint: '换行、制表符等' },
  { key: 'other', label: '其他字符', hint: '标点、符号、表情等' },
]
</script>
<template>
  <section class="tool-surface">
    <div
      class="statistics-grid"
      aria-live="polite"
    >
      <div
        v-for="item in labels"
        :key="item.key"
        class="statistic"
        :class="{ featured: item.key === 'total' }"
      >
        <span>{{ item.label }}</span><strong>{{ counts[item.key] }}</strong><small>{{ item.hint }}</small>
      </div>
    </div>
    <div class="panel-header">
      <label for="character-input">输入文本 · 实时统计</label><ElButton
        text
        @click="input = ''"
      >
        清空
      </ElButton>
    </div>
    <ElInput
      id="character-input"
      v-model="input"
      type="textarea"
      :rows="12"
      placeholder="粘贴一段文字，看看它由哪些字符组成…"
      aria-label="待统计文本"
    />
    <div class="tool-notes">
      <p>输入文本后实时统计。中文按汉字计算，英文为 A–Z / a–z，数字为 0–9；普通空格单独计数，换行、制表符等归入其他空白。</p>
      <p>各分类互不重叠，总字符等于各分类之和。按 Unicode 码点计数，CRLF 换行按一个字符计算；组合表情或带组合音标的文字可能包含多个码点。</p>
    </div>
  </section>
</template>
