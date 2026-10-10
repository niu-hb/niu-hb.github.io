import { calculateDigests, type DigestInput, type DigestMessage } from './logic'

/** 接收一次摘要任务；event 包含文本或文件及算法，通过消息返回进度、结果或错误。 */
self.onmessage = async (event: MessageEvent<DigestInput>) => {
  const post = (message: DigestMessage): void => self.postMessage(message)
  try {
    const output = await calculateDigests(event.data, (processed, total) => post({ type: 'progress', processed, total }))
    post({ type: 'done', output })
  } catch (cause) {
    post({ type: 'error', error: cause instanceof Error ? cause.message : '摘要计算失败，请重试' })
  }
}
