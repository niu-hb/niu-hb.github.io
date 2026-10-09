<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { ElButton } from 'element-plus/es/components/button/index'
import { ElCheckbox } from 'element-plus/es/components/checkbox/index'
import { ElInputNumber } from 'element-plus/es/components/input-number/index'
import { ElInput } from 'element-plus/es/components/input/index'
import { generatePassword, passwordSymbols } from './logic'

const options = reactive({ length: 16, lowercase: true, uppercase: true, digits: true, symbols: true, excludeSimilar: false })
const output = ref('')
const error = ref('')
const feedback = ref('')
watch(options, () => {
  output.value = ''
  error.value = ''
  feedback.value = ''
})

/** 按当前设置生成密码；无参数、无返回值，失败时清空结果并反馈原因。 */
function generate(): void {
  feedback.value = ''
  try {
    output.value = generatePassword(options)
    error.value = ''
  } catch (cause) {
    output.value = ''
    error.value = cause instanceof Error ? cause.message : '生成失败'
  }
}

/** 复制当前密码；无参数、无返回值，权限失败时引导手动复制，不记录密码。 */
async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(output.value)
    feedback.value = '已复制'
  } catch {
    feedback.value = '复制失败，请手动选择密码复制'
  }
}
</script>

<template>
  <section class="tool-surface">
    <div class="toolbar">
      <label for="password-length">密码长度（1–128）</label>
      <ElInputNumber
        id="password-length"
        v-model="options.length"
        :min="1"
        :max="128"
        :precision="0"
        aria-label="密码长度"
      />
    </div>
    <div class="toolbar">
      <ElCheckbox v-model="options.lowercase">
        小写字母 a–z
      </ElCheckbox>
      <ElCheckbox v-model="options.uppercase">
        大写字母 A–Z
      </ElCheckbox>
      <ElCheckbox v-model="options.digits">
        数字 0–9
      </ElCheckbox>
      <ElCheckbox v-model="options.symbols">
        常用符号
      </ElCheckbox>
      <ElCheckbox v-model="options.excludeSimilar">
        排除易混淆字符 I l 1 O 0 o
      </ElCheckbox>
    </div>
    <div class="toolbar">
      <ElButton
        type="primary"
        @click="generate"
      >
        生成密码
      </ElButton>
      <ElButton
        :disabled="!output"
        @click="copy"
      >
        复制密码
      </ElButton>
    </div>
    <ElInput
      :model-value="output"
      readonly
      aria-label="生成的密码"
      placeholder="生成的密码将在这里显示"
      autocomplete="off"
    />
    <p
      v-if="error"
      class="error-message"
      role="alert"
    >
      {{ error }}
    </p>
    <p
      v-if="feedback"
      class="feedback"
      role="status"
    >
      {{ feedback }}
    </p>
    <div class="tool-notes">
      <p>选择字符类型和长度后生成密码，每种选中的类型至少出现一次。长度不能少于选中的类型数量。</p>
      <p>符号仅使用 <code>{{ passwordSymbols }}</code>，不包含引号、括号、斜杠、空格等字符。不同网站允许的符号范围可能不同，请按目标网站的密码规则选择是否启用符号。</p>
      <p>使用浏览器加密随机数与无偏抽样。密码只在当前页面内存中显示，不保存、不上传；修改设置后清空旧密码。</p>
    </div>
  </section>
</template>
