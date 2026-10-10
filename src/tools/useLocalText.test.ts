// @vitest-environment jsdom
import { createApp, defineComponent, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLocalText } from './useLocalText'
import { parseCustomMenu } from './what-to-eat/logic'

const cleanups: (() => void)[] = []

/** 挂载本地保存逻辑；key 为存储键、limit 为长度限制、validate 为额外校验，返回可操作的保存状态。 */
function mountDraft(key: string, limit = 100000, validate?: (text: string) => unknown) {
  let draft!: ReturnType<typeof useLocalText>
  const host = document.createElement('div')
  document.body.append(host)
  const app = createApp(defineComponent({
    setup() {
      draft = useLocalText(key, limit, validate)
      return () => null
    },
  }))
  app.mount(host)
  cleanups.push(() => { app.unmount(); host.remove() })
  return draft
}

beforeEach(() => window.localStorage.clear())
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
  vi.restoreAllMocks()
})

describe('浏览器本地手动保存', () => {
  it('保留 Unicode 与源码原文，仅点击保存才持久化，并在重新挂载时恢复', async () => {
    const draft = mountDraft('markdown')
    draft.text.value = '# 标题😀\n\n<script>文本</script>\n'
    await nextTick()
    expect(window.localStorage.getItem('markdown')).toBeNull()
    draft.saveText()
    expect(draft.storageFeedback.value).toContain('已保存')
    expect(mountDraft('markdown').text.value).toBe(draft.text.value)
    draft.text.value = '尚未保存'
    await nextTick()
    expect(draft.storageFeedback.value).toBe('')
    expect(mountDraft('markdown').text.value).toContain('# 标题😀')
  })

  it('不同工具存档隔离，保存空内容清除之前保存的文本', () => {
    const menu = mountDraft('menu', 10000, parseCustomMenu)
    const markdown = mountDraft('markdown')
    menu.text.value = '饺子\n牛肉面'
    markdown.text.value = '# 文档'
    menu.saveText()
    markdown.saveText()
    menu.text.value = ''
    menu.saveText()
    expect(mountDraft('menu').text.value).toBe('')
    expect(mountDraft('markdown').text.value).toBe('# 文档')
    expect(menu.storageFeedback.value).toContain('已清除')
  })

  it('拒绝超长或非法菜单，不覆盖已有存档', () => {
    window.localStorage.setItem('menu', '饺子')
    const draft = mountDraft('menu', 10000, parseCustomMenu)
    draft.text.value = '中'.repeat(51)
    draft.saveText()
    expect(draft.storageError.value).toContain('50')
    expect(window.localStorage.getItem('menu')).toBe('饺子')
    const markdown = mountDraft('markdown', 3)
    markdown.text.value = 'abcd'
    markdown.saveText()
    expect(markdown.storageError.value).toContain('3')
    expect(window.localStorage.getItem('markdown')).toBeNull()
  })

  it('不恢复非法或超长的存档，并显示读取失败原因', () => {
    window.localStorage.setItem('menu', '中'.repeat(51))
    const menu = mountDraft('menu', 10000, parseCustomMenu)
    expect(menu.text.value).toBe('')
    expect(menu.storageError.value).toContain('读取本地保存失败')
    window.localStorage.setItem('markdown', 'abcd')
    expect(mountDraft('markdown', 3).text.value).toBe('')
  })

  it('浏览器禁止访问存储时仍允许编辑并显示错误', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('存储权限被禁止') })
    const draft = mountDraft('menu')
    expect(draft.storageError.value).toContain('存储权限被禁止')
    draft.text.value = '饺子'
    draft.saveText()
    expect(draft.text.value).toBe('饺子')
    expect(draft.storageError.value).toContain('保存失败')
  })

  it('配额写入失败保留原存档，恢复存储后可再次保存', () => {
    window.localStorage.setItem('menu', '旧菜单')
    const draft = mountDraft('menu')
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('存储空间不足') })
    draft.text.value = '新菜单'
    draft.saveText()
    expect(draft.storageError.value).toContain('存储空间不足')
    expect(window.localStorage.getItem('menu')).toBe('旧菜单')
    write.mockRestore()
    draft.saveText()
    expect(draft.storageError.value).toBe('')
    expect(window.localStorage.getItem('menu')).toBe('新菜单')
  })
})
