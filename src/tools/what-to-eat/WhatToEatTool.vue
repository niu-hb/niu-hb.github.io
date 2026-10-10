<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { ElButton } from 'element-plus/es/components/button/index'
import { ElInput } from 'element-plus/es/components/input/index'
import { useLocalText } from '../useLocalText'
import { buildMealPool, builtinMeals, drawMeal, filterMeals, filterOptions, menuNote, menuSources, parseCustomMenu, type Meal, type MealFilters, type MenuMode } from './logic'

const modes: { value: MenuMode; label: string }[] = [
  { value: 'builtin', label: '内置菜单' },
  { value: 'custom', label: '仅自定义' },
  { value: 'combined', label: '内置 + 自定义' },
]
const dimensions: { key: keyof MealFilters; label: string }[] = [
  { key: 'flavors', label: '口味' },
  { key: 'regions', label: '风味地区' },
  { key: 'categories', label: '餐食类别' },
]
const mode = ref<MenuMode>('builtin')
const filters = reactive<MealFilters>({ regions: [], flavors: [], categories: [] })
const { text: customText, storageFeedback, storageError, saveText } = useLocalText('toolbox:custom-menu:v1', 10000, parseCustomMenu)
const customMenu = computed(() => {
  try {
    return { meals: parseCustomMenu(customText.value), error: '' }
  } catch (cause) {
    return { meals: [], error: cause instanceof Error ? cause.message : '自定义菜单解析失败' }
  }
})
const filteredBuiltin = computed(() => filterMeals(builtinMeals, filters))
const pool = computed(() => buildMealPool(mode.value, filteredBuiltin.value, customMenu.value.meals))
const spinning = ref(false)
const celebrating = ref(false)
const displayMeal = ref<Meal>()
const result = ref<Meal>()
const drawError = ref('')
const inputError = computed(() => mode.value !== 'builtin' ? customMenu.value.error : '')
const error = computed(() => inputError.value || drawError.value)
let timer: number | undefined

/** 释放动画计时器；无参数、无返回值，避免切换菜单或离开页面后继续更新状态。 */
function stopAnimation(): void {
  window.clearTimeout(timer)
  timer = undefined
  spinning.value = false
  celebrating.value = false
}

watch(pool, () => {
  stopAnimation()
  result.value = undefined
  displayMeal.value = undefined
  drawError.value = ''
})
onBeforeUnmount(stopAnimation)

/** 切换一个筛选标签；key 为维度，value 为标签，无返回值，同组可多选。 */
function toggleFilter(key: keyof MealFilters, value: string): void {
  const selected = filters[key]
  filters[key] = selected.includes(value) ? selected.filter(item => item !== value) : [...selected, value]
}

/** 清空所有筛选；无参数、无返回值，恢复全部内置餐食。 */
function resetFilters(): void {
  filters.regions = []
  filters.flavors = []
  filters.categories = []
}

/** 抽选并播放逐渐减速的菜单动画；无参数、无返回值，结果预先等概率抽取，不受动画影响。 */
function draw(): void {
  if (spinning.value || inputError.value) return
  stopAnimation()
  result.value = undefined
  drawError.value = ''
  try {
    const snapshot = [...pool.value]
    const winner = drawMeal(snapshot)
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // 只有最终结果播报给读屏；单选项和减少动态效果设置直接显示，避免无意义滚动。
    if (reducedMotion || snapshot.length === 1) {
      result.value = winner
      displayMeal.value = winner
      return
    }
    spinning.value = true
    let frame = 0
    const advance = (): void => {
      if (frame >= 18) {
        spinning.value = false
        displayMeal.value = winner
        result.value = winner
        celebrating.value = true
        timer = window.setTimeout(() => { celebrating.value = false }, 1200)
        return
      }
      displayMeal.value = snapshot[frame % snapshot.length]
      timer = window.setTimeout(advance, 65 + frame * 12)
      frame += 1
    }
    advance()
  } catch (cause) {
    stopAnimation()
    displayMeal.value = undefined
    drawError.value = cause instanceof Error ? cause.message : '抽选失败，请重试'
  }
}
</script>

<template>
  <section class="tool-surface food-tool">
    <div class="food-layout">
      <div class="draw-column">
        <div
          class="draw-stage"
          :class="{ spinning, celebrating }"
          :aria-busy="spinning"
        >
          <span class="stage-eyebrow">把选择交给一点好运</span>
          <div
            class="bowl-art"
            aria-hidden="true"
          >
            <div class="steam">
              <i /><i /><i />
            </div>
            <div class="bowl-rim" />
            <div class="bowl" />
            <span class="bowl-star">✦</span>
          </div>
          <p class="stage-caption">
            {{ spinning ? '好吃的正在排队…' : result ? '今天就吃这道吧！' : '今天，吃点什么？' }}
          </p>
          <div
            class="meal-slot"
            aria-hidden="true"
          >
            <Transition
              name="meal-slide"
              mode="out-in"
            >
              <strong :key="displayMeal?.name || 'empty'">{{ displayMeal?.name || '等你开饭' }}</strong>
            </Transition>
          </div>
          <div class="result-tags">
            <template v-if="displayMeal">
              <span>{{ displayMeal.category }}</span>
              <span
                v-for="tag in [...displayMeal.regions, ...displayMeal.flavors]"
                :key="tag"
              >{{ tag }}</span>
            </template>
            <span v-else>先选菜单，再来一次惊喜</span>
          </div>
          <div
            v-if="celebrating"
            class="confetti"
            aria-hidden="true"
          >
            <i
              v-for="index in 12"
              :key="index"
              :style="{ '--i': index }"
            />
          </div>
          <ElButton
            type="primary"
            size="large"
            class="draw-button"
            :disabled="spinning || !pool.length || !!inputError"
            @click="draw"
          >
            {{ spinning ? '正在揭晓…' : result ? '再选一次' : '帮我选一道' }}
          </ElButton>
          <p class="pool-count">
            当前可抽选 <strong>{{ pool.length }}</strong> 道 · 每道机会相同
          </p>
          <p
            class="screen-reader-status"
            role="status"
          >
            {{ result ? `抽选结果：${result.name}` : '' }}
          </p>
        </div>
        <p
          v-if="error"
          class="error-message"
          role="alert"
        >
          {{ error }}
        </p>
        <p
          v-else-if="!pool.length"
          class="empty-hint"
          role="status"
        >
          暂无候选餐食。请放宽筛选，或每行输入一个自定义选项。
        </p>
      </div>

      <div class="menu-settings">
        <h2>从哪里选？</h2>
        <div
          class="mode-buttons toolbar"
          role="group"
          aria-label="菜单来源"
        >
          <ElButton
            v-for="item in modes"
            :key="item.value"
            :type="mode === item.value ? 'primary' : 'default'"
            :aria-pressed="mode === item.value"
            :disabled="spinning"
            @click="mode = item.value"
          >
            {{ item.label }}
          </ElButton>
        </div>

        <fieldset
          v-if="mode !== 'custom'"
          class="filter-fieldset"
          :disabled="spinning"
        >
          <legend>内置菜单筛选</legend>
          <p class="settings-hint">
            同一维度可多选，满足其中一个即可；不同维度需同时满足。
          </p>
          <div
            v-for="dimension in dimensions"
            :key="dimension.key"
            class="filter-row"
            role="group"
            :aria-label="dimension.label"
          >
            <div class="filter-title">
              {{ dimension.label }}
            </div>
            <div class="filter-buttons">
              <ElButton
                size="small"
                :type="!filters[dimension.key].length ? 'primary' : 'default'"
                :aria-pressed="!filters[dimension.key].length"
                :disabled="spinning"
                @click="filters[dimension.key] = []"
              >
                不限
              </ElButton>
              <ElButton
                v-for="option in filterOptions[dimension.key]"
                :key="option"
                size="small"
                :type="filters[dimension.key].includes(option) ? 'primary' : 'default'"
                :aria-pressed="filters[dimension.key].includes(option)"
                :disabled="spinning"
                @click="toggleFilter(dimension.key, option)"
              >
                {{ option }}
              </ElButton>
            </div>
          </div>
          <div class="filter-summary">
            <span>内置符合条件：<strong>{{ filteredBuiltin.length }}</strong> / {{ builtinMeals.length }} 道</span>
            <ElButton
              size="small"
              :disabled="spinning"
              @click="resetFilters"
            >
              重置筛选
            </ElButton>
          </div>
        </fieldset>

        <div
          v-if="mode !== 'builtin'"
          class="custom-menu"
        >
          <label for="custom-meals">我的菜单 <span>每行一个选项</span></label>
          <ElInput
            id="custom-meals"
            v-model="customText"
            type="textarea"
            :rows="5"
            :maxlength="10000"
            :disabled="spinning"
            placeholder="饺子&#10;牛肉面&#10;食堂套餐"
            aria-describedby="custom-menu-hint"
          />
          <p
            id="custom-menu-hint"
            class="settings-hint"
          >
            最多 100 行，每项最多 50 个字符。自动忽略空行和重复名称；自定义选项不受内置筛选影响。点击保存后存入当前浏览器，重新进入页面时恢复，不上传。
          </p>
          <div class="filter-summary">
            <span>自定义有效选项：<strong>{{ customMenu.meals.length }}</strong> 个</span>
            <ElButton
              size="small"
              :disabled="spinning || !customText"
              @click="customText = ''"
            >
              清空输入
            </ElButton>
          </div>
          <div class="toolbar custom-save">
            <ElButton
              :disabled="spinning || !!customMenu.error"
              @click="saveText"
            >
              保存菜单
            </ElButton>
          </div>
          <p
            v-if="storageFeedback"
            class="feedback"
            role="status"
          >
            {{ storageFeedback }}
          </p>
        </div>
        <p
          v-if="storageError"
          class="error-message"
          role="alert"
        >
          {{ storageError }}
        </p>
        <p
          v-if="mode === 'combined'"
          class="settings-hint combined-hint"
        >
          抽选池 = 符合筛选的内置餐食 + 全部自定义选项。同名选项合并，不增加抽中概率。
        </p>
      </div>
    </div>

    <details class="candidate-details">
      <summary>查看当前候选菜单 <span>{{ pool.length }} 道</span></summary>
      <ul
        v-if="pool.length"
        class="candidate-grid"
      >
        <li
          v-for="meal in pool"
          :key="meal.name"
        >
          <strong>{{ meal.name }}</strong>
          <span>{{ [...meal.regions, ...meal.flavors, meal.category].join(' · ') }}</span>
        </li>
      </ul>
      <p
        v-else
        class="settings-hint"
      >
        没有符合条件的餐食。
      </p>
    </details>
    <div class="tool-notes">
      <p>自定义菜单需手动保存，只保留最近一次保存内容。清空输入后点击“保存菜单”可清除已保存的内容；清理浏览器网站数据也会删除保存内容。</p>
      <p>{{ menuNote }} 内置餐食共 {{ builtinMeals.length }} 道，主食包含米饭、面条、米粉及包饺等；家常菜涵盖炒菜、蒸菜、水煮和炖菜，另有小吃、汤粥和甜品。抽选一份餐食，不组合整套餐单。</p>
      <p>抽选使用浏览器随机数，每个去重后的候选等概率；允许连续抽到同一道。滚动、减速与彩纸效果仅用于展示，开启系统“减少动态效果”时直接显示结果。</p>
      <details class="source-details">
        <summary>餐食资料来源</summary>
        <ul>
          <li
            v-for="source in menuSources"
            :key="source.id"
          >
            <a
              :href="source.url"
              target="_blank"
              rel="noopener noreferrer"
            >{{ source.title }} ↗</a>
          </li>
        </ul>
      </details>
    </div>
  </section>
</template>

<style scoped>
.food-layout { display: grid; grid-template-columns: minmax(0, .85fr) minmax(0, 1.15fr); gap: 30px; align-items: start; }
.draw-column, .menu-settings { min-width: 0; }
.draw-stage { position: relative; isolation: isolate; overflow: hidden; padding: 32px 22px 24px; text-align: center; border: 1px solid #e7e5d0; border-radius: 18px; background: radial-gradient(ellipse at 50% 35%, #fff9df, transparent 70%), #f8f7ee; }
.stage-eyebrow { font-size: 12px; letter-spacing: 2px; color: #8b7650; }
.bowl-art { position: relative; width: 146px; height: 120px; margin: 32px auto 12px; }
.bowl { position: absolute; top: 49px; left: 17px; width: 112px; height: 62px; border-radius: 5px 5px 65px 65px; background: #205c46; box-shadow: inset -10px -5px 0 #194a38, 0 12px 0 -8px #ccb789; }
.bowl-rim { position: absolute; top: 39px; left: 14px; width: 118px; height: 24px; border: 6px solid #90ad9f; border-radius: 50%; background: #e8ce96; z-index: 1; }
.bowl-star { position: absolute; right: -3px; top: 31px; font-size: 27px; color: #bc9350; transform: rotate(12deg); }
.steam { display: flex; gap: 16px; justify-content: center; }
.steam i { width: 9px; height: 27px; border-left: 2px solid #bca881; border-radius: 50%; transform: rotate(12deg); }
.steam i:nth-child(2) { margin-top: -9px; }
.spinning .steam i { animation: steam-rise .7s ease-in-out infinite alternate; }
.spinning .steam i:nth-child(2) { animation-delay: .2s; }
.stage-caption { font-size: 13px; color: #7a7d66; margin: 12px 0; }
.meal-slot { display: grid; place-items: center; min-height: 102px; padding: 8px; overflow: hidden; }
.meal-slot strong { font-size: clamp(26px, 3vw, 38px); line-height: 1.4; overflow-wrap: anywhere; color: #205c46; }
.result-tags { display: flex; justify-content: center; flex-wrap: wrap; gap: 6px; min-height: 48px; align-content: start; }
.result-tags span { color: #66775b; border: 1px solid #dce3ce; border-radius: 20px; padding: 3px 9px; font-size: 11px; background: #ffffff80; }
.draw-button { width: min(100%, 248px); margin-top: 15px; }
.pool-count { margin: 16px 0 0; font-size: 12px; color: #6a7862; }
.pool-count strong { color: #205c46; font-size: 17px; }
.menu-settings h2 { font-size: 18px; margin: 2px 0 14px; }
.mode-buttons { gap: 8px; margin-bottom: 20px; }
.mode-buttons .el-button { flex: 1; padding-left: 8px; padding-right: 8px; }
.filter-fieldset { border: 0; padding: 0; margin: 0; min-width: 0; }
.filter-fieldset legend { padding: 0; font-weight: 600; font-size: 14px; }
.settings-hint { font-size: 12px; color: #71806f; line-height: 1.8; margin: 10px 0 14px; overflow-wrap: anywhere; }
.filter-row { margin: 16px 0; }
.filter-title { font-size: 12px; color: #657361; margin-bottom: 9px; }
.filter-buttons { display: flex; flex-wrap: wrap; gap: 7px; }
.filter-buttons .el-button { margin: 0; border-radius: 16px; padding: 5px 12px; height: 29px; }
.filter-summary { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: #657361; font-size: 12px; }
.filter-summary strong { color: #205c46; font-size: 16px; }
.custom-menu { margin-top: 20px; }
.custom-save { margin-top: 14px; margin-bottom: 0; }
.custom-menu label { display: block; margin-bottom: 10px; font-size: 14px; font-weight: 600; }
.custom-menu label span { font-weight: 400; font-size: 12px; color: #71806f; margin-left: 8px; }
.combined-hint { background: #edf2e9; border-radius: 8px; padding: 10px 12px; }
.empty-hint { font-size: 13px; line-height: 1.8; color: #8b7650; padding: 0 8px; }
.candidate-details { margin-top: 28px; border-top: 1px solid #e6ebdf; padding-top: 18px; }
summary { cursor: pointer; font-size: 13px; color: #536657; }
summary:focus-visible { outline: 3px solid #a0bba6; outline-offset: 4px; }
.candidate-details summary span { background: #edf2e9; padding: 3px 8px; border-radius: 5px; margin-left: 6px; font-size: 11px; }
.candidate-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); list-style: none; gap: 10px; padding: 0; max-height: 320px; overflow-y: auto; }
.candidate-grid li { background: #f7f9f4; border-radius: 8px; padding: 12px; min-width: 0; overflow-wrap: anywhere; }
.candidate-grid strong { display: block; font-size: 13px; margin-bottom: 6px; }
.candidate-grid li span { color: #788575; font-size: 11px; line-height: 1.6; }
.source-details ul { padding-left: 20px; }
.source-details a { text-decoration: underline; text-underline-offset: 3px; }
.screen-reader-status { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.meal-slide-enter-active, .meal-slide-leave-active { transition: transform .06s, opacity .06s; }
.meal-slide-enter-from { transform: translateY(15px); opacity: 0; }
.meal-slide-leave-to { transform: translateY(-15px); opacity: 0; }
.celebrating { animation: stage-glow .7s ease-out; }
.confetti { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.confetti i { position: absolute; width: 7px; height: 12px; top: -20px; left: calc(var(--i) * 7.5%); background: #bda05b; border-radius: 2px; animation: confetti-fall 1.1s ease-out both; animation-delay: calc(var(--i) * .01s); }
.confetti i:nth-child(2n) { background: #628b78; }
.confetti i:nth-child(3n) { background: #dbad97; }
@keyframes steam-rise { to { transform: translateY(-8px) rotate(-12deg); opacity: .4; } }
@keyframes stage-glow { 50% { box-shadow: inset 0 0 0 3px #bda05b70; } }
@keyframes confetti-fall { to { transform: translateY(480px) rotate(280deg); opacity: 0; } }
@media (max-width: 760px) {
  .food-layout { grid-template-columns: 1fr; gap: 24px; }
  .draw-stage { padding: 24px 16px 20px; }
  .bowl-art { margin-top: 22px; }
  .meal-slot { min-height: 78px; }
  .candidate-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 420px) {
  .mode-buttons .el-button { font-size: 12px; }
  .candidate-grid { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) {
  .food-tool *, .food-tool *::before, .food-tool *::after { animation: none !important; transition: none !important; }
}
</style>
