import { onMounted, ref, watch } from 'vue'

/** 管理手动保存的本地文本；key 为独立存储键，maxLength 为字符上限，validate 为额外校验，返回文本、反馈与保存方法。 */
export function useLocalText(key: string, maxLength: number, validate?: (text: string) => unknown) {
  const text = ref('')
  const storageFeedback = ref('')
  const storageError = ref('')

  /** 校验保存或恢复的内容；value 为文本，无返回值，非法内容抛错以保留现有草稿。 */
  function check(value: string): void {
    if (value.length > maxLength) throw new Error(`内容不能超过 ${maxLength.toLocaleString('en-US')} 个字符`)
    validate?.(value)
  }

  // 延后到挂载后访问浏览器 API，同时捕获访问 localStorage 本身被浏览器禁止的情况。
  onMounted(() => {
    try {
      const saved = window.localStorage.getItem(key)
      if (saved !== null) {
        check(saved)
        text.value = saved
      }
    } catch (cause) {
      storageError.value = `读取本地保存失败：${cause instanceof Error ? cause.message : '浏览器存储不可用'}`
    }
  })

  watch(text, () => {
    storageFeedback.value = ''
  })

  /** 保存当前文本；无参数、无返回值，仅覆盖此工具的保存内容，写入失败时保留旧存档。 */
  function saveText(): void {
    storageFeedback.value = ''
    storageError.value = ''
    try {
      check(text.value)
      window.localStorage.setItem(key, text.value)
      storageFeedback.value = text.value ? '已保存到当前浏览器' : '已保存空内容，之前的保存内容已清除'
    } catch (cause) {
      storageError.value = `保存失败：${cause instanceof Error ? cause.message : '浏览器存储不可用'}`
    }
  }

  return { text, storageFeedback, storageError, saveText }
}
