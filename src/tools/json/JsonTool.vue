<script setup lang="ts">
import { ref } from 'vue'
import { ElButton } from 'element-plus/es/components/button/index'
import { ElSelect, ElOption } from 'element-plus/es/components/select/index'
import TextWorkbench from '../../components/TextWorkbench.vue'
import { useTextTransform } from '../useTextTransform'
import { formatJson } from './logic'
const input = ref('')
const indent = ref<2 | 4>(2)
const { output, error, run } = useTextTransform(input, [indent])
</script>

<template>
  <section class="tool-surface">
    <div class="toolbar">
      <ElButton
        type="primary"
        @click="run(text => formatJson(text, indent))"
      >
        格式化
      </ElButton><ElButton @click="run(text => formatJson(text, 0))">
        压缩
      </ElButton><ElButton @click="run(text => { formatJson(text, 0); return 'JSON 语法校验通过' })">
        校验
      </ElButton><label for="json-indent">缩进</label><ElSelect
        id="json-indent"
        v-model="indent"
        aria-label="JSON 缩进"
        class="small-select"
      >
        <ElOption
          label="2 空格"
          :value="2"
        /><ElOption
          label="4 空格"
          :value="4"
        />
      </ElSelect>
    </div>
    <TextWorkbench
      v-model="input"
      :output="output"
      :error="error"
      placeholder="请输入 JSON，例如：{ &quot;hello&quot;: &quot;世界&quot; }"
    />
    <div class="tool-notes">
      <p>输入 JSON 后，可选择格式化、压缩或校验。格式化支持 2 或 4 空格缩进，结果可以直接复制。</p>
      <p>遵循标准 JSON 语法，不支持注释或末尾逗号。格式化和压缩使用 JavaScript 数值精度，超大整数请以字符串保存。</p>
    </div>
  </section>
</template>
