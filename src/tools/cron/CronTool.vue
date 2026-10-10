<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElButton } from 'element-plus/es/components/button/index'
import { ElInput } from 'element-plus/es/components/input/index'
import { ElInputNumber } from 'element-plus/es/components/input-number/index'
import { ElSelect, ElOption } from 'element-plus/es/components/select/index'
import { cronVersions, cronExamples, cronFieldNames, cronFieldRanges, fieldIndexes, exampleFields, generateCron, validateCron, type CronVersion } from './logic'
import { cronDialect } from './dialects'
import CronWorker from './worker?worker'

const version = ref<CronVersion>('unix5')
const expression = ref('*/5 * * * *')
const fields = ref(['0', '*/5', '*', '*', '*', '*', '*'])
const timezone = ref('Asia/Shanghai')
const start = ref(new Date().toISOString().slice(0, 19))
const count = ref(5)
const indexes = computed(() => fieldIndexes(version.value))
const dialect = computed(() => cronDialect(version.value))
const specials = computed(() => dialect.value.quartz || version.value === 'spring6')
const times = ref<string[]>([])
const warning = ref('')
const error = ref('')
const status = ref('')
const busy = ref(false)
const checked = ref(false)
let worker: InstanceType<typeof window.Worker> | undefined
let timer: number | undefined

/** 结束后台计算；无参数、无返回值，释放计时器及 Worker，旧结果不会写入新输入。 */
function stop(): void {
  worker?.terminate()
  worker = undefined
  window.clearTimeout(timer)
  busy.value = false
}
onBeforeUnmount(stop)
watch([expression, version, timezone, start, count], () => {
  stop()
  times.value = []
  error.value = ''
  warning.value = ''
  status.value = ''
  checked.value = false
}, { flush: 'sync' })
watch(version, () => { loadExample(1) })

/** 从分段生成表达式；无参数、无返回值，先校验再替换，失败保留现有表达式。 */
function build(): void {
  try {
    expression.value = generateCron(fields.value, version.value)
    error.value = ''
    status.value = '表达式已生成，可点击校验与测试'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '生成失败'
  }
}

/** 填入常用示例；index 为示例序号，无返回值，按当前版本生成并同步字段编辑器。 */
function loadExample(index: number): void {
  const example = cronExamples[index]
  if (!example || (example.specialOnly && !specials.value)) return
  fields.value = exampleFields(example, version.value)
  build()
}

/** 校验并预览执行时间；无参数、无返回值，起点以 UTC ISO 输入，按所选时区计算，超时两秒终止。 */
function run(): void {
  stop()
  times.value = []
  warning.value = ''
  error.value = ''
  status.value = ''
  checked.value = false
  try {
    const result = validateCron(expression.value, version.value)
    for (const [position, index] of indexes.value.entries()) fields.value[index] = result.fields[position]!
    const active = new CronWorker()
    worker = active
    busy.value = true
    active.onmessage = event => {
      if (worker !== active) return
      const result: { times: string[]; warning: string; error: string } = event.data
      times.value = result.times
      warning.value = result.warning
      error.value = result.error
      checked.value = !result.error
      stop()
    }
    active.onerror = () => {
      if (worker !== active) return
      error.value = '执行时间计算失败，请重试'
      stop()
    }
    active.postMessage({ expression: expression.value, version: version.value, start: `${start.value}Z`, timezone: timezone.value, count: count.value })
    timer = window.setTimeout(() => {
      error.value = '计算超过两秒，已停止；请调整表达式或测试起点'
      stop()
    }, 2000)
  } catch (cause) {
    stop()
    error.value = cause instanceof Error ? cause.message : '测试失败'
  }
}

/** 复制表达式；无参数，返回异步完成状态，剪贴板拒绝时显示手动复制提示。 */
async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(expression.value)
    status.value = '已复制表达式'
  } catch {
    status.value = '复制失败，请手动选择表达式复制'
  }
}
</script>

<template>
  <section class="tool-surface cron-tool">
    <p class="cron-intro">
      5、6、7 表示时间字段数，不是某种编程语言的统一标准。同为 6 段，Spring、node-cron 与 Quartz 的日期规则也不同，请先选择实际使用的工具。系统 crontab 后面的用户名、命令不算时间字段。
    </p>
    <details class="cron-dialects">
      <summary>5 / 6 / 7 段对应的工具与规则</summary>
      <div class="cron-table-scroll">
        <table>
          <thead><tr><th>字段数</th><th>工具 / 规范</th><th>语言 / 环境</th><th>字段顺序</th><th>日期与星期</th></tr></thead>
          <tbody>
            <tr
              v-for="option in cronVersions"
              :key="option.value"
            >
              <td>{{ option.count }}</td><td>{{ option.tool }}</td><td>{{ option.language }}</td><td>{{ option.order }}</td><td>{{ option.weekdays }}；{{ option.dates }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="cron-rule">
        Linux 选项包含 Vixie/Cronie 的常用扩展；node-cron 明确以 4.2.1 为参照，其他版本或 npm 的 cron 包不能按段数直接套用。Spring 使用 5.3+ 的 CronExpression，旧 CronSequenceGenerator 的扩展支持不同。
      </p>
    </details>
    <div class="cron-header">
      <label class="form-field">Cron 方言 / 使用工具<ElSelect
        v-model="version"
        aria-label="Cron 版本"
      ><ElOption
        v-for="option in cronVersions"
        :key="option.value"
        :label="option.label"
        :value="option.value"
      /></ElSelect></label>
      <label class="form-field">执行时区<ElSelect
        v-model="timezone"
        aria-label="执行时区"
      ><ElOption
        v-for="zone in ['Asia/Shanghai', 'UTC', 'Asia/Tokyo', 'America/New_York', 'Europe/London']"
        :key="zone"
        :label="zone"
        :value="zone"
      /></ElSelect></label>
    </div>
    <section
      class="cron-profile"
      aria-label="当前方言规则"
    >
      <h2>{{ dialect.tool }}</h2>
      <p>{{ dialect.language }} · {{ dialect.count }} 个时间字段</p>
      <p>字段顺序：<code>{{ dialect.order }}</code></p>
      <p>星期编号：{{ dialect.weekdays }}。{{ dialect.dates }}</p>
      <p>{{ dialect.syntax }}</p>
      <a
        :href="dialect.source"
        target="_blank"
        rel="noopener noreferrer"
      >查看对应官方说明 / 源码 ↗</a>
    </section>
    <label class="form-field">Cron 表达式<ElInput
      v-model="expression"
      aria-label="Cron 表达式"
      placeholder="例如：*/5 * * * *"
    /></label>
    <div
      class="cron-examples"
      aria-label="常用表达式"
    >
      <ElButton
        v-for="(example, index) in cronExamples"
        :key="example.name"
        :disabled="example.specialOnly && !specials"
        @click="loadExample(index)"
      >
        {{ example.name }}
      </ElButton>
    </div>
    <details
      class="cron-builder"
      open
    >
      <summary>分段生成表达式</summary>
      <div class="cron-fields">
        <label
          v-for="index in indexes"
          :key="index"
          class="form-field"
        >{{ cronFieldNames[index] }}<ElInput
          v-model="fields[index]"
          :aria-label="`${cronFieldNames[index]}字段`"
        /><small>{{ index === 5 ? dialect.quartz ? '1–7 / SUN–SAT' : '0–7 / SUN–SAT' : cronFieldRanges[index] }}</small></label>
      </div>
      <ElButton @click="build">
        生成表达式
      </ElButton>
    </details>
    <div class="cron-test-settings">
      <label class="form-field">测试起点（UTC，之后的时间）<input
        v-model="start"
        type="datetime-local"
        step="1"
        aria-label="测试起点 UTC"
      ></label>
      <label class="form-field">预览次数<ElInputNumber
        v-model="count"
        :min="1"
        :max="20"
        :precision="0"
        aria-label="预览次数"
      /></label>
    </div>
    <div class="toolbar">
      <ElButton
        type="primary"
        :loading="busy"
        @click="run"
      >
        校验与测试
      </ElButton>
      <ElButton
        :disabled="!expression.trim()"
        @click="copy"
      >
        复制表达式
      </ElButton>
    </div>
    <p
      v-if="error"
      class="error-message"
      role="alert"
    >
      {{ error }}
    </p>
    <p
      v-if="status"
      role="status"
    >
      {{ status }}
    </p>
    <section
      v-if="checked"
      class="cron-result"
      aria-live="polite"
    >
      <h2>语法有效 · 后续执行时间</h2>
      <p>时区：{{ timezone }}，结果包含 UTC 偏移。</p>
      <ol>
        <li
          v-for="time in times"
          :key="time"
        >
          {{ time }}
        </li>
      </ol>
      <p v-if="warning">
        {{ warning }}
      </p>
    </section>
    <div class="tool-notes">
      <p>生成与校验、执行时间计算共用所选方言。切换工具后填入该工具的每 5 分钟示例；分段修改后点击“生成表达式”，或直接编辑表达式再测试。内置特殊日期示例仅在 Spring / Quartz 中可用。</p>
      <p>本工具预览范围为 1970–2099 年，最多 20 次、搜索未来 10 年；# 的序号限 1–5，L-n 偏移限 Quartz 0–30 / Spring 1–30，不预览跨月偏移。Quartz 的 L/W/# 不与列表混合；不支持随机 H、C、@reboot、命令部分或多条表达式。这些是工具支持范围，不代表所有调度器的完整能力。</p>
      <p>日历日期按所选 IANA 时区筛选，再计算时分秒。计算在本地 Worker 中运行，超过搜索步数上限或两秒时停止。本工具只生成和测试表达式，不会执行定时任务，也不模拟调度器停机补偿、misfire 或重启策略。</p>
    </div>
  </section>
</template>

<style scoped>
.cron-intro { margin-top: 0; line-height: 1.8; color: #52634f; }
.cron-dialects { margin-bottom: 24px; }
.cron-dialects summary { cursor: pointer; color: #426044; font-weight: 600; }
.cron-table-scroll { overflow-x: auto; margin-top: 16px; }
.cron-table-scroll table { width: 100%; min-width: 720px; border-collapse: collapse; font-size: 13px; line-height: 1.7; }
.cron-table-scroll th, .cron-table-scroll td { padding: 12px; border: 1px solid #dfe7d6; text-align: left; }
.cron-table-scroll th { background: #f0f5ec; }
.cron-profile { padding: 16px 20px; margin-bottom: 20px; border-radius: 12px; background: #f0f5ec; border-left: 4px solid #426044; line-height: 1.7; font-size: 13px; }
.cron-profile h2 { margin-top: 0; font-size: 16px; }
.cron-profile p { margin: 8px 0; }
.cron-profile a { color: #245f4b; }
.cron-header, .cron-test-settings { display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 20px; }
.cron-header > label { flex: 1; min-width: min(260px, 100%); }
.cron-rule { color: #657361; font-size: 13px; line-height: 1.8; }
.cron-examples { display: flex; flex-wrap: wrap; gap: 8px; margin: 18px 0; }
.cron-examples .el-button { margin: 0; font-size: 12px; }
.cron-builder { padding: 20px; border: 1px solid #dfe7d6; border-radius: 12px; background: #f8faf5; margin-bottom: 20px; }
.cron-builder summary { cursor: pointer; color: #426044; font-weight: 600; }
.cron-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 12px; margin: 20px 0; }
.cron-fields small { color: #657361; font-size: 11px; }
.cron-test-settings input { border: 1px solid #dcdfe6; border-radius: 4px; padding: 8px; font: inherit; max-width: 100%; color: #354e39; background: white; }
.cron-result { padding: 20px; margin-top: 20px; border: 1px solid #dfe7d6; border-radius: 12px; background: #f8faf5; overflow-wrap: anywhere; }
.cron-result h2 { font-size: 16px; }
.cron-result li { margin: 10px 0; font-variant-numeric: tabular-nums; }
</style>
