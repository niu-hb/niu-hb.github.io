<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElButton } from 'element-plus/es/components/button/index'
import { ElInput } from 'element-plus/es/components/input/index'
import { ElCheckbox } from 'element-plus/es/components/checkbox/index'
import { highlightMatches, regexExamples, type RegexMatch } from './logic'
import RegexWorker from './worker?worker'

const pattern = ref('')
const text = ref('')
const flags = ref(['g'])
const example = ref<number>()
const showExamples = ref(false)
const exampleName = computed(() => example.value === undefined ? '' : regexExamples[example.value]?.name ?? '')
const matches = ref<RegexMatch[]>([])
const error = ref('')
const busy = ref(false)
const completed = ref(false)
const truncated = ref(false)
const parts = computed(() => highlightMatches(text.value, matches.value))
const flagOptions = [
  { value: 'g', label: 'g 全局匹配' }, { value: 'i', label: 'i 忽略大小写' },
  { value: 'm', label: 'm 多行边界' }, { value: 's', label: 's 点匹配换行' },
  { value: 'u', label: 'u Unicode' }, { value: 'y', label: 'y 粘连匹配' },
]
let worker: InstanceType<typeof window.Worker> | undefined
let timeout: number | undefined

/** 释放匹配任务；无参数、无返回值，终止 Worker 并清理超时计时。 */
function stop(): void {
  worker?.terminate()
  worker = undefined
  window.clearTimeout(timeout)
  busy.value = false
}
watch([pattern, text, flags], () => {
  stop()
  matches.value = []
  error.value = ''
  completed.value = false
  truncated.value = false
}, { deep: true, flush: 'sync' })
onBeforeUnmount(stop)

/** 填入所选示例；index 为示例索引，无返回值，同时设置表达式、标志与测试文本。 */
function loadExample(index: number): void {
  const selected = regexExamples[index]
  if (selected) {
    example.value = index
    pattern.value = selected.pattern
    text.value = selected.text
    flags.value = [...selected.flags]
  }
}

/** 执行当前匹配；无参数、无返回值，在隔离 Worker 内运行并于两秒超时后终止。 */
function run(): void {
  stop()
  matches.value = []
  error.value = ''
  completed.value = false
  truncated.value = false
  if (!pattern.value) {
    error.value = '请输入正则表达式（无需两侧 /）'
    return
  }
  try {
    const active = new RegexWorker()
    worker = active
    busy.value = true
    active.onmessage = event => {
      if (worker !== active) return
      const result: { matches: RegexMatch[]; error: string; truncated: boolean } = event.data
      matches.value = result.matches
      error.value = result.error
      truncated.value = result.truncated
      completed.value = !event.data.error
      stop()
    }
    active.onerror = () => {
      if (worker === active) {
        stop()
        error.value = '匹配任务执行失败，请检查浏览器支持后重试'
      }
    }
    timeout = window.setTimeout(() => {
      stop()
      error.value = '匹配超过 2 秒，已终止。请简化表达式或缩短文本。'
    }, 2000)
    active.postMessage({ pattern: pattern.value, flags: flags.value.join(''), text: text.value })
  } catch (cause) {
    stop()
    error.value = cause instanceof Error ? cause.message : '无法启动匹配任务'
  }
}

/** 取消耗时匹配；无参数、无返回值，并在界面显示取消状态。 */
function cancel(): void {
  stop()
  error.value = '匹配已取消'
}
</script>

<template>
  <section class="tool-surface">
    <p class="engine-label">
      JavaScript 正则引擎
    </p>
    <label class="form-field">正则表达式（无需两侧 /）<ElInput
      v-model="pattern"
      aria-label="正则表达式"
      placeholder="例如：\d+"
    /></label>
    <div class="toolbar regex-flags">
      <ElCheckbox
        v-for="option in flagOptions"
        :key="option.value"
        :model-value="flags.includes(option.value)"
        @change="checked => flags = checked ? [...flags, option.value] : flags.filter(flag => flag !== option.value)"
      >
        {{ option.label }}
      </ElCheckbox>
    </div>
    <div class="toolbar">
      <ElButton
        type="primary"
        :loading="busy"
        @click="run"
      >
        测试匹配
      </ElButton>
      <ElButton
        v-if="busy"
        @click="cancel"
      >
        取消
      </ElButton>
      <ElButton
        :aria-expanded="showExamples"
        aria-controls="regex-examples"
        @click="showExamples = !showExamples"
      >
        {{ showExamples ? '收起常用示例' : '展开常用示例' }}
      </ElButton>
      <span
        v-if="exampleName"
        class="example-status"
      >已填入：{{ exampleName }}</span>
    </div>
    <div
      v-show="showExamples"
      id="regex-examples"
      class="examples-grid"
      role="group"
      aria-label="常用正则示例"
    >
      <ElButton
        v-for="(item, index) in regexExamples"
        :key="item.name"
        :type="example === index ? 'primary' : 'default'"
        :aria-pressed="example === index"
        @click="loadExample(index)"
      >
        {{ item.name }}
      </ElButton>
    </div>
    <label class="form-field">测试文本<ElInput
      v-model="text"
      type="textarea"
      :rows="8"
      aria-label="测试文本"
    /></label>
    <p
      v-if="error"
      class="error-message"
      role="alert"
    >
      {{ error }}
    </p>
    <template v-if="completed">
      <p role="status">
        {{ matches.length ? `匹配到 ${matches.length} 项` : '未匹配到结果' }}{{ truncated ? '（仅展示前 1,000 项）' : '' }}
      </p>
      <pre
        class="match-preview"
        aria-label="匹配高亮"
      ><template
v-for="(part, index) in parts"
                                       :key="index"
      ><mark v-if="part.matched">{{ part.text }}</mark><template v-else>{{ part.text }}</template></template></pre>
      <ol class="match-list">
        <li
          v-for="(match, index) in matches"
          :key="index"
        >
          <p><strong>{{ match.text || '（零长度匹配）' }}</strong> · 位置 {{ match.index }}–{{ match.index + match.text.length }}（右端不含）</p>
          <p
            v-for="(group, groupIndex) in match.groups"
            :key="groupIndex"
          >
            捕获组 {{ groupIndex + 1 }}：{{ group === undefined ? '（未参与匹配）' : group || '（空字符串）' }}
          </p>
          <p
            v-for="(group, name) in match.namedGroups"
            :key="name"
          >
            命名组 {{ name }}：{{ group === undefined ? '（未参与匹配）' : group || '（空字符串）' }}
          </p>
        </li>
      </ol>
    </template>
    <div class="tool-notes">
      <p>输入表达式和文本后点击测试；全局模式展示所有匹配，关闭 g/y 时只返回首次匹配。y 模式要求从当前位置连续匹配。位置从 0 开始，按 JavaScript UTF-16 单元计算。</p>
      <p>展开常用示例后点击按钮，可填入表达式、匹配标志和测试文本。示例在页面内展示，可随页面滚动。</p>
      <p>采用当前浏览器的 JavaScript 引擎，其他语言的正则语法可能不同。示例中的邮箱与网址规则用于常见文本提取，不替代完整业务校验。</p>
      <p>表达式最多 10,000 字符，文本最多 200,000 字符，展示最多 1,000 项；耗时超过 2 秒会终止。零长度匹配在列表显示，不对原文添加字符。</p>
    </div>
  </section>
</template>

<style scoped>
.engine-label { display: inline-block; margin: 0 0 20px; padding: 6px 12px; border-radius: 6px; background: #e8efec; color: #205c46; font-size: 13px; }
.regex-flags { margin-top: 16px; }
.example-status { font-size: 13px; color: #667660; overflow-wrap: anywhere; }
.examples-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; padding: 16px; margin-bottom: 22px; border: 1px solid #e0e6db; border-radius: 8px; background: #f8f9f5; }
.examples-grid .el-button { width: 100%; height: auto; min-height: 40px; margin-left: 0; padding: 10px; white-space: normal; line-height: 1.6; }
.examples-grid :deep(.el-button > span) { white-space: normal; overflow-wrap: anywhere; }
@media (max-width: 900px) { .examples-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 640px) { .examples-grid { grid-template-columns: 1fr; } }
.match-preview { padding: 16px; background: #f8f9f5; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.8; max-height: 400px; overflow: auto; }
mark { background: #dcecb9; color: inherit; border-radius: 2px; }
.match-list { max-height: 400px; overflow: auto; padding-left: 28px; overflow-wrap: anywhere; }
.match-list li { padding: 6px; border-bottom: 1px solid #e3e7df; }
.match-list p { white-space: pre-wrap; margin: 6px 0; }
</style>
