// @vitest-environment jsdom
import { createApp, nextTick } from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import CronTool from './CronTool.vue'

const workers = vi.hoisted(() => [] as { onmessage?: (event: { data: unknown }) => void; terminate: ReturnType<typeof vi.fn>; postMessage: ReturnType<typeof vi.fn> }[])
vi.mock('./worker?worker', () => ({ default: class {
  onmessage?: (event: { data: unknown }) => void
  terminate = vi.fn()
  postMessage = vi.fn()
  constructor() { workers.push(this) }
} }))
const cleanups: (() => void)[] = []

/** 挂载真实 Cron 页面；无参数，返回已更新的容器，测试后释放组件和 Worker。 */
async function mountTool() {
  const host = document.createElement('div')
  document.body.append(host)
  const app = createApp(CronTool)
  app.mount(host)
  cleanups.push(() => { app.unmount(); host.remove() })
  await nextTick()
  return host
}

/** 点击指定按钮；host 为容器、text 为完整按钮文字，无返回值，等待 Vue 更新。 */
async function click(host: Element, text: string) {
  const button = Array.from(host.querySelectorAll('button')).find(item => item.textContent?.trim() === text)
  if (!button) throw new Error(`未找到按钮：${text}`)
  button.click()
  await nextTick()
}

/** 输入指定字段；host 为容器、label 为无障碍名称、value 为新值，无返回值。 */
async function fill(host: Element, label: string, value: string) {
  const input = host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)
  if (!input) throw new Error(`未找到字段：${label}`)
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
}

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
  workers.splice(0)
  vi.useRealTimers()
})

it('展示 Worker 结果，修改输入清空旧结果，旧 Worker 回调不能覆盖新输入', async () => {
  const host = await mountTool()
  await click(host, '校验与测试')
  const first = workers[0]!
  expect(first.postMessage.mock.calls[0]![0]).toMatchObject({ version: 'unix5', expression: '*/5 * * * *', count: 5 })
  first.onmessage?.({ data: { times: ['2026-10-10T09:00:00+08:00'], warning: '', error: '' } })
  await nextTick()
  expect(host.querySelector('.cron-result')?.textContent).toContain('09:00:00+08:00')
  await fill(host, 'Cron 表达式', '0 9 * * *')
  expect(host.querySelector('.cron-result')).toBeNull()
  first.onmessage?.({ data: { times: ['旧结果'], warning: '', error: '' } })
  await nextTick()
  expect(host.textContent).not.toContain('旧结果')
  expect(first.terminate).toHaveBeenCalled()
})

it('非法输入不启动 Worker，计算超时终止并反馈，常用表达式与生成器同步', async () => {
  const host = await mountTool()
  await fill(host, 'Cron 表达式', '中文')
  await click(host, '校验与测试')
  expect(workers).toHaveLength(0)
  expect(host.querySelector('[role="alert"]')).not.toBeNull()
  await click(host, '工作日 09:00')
  expect(host.querySelector<HTMLInputElement>('input[aria-label="Cron 表达式"]')?.value).toBe('0 9 * * MON-FRI')
  expect(host.querySelector<HTMLInputElement>('input[aria-label="日字段"]')?.value).toBe('*')
  vi.useFakeTimers()
  await click(host, '校验与测试')
  await vi.advanceTimersByTimeAsync(2000)
  expect(workers[0]!.terminate).toHaveBeenCalled()
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('超过两秒')
})

/** 选择真实下拉框选项；host 为容器、name 为选项文字，无返回值，等待弹层与页面更新。 */
async function selectDialect(host: Element, name: string) {
  const input = host.querySelector<HTMLInputElement>('input[aria-label="Cron 版本"]')
  if (!input) throw new Error('未找到方言选择框')
  input.click()
  await nextTick()
  const option = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find(item => item.textContent?.trim() === name)
  if (!option) throw new Error(`未找到方言：${name}`)
  option.click()
  await nextTick()
}

it('切换方言同步规则、示例和字段，生成与测试都遵守当前工具规则', async () => {
  const host = await mountTool()
  await selectDialect(host, '6 段 · Spring @Scheduled')
  expect(host.querySelector('[aria-label="当前方言规则"]')?.textContent).toContain('不要求有且仅有一个 ?')
  expect(host.querySelectorAll('.cron-fields input')).toHaveLength(6)
  await fill(host, '日字段', '?')
  await fill(host, '星期字段', '?')
  await click(host, '生成表达式')
  expect(host.querySelector<HTMLInputElement>('input[aria-label="Cron 表达式"]')?.value).toBe('0 */5 * ? * ?')
  await click(host, '校验与测试')
  expect(workers.at(-1)!.postMessage.mock.calls[0]![0]).toMatchObject({ version: 'spring6' })
  await selectDialect(host, '7 段 · Quartz Java（含年）')
  expect(host.querySelectorAll('.cron-fields input')).toHaveLength(7)
  expect(host.querySelector('[aria-label="当前方言规则"]')?.textContent).toContain('1 为周日')
  await fill(host, '星期字段', '*')
  await click(host, '生成表达式')
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('有且仅有一个')
  await selectDialect(host, '5 段 · node-cron 4.2.1')
  expect(host.querySelectorAll('.cron-fields input')).toHaveLength(5)
  await fill(host, '日字段', '?')
  await click(host, '生成表达式')
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('不支持 ?')
})
