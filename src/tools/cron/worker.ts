import { testCron, type CronTestInput } from './logic'

// 每次独立计算，复杂或无法匹配的日历表达式由页面超时终止，避免阻塞交互。
self.onmessage = (event: MessageEvent<CronTestInput>) => {
  try { self.postMessage({ ...testCron(event.data), error: '' }) }
  catch (cause) { self.postMessage({ times: [], warning: '', error: cause instanceof Error ? cause.message : 'Cron 测试失败' }) }
}
