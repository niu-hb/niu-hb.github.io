<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElButton } from 'element-plus/es/components/button/index'
import { ElInput } from 'element-plus/es/components/input/index'

const input = defineModel<string>({ required: true })
const props = defineProps<{ output: string; error: string; placeholder?: string }>()
const clipboardStatus = ref('')
watch(() => props.output, () => { clipboardStatus.value = '' })

/** 将当前结果复制到剪贴板；无参数，返回完成状态，并在界面显示浏览器权限错误。 */
async function copyOutput(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.output)
    clipboardStatus.value = '已复制'
  } catch {
    clipboardStatus.value = '复制失败，请手动选择结果复制'
  }
}
</script>

<template>
  <div class="workbench">
    <div class="editor-panel">
      <div class="panel-header">
        <label for="tool-input">输入</label><ElButton
          text
          @click="input = ''"
        >
          清空
        </ElButton>
      </div><ElInput
        id="tool-input"
        v-model="input"
        type="textarea"
        :rows="14"
        :placeholder="placeholder ?? '在这里粘贴或输入文本…'"
        aria-label="工具输入"
      />
    </div>
    <div class="editor-panel">
      <div class="panel-header">
        <label for="tool-output">结果</label><ElButton
          text
          :disabled="!output"
          @click="copyOutput"
        >
          复制结果
        </ElButton>
      </div><ElInput
        id="tool-output"
        :model-value="output"
        type="textarea"
        :rows="14"
        readonly
        placeholder="处理结果将在这里显示"
        aria-label="处理结果"
      />
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
    v-if="clipboardStatus"
    class="feedback"
    role="status"
  >
    {{ clipboardStatus }}
  </p>
</template>
