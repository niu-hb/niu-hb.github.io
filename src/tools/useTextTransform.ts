import { ref, watch, type Ref, type WatchSource } from 'vue'

/** 管理文本处理状态；input 为输入，options 为模式，返回结果、错误和执行函数；输入变化时清除旧结果。 */
export function useTextTransform(input: Ref<string>, options: WatchSource[] = []) {
  const output = ref('')
  const error = ref('')
  watch([input, ...options], () => {
    output.value = ''
    error.value = ''
  }, { flush: 'sync' })

  /** 执行转换；transform 接收输入并返回结果；失败时清除结果并显示错误，无返回值。 */
  function run(transform: (text: string) => string): void {
    try {
      output.value = transform(input.value)
      error.value = ''
    } catch (cause) {
      output.value = ''
      error.value = cause instanceof Error ? cause.message : '处理失败，请检查输入'
    }
  }
  return { output, error, run }
}
