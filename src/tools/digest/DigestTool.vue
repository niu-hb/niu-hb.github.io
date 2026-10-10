<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElButton } from 'element-plus/es/components/button/index'
import { ElInput } from 'element-plus/es/components/input/index'
import { ElCheckbox } from 'element-plus/es/components/checkbox/index'
import { ElSelect, ElOption } from 'element-plus/es/components/select/index'
import { digestAlgorithms, digestSourceSize, validateAlgorithms, formatDigest, type DigestFormat, type DigestOutput, type DigestMessage } from './logic'
import DigestWorker from './worker?worker'

const mode = ref<'text' | 'file'>('text')
const text = ref('')
const file = ref<InstanceType<typeof window.File> | null>(null)
const fileInput = ref<InstanceType<typeof window.HTMLInputElement> | null>(null)
const selected = ref(['md5', 'sha1', 'sha256', 'sha512'])
const format = ref<DigestFormat>('hex')
const output = ref<DigestOutput | null>(null)
const busy = ref(false)
const progress = ref(0)
const error = ref('')
const feedback = ref('')
const groups = [...new Set(digestAlgorithms.map(item => item.group))]
const rows = computed(() => output.value?.results.map(result => ({
  ...result,
  algorithm: digestAlgorithms.find(item => item.id === result.id)!,
  value: formatDigest(result.hex, format.value),
})) ?? [])
let worker: InstanceType<typeof window.Worker> | undefined

/** 释放当前后台任务；无参数、无返回值，使取消或输入变化后的旧消息失效。 */
function stop(): void {
  worker?.terminate()
  worker = undefined
  busy.value = false
}
onBeforeUnmount(stop)
watch([mode, text, file, selected], () => {
  stop()
  output.value = null
  error.value = ''
  feedback.value = ''
  progress.value = 0
}, { deep: true, flush: 'sync' })
watch(format, () => { feedback.value = '' })

/** 更改算法勾选；id 为算法标识、checked 为状态，无返回值，通过替换列表触发任务取消。 */
function toggleAlgorithm(id: string, checked: boolean | string | number): void {
  selected.value = checked ? [...selected.value, id] : selected.value.filter(value => value !== id)
}

/** 读取文件选择；event 为选择事件，无返回值，保留原始文件字节，不解析文件内容。 */
function chooseFile(event: InstanceType<typeof window.Event>): void {
  const input = event.target as InstanceType<typeof window.HTMLInputElement>
  file.value = input.files?.[0] ?? null
  input.value = ''
}

/** 启动摘要计算；无参数、无返回值，先校验大小及算法，再在 Worker 中计算并显示进度。 */
function run(): void {
  stop()
  output.value = null
  error.value = ''
  feedback.value = ''
  progress.value = 0
  try {
    if (mode.value === 'file' && !file.value) throw new Error('请先选择文件')
    const source = mode.value === 'text' ? text.value : file.value!
    const algorithms = validateAlgorithms(selected.value)
    digestSourceSize(source)
    const active = new DigestWorker()
    worker = active
    busy.value = true
    active.onmessage = event => {
      if (worker !== active) return
      const message: DigestMessage = event.data
      if (message.type === 'progress') {
        progress.value = message.total ? Math.floor(message.processed / message.total * 100) : 100
      } else {
        if (message.type === 'done') output.value = message.output
        else error.value = message.error
        stop()
      }
    }
    active.onerror = () => {
      if (worker !== active) return
      error.value = '后台摘要计算失败，请检查浏览器是否支持 WebAssembly 后重试'
      stop()
    }
    active.postMessage({ source, algorithms })
  } catch (cause) {
    stop()
    error.value = cause instanceof Error ? cause.message : '摘要计算失败，请重试'
  }
}

/** 取消当前任务；无参数、无返回值，终止 Worker 并提示尚未生成结果。 */
function cancel(): void {
  stop()
  feedback.value = '已取消计算'
}

/** 复制当前显示内容；value 为单项或全部结果，无返回值，失败时给出手动复制提示。 */
async function copy(value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value)
    feedback.value = '已复制'
  } catch {
    feedback.value = '复制失败，请手动选择结果复制'
  }
}
</script>

<template>
  <section class="tool-surface">
    <div class="digest-input">
      <div class="toolbar">
        <ElButton
          :type="mode === 'text' ? 'primary' : 'default'"
          :aria-pressed="mode === 'text'"
          @click="mode = 'text'"
        >
          文本摘要
        </ElButton>
        <ElButton
          :type="mode === 'file' ? 'primary' : 'default'"
          :aria-pressed="mode === 'file'"
          @click="mode = 'file'"
        >
          文件摘要
        </ElButton>
      </div>
      <div v-if="mode === 'text'">
        <label
          class="digest-label"
          for="digest-text"
        >输入文本（UTF-8）</label>
        <ElInput
          id="digest-text"
          v-model="text"
          type="textarea"
          :rows="7"
          aria-label="摘要文本"
          placeholder="输入要计算摘要的文本；空文本也可以计算"
        />
        <p class="muted">
          保留空格与换行，UTF-8 编码后最多 1 MiB。
        </p>
      </div>
      <div
        v-else
        class="file-panel"
      >
        <p class="digest-label">
          选择文件（最大 512 MiB）
        </p>
        <ElButton @click="fileInput?.click()">
          {{ file ? '重新选择文件' : '选择文件' }}
        </ElButton>
        <input
          id="digest-file"
          ref="fileInput"
          hidden
          type="file"
          aria-label="摘要文件"
          @change="chooseFile"
        >
        <p
          v-if="file"
          class="file-name"
        >
          {{ file.name }} · {{ file.size.toLocaleString() }} 字节
        </p>
        <p class="muted">
          直接计算文件原始字节，文件名不参与摘要；文件不会上传。
        </p>
      </div>
    </div>

    <div class="algorithm-heading">
      <h2>选择算法 <span class="muted">已选 {{ selected.length }} / {{ digestAlgorithms.length }}</span></h2>
      <div class="toolbar">
        <ElButton
          text
          @click="selected = ['md5', 'sha1', 'sha256', 'sha512']"
        >
          常用组合
        </ElButton>
        <ElButton
          text
          @click="selected = digestAlgorithms.map(item => item.id)"
        >
          全选
        </ElButton>
        <ElButton
          text
          @click="selected = []"
        >
          取消全选
        </ElButton>
      </div>
    </div>
    <div class="algorithm-grid">
      <fieldset
        v-for="group in groups"
        :key="group"
        class="algorithm-group"
      >
        <legend>{{ group }}</legend>
        <ElCheckbox
          v-for="algorithm in digestAlgorithms.filter(item => item.group === group)"
          :key="algorithm.id"
          :model-value="selected.includes(algorithm.id)"
          @change="checked => toggleAlgorithm(algorithm.id, checked)"
        >
          {{ algorithm.label }} <small v-if="algorithm.note">{{ algorithm.note }}</small>
        </ElCheckbox>
      </fieldset>
    </div>

    <div class="digest-actions toolbar">
      <ElButton
        type="primary"
        :disabled="busy"
        @click="run"
      >
        {{ busy ? '计算中…' : '计算摘要' }}
      </ElButton>
      <ElButton
        v-if="busy"
        @click="cancel"
      >
        取消计算
      </ElButton>
      <span
        v-if="busy"
        role="status"
      >已处理 {{ progress }}%</span>
    </div>
    <div
      v-if="busy"
      class="digest-progress"
      role="progressbar"
      aria-label="摘要计算进度"
      :aria-valuenow="progress"
      :aria-valuemin="0"
      :aria-valuemax="100"
    >
      <span :style="{ width: `${progress}%` }" />
    </div>
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

    <div class="result-heading">
      <h2>摘要结果</h2>
      <div class="toolbar">
        <label for="digest-format">输出格式</label>
        <ElSelect
          id="digest-format"
          v-model="format"
          aria-label="摘要输出格式"
        >
          <ElOption
            value="hex"
            label="Hex 小写"
          />
          <ElOption
            value="hex-upper"
            label="Hex 大写"
          />
          <ElOption
            value="base64"
            label="Base64"
          />
        </ElSelect>
        <ElButton
          :disabled="!rows.length"
          @click="copy(rows.map(row => `${row.algorithm.label}: ${row.value}`).join('\n'))"
        >
          复制全部
        </ElButton>
      </div>
    </div>
    <p
      v-if="output"
      class="muted"
    >
      输入 {{ output.bytes.toLocaleString() }} 字节 · {{ rows.length }} 项结果
    </p>
    <div
      v-if="rows.length"
      class="digest-results"
    >
      <article
        v-for="row in rows"
        :key="row.id"
        class="digest-result"
      >
        <div class="digest-result-heading">
          <strong>{{ row.algorithm.label }}</strong><span>{{ row.algorithm.bits }} bit</span><ElButton
            text
            @click="copy(row.value)"
          >
            复制 {{ row.algorithm.label }}
          </ElButton>
        </div>
        <code>{{ row.value }}</code>
      </article>
    </div>
    <p
      v-else
      class="digest-empty"
    >
      选择算法后点击“计算摘要”，结果将在这里显示。
    </p>
    <div class="tool-notes">
      <p>摘要用于内容指纹与校验，不是加密，也不能还原原文。MD4、MD5、SHA-1 已不适合需要抗碰撞的安全用途；CRC32、CRC32C、Adler32、xxHash64 是非密码学校验算法。</p>
      <p>SHA3-256 与 Keccak-256 输出不同。Base64 编码的是摘要原始字节；BLAKE 算法使用页面标注的固定输出长度、无密钥模式，xxHash64 种子为 0。</p>
      <p>所有输入仅在当前浏览器计算，不保存、不上传。文件分块在后台处理，可以取消；输入或算法变化会清除旧结果。</p>
    </div>
  </section>
</template>

<style scoped>
.digest-label { display: block; margin-bottom: 12px; font-size: 14px; }
.digest-input { padding-bottom: 18px; border-bottom: 1px solid #e3e9df; }
.file-panel { padding: 22px; border: 1px dashed #aec0ad; border-radius: 12px; background: #f8faf5; }
.file-panel input { max-width: 100%; }
.file-name { overflow-wrap: anywhere; }
.algorithm-heading, .result-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px; margin: 24px 0 16px; }
.algorithm-heading h2, .result-heading h2 { font-size: 18px; }
.algorithm-heading .toolbar, .result-heading .toolbar { margin: 0; }
.algorithm-heading .muted { margin-left: 8px; font-size: 12px; font-weight: 400; }
.algorithm-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.algorithm-group { display: flex; flex-direction: column; min-width: 0; margin: 0; padding: 14px; border: 1px solid #e0e7db; border-radius: 10px; }
.algorithm-group legend { padding: 0 6px; color: #47604b; font-size: 13px; }
.algorithm-group .el-checkbox { margin: 0; height: auto; min-height: 34px; white-space: normal; }
.algorithm-group small { color: #788575; font-size: 10px; }
.digest-actions { margin: 22px 0 12px; }
.digest-actions span { font-size: 13px; color: #657361; }
.digest-progress { height: 5px; background: #e8efec; border-radius: 5px; overflow: hidden; }
.digest-progress span { display: block; height: 100%; background: #205c46; }
.digest-results { display: grid; gap: 12px; }
.digest-result { padding: 14px 18px; border: 1px solid #e0e7db; border-radius: 10px; background: #f8faf5; min-width: 0; }
.digest-result-heading { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; font-size: 13px; margin-bottom: 8px; }
.digest-result-heading span { color: #788575; font-size: 11px; }
.digest-result-heading .el-button { margin-left: auto; }
.digest-result code { display: block; overflow-wrap: anywhere; line-height: 1.7; user-select: all; font-family: Consolas, monospace; font-size: 13px; }
.digest-empty { padding: 30px 16px; border-radius: 10px; background: #f8faf5; color: #788575; text-align: center; font-size: 13px; }
@media (max-width: 850px) { .algorithm-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 550px) { .algorithm-grid { grid-template-columns: 1fr; } .file-panel { padding: 16px; } .result-heading .toolbar { width: 100%; } .result-heading .toolbar label { margin-left: 0; } .result-heading .el-select { width: 125px; } }
</style>
