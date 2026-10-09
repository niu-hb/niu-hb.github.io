<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { ElButton } from 'element-plus/es/components/button/index'
import { ElInput } from 'element-plus/es/components/input/index'
import { ElSelect, ElOption } from 'element-plus/es/components/select/index'
import { parseTimestamp, parseDate, formatDate, localZoneLabel, type TimeUnit, type TimeZone } from './logic'
const now = ref(new Date())
const timer = window.setInterval(() => { now.value = new Date() }, 1000)
onUnmounted(() => window.clearInterval(timer))
const localLabel = computed(() => localZoneLabel(now.value))
const timestamp = ref('')
const unit = ref<TimeUnit>('seconds')
const dateInput = ref('')
const zone = ref<TimeZone>('local')
const dateResult = ref('')
const timestampResult = ref('')
const timestampError = ref('')
const dateError = ref('')
watch([timestamp, unit], () => {
  dateResult.value = ''
  timestampError.value = ''
}, { flush: 'sync' })
watch([dateInput, zone], () => {
  timestampResult.value = ''
  dateError.value = ''
}, { flush: 'sync' })

/** 将输入时间戳转换为本地和 UTC 日期；无参数，结果或错误显示在对应面板。 */
function toDate(): void {
  try {
    const date = parseTimestamp(timestamp.value, unit.value)
    dateResult.value = `本地：${formatDate(date, 'local')}\n时区：${localZoneLabel(date)}\nUTC：${formatDate(date, 'utc')}\nISO：${date.toISOString()}`
    timestampError.value = ''
  } catch (error) {
    dateResult.value = ''
    timestampError.value = error instanceof Error ? error.message : '转换失败'
  }
}

/** 将输入日期转换为秒和毫秒时间戳；无参数，结果或错误显示在对应面板。 */
function toTimestamp(): void {
  try {
    const date = parseDate(dateInput.value, zone.value)
    timestampResult.value = `秒：${Math.floor(date.getTime() / 1000)}\n毫秒：${date.getTime()}\n时区：${zone.value === 'utc' ? 'UTC+00:00' : localZoneLabel(date)}`
    dateError.value = ''
  } catch (error) {
    timestampResult.value = ''
    dateError.value = error instanceof Error ? error.message : '转换失败'
  }
}
</script>
<template>
  <section
    class="clock-grid"
    aria-label="当前时间"
  >
    <div class="clock-card primary">
      <p>当前本地时间</p><strong>{{ formatDate(now, 'local').slice(0, -4) }}</strong><small>{{ localLabel }}</small>
    </div>
    <div class="clock-card">
      <p>当前 UTC 时间</p><strong>{{ formatDate(now, 'utc').slice(0, -4) }}</strong><small>UTC+00:00</small>
    </div>
    <div class="clock-card">
      <p>当前时间戳</p><strong>{{ Math.floor(now.getTime() / 1000) }}</strong><small>毫秒：{{ now.getTime() }}</small>
    </div>
  </section>
  <div class="time-panels">
    <section class="tool-surface">
      <h2>时间戳 → 日期</h2><div class="form-field">
        <label for="timestamp">时间戳</label><ElInput
          id="timestamp"
          v-model="timestamp"
          placeholder="例如 0 或 1700000000"
        />
      </div><div class="toolbar">
        <ElSelect
          v-model="unit"
          aria-label="时间戳单位"
        >
          <ElOption
            label="秒（s）"
            value="seconds"
          /><ElOption
            label="毫秒（ms）"
            value="milliseconds"
          />
        </ElSelect><ElButton @click="timestamp = String(unit === 'seconds' ? Math.floor(Date.now() / 1000) : Date.now())">
          填入当前
        </ElButton><ElButton
          type="primary"
          @click="toDate"
        >
          转换
        </ElButton>
      </div><pre
        v-if="dateResult"
        class="time-result"
        role="status"
      >{{ dateResult }}</pre><p
        v-if="timestampError"
        class="error-message"
        role="alert"
      >
        {{ timestampError }}
      </p>
    </section>
    <section class="tool-surface">
      <h2>日期 → 时间戳</h2><div class="form-field">
        <label for="date-input">日期时间</label><ElInput
          id="date-input"
          v-model="dateInput"
          placeholder="YYYY-MM-DD HH:mm:ss.SSS"
        />
      </div><div class="toolbar">
        <ElSelect
          v-model="zone"
          aria-label="输入日期时区"
        >
          <ElOption
            label="本地时区"
            value="local"
          /><ElOption
            label="UTC"
            value="utc"
          />
        </ElSelect><ElButton @click="dateInput = formatDate(new Date(), zone)">
          填入当前
        </ElButton><ElButton
          type="primary"
          @click="toTimestamp"
        >
          转换
        </ElButton>
      </div><pre
        v-if="timestampResult"
        class="time-result"
        role="status"
      >{{ timestampResult }}</pre><p
        v-if="dateError"
        class="error-message"
        role="alert"
      >
        {{ dateError }}
      </p>
    </section>
  </div>
  <div class="tool-notes">
    <p>当前时间来自设备时钟，每秒刷新。时间戳转换前请选择秒或毫秒，不按位数自动判断单位。</p>
    <p>日期格式为 <code>YYYY-MM-DD HH:mm:ss</code>，可附加 1–3 位毫秒。输入按本地时区或 UTC 解释，转换结果会注明时区。</p>
    <p>夏令时重复时段采用浏览器的较早时间，跳跃时段的无效日期会被拒绝。秒时间戳向下取整。</p>
  </div>
</template>
