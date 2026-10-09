export type TimeUnit = 'seconds' | 'milliseconds'
export type TimeZone = 'local' | 'utc'

/** 解析整数时间戳；text 为输入，unit 为秒或毫秒；返回 Date，超范围或无效值时抛错。 */
export function parseTimestamp(text: string, unit: TimeUnit): Date {
  if (!/^[+-]?\d+$/.test(text.trim())) throw new Error('请输入整数时间戳，支持负数')
  const value = Number(text.trim())
  const milliseconds = unit === 'seconds' ? value * 1000 : value
  if (!Number.isSafeInteger(milliseconds)) throw new Error('时间戳超出安全整数范围')
  const date = new Date(milliseconds)
  if (Number.isNaN(date.getTime())) throw new Error('时间戳超出可转换日期范围')
  return date
}

/** 格式化日期；date 为有效日期，zone 为时区；返回含毫秒的年月日时分秒。 */
export function formatDate(date: Date, zone: TimeZone): string {
  if (Number.isNaN(date.getTime())) throw new Error('日期无效')
  const values = zone === 'utc'
    ? [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds()]
    : [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds()]
  const parts = values.map((value, index) => String(value).padStart(index === 0 ? 4 : index === 6 ? 3 : 2, '0'))
  return `${parts[0]}-${parts[1]}-${parts[2]} ${parts[3]}:${parts[4]}:${parts[5]}.${parts[6]}`
}

/** 解析明确格式的日期；text 为 YYYY-MM-DD HH:mm:ss[.SSS]，zone 为时区；返回 Date，拒绝日期自动进位。 */
export function parseDate(text: string, zone: TimeZone): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/.exec(text.trim())
  if (!match) throw new Error('请使用 YYYY-MM-DD HH:mm:ss 或 YYYY-MM-DD HH:mm:ss.SSS 格式')
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3])
  const hour = Number(match[4]), minute = Number(match[5]), second = Number(match[6])
  const milliseconds = Number((match[7] ?? '').padEnd(3, '0'))
  const date = new Date(0)
  // 使用 setFullYear 避免 0000–0099 年被构造函数解释为 1900–1999 年。
  if (zone === 'utc') { date.setUTCFullYear(year, month - 1, day); date.setUTCHours(hour, minute, second, milliseconds) }
  else { date.setFullYear(year, month - 1, day); date.setHours(hour, minute, second, milliseconds) }
  const expected = `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}:${match[6]}.${String(milliseconds).padStart(3, '0')}`
  if (formatDate(date, zone) !== expected) throw new Error('日期或时间无效，请检查月份、天数及夏令时跳跃')
  return date
}

/** 返回本地时区标签；date 为偏移对应日期，返回浏览器时区名称和 UTC 偏移。 */
export function localZoneLabel(date: Date): string {
  const offset = -date.getTimezoneOffset()
  return `${Intl.DateTimeFormat().resolvedOptions().timeZone} (UTC${offset >= 0 ? '+' : '-'}${String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0')}:${String(Math.abs(offset) % 60).padStart(2, '0')})`
}
