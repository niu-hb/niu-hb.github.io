import { matchRegex } from './logic'

// 单次任务由页面创建独立 Worker，超时和页面离开时直接终止，隔离回溯耗时。
self.onmessage = (event: MessageEvent<{ pattern: string; flags: string; text: string }>) => {
  try {
    const { pattern, flags, text } = event.data
    self.postMessage({ ...matchRegex(pattern, flags, text), error: '' })
  } catch (cause) {
    self.postMessage({ error: cause instanceof Error ? cause.message : '匹配失败', matches: [], truncated: false })
  }
}
