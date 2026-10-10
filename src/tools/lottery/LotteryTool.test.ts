// @vitest-environment jsdom
import { createApp, nextTick } from 'vue'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import LotteryTool from './LotteryTool.vue'
import { lotteryStorageKey } from './logic'

const cleanups: (() => void)[] = []

/** 挂载真实抽签页面；无参数，返回页面 DOM，等待本地分组恢复。 */
async function mountTool() {
  const host = document.createElement('div')
  document.body.append(host)
  const app = createApp(LotteryTool)
  app.mount(host)
  cleanups.push(() => { app.unmount(); host.remove() })
  await nextTick()
  await nextTick()
  return host
}

/** 点击指定文本按钮；host 为作用域、text 为按钮文字，无返回值，等待响应式更新。 */
async function clickButton(host: Element, text: string): Promise<void> {
  const button = Array.from(host.querySelectorAll('button')).find(item => item.textContent?.trim().endsWith(text))
  if (!button) throw new Error(`未找到按钮：${text}`)
  button.click()
  await nextTick()
}

/** 获取重置确认弹窗；无参数，返回传送到页面根节点的弹窗，缺失时立即报告交互回归。 */
function restartConfirmation(): Element {
  const dialog = document.body.querySelector('.lottery-restart-dialog')
  if (!dialog) throw new Error('未显示重新开始确认弹窗')
  return dialog
}

/** 通过用户输入事件修改表单；host 为页面、selector 为已知控件、value 为输入文本，无返回值。 */
async function fill(host: Element, selector: string, value: string): Promise<void> {
  const input = host.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)
  if (!input) throw new Error(`未找到输入：${selector}`)
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
  await nextTick()
}

beforeEach(() => {
  window.localStorage.clear()
  window.localStorage.setItem(lotteryStorageKey, JSON.stringify({ version: 1, groups: [{ id: 'g', name: '测试分组', items: ['甲', '乙', '丙'], records: [] }] }))
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
})
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('分组草稿保存后才生效，空池与无效候选显示反馈', async () => {
  const host = await mountTool()
  await fill(host, '#lottery-items', '中'.repeat(51))
  expect(host.textContent).toContain('有未保存修改')
  expect(Array.from(host.querySelectorAll('button')).find(button => button.textContent?.trim() === '开始抽签')?.disabled).toBe(true)
  await clickButton(host, '保存分组')
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('50')
  await fill(host, '#lottery-items', '  ')
  await clickButton(host, '保存分组')
  expect(host.textContent).toContain('请先在分组中填写项目并保存')
})

it('添加周末示例可直接抽签，再次查看不重复创建或覆盖编辑后的项目', async () => {
  const host = await mountTool()
  await clickButton(host, '添加周末示例')
  expect(host.querySelector<HTMLInputElement>('#lottery-group-name')?.value).toBe('周末去干嘛')
  expect(host.textContent).toContain('可抽 8 / 8 项')
  await clickButton(host, '开始抽签')
  expect(host.querySelectorAll('.history-list > li')).toHaveLength(1)
  await fill(host, '#lottery-items', '自己的周末安排')
  await clickButton(host, '保存分组')
  await clickButton(host, '查看周末示例')
  const groups = JSON.parse(window.localStorage.getItem(lotteryStorageKey)!).groups
  expect(groups).toHaveLength(2)
  expect(groups[0].items).toEqual(['甲', '乙', '丙'])
  expect(groups[1].items).toEqual(['自己的周末安排'])
  expect(groups[1].records).toHaveLength(1)
})

it('多项抽签顺序记录，转盘始终显示并抽取一项，所有模式可用', async () => {
  const host = await mountTool()
  const repeat = host.querySelector<HTMLInputElement>('input[type="checkbox"]')!
  repeat.checked = true
  repeat.dispatchEvent(new Event('change', { bubbles: true }))
  await nextTick()
  await clickButton(host, '翻牌揭晓')
  expect(host.querySelector('#lottery-count')?.getAttribute('aria-disabled')).toBe('false')
  await fill(host, '#lottery-count', '3')
  await clickButton(host, '开始抽签')
  expect(host.querySelectorAll('.latest-results li')).toHaveLength(3)
  expect(host.querySelectorAll('.history-list > li')).toHaveLength(3)
  for (const label of ['滚动抽选', '签筒摇签']) {
    await clickButton(host, label)
    expect(host.querySelector<HTMLInputElement>('#lottery-count')?.value).toBe('1')
    await fill(host, '#lottery-count', '3')
    await clickButton(host, '开始抽签')
    expect(host.querySelectorAll('.latest-results li')).toHaveLength(3)
  }
  await clickButton(host, '幸运转盘')
  expect(host.querySelector<HTMLInputElement>('#lottery-count')?.value).toBe('1')
  await clickButton(host, '开始抽签')
  expect(host.querySelectorAll('.latest-results li')).toHaveLength(1)
  expect(host.querySelectorAll('.history-list > li')).toHaveLength(1)
  const records = JSON.parse(window.localStorage.getItem(lotteryStorageKey)!).groups[0].records
  const names = Array.from(host.querySelectorAll('.history-result-name')).map(row => row.textContent)
  expect(names).toEqual(records.filter((record: { mode: string }) => record.mode === 'wheel').flatMap((record: { results: string[] }) => record.results))
  expect(records).toHaveLength(4)
})

it('数量和重复设置随模式独立保留，切换模式取消待确认重置', async () => {
  const host = await mountTool()
  await clickButton(host, '翻牌揭晓')
  await fill(host, '#lottery-count', '2')
  const repeat = host.querySelector<HTMLInputElement>('input[type="checkbox"]')!
  repeat.checked = true
  repeat.dispatchEvent(new Event('change', { bubbles: true }))
  await nextTick()
  await clickButton(host, '开始抽签')
  await clickButton(host, '重新开始')
  await clickButton(host, '滚动抽选')
  expect(Array.from(host.querySelectorAll('button')).find(button => button.textContent?.trim() === '开始抽签')?.disabled).toBe(false)
  expect(host.querySelector<HTMLInputElement>('#lottery-count')?.value).toBe('1')
  expect(host.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(false)
  expect(host.textContent).toContain('可抽 3 / 3 项')
  await clickButton(host, '翻牌揭晓')
  expect(host.querySelector<HTMLInputElement>('#lottery-count')?.value).toBe('2')
  expect(host.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(true)
  expect(host.querySelectorAll('.history-list > li')).toHaveLength(2)
})

it('清空记录需要确认且只清空当前组，旧结果不会因切换模式而消失', async () => {
  const host = await mountTool()
  await clickButton(host, '开始抽签')
  await clickButton(host, '翻牌揭晓')
  expect(host.querySelectorAll('.history-list > li')).toHaveLength(0)
  await clickButton(host, '幸运转盘')
  expect(host.querySelectorAll('.history-list > li')).toHaveLength(1)
  await clickButton(host, '清空当前记录')
  expect(restartConfirmation().textContent).toContain('重新开始抽签？')
  expect(restartConfirmation().textContent).toContain('幸运转盘')
  expect(host.querySelectorAll('.history-list > li')).toHaveLength(1)
  await clickButton(restartConfirmation(), '取消')
  expect(host.querySelectorAll('.history-list > li')).toHaveLength(1)
  await clickButton(host, '清空当前记录')
  await clickButton(restartConfirmation(), '确认清空记录')
  expect(host.querySelectorAll('.history-list > li')).toHaveLength(0)
  expect(host.textContent).toContain('可抽 3 / 3 项')
})

it('重新开始只清空当前模式，保留其他模式、候选与其他分组', async () => {
  const host = await mountTool()
  await clickButton(host, '添加周末示例')
  await clickButton(host, '开始抽签')
  await clickButton(host, '测试分组3 项')
  await clickButton(host, '开始抽签')
  await clickButton(host, '翻牌揭晓')
  await clickButton(host, '开始抽签')
  await clickButton(host, '重新开始')
  expect(restartConfirmation().textContent).toContain('其他模式和分组不受影响')
  await clickButton(restartConfirmation(), '确认清空记录')
  expect(host.querySelector('.latest-results')).toBeNull()
  expect(host.querySelectorAll('.history-list > li')).toHaveLength(0)
  const groups = JSON.parse(window.localStorage.getItem(lotteryStorageKey)!).groups
  expect(groups[0].records).toHaveLength(1)
  expect(groups[0].records[0].mode).toBe('wheel')
  expect(groups[0].items).toEqual(['甲', '乙', '丙'])
  expect(groups[1].records).toHaveLength(1)
  await clickButton(host, '幸运转盘')
  expect(host.querySelectorAll('.history-list > li')).toHaveLength(1)
  expect(host.textContent).toContain('可抽 2 / 3 项')
})

it('重置保存失败时弹窗展示错误，保留记录并允许取消', async () => {
  const host = await mountTool()
  await clickButton(host, '开始抽签')
  const saved = window.localStorage.getItem(lotteryStorageKey)
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('空间不足') })
  await clickButton(host, '重新开始')
  await clickButton(restartConfirmation(), '确认清空记录')
  expect(restartConfirmation().querySelector('[role="alert"]')?.textContent).toContain('空间不足')
  expect(window.localStorage.getItem(lotteryStorageKey)).toBe(saved)
  expect(host.querySelectorAll('.history-list > li')).toHaveLength(1)
  await clickButton(restartConfirmation(), '取消')
  expect(Array.from(host.querySelectorAll('button')).find(button => button.textContent?.trim() === '再抽一次')?.disabled).toBe(false)
  write.mockRestore()
})

it('拉杆滚轮从负位移向下落到已保存结果，并保持轮内顺序', async () => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))
  vi.useFakeTimers()
  const host = await mountTool()
  await clickButton(host, '滚动抽选')
  await fill(host, '#lottery-count', '2')
  const lever = host.querySelector<HTMLButtonElement>('.slot-lever')!
  lever.click()
  await nextTick()
  expect(lever.classList.contains('pulled')).toBe(true)
  expect(host.querySelector('.reel-strip')?.getAttribute('style')).toContain('translateY(-')
  await vi.advanceTimersByTimeAsync(50)
  expect(host.querySelector('.reel-strip')?.getAttribute('style')).toContain('translateY(0px)')
  await vi.advanceTimersByTimeAsync(4000)
  expect(host.querySelector('[aria-busy="true"]')).toBeNull()
  expect(lever.classList.contains('pulled')).toBe(false)
  const results = JSON.parse(window.localStorage.getItem(lotteryStorageKey)!).groups[0].records[0].results
  expect(Array.from(host.querySelectorAll('.history-result-name')).map(item => item.textContent)).toEqual(results)
  expect(host.querySelector('.reel-item')?.textContent?.trim()).toBe(results[1])
})

it('卡牌逐张翻转，最后一张完成后再展示本轮结果与记录', async () => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))
  vi.useFakeTimers()
  const host = await mountTool()
  await clickButton(host, '翻牌揭晓')
  await fill(host, '#lottery-count', '2')
  await clickButton(host, '开始抽签')
  expect(host.querySelectorAll('.draw-card.revealed')).toHaveLength(0)
  expect(host.querySelectorAll('.draw-card:not(.revealed) .card-front strong')[0]?.textContent).toBe('等待揭晓')
  await vi.advanceTimersByTimeAsync(1600)
  expect(host.querySelectorAll('.draw-card.revealed')).toHaveLength(1)
  expect(host.querySelector('[aria-busy="true"]')).not.toBeNull()
  expect(host.querySelectorAll('.history-list > li')).toHaveLength(0)
  await vi.advanceTimersByTimeAsync(1400)
  expect(host.querySelectorAll('.draw-card.revealed')).toHaveLength(2)
  expect(host.querySelector('[aria-busy="true"]')).toBeNull()
  expect(host.querySelectorAll('.history-list > li')).toHaveLength(2)
})

it('摇签揭晓后弹窗按顺序显示结果，关闭不会丢失记录', async () => {
  const host = await mountTool()
  await clickButton(host, '签筒摇签')
  await fill(host, '#lottery-count', '2')
  await clickButton(host, '开始抽签')
  await nextTick()
  const dialog = document.body.querySelector('.lottery-result-dialog')!
  expect(dialog).not.toBeNull()
  const results = JSON.parse(window.localStorage.getItem(lotteryStorageKey)!).groups[0].records[0].results
  expect(Array.from(dialog.querySelectorAll('.fortune-results li strong')).map(item => item.textContent)).toEqual(results)
  await clickButton(dialog, '收下幸运签')
  expect(host.querySelectorAll('.history-list > li')).toHaveLength(2)
})

it('动画进行时禁止再次抽取，卸载中断动画仍保留已保存的完整结果', async () => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))
  vi.useFakeTimers()
  const host = await mountTool()
  await clickButton(host, '开始抽签')
  expect(host.querySelector('[aria-busy="true"]')).not.toBeNull()
  expect(host.querySelectorAll('.history-list > li')).toHaveLength(0)
  expect(JSON.parse(window.localStorage.getItem(lotteryStorageKey)!).groups[0].records).toHaveLength(1)
  await vi.advanceTimersByTimeAsync(2600)
  expect(host.querySelector('[aria-busy="true"]')).toBeNull()
  expect(host.querySelectorAll('.latest-results li')).toHaveLength(1)
  await clickButton(host, '翻牌揭晓')
  await clickButton(host, '开始抽签')
  const saved = window.localStorage.getItem(lotteryStorageKey)
  for (const cleanup of cleanups.splice(0)) cleanup()
  await vi.advanceTimersByTimeAsync(5000)
  expect(host.isConnected).toBe(false)
  expect(window.localStorage.getItem(lotteryStorageKey)).toBe(saved)
  expect(JSON.parse(window.localStorage.getItem(lotteryStorageKey)!).groups[0].records).toHaveLength(2)
})
