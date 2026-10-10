<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElButton } from 'element-plus/es/components/button/index'
import { ElInput } from 'element-plus/es/components/input/index'
import { ElInputNumber } from 'element-plus/es/components/input-number/index'
import { ElCheckbox } from 'element-plus/es/components/checkbox/index'
import { ElDialog } from 'element-plus/es/components/dialog/index'
import { drawModes, exampleDrawGroup, getDrawPool, maxDrawCount, maxGroups, maxItems, maxRecords, type DrawMode, type DrawRecord } from './logic'
import { useLottery } from './useLottery'

const { groups, ready, error, feedback, load, createGroup, saveGroup, draw, clearRecords, removeGroup, resetUnreadable } = useLottery()
const selectedId = ref('')
const selected = computed(() => groups.value.find(group => group.id === selectedId.value))
const existingExample = computed(() => groups.value.find(group => group.name === exampleDrawGroup.name))
const newGroupName = ref('')
const groupName = ref('')
const itemsText = ref('')
const mode = ref<DrawMode>('wheel')
const modeSettings = ref<Record<DrawMode, { count: number | undefined; repeat: boolean }>>({
  wheel: { count: 1, repeat: false }, cards: { count: 1, repeat: false },
  slot: { count: 1, repeat: false }, sticks: { count: 1, repeat: false },
})
const count = computed({ get: () => modeSettings.value[mode.value].count, set: value => { modeSettings.value[mode.value].count = value } })
const repeat = computed({ get: () => modeSettings.value[mode.value].repeat, set: value => { modeSettings.value[mode.value].repeat = value } })
const effectiveCount = computed(() => mode.value === 'wheel' ? 1 : count.value ?? 0)
const dirty = computed(() => !!selected.value && (groupName.value !== selected.value.name || itemsText.value !== selected.value.items.join('\n')))
const pool = computed(() => selected.value ? getDrawPool(selected.value, repeat.value, mode.value) : [])
const busy = ref(false)
const currentRecord = ref<DrawRecord | null>(null)
const stagePool = ref<string[]>([])
const revealedCount = ref(0)
const rollingText = ref('等一个幸运答案')
const wheelRotation = ref(0)
const resultDialog = ref(false)
const reelItems = ref<string[]>([])
const reelOffset = ref(0)
const reelDuration = ref(0)
const reelSpinning = ref(false)
const confirmAction = ref<'delete' | 'clear' | null>(null)
const restartDialog = computed({
  get: () => confirmAction.value === 'clear',
  set: value => { if (!value && confirmAction.value === 'clear') confirmAction.value = null },
})
const animationError = ref('')
let timer: number | undefined

const wheelItems = computed(() => stagePool.value.length ? stagePool.value : pool.value)
const palette = ['#ffc857', '#ff8b94', '#72d6ca', '#a9a1f5', '#ffad68', '#74bdf2', '#b8df6b', '#f694c1']
const wheelBackground = computed(() => {
  const size = wheelItems.value.length
  if (!size) return '#edf0e5'
  return `conic-gradient(${wheelItems.value.map((_, index) => `${palette[index % palette.length]} ${index * 360 / size}deg ${(index + 1) * 360 / size}deg`).join(', ')})`
})
const visibleRecords = computed(() => selected.value?.records.filter(record => record.mode === mode.value && (!busy.value || record.id !== currentRecord.value?.id)) ?? [])
const orderedResults = computed(() => {
  let order = 0
  return visibleRecords.value.flatMap((record, round) => record.results.map((name, index) => ({
    key: `${record.id}:${index}`, order: ++order, round: round + 1, withinRound: index + 1, name,
    mode: drawModes.find(item => item.value === record.mode)?.label,
  })))
})

/** 释放揭晓计时器；无参数、无返回值，切换页面时记录已保存，不因动画中断丢失结果。 */
function stopAnimation(): void {
  window.clearTimeout(timer)
  timer = undefined
  busy.value = false
  reelSpinning.value = false
}
onBeforeUnmount(stopAnimation)

/** 清理展示动画；无参数、无返回值，仅清空当前视觉结果，保留本地历史。 */
function resetPresentation(): void {
  stopAnimation()
  currentRecord.value = null
  stagePool.value = []
  revealedCount.value = 0
  rollingText.value = '等一个幸运答案'
  wheelRotation.value = 0
  resultDialog.value = false
  reelItems.value = []
  reelOffset.value = 0
  reelDuration.value = 0
  animationError.value = ''
}

/** 将所选分组同步到维护表单；无参数、无返回值，放弃草稿不会写入存档。 */
function syncDraft(): void {
  groupName.value = selected.value?.name ?? ''
  itemsText.value = selected.value?.items.join('\n') ?? ''
  confirmAction.value = null
}
watch(() => groups.value.map(group => group.id).join(','), () => {
  if (!groups.value.some(group => group.id === selectedId.value)) selectedId.value = groups.value[0]?.id ?? ''
})
watch(selectedId, () => { syncDraft(); resetPresentation() })
watch([mode, count, repeat], resetPresentation)
watch(mode, () => { confirmAction.value = null })

/** 创建并选择分组；无参数、无返回值，保存成功后清空新分组名称。 */
function addGroup(): void {
  const id = createGroup(newGroupName.value)
  if (id) {
    selectedId.value = id
    newGroupName.value = ''
  }
}

/** 添加或查看周末示例；无参数、无返回值，同名分组存在时仅切换，不覆盖用户已编辑的项目或记录。 */
function addExample(): void {
  const id = existingExample.value?.id ?? createGroup(exampleDrawGroup.name, exampleDrawGroup.items.join('\n'))
  if (id) selectedId.value = id
}

/** 保存当前分组维护草稿；无参数、无返回值，失败保留输入，成功后重置抽签展示。 */
function saveSettings(): void {
  if (saveGroup(selectedId.value, groupName.value, itemsText.value)) {
    syncDraft()
    resetPresentation()
  }
}

/** 执行用户二次确认的清空或删除；无参数、无返回值，保存失败时保留原数据。 */
function confirmChange(): void {
  if (!confirmAction.value || busy.value || dirty.value || !ready.value) return
  const saved = confirmAction.value === 'delete' ? removeGroup(selectedId.value) : clearRecords(selectedId.value, mode.value)
  if (saved) { confirmAction.value = null; resetPresentation() }
}

/** 完成当前轮次展示；无参数、无返回值，摇签自动打开结果弹窗，保留本地记录。 */
function finishReveal(): void {
  busy.value = false
  reelSpinning.value = false
  if (mode.value === 'sticks') resultDialog.value = true
}

/** 开始一项滚轮揭晓；record 为已保存的本轮结果、index 为轮内序号，无返回值，滚轮落点由结果决定。 */
function spinReel(record: DrawRecord, index: number): void {
  const winner = record.results[index]!
  // 从负位移向零移动，候选从上往下经过窗口，最后让已保存的中奖项停在中间。
  const candidates = Array.from({ length: 18 }, (_, position) => stagePool.value[position % stagePool.value.length]!)
  reelItems.value = [winner, ...candidates, rollingText.value]
  reelDuration.value = 0
  reelOffset.value = -(reelItems.value.length - 1) * 88
  reelSpinning.value = true
  timer = window.setTimeout(() => {
    reelDuration.value = 1400
    reelOffset.value = 0
    timer = window.setTimeout(() => {
      rollingText.value = winner
      revealedCount.value = index + 1
      reelSpinning.value = false
      if (index + 1 < record.results.length) timer = window.setTimeout(() => spinReel(record, index + 1), 180)
      else finishReveal()
    }, 1400)
  }, 50)
}

/** 启动抽签展示；无参数、无返回值，结果先随机抽取并保存，动画只负责按顺序揭晓。 */
function startDraw(): void {
  if (busy.value || dirty.value || !ready.value || confirmAction.value) return
  animationError.value = ''
  const snapshot = [...pool.value]
  const record = draw(selectedId.value, mode.value, effectiveCount.value, repeat.value)
  if (!record) return
  currentRecord.value = record
  stagePool.value = snapshot
  revealedCount.value = 0
  resultDialog.value = false
  try {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (mode.value === 'wheel') {
      const winnerIndex = snapshot.indexOf(record.results[0]!)
      const target = 360 - (winnerIndex + 0.5) * 360 / snapshot.length
      wheelRotation.value = Math.floor(wheelRotation.value / 360) * 360 + (reducedMotion ? 1 : 5) * 360 + target
    }
    if (reducedMotion) {
      revealedCount.value = record.results.length
      rollingText.value = record.results.join('、')
      reelItems.value = [record.results.at(-1)!]
      reelOffset.value = 0
      finishReveal()
      return
    }
    busy.value = true
    if (mode.value === 'slot') {
      spinReel(record, 0)
      return
    }
    let frame = 0
    /** 播放滚动并依序揭晓；无参数、无返回值，按预先保存的结果展示，不改变中奖概率。 */
    const advance = (): void => {
      frame += 1
      if (mode.value === 'wheel') {
        revealedCount.value = record.results.length
        finishReveal()
        return
      }
      if (frame <= 12) {
        rollingText.value = snapshot[(frame - 1) % snapshot.length]!
        timer = window.setTimeout(advance, 55 + frame * 10)
        return
      }
      revealedCount.value += 1
      rollingText.value = record.results[revealedCount.value - 1]!
      // 翻牌间隔留出完整的 3D 旋转时间，避免多张牌瞬间同时揭晓。
      if (revealedCount.value < record.results.length) timer = window.setTimeout(advance, mode.value === 'cards' ? 700 : 220)
      else timer = window.setTimeout(finishReveal, mode.value === 'cards' ? 650 : 300)
    }
    timer = window.setTimeout(advance, mode.value === 'wheel' ? 2600 : 80)
  } catch (cause) {
    stopAnimation()
    revealedCount.value = record.results.length
    finishReveal()
    animationError.value = `动画不可用，已直接显示已保存的结果：${cause instanceof Error ? cause.message : '请检查浏览器支持'}`
  }
}
</script>

<template>
  <section class="tool-surface lottery-tool">
    <p
      v-if="error || animationError"
      class="error-message"
      role="alert"
    >
      {{ error || animationError }}
    </p>
    <div
      v-if="!ready && error"
      class="toolbar"
    >
      <ElButton @click="load">
        重新读取
      </ElButton>
      <ElButton
        type="danger"
        plain
        @click="resetUnreadable"
      >
        放弃原存档并重新开始
      </ElButton>
    </div>
    <div class="lottery-layout">
      <aside class="group-panel">
        <div class="section-title">
          <h2>我的分组</h2><span>{{ groups.length }} / {{ maxGroups }}</span>
        </div>
        <form
          class="new-group"
          @submit.prevent="addGroup"
        >
          <ElInput
            v-model="newGroupName"
            aria-label="新分组名称"
            placeholder="例如：周末活动"
            :disabled="!ready || busy || dirty"
          />
          <ElButton
            native-type="submit"
            :disabled="!ready || busy || dirty"
          >
            新建
          </ElButton>
        </form>
        <ElButton
          class="example-button"
          type="primary"
          plain
          :disabled="!ready || busy || dirty"
          @click="addExample"
        >
          {{ existingExample ? '查看周末示例' : '添加周末示例' }}
        </ElButton>
        <div
          class="group-tabs"
          role="group"
          aria-label="选择抽签分组"
        >
          <ElButton
            v-for="group in groups"
            :key="group.id"
            :type="selectedId === group.id ? 'primary' : 'default'"
            :aria-pressed="selectedId === group.id"
            :disabled="busy || dirty"
            @click="selectedId = group.id"
          >
            <span class="group-tab-name">{{ group.name }}</span><span class="group-count">{{ group.items.length }} 项</span>
          </ElButton>
        </div>
        <p
          v-if="!groups.length"
          class="settings-hint"
        >
          先新建一个分组，再添加想要抽取的项目。
        </p>
        <form
          v-if="selected"
          class="group-editor"
          @submit.prevent="saveSettings"
        >
          <label for="lottery-group-name">分组名称</label>
          <ElInput
            id="lottery-group-name"
            v-model="groupName"
            :disabled="busy"
          />
          <label for="lottery-items">候选项目 · 每行一项</label>
          <ElInput
            id="lottery-items"
            v-model="itemsText"
            type="textarea"
            :rows="7"
            placeholder="散步&#10;看电影&#10;读书&#10;打球"
            :disabled="busy"
          />
          <p class="settings-hint">
            最多 {{ maxItems }} 项，每项 50 个字符。空行忽略，同名项目去重，每项机会相同。
          </p>
          <div class="editor-buttons">
            <ElButton
              type="primary"
              native-type="submit"
              :disabled="busy || !ready"
            >
              保存分组
            </ElButton>
            <ElButton
              type="danger"
              plain
              :disabled="busy || dirty"
              @click="confirmAction = 'delete'"
            >
              删除分组
            </ElButton>
            <ElButton
              v-if="dirty"
              :disabled="busy"
              @click="syncDraft"
            >
              放弃修改
            </ElButton>
          </div>
          <p
            v-if="dirty"
            class="draft-hint"
          >
            有未保存修改。保存或放弃后可切换分组、开始抽签。
          </p>
          <div
            v-if="confirmAction === 'delete'"
            class="confirm-panel"
            role="alert"
          >
            <p>删除“{{ selected.name }}”及其所有项目和记录？</p>
            <ElButton
              type="danger"
              :disabled="busy || dirty"
              @click="confirmChange"
            >
              确认删除分组
            </ElButton>
            <ElButton @click="confirmAction = null">
              取消
            </ElButton>
          </div>
        </form>
        <p
          class="storage-feedback"
          role="status"
        >
          {{ feedback || '分组与结果保存在当前浏览器' }}
        </p>
      </aside>

      <div class="draw-panel">
        <div
          class="mode-tabs"
          role="group"
          aria-label="抽签模式"
        >
          <ElButton
            v-for="option in drawModes"
            :key="option.value"
            :type="mode === option.value ? 'primary' : 'default'"
            :aria-pressed="mode === option.value"
            :disabled="busy"
            @click="mode = option.value"
          >
            <span aria-hidden="true">{{ option.icon }}</span>{{ option.label }}
          </ElButton>
        </div>
        <div
          class="draw-stage"
          :class="[`mode-${mode}`, { busy }]"
          :aria-busy="busy"
        >
          <p class="stage-eyebrow">
            {{ selected?.name || '为每个选择，留一点惊喜' }}
          </p>
          <p class="stage-hint">
            {{ drawModes.find(option => option.value === mode)?.hint }}
          </p>
          <div
            v-if="mode === 'wheel'"
            class="wheel-stage"
            aria-hidden="true"
          >
            <span
              v-for="index in 16"
              :key="index"
              class="wheel-light"
              :style="{ transform: `rotate(${index * 22.5}deg) translateY(calc(-1 * var(--wheel-light-radius)))` }"
            />
            <span class="wheel-pointer" />
            <div
              class="wheel"
              :style="{ background: wheelBackground, transform: `rotate(${wheelRotation}deg)` }"
            >
              <span
                v-for="(item, index) in wheelItems.length <= 20 ? wheelItems : []"
                :key="item"
                class="wheel-label"
                :title="item"
                :style="{ transform: `translate(-50%, -50%) rotate(${(index + 0.5) * 360 / wheelItems.length}deg) translateY(calc(-1 * var(--wheel-label-radius)))` }"
              >{{ wheelItems.length <= 8 ? Array.from(item).slice(0, 7).join('') : index + 1 }}</span>
            </div>
            <span class="wheel-center">好运</span>
          </div>
          <div
            v-else-if="mode === 'cards'"
            class="card-stage"
            aria-hidden="true"
          >
            <div
              v-for="index in currentRecord?.results.length || effectiveCount || 1"
              :key="index"
              class="draw-card"
              :class="{ revealed: index <= revealedCount }"
            >
              <div class="card-inner">
                <div class="card-face card-back">
                  <small>第 {{ index }} 张</small><strong>✦</strong><span>幸运藏在背面</span>
                </div>
                <div class="card-face card-front">
                  <small>第 {{ index }} 张</small><strong>{{ index <= revealedCount ? currentRecord?.results[index - 1] : '等待揭晓' }}</strong><span>{{ index <= revealedCount ? '好选择，已揭晓' : '幸运正在转动' }}</span>
                </div>
              </div>
            </div>
          </div>
          <div
            v-else-if="mode === 'slot'"
            class="slot-stage"
          >
            <div class="slot-machine">
              <div
                class="machine-marquee"
                aria-hidden="true"
              >
                ✦ LUCKY DRAW ✦
              </div>
              <div
                class="reel-window"
                :class="{ spinning: reelSpinning }"
                aria-hidden="true"
              >
                <div
                  class="reel-strip"
                  :style="{ transform: `translateY(${reelOffset}px)`, transitionDuration: `${reelDuration}ms` }"
                >
                  <div
                    v-for="(item, index) in reelItems.length ? reelItems : ['拉动拉杆，试试好运']"
                    :key="index"
                    class="reel-item"
                  >
                    <span :title="item">{{ item }}</span>
                  </div>
                </div>
              </div>
              <div
                class="machine-foot"
                aria-hidden="true"
              >
                {{ busy ? `正在揭晓第 ${revealedCount + 1} 项` : '向下拉动，幸运开场' }}
              </div>
            </div>
            <ElButton
              class="slot-lever"
              :class="{ pulled: busy }"
              aria-label="拉动拉杆抽签"
              :disabled="busy || dirty || !ready || !selected || !pool.length || !!confirmAction"
              @click="startDraw"
            >
              <span
                class="lever-knob"
                aria-hidden="true"
              /><span
                class="lever-shaft"
                aria-hidden="true"
              />
            </ElButton>
          </div>
          <div
            v-else
            class="sticks-stage"
            :class="{ shaking: busy }"
            aria-hidden="true"
          >
            <div class="bamboo-sticks">
              <span
                v-for="index in 5"
                :key="index"
                :style="{ '--stick': index }"
              >吉</span>
            </div>
            <div class="stick-holder">
              <span>好<br>运</span>
            </div>
          </div>
          <div
            v-if="currentRecord && !busy"
            class="latest-results"
            role="status"
          >
            <h3>本次抽取结果</h3>
            <ol>
              <li
                v-for="(result, index) in currentRecord.results"
                :key="index"
              >
                <span>{{ index + 1 }}</span><strong>{{ result }}</strong>
              </li>
            </ol>
          </div>
          <p
            v-else
            class="stage-caption"
            role="status"
          >
            {{ busy ? '幸运正在路上，按顺序揭晓…' : '准备好，抽一个惊喜吧' }}
          </p>
          <ElButton
            type="primary"
            size="large"
            class="draw-button"
            :disabled="busy || dirty || !ready || !selected || !pool.length || !!confirmAction"
            @click="startDraw"
          >
            {{ busy ? '正在揭晓…' : currentRecord ? '再抽一次' : '开始抽签' }}
          </ElButton>
          <ElButton
            class="restart-button"
            text
            :disabled="busy || dirty || !visibleRecords.length"
            @click="confirmAction = 'clear'"
          >
            重新开始
          </ElButton>
          <p class="pool-count">
            可抽 {{ pool.length }} / {{ selected?.items.length || 0 }} 项
          </p>
          <p
            v-if="selected && !pool.length"
            class="settings-hint"
          >
            {{ selected.items.length ? '项目已抽完，可清空记录重新开始，或勾选允许重复。' : '请先在分组中填写项目并保存。' }}
          </p>
        </div>
        <div class="draw-settings">
          <div class="count-setting">
            <label for="lottery-count">每次抽取</label>
            <div class="count-control">
              <!-- 组件仅在初始化时写入 aria-disabled，禁用状态变化时重建，使读屏状态与实际交互一致。 -->
              <ElInputNumber
                id="lottery-count"
                :key="busy || mode === 'wheel' ? 'locked' : 'editable'"
                :min="1"
                :max="maxDrawCount"
                :step="1"
                step-strictly
                :disabled="busy || mode === 'wheel'"
                :model-value="mode === 'wheel' ? 1 : count"
                @update:model-value="count = $event"
              />
              <span>项{{ mode === 'wheel' ? '（转盘固定 1 项）' : '' }}</span>
            </div>
          </div>
          <div class="repeat-setting">
            <span class="setting-label">重复规则</span>
            <ElCheckbox
              v-model="repeat"
              :disabled="busy"
            >
              允许重复抽取
            </ElCheckbox>
          </div>
          <p class="settings-hint">
            {{ repeat ? '每次抽取后放回，同一轮也可能多次抽中同一项目。' : '本模式同轮及后续轮次均不重复；其他模式的记录不影响本模式候选。' }}
          </p>
        </div>
        <details
          v-if="wheelItems.length && mode === 'wheel'"
          class="candidate-legend"
        >
          <summary>查看{{ stagePool.length ? '本轮' : '当前' }}转盘候选（{{ wheelItems.length }} 项）</summary>
          <ol>
            <li
              v-for="item in wheelItems"
              :key="item"
            >
              {{ item }}
            </li>
          </ol>
        </details>
      </div>
      <section
        class="history-panel"
        aria-labelledby="draw-history-title"
      >
        <div class="section-title">
          <h2 id="draw-history-title">
            {{ selected?.name || '当前分组' }} · 抽签记录
          </h2>
        </div>
        <p class="history-mode">
          {{ drawModes.find(option => option.value === mode)?.label }} · {{ visibleRecords.length }} 轮
        </p>
        <ElButton
          :disabled="busy || dirty || !visibleRecords.length"
          @click="confirmAction = 'clear'"
        >
          清空当前记录
        </ElButton>
        <p class="settings-hint">
          当前模式独立记录，按抽取顺序展示；每组每种模式最多 {{ maxRecords }} 轮。候选池、轮次和重置互不影响。
        </p>
        <div
          v-if="orderedResults.length"
          class="history-scroll"
        >
          <ol class="history-list">
            <li
              v-for="result in orderedResults"
              :key="result.key"
            >
              <span class="history-order">{{ result.order }}</span>
              <div>
                <strong class="history-result-name">{{ result.name }}</strong>
                <small>第 {{ result.round }} 轮 · 本轮第 {{ result.withinRound }} 项</small>
              </div>
            </li>
          </ol>
        </div>
        <p
          v-else
          class="history-empty"
        >
          {{ busy ? '本轮结果正在揭晓，稍后显示记录。' : '当前模式还没有抽签记录，试着抽一次吧。' }}
        </p>
      </section>
    </div>
    <ElDialog
      v-model="restartDialog"
      title="重新开始抽签？"
      width="min(440px, 92vw)"
      class="lottery-restart-dialog"
      :close-on-click-modal="false"
    >
      <div class="restart-message">
        <p>将清空「{{ selected?.name }}」中「{{ drawModes.find(option => option.value === mode)?.label }}」的抽取结果与历史记录。</p>
        <p class="settings-hint">
          保留候选项目，恢复本模式全部候选，从第 1 轮重新开始。其他模式和分组不受影响。
        </p>
        <p
          v-if="error"
          class="error-message"
          role="alert"
        >
          {{ error }}
        </p>
      </div>
      <template #footer>
        <ElButton @click="restartDialog = false">
          取消
        </ElButton>
        <ElButton
          type="danger"
          :disabled="busy || dirty || !ready"
          @click="confirmChange"
        >
          确认清空记录
        </ElButton>
      </template>
    </ElDialog>
    <ElDialog
      v-model="resultDialog"
      title="幸运签已揭晓"
      width="min(480px, 92vw)"
      class="lottery-result-dialog"
      :close-on-click-modal="false"
    >
      <div class="fortune-results">
        <span
          class="fortune-symbol"
          aria-hidden="true"
        >✦</span>
        <p>{{ selected?.name }} · 本次幸运签</p>
        <ol>
          <li
            v-for="(result, index) in currentRecord?.results || []"
            :key="index"
            :style="{ animationDelay: `${index * 80}ms` }"
          >
            <span>第 {{ index + 1 }} 签</span><strong>{{ result }}</strong>
          </li>
        </ol>
        <p class="settings-hint">
          抽取顺序已记录，关闭弹窗后可在历史中查看。
        </p>
      </div>
      <template #footer>
        <ElButton
          type="primary"
          @click="resultDialog = false"
        >
          收下幸运签
        </ElButton>
      </template>
    </ElDialog>
    <div class="tool-notes">
      <p>新建分组后，每行填写一个候选并保存。各组项目与记录独立维护，项目编辑不会改写已有结果。四种模式使用相同的等概率抽取逻辑；转盘每次 1 项，其余模式每次 1–{{ maxDrawCount }} 项。结果先保存，再播放动画，离开页面后仍可在记录中查看。</p>
      <p>各模式的候选池、抽取数量、重复设置与历史轮次独立。点击“重新开始”或“清空当前记录”，确认后仅清空当前分组当前模式的结果与记录，保留候选项目，恢复本模式完整候选池；其他模式和分组不受影响。</p>
      <p>分组与记录仅存储在当前浏览器，不上传、不跨设备同步。清除网站数据会删除存档；多个标签页同时修改以最后保存的内容为准。系统设置减少动态效果时直接显示结果。</p>
    </div>
  </section>
</template>

<style scoped>
.lottery-layout { display: grid; grid-template-columns: 200px minmax(0, 1fr) 220px; gap: 18px; align-items: start; }
.group-panel, .draw-panel { min-width: 0; }
.group-panel { padding-right: 16px; border-right: 1px solid #e3e8df; }
.section-title { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.section-title h2 { font-size: 18px; overflow-wrap: anywhere; }
.section-title > span { color: #71806f; font-size: 12px; white-space: nowrap; }
.new-group { display: flex; gap: 8px; margin: 16px 0; }
.example-button { width: 100%; margin-bottom: 12px; }
.group-tabs { display: grid; gap: 8px; max-height: 250px; overflow-y: auto; }
.group-tabs .el-button { margin: 0; height: auto; min-height: 40px; text-align: left; }
.group-tabs :deep(.el-button > span) { width: 100%; display: flex; justify-content: space-between; gap: 12px; }
.group-tab-name { white-space: normal; overflow-wrap: anywhere; min-width: 0; line-height: 1.5; }
.group-count { font-size: 11px; opacity: .8; flex-shrink: 0; }
.group-editor { display: grid; gap: 10px; margin-top: 22px; }
.group-editor > label { font-size: 13px; font-weight: 600; }
.editor-buttons { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.editor-buttons .el-button { min-width: 0; padding: 0 8px; }
.editor-buttons .el-button:last-child:nth-child(3) { grid-column: 1 / -1; }
.editor-buttons .el-button + .el-button { margin: 0; }
.settings-hint, .storage-feedback { color: #657361; font-size: 12px; line-height: 1.8; margin: 0; overflow-wrap: anywhere; }
.storage-feedback { margin-top: 16px; color: #205c46; }
.draft-hint { color: #946524; background: #fff6df; padding: 10px; border-radius: 8px; margin: 0; font-size: 12px; line-height: 1.8; }
.mode-tabs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-bottom: 16px; }
.mode-tabs .el-button { margin: 0; padding: 0 8px; font-size: 12px; }
.mode-tabs .el-button span[aria-hidden] { margin-right: 5px; }
.draw-stage { border: 1px solid #dfe7d6; border-radius: 18px; background: radial-gradient(circle at 50% 30%, #fff 0, #f1f5e9 80%); padding: 24px 18px 16px; text-align: center; }
.stage-eyebrow { margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #426044; overflow-wrap: anywhere; }
.stage-hint { margin: 0 0 20px; font-size: 12px; color: #75816b; }
.mode-wheel { background: radial-gradient(circle at 50% 40%, #fff6db, #fffaf1 60%, #f9edf4); border-color: #f0d2a5; }
.wheel-stage { --wheel-label-radius: 93px; --wheel-light-radius: 137px; position: relative; width: 280px; height: 280px; margin: 0 auto 20px; border: 10px solid #efb748; border-radius: 50%; background: #f8d97a; box-shadow: 0 0 0 4px #fff0b5, 0 10px 24px #ca882d30; }
.wheel { position: absolute; inset: 0; border: 4px solid #fff7d6; border-radius: 50%; transition: transform 2.6s cubic-bezier(.15,.65,.1,1); }
.wheel-light { position: absolute; top: calc(50% - 4px); left: calc(50% - 4px); width: 8px; height: 8px; border-radius: 50%; background: #fffbea; box-shadow: 0 0 6px #fff; z-index: 2; }
.busy .wheel-light { animation: wheel-spark .45s infinite alternate; }
.wheel-light:nth-child(even) { animation-delay: .2s; }
.wheel-pointer { position: absolute; top: -19px; left: calc(50% - 13px); z-index: 3; width: 0; height: 0; border-left: 13px solid transparent; border-right: 13px solid transparent; border-top: 33px solid #d34452; filter: drop-shadow(0 2px 1px #9a324040); }
.wheel-center { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); display: grid; place-items: center; width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(145deg, #fff8da, #ffd366); color: #824515; border: 4px solid #fff; font-size: 13px; font-weight: 700; box-shadow: 0 3px 8px #87541f30; }
.wheel-label { position: absolute; top: 50%; left: 50%; color: #3c2937; font-size: 12px; font-weight: 700; }
.card-stage { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(140px, 100%), 1fr)); gap: 10px; margin: 24px 0; }
.draw-card { height: 210px; perspective: 900px; }
.card-inner { position: relative; width: 100%; height: 100%; transform-style: preserve-3d; transition: transform .65s cubic-bezier(.2,.7,.2,1); }
.draw-card.revealed .card-inner { transform: rotateY(180deg); }
.busy .draw-card:not(.revealed) .card-inner { animation: card-spin 1.4s ease-in-out both; }
.card-face { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 12px; border: 2px solid #cabf88; border-radius: 12px; backface-visibility: hidden; box-shadow: 0 5px 12px #29473418; overflow: hidden; }
.card-back { color: #fff1c5; background: repeating-linear-gradient(45deg, #205c46, #205c46 12px, #2f7656 12px, #2f7656 14px); }
.card-front { transform: rotateY(180deg); color: #34533b; background: linear-gradient(145deg, #fffdf1, #f4f0d6); border-color: #d3bd74; }
.card-face small, .card-face > span { font-size: 10px; opacity: .8; }
.card-face strong { font-size: 30px; overflow-wrap: anywhere; max-width: 100%; }
.card-front strong { font-size: 24px; line-height: 1.4; max-height: 130px; overflow-y: auto; }
.slot-stage { display: grid; grid-template-columns: 36px minmax(0, 1fr) 36px; align-items: center; gap: 12px; max-width: 520px; margin: 26px auto; }
.slot-machine { grid-column: 2; min-width: 0; padding: 16px; border: 3px solid #d89935; border-radius: 20px; background: linear-gradient(145deg, #fff2ce, #f7c96c); box-shadow: 0 7px 0 #c48c37, 0 14px 20px #b3812620; }
.machine-marquee { padding: 10px 6px; margin-bottom: 16px; color: #934c2d; background: #fff9e8; border: 3px dotted #df9a49; border-radius: 10px; font-size: 12px; font-weight: 700; letter-spacing: 2px; }
.reel-window { position: relative; height: 88px; overflow: hidden; background: #fff; border: 3px solid #9b6540; border-radius: 10px; box-sizing: content-box; box-shadow: inset 0 6px 14px #714a2420; }
.reel-window::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(#59342122, transparent 26%, transparent 74%, #59342122); }
.reel-strip { transition-property: transform; transition-timing-function: cubic-bezier(.12,.64,.16,1); will-change: transform; }
.reel-item { height: 88px; display: grid; place-items: center; padding: 8px; color: #784627; font-size: 18px; font-weight: 700; overflow-wrap: anywhere; line-height: 1.4; }
.reel-item span { display: -webkit-box; max-width: 100%; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 3; }
.spinning .reel-item { filter: blur(.5px); }
.machine-foot { color: #8c5f31; font-size: 11px; margin-top: 14px; }
.slot-lever.el-button { grid-column: 3; position: relative; width: 36px; height: 150px; padding: 0; margin: 0; border: 0; background: transparent; transform-origin: 50% 95%; transition: transform .38s cubic-bezier(.2,.7,.2,1); }
.slot-lever.el-button:hover { background: transparent; }
/* 底座保持固定，以透视旋转表现向下扳动，轻微侧倾让杆身角度清晰可见。 */
.slot-lever.pulled { transform: perspective(280px) rotateX(-58deg) rotateZ(-3deg); }
.lever-shaft { position: absolute; top: 28px; left: 13px; width: 10px; height: 115px; border-radius: 6px; background: linear-gradient(90deg, #8b949e, #edf0f3 50%, #899099); }
.lever-knob { position: absolute; top: 4px; left: 1px; z-index: 1; width: 34px; height: 34px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #ffaeaa, #df4b57 65%); box-shadow: 0 3px 5px #7c343333; }
.sticks-stage { position: relative; width: 160px; height: 230px; margin: 20px auto 30px; }
.bamboo-sticks { position: absolute; top: 0; left: 24px; right: 24px; display: flex; justify-content: center; gap: 4px; }
.bamboo-sticks span { display: block; width: 20px; height: 180px; padding-top: 10px; background: #e9cea1; border: 1px solid #c79a62; border-radius: 5px; color: #936335; transform: rotate(calc((var(--stick) - 3) * 8deg)); transform-origin: bottom; }
.stick-holder { position: absolute; bottom: 0; width: 160px; height: 150px; display: grid; place-items: center; border-radius: 18px 18px 35px 35px; background: linear-gradient(90deg, #205c46, #3e7c58 50%, #205c46); border-top: 10px solid #51876a; box-shadow: 0 12px 20px #285d4220; }
.stick-holder span { background: #f2dfb3; border-radius: 8px; padding: 12px 20px; color: #70552b; font-family: serif; font-size: 21px; }
.shaking { animation: shake .25s infinite alternate; }
.stage-caption { font-size: 15px; color: #657361; margin: 20px 0; }
.draw-button { min-width: 180px; margin-top: 8px; }
.restart-button { display: block; margin: 10px auto 0; }
.restart-message { line-height: 1.8; overflow-wrap: anywhere; }
.restart-message > p:first-child { margin: 0 0 12px; color: #354e39; }
.pool-count { font-size: 12px; color: #6b7b62; margin: 12px 0 4px; }
.latest-results { margin: 12px 0 16px; }
.latest-results h3 { font-size: 12px; color: #75816b; font-weight: 400; }
.latest-results ol { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
.latest-results li { max-width: 100%; display: flex; gap: 8px; align-items: baseline; padding: 8px 12px; border: 1px solid #d9e4cf; border-radius: 8px; background: #fff; color: #205c46; overflow-wrap: anywhere; }
.latest-results li span { font-size: 11px; opacity: .6; }
.latest-results strong { min-width: 0; font-size: 20px; }
.draw-settings { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; gap: 14px; margin-top: 18px; padding: 16px; border: 1px solid #e0e6db; border-radius: 12px; background: #f8faf5; }
.count-setting, .repeat-setting { min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }
.count-setting label, .setting-label { color: #426044; font-size: 13px; font-weight: 600; }
.count-setting { font-size: 12px; color: #657361; }
.count-control { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.count-setting .el-input-number { width: 116px; }
.draw-settings > p { grid-column: 1 / -1; }
.candidate-legend { color: #657361; font-size: 12px; margin-top: 16px; }
.candidate-legend summary { cursor: pointer; }
.candidate-legend ol { columns: 2; padding-left: 24px; line-height: 1.8; }
.candidate-legend li { overflow-wrap: anywhere; break-inside: avoid; }
.history-panel { min-width: 0; position: sticky; top: 20px; padding: 16px; border: 1px solid #e0e6db; background: #f8faf5; border-radius: 12px; }
.history-panel h2 { font-size: 16px; line-height: 1.6; }
.history-mode { color: #205c46; font-size: 13px; font-weight: 600; }
.history-panel > p { margin: 12px 0; }
.history-scroll { margin-top: 16px; max-height: 60vh; overflow: auto; }
.history-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
.history-list li { display: flex; align-items: flex-start; gap: 10px; padding: 12px 10px; background: white; border: 1px solid #e2e9da; border-radius: 9px; }
.history-order { flex-shrink: 0; min-width: 24px; padding: 3px; text-align: center; border-radius: 6px; background: #e8efdd; color: #5c7345; font-size: 12px; }
.history-list li > div { min-width: 0; }
.history-result-name { display: block; color: #354e39; font-size: 13px; line-height: 1.6; overflow-wrap: anywhere; }
.history-list small { display: block; margin-top: 5px; color: #7a8772; font-size: 10px; }
.history-empty { text-align: center; padding: 26px; color: #71806f; font-size: 13px; }
.confirm-panel { margin-top: 20px; padding: 16px; background: #fff5ee; border: 1px solid #ead4c4; border-radius: 10px; }
.confirm-panel p { margin: 0 0 12px; overflow-wrap: anywhere; font-size: 13px; }
.fortune-results { text-align: center; }
.fortune-symbol { display: block; font-size: 44px; color: #c39336; animation: fortune-star .8s ease-out; }
.fortune-results > p { color: #8d6c37; font-size: 13px; }
.fortune-results ol { list-style: none; padding: 0; display: grid; gap: 12px; max-height: 50vh; overflow-y: auto; }
.fortune-results li { display: grid; gap: 10px; padding: 20px; border: 1px solid #ebd39e; border-radius: 10px; background: linear-gradient(145deg, #fff9e9, #f7ead0); animation: fortune-rise .6s both; }
.fortune-results li span { color: #a57f40; font-size: 11px; }
.fortune-results li strong { color: #745429; font-size: 20px; overflow-wrap: anywhere; }
@keyframes fortune-rise { from { opacity: 0; transform: translateY(35px) rotate(-4deg) scale(.9); } to { opacity: 1; transform: translateY(0) rotate(0) scale(1); } }
@keyframes fortune-star { from { transform: rotate(-100deg) scale(.4); opacity: 0; } to { transform: rotate(0) scale(1); opacity: 1; } }
@keyframes wheel-spark { from { opacity: .5; } to { opacity: 1; box-shadow: 0 0 10px #fff; } }
@keyframes shake { from { transform: rotate(-5deg); } to { transform: rotate(5deg); } }
@keyframes card-spin { from { transform: rotateY(0); } to { transform: rotateY(720deg); } }
@media (max-width: 900px) {
  .lottery-layout { grid-template-columns: 1fr; gap: 24px; }
  .history-panel, .group-panel { grid-column: auto; grid-row: auto; position: static; }
  .group-panel { padding: 0 0 20px; border-right: 0; border-bottom: 1px solid #e3e8df; }
  .group-tabs { grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); }
}
@media (max-width: 600px) {
  .mode-tabs { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .draw-stage { padding: 20px 10px 14px; }
  .wheel-stage { --wheel-label-radius: clamp(55px, calc(50vw - 118px), 80px); --wheel-light-radius: clamp(93px, calc(50vw - 75px), 122px); width: 250px; max-width: 100%; height: auto; aspect-ratio: 1; }
  .wheel-label { font-size: 10px; }
  .section-title { flex-wrap: wrap; }
  .slot-machine { padding: 10px; }
  .reel-item { font-size: 16px; }
  .slot-stage { gap: 5px; }
  .draw-settings { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) {
  .wheel, .card-inner, .slot-lever, .reel-strip { transition: none; }
  .busy .draw-card:not(.revealed) .card-inner, .shaking, .wheel-light, .fortune-results li, .fortune-symbol { animation: none; }
}
</style>
