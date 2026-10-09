<script setup lang="ts">
import { ref } from 'vue'
import { ElButton } from 'element-plus/es/components/button/index'
import { ElSelect, ElOption } from 'element-plus/es/components/select/index'
import TextWorkbench from '../../components/TextWorkbench.vue'
import { useTextTransform } from '../useTextTransform'
import { transformUrl, type UrlMode } from './logic'
const input = ref('')
const mode = ref<UrlMode>('component')
const { output, error, run } = useTextTransform(input, [mode])
</script>
<template>
  <section class="tool-surface">
    <div class="toolbar">
      <ElButton
        type="primary"
        @click="run(text => transformUrl(text, mode, false))"
      >
        编码
      </ElButton><ElButton @click="run(text => transformUrl(text, mode, true))">
        解码
      </ElButton><label for="url-mode">转换模式</label><ElSelect
        id="url-mode"
        v-model="mode"
        aria-label="URL 转换模式"
      >
        <ElOption
          label="URL 参数值"
          value="component"
        /><ElOption
          label="完整 URL"
          value="uri"
        />
      </ElSelect>
    </div>
    <TextWorkbench
      v-model="input"
      :output="output"
      :error="error"
    />
    <div class="tool-notes">
      <p><strong>URL 参数值：</strong>适合单个查询参数，会编码 &amp;、=、/ 等符号，避免它们被当作网址结构。</p>
      <p><strong>完整 URL：</strong>保留 :、/、?、&amp;、=、# 等结构，编码中文、空格等字符。已由常见英文字符组成的网址可能没有变化。</p>
      <p>例如 <code>/中文 → /%E4%B8%AD%E6%96%87</code>，空格编码为 <code>%20</code>。两种模式解码时都不会把 <code>+</code> 自动转换为空格。</p>
    </div>
  </section>
</template>
