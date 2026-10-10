import { parse } from '@datasert/cronjs-parser'
import { getFutureMatches, isTimeMatches } from '@datasert/cronjs-matcher'
import { cronDialect, type CronVersion } from './dialects'
export { cronVersions, type CronVersion } from './dialects'

export const cronFieldNames = ['秒', '分', '时', '日', '月', '星期', '年']
export const cronFieldRanges = ['0–59', '0–59', '0–23', '1–31', '1–12 / JAN–DEC', 'SUN–SAT', '1970–2099']
export const cronExamples = [
  { name: '每分钟', fields: ['0', '*', '*', '*', '*', '?', '*'] },
  { name: '每 5 分钟', fields: ['0', '*/5', '*', '*', '*', '?', '*'] },
  { name: '每小时整点', fields: ['0', '0', '*', '*', '*', '?', '*'] },
  { name: '每天 09:00', fields: ['0', '0', '9', '*', '*', '?', '*'] },
  { name: '工作日 09:00', fields: ['0', '0', '9', '?', '*', 'MON-FRI', '*'] },
  { name: '每周一 09:00', fields: ['0', '0', '9', '?', '*', 'MON', '*'] },
  { name: '每月 1 日 00:00', fields: ['0', '0', '0', '1', '*', '?', '*'] },
  { name: '每年 1 月 1 日', fields: ['0', '0', '0', '1', '1', '?', '*'] },
  { name: '月末 18:00', fields: ['0', '0', '18', 'L', '*', '?', '*'], specialOnly: true },
  { name: '每月最后工作日', fields: ['0', '0', '9', 'LW', '*', '?', '*'], specialOnly: true },
]

const monthNames = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER']
const weekNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
const macroFields: Record<string, string[]> = {
  '@YEARLY': ['0', '0', '1', '1', '*'], '@ANNUALLY': ['0', '0', '1', '1', '*'],
  '@MONTHLY': ['0', '0', '1', '*', '*'], '@WEEKLY': ['0', '0', '*', '*', '0'],
  '@DAILY': ['0', '0', '*', '*', '*'], '@MIDNIGHT': ['0', '0', '*', '*', '*'], '@HOURLY': ['0', '*', '*', '*', '*'],
}

/** 获取字段顺序；version 为方言，返回秒至年的字段索引，未知方言抛错。 */
export function fieldIndexes(version: CronVersion): number[] {
  const { count } = cronDialect(version)
  return count === 5 ? [1, 2, 3, 4, 5] : count === 7 ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 2, 3, 4, 5]
}

/** 适配内置示例；example 为模板、version 为方言，返回可直接使用的七字段，用户输入不自动改写。 */
export function exampleFields(example: { fields: string[] }, version: CronVersion): string[] {
  return example.fields.map(value => !cronDialect(version).quartz && value === '?' ? '*' : value)
}

/** 分段生成表达式；fields 为七字段、version 为方言，返回经过同一校验器验证的原始表达式。 */
export function generateCron(fields: readonly string[], version: CronVersion): string {
  if (fields.length !== 7) throw new Error('生成器字段数量无效')
  const expression = fieldIndexes(version).map(index => fields[index]!.trim()).join(' ')
  validateCron(expression, version)
  return expression
}

/** 转换合法月份/星期名称；field 为字段、index 为位置、version 为方言，返回数字或保留特殊后缀。 */
function replaceNames(field: string, index: number, version: CronVersion): string {
  if (index !== 4 && index !== 5) return field
  const names = index === 4 ? monthNames : weekNames
  const node = version.startsWith('node')
  const alternatives = names.flatMap(name => node ? [name, name.slice(0, 3)] : [name.slice(0, 3)])
  return field.replace(new RegExp(alternatives.join('|'), 'g'), value => {
    const position = names.findIndex(name => name === value || name.slice(0, 3) === value)
    return String(position + (index === 4 || cronDialect(version).quartz ? 1 : 0))
  })
}

/** 展开普通字段；part 为一项、index 为位置、version 为方言，返回匹配器数字列表或通配符。 */
function numericPart(part: string, index: number, version: CronVersion): string {
  const dialect = cronDialect(version)
  const limits = [[0, 59], [0, 59], [0, 23], [1, 31], [1, 12], [dialect.quartz ? 1 : 0, 7], [1970, 2099]]
  const [min, max] = limits[index] as [number, number]
  const match = /^(\*|\d+)(?:-(\d+))?(?:\/(\d+))?$/.exec(part)
  if (!match || (match[1] === '*' && match[2])) throw new Error(`${cronFieldNames[index]}字段语法无效：${part}`)
  if (part === '*') return '*'
  let from = match[1] === '*' ? min : Number(match[1])
  let to = match[2] ? Number(match[2]) : match[1] === '*' || match[3] ? max : from
  const step = match[3] ? Number(match[3]) : 1
  if (from < min || from > max || to < min || to > max || !Number.isSafeInteger(step) || step < 1) throw new Error(`${cronFieldNames[index]}字段范围或步长无效：${part}`)
  if (version.startsWith('node')) {
    // 4.2.1 的步长转换仅针对通配符或范围，拒绝会被宽松整数解析误读的 n/k。
    if (match[3] && match[1] !== '*' && !match[2]) throw new Error('node-cron 步长需使用 */n 或 a-b/n 范围')
    if (index === 5) {
      from = from === 7 ? 0 : from
      to = to === 7 ? 0 : to
      if (match[1] === '*') to = 6
    }
    if (from > to) [from, to] = [to, from]
  } else if (version === 'spring6' && index === 5 && from === 7 && match[2]) {
    from = 0
  }
  if (from > to && !dialect.quartz) throw new Error(`${cronFieldNames[index]}字段范围起点不能大于终点`)
  // Quartz 允许跨上界的范围（如 22-2 或 SAT-SUN）；展开后不把这种语义交给通用解析器猜测。
  const length = from <= to ? to - from + 1 : max - from + 1 + to - min + 1
  const values: number[] = []
  for (let offset = 0; offset < length; offset += step) {
    let value = from + offset
    if (value > max) value = min + value - max - 1
    if (index === 5) value = dialect.quartz ? value - 1 : value === 7 ? 0 : value
    values.push(value)
  }
  return [...new Set(values)].join(',')
}

interface ValidatedCron {
  fields: string[]
  normalized: string
  dayOfMonth: string
  dayOfWeek: string
  offsets: number[]
}

/** 校验并适配指定工具；expression 为输入、version 为方言，返回字段、匹配器表达式及月末偏移。 */
export function validateCron(expression: string, version: CronVersion): ValidatedCron {
  const dialect = cronDialect(version)
  if (!expression.trim() || expression.length > 200) throw new Error('请输入 Cron 表达式，最多 200 个字符')
  let text = expression.trim().toUpperCase()
  if (text.startsWith('@')) {
    const macro = macroFields[text]
    if (!macro || (version !== 'unix5' && version !== 'spring6')) throw new Error('当前方言不支持此时间宏；@reboot 不属于可计算的日历表达式')
    text = (version === 'spring6' ? ['0', ...macro] : macro).join(' ')
  }
  const fields = text.split(/\s+/)
  if (fields.length !== dialect.count) throw new Error(`${dialect.label} 需要 ${dialect.count} 段，实际输入 ${fields.length} 段`)
  const normalized: string[] = []
  const offsets: number[] = []
  let dayOfMonth = '*'
  let dayOfWeek = '*'
  for (const [position, index] of fieldIndexes(version).entries()) {
    const field = fields[position]!
    const value = replaceNames(field, index, version)
    const specialAllowed = dialect.quartz || version === 'spring6'
    if (value === '?') {
      if (!specialAllowed || (index !== 3 && index !== 5)) throw new Error(`${cronFieldNames[index]}字段不支持 ?`)
      normalized.push(dialect.quartz ? '?' : '*')
    } else {
      const parts = value.split(',')
      if (dialect.quartz && parts.length > 1 && /[LW#]/.test(value)) throw new Error('Quartz 特殊日期请单独使用，不与列表混合')
      const normalizedParts = parts.map(part => {
        if (specialAllowed && index === 3) {
          if (part === 'L' || part === 'LW') return part
          const offset = /^L-(\d+)$/.exec(part)
          if (offset) {
            const number = Number(offset[1])
            if (number < (dialect.quartz ? 0 : 1) || number > 30) throw new Error('月末偏移需为 Quartz 0–30 / Spring 1–30；本工具不预览跨月偏移')
            offsets.push(number)
            return Array.from({ length: 4 }, (_, index) => 28 + index - number).filter(day => day > 0).join(',')
          }
          const nearest = /^(\d+)W$/.exec(part)
          if (nearest) {
            const number = Number(nearest[1])
            if (number < 1 || number > 31) throw new Error('最近工作日需为 1–31W')
            return part
          }
        }
        if (specialAllowed && index === 5) {
          if (part === 'L' && dialect.quartz) return '6'
          const special = /^(\d+)(L|#[1-5])$/.exec(part)
          if (special) {
            const number = Number(special[1])
            if (number < (dialect.quartz ? 1 : 0) || number > 7) throw new Error('特殊星期编号超出当前方言范围')
            return `${dialect.quartz ? number - 1 : number === 7 ? 0 : number}${special[2]}`
          }
        }
        return numericPart(part, index, version)
      })
      normalized.push(normalizedParts.includes('*') ? '*' : normalizedParts.join(','))
    }
    if (index === 3) {
      // L-n 候选按日搜索，实际日期由匹配谓词过滤；其他日项仍保留各自的匹配语义。
      const ordinary = value.split(',').filter(part => !/^L-\d+$/.test(part))
      dayOfMonth = normalized.at(-1)!
      if (offsets.length) {
        dayOfMonth = ordinary.length ? ordinary.map(part => /[LW]/.test(part) ? part : numericPart(part, index, version)).join(',') : '?'
      }
    }
    if (index === 5) dayOfWeek = normalized.at(-1)!
  }
  const indexes = fieldIndexes(version)
  if (dialect.quartz && ((fields[indexes.indexOf(3)] === '?') === (fields[indexes.indexOf(5)] === '?'))) throw new Error('Quartz 的日和星期必须有且仅有一个设为 ?')
  const adapted = normalized.join(' ')
  try {
    parse(adapted, { hasSeconds: dialect.count !== 5 })
  } catch (cause) {
    throw new Error(`Cron 字段超出范围或语法无效：${cause instanceof Error ? cause.message : '解析失败'}`)
  }
  return { fields, normalized: adapted, dayOfMonth, dayOfWeek, offsets }
}

export interface CronTestInput { expression: string; version: CronVersion; start: string; timezone: string; count: number }

/** 获取时区中的日历日期；date 为时刻、timezone 为 IANA 时区，返回以 UTC 存放年月日的日期，便于跨夏令时逐日搜索。 */
function calendarDate(date: Date, timezone: string): Date {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const number = (name: string) => Number(parts.find(item => item.type === name)!.value)
  return new Date(Date.UTC(number('year'), number('month') - 1, number('day')))
}

/** 计算起点之后执行时间；input 为表达式、方言、ISO 起点、IANA 时区和数量，返回有序结果及限制提示。 */
export function testCron(input: CronTestInput): { times: string[]; warning: string } {
  const validated = validateCron(input.expression, input.version)
  const dialect = cronDialect(input.version)
  const start = new Date(input.start)
  if (!Number.isFinite(start.getTime()) || start.getUTCFullYear() < 1970 || start.getUTCFullYear() > 2099) throw new Error('测试起点需为 1970–2099 年的有效日期')
  if (!Number.isInteger(input.count) || input.count < 1 || input.count > 20) throw new Error('预览数量需为 1–20 的整数')
  try { new Intl.DateTimeFormat('zh-CN', { timeZone: input.timezone }).format(start) }
  catch { throw new Error('时区无效，请选择有效 IANA 时区') }
  const dom = parse(`* * * ${validated.dayOfMonth} * ?`, { hasSeconds: true })
  const dow = parse(`* * * ? * ${validated.dayOfWeek}`, { hasSeconds: true })
  const indexes = fieldIndexes(input.version)
  const andDates = !dialect.quartz && (input.version !== 'unix5' || [3, 5].some(index => validated.fields[indexes.indexOf(index)]!.startsWith('*')))
  const end = new Date(start)
  end.setUTCFullYear(Math.min(start.getUTCFullYear() + 10, 2100))
  const after = new Date(start.getTime() + 1000).toISOString()
  const options = {
    hasSeconds: dialect.count !== 5, startAt: after, endAt: end.toISOString(),
    timezone: input.timezone, formatInTimezone: true, matchCount: input.count, maxLoopCount: 20000,
    matchValidator: (time: string) => Number(time.slice(0, 4)) >= 1970 && Number(time.slice(0, 4)) <= 2099,
  }
  let times: string[]
  if (!andDates && !validated.offsets.length) {
    times = getFutureMatches(validated.normalized, options)
  } else {
    // 先按本地日历选出有效日期，再交给库计算时分秒，避免秒级表达式在不符合且规则的日期上空转。
    const normalized = validated.normalized.split(' ')
    const fullFields = ['0', '*', '*', '*', '*', '*', '*']
    indexes.forEach((index, position) => { fullFields[index] = normalized[position]! })
    const monthsAndYears = parse(`* * * ? ${fullFields[4]} * ${fullFields[6]}`, { hasSeconds: true })
    const calendar = calendarDate(start, input.timezone)
    const lastCalendar = calendarDate(end, input.timezone)
    times = []
    while (calendar.getTime() <= lastCalendar.getTime() && calendar.getUTCFullYear() <= 2099 && times.length < input.count) {
      const date = calendar.toISOString().slice(0, 10)
      const noon = `${date}T12:00:00Z`
      const lastDay = new Date(Date.UTC(calendar.getUTCFullYear(), calendar.getUTCMonth() + 1, 0)).getUTCDate()
      const matchesDom = isTimeMatches(dom, noon, 'UTC') || validated.offsets.some(offset => calendar.getUTCDate() === lastDay - offset)
      const matchesDow = isTimeMatches(dow, noon, 'UTC')
      const matchesDate = andDates ? matchesDom && matchesDow : matchesDom || matchesDow
      if (calendar.getUTCFullYear() >= 1970 && matchesDate && isTimeMatches(monthsAndYears, noon, 'UTC')) {
        const candidate = `${fullFields.slice(0, 3).join(' ')} ${calendar.getUTCDate()} ${calendar.getUTCMonth() + 1} ? ${calendar.getUTCFullYear()}`
        times.push(...getFutureMatches(candidate, { ...options, hasSeconds: true, startAt: after, matchCount: input.count - times.length }))
      }
      calendar.setUTCDate(calendar.getUTCDate() + 1)
    }
  }
  return { times, warning: times.length < input.count ? '在未来 10 年及搜索步数上限内未找到足够结果；这不代表表达式语法错误。' : '' }
}
