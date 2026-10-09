<script setup lang="ts">
import { ref } from 'vue'
import { ElButton } from 'element-plus/es/components/button/index'
import { ElSelect, ElOption } from 'element-plus/es/components/select/index'
import TextWorkbench from '../../components/TextWorkbench.vue'
import { useTextTransform } from '../useTextTransform'
import { encodeBase64, decodeBase64, type Base64Mode } from './logic'
const input = ref('')
const mode = ref<Base64Mode>('standard')
const { output, error, run } = useTextTransform(input, [mode])
</script>
<template>
  <section class="tool-surface">
    <div class="toolbar">
      <ElButton
        type="primary"
        @click="run(text => encodeBase64(text, mode))"
      >
        编码
      </ElButton><ElButton @click="run(text => decodeBase64(text, mode))">
        解码
      </ElButton><label for="base64-mode">编码模式</label><ElSelect
        id="base64-mode"
        v-model="mode"
        aria-label="Base64 编码模式"
      >
        <ElOption
          label="标准 Base64"
          value="standard"
        /><ElOption
          label="URL-safe（网址安全）"
          value="url-safe"
        />
      </ElSelect>
    </div>
    <TextWorkbench
      v-model="input"
      :output="output"
      :error="error"
    />
    <div class="tool-notes">
      <p>将 UTF-8 文本与 Base64 相互转换，支持中文和表情，不用于解码图片等二进制文件。Base64 是编码方式，不是加密。</p>
      <p><strong>标准 Base64：</strong>使用标准字母表，解码时需要保留编码结果末尾的 <code>=</code> 填充（如果有）。</p>
      <p><strong>URL-safe：</strong>将 <code>+</code> 替换为 <code>-</code>、<code>/</code> 替换为 <code>_</code>，编码时去掉末尾 <code>=</code>。解码接受省略或完整填充，两种模式均忽略输入中的空白。</p>
    </div>
  </section>
</template>
