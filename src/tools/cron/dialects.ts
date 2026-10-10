export type CronVersion = 'unix5' | 'node5' | 'node6' | 'spring6' | 'quartz6' | 'quartz7'
export interface CronDialect {
  value: CronVersion
  label: string
  count: number
  quartz: boolean
  tool: string
  language: string
  order: string
  weekdays: string
  dates: string
  syntax: string
  source: string
}

export const cronVersions: CronDialect[] = [
  {
    value: 'unix5', label: '5 段 · Linux crontab', count: 5, quartz: false,
    tool: 'Linux crontab（Vixie / Cronie 语法）', language: '操作系统工具，与编程语言无关',
    order: '分 时 日 月 星期', weekdays: '0–7，0 / 7 为周日',
    dates: '日与星期均受限时取“或”；任一字段以 * 开头时取“且”。',
    syntax: '支持 * , - /、三字母月份/星期及常用时间宏；不支持秒、年、?、L、W、#。步长、名称及时间宏含实现扩展，不是所有 POSIX 实现都支持。',
    source: 'https://man7.org/linux/man-pages/man5/crontab.5.html',
  },
  {
    value: 'node5', label: '5 段 · node-cron 4.2.1', count: 5, quartz: false,
    tool: 'Node.js · node-cron 4.2.1（省略秒）', language: 'JavaScript / TypeScript 库',
    order: '分 时 日 月 星期（秒固定为 0）', weekdays: '0–7，0 / 7 为周日',
    dates: '日与星期取“且”，必须同时满足。',
    syntax: '支持 * , - / 和月份/星期名称；不支持 ?、L、W、#、年或时间宏。步长请使用 */n 或 a-b/n。不要套用其他 Node.js cron 库或更新版本的扩展。',
    source: 'https://github.com/node-cron/node-cron/tree/v4.2.1',
  },
  {
    value: 'node6', label: '6 段 · node-cron 4.2.1', count: 6, quartz: false,
    tool: 'Node.js · node-cron 4.2.1（含秒）', language: 'JavaScript / TypeScript 库',
    order: '秒 分 时 日 月 星期', weekdays: '0–7，0 / 7 为周日',
    dates: '日与星期取“且”，必须同时满足。',
    syntax: '支持 * , - / 和月份/星期名称；不支持 ?、L、W、#、年或时间宏。步长请使用 */n 或 a-b/n。',
    source: 'https://github.com/node-cron/node-cron/tree/v4.2.1',
  },
  {
    value: 'spring6', label: '6 段 · Spring @Scheduled', count: 6, quartz: false,
    tool: 'Spring Framework 5.3+ · @Scheduled / CronExpression', language: 'Java；可由 Kotlin 等 JVM 语言调用',
    order: '秒 分 时 日 月 星期（没有年字段）', weekdays: '0–7，0 / 7 为周日；1 为周一',
    dates: '日与星期取“且”；? 在日或星期字段等价于 *，不要求有且仅有一个 ?。',
    syntax: '支持 * , - /、月份/星期缩写、时间宏，以及 L、L-n、W、LW、dL、d#n。星期字段不能单独写 L，需写 0L / SUNL 等。',
    source: 'https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/scheduling/support/CronExpression.html',
  },
  {
    value: 'quartz6', label: '6 段 · Quartz Java', count: 6, quartz: true,
    tool: 'Quartz Java · CronTrigger（不指定年）', language: 'Java 调度库',
    order: '秒 分 时 日 月 星期', weekdays: '1–7，1 为周日；2 为周一',
    dates: '日和星期有且仅有一个设为 ?；另一字段决定日期。',
    syntax: '支持 * , - /、月份/星期缩写、?、L、L-n、W、LW、dL、d#n；星期单独 L 表示周六。无时间宏。',
    source: 'https://www.quartz-scheduler.org/documentation/quartz-2.2.2/tutorials/crontrigger',
  },
  {
    value: 'quartz7', label: '7 段 · Quartz Java（含年）', count: 7, quartz: true,
    tool: 'Quartz Java · CronTrigger（指定年）', language: 'Java 调度库',
    order: '秒 分 时 日 月 星期 年', weekdays: '1–7，1 为周日；2 为周一',
    dates: '日和星期有且仅有一个设为 ?；另一字段决定日期。',
    syntax: '在 6 段 Quartz 上增加年字段，本工具使用 1970–2099 的文档兼容范围。不是 Java 语言标准，也不代表所有 7 段实现。',
    source: 'https://www.quartz-scheduler.org/documentation/quartz-2.2.2/tutorials/crontrigger',
  },
]

/** 获取方言定义；version 为选择值，返回对应规范，未知值抛错，避免按段数猜测语义。 */
export function cronDialect(version: CronVersion): CronDialect {
  const dialect = cronVersions.find(item => item.value === version)
  if (!dialect) throw new Error('Cron 方言无效')
  return dialect
}
