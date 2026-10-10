import { describe, expect, it } from 'vitest'
import { cronExamples, cronVersions, exampleFields, generateCron, testCron, validateCron, type CronVersion } from './logic'

const start = '2026-10-10T00:00:00Z'
/** 计算测试样例；expression 为表达式、version 为版本，返回 UTC 时区下后续三次执行时间。 */
function times(expression: string, version: CronVersion = 'unix5') {
  return testCron({ expression, version, start, timezone: 'UTC', count: 3 }).times
}
describe('Cron 版本、生成和语法', () => {
  it('所有适用示例都能按 5/6/7 段生成并校验', () => {
    for (const { value: version, count } of cronVersions) {
      for (const example of cronExamples.filter(item => !item.specialOnly || version.startsWith('quartz') || version === 'spring6')) {
        const expression = generateCron(exampleFields(example, version), version)
        expect(validateCron(expression, version).fields).toHaveLength(count)
      }
    }
  })
  it('拒绝段数、范围、零步长、非法字母、Unicode 和 Quartz 日期冲突', () => {
    for (const expression of ['', '😀 * * * *', '60 * * * *', '60/1 * * * *', '*/0 * * * *', '2abc * * * *', '* * * *', '1-0 * * * *', '0 0 ? * *', '* * * JAN MON garbage']) expect(() => validateCron(expression, 'unix5')).toThrow()
    expect(() => validateCron('0 0 9 * * *', 'quartz6')).toThrow('有且仅有一个')
    expect(() => validateCron('0 0 9 ? * 0', 'quartz6')).toThrow('星期')
    expect(() => validateCron('0 0 9 ? * 8', 'quartz6')).toThrow('星期')
    expect(() => validateCron('0 0 9 ? * MON 2100', 'quartz7')).toThrow()
    expect(() => validateCron('x'.repeat(201), 'unix5')).toThrow('200')
    expect(validateCron('  */5   * * * *  ', 'unix5').fields).toEqual(['*/5', '*', '*', '*', '*'])
  })
})
describe('Cron 后续执行时间', () => {
  it('分钟/秒精度、列表、范围、步长均严格在起点之后', () => {
    expect(times('*/5 * * * *')[0]).toContain('00:05:00')
    expect(times('*/10 * * * * *', 'node6')[0]).toContain('00:00:10')
    expect(times('0,30 9-10 * * *')[0]).toContain('09:00:00')
    expect(times('0 0 9 ? * MON-FRI *', 'quartz7')[0]).toContain('2026-10-12T09:00:00')
    expect(times('0 9 15 * 1')[0]).toContain('2026-10-12')
    expect(times('0 9 15 * 1')[1]).toContain('2026-10-15')
    expect(times('0 9 * * 7')[0]).toContain('2026-10-11')
  })
  it('Quartz 星期 1 是周日，2 是周一，与 Unix 编号不同', () => {
    expect(times('0 0 9 ? * 1', 'quartz6')[0]).toContain('2026-10-11')
    expect(times('0 0 9 ? * 2', 'quartz6')[0]).toContain('2026-10-12')
    expect(times('0 9 * * 1')[0]).toContain('2026-10-12')
    expect(times('0 0 9 ? * 1-7/2', 'quartz6')[0]).toContain('2026-10-10')
  })
  it('支持末日、最近工作日、最后工作日和第几个星期', () => {
    expect(times('0 0 9 L * ? *', 'quartz7')[0]).toContain('2026-10-31')
    expect(times('0 0 9 15W * ?', 'quartz6')[0]).toContain('2026-10-15')
    expect(times('0 0 9 LW * ?', 'quartz6')[0]).toContain('2026-10-30')
    expect(times('0 0 9 ? * 2#2', 'quartz6')[0]).toContain('2026-10-12')
    expect(times('0 0 9 ? * 6L', 'quartz6')[0]).toContain('2026-10-30')
  })
  it('年份限制与时区生效，非法起点/时区/数量拒绝，无匹配有提示', () => {
    expect(times('0 0 9 1 1 ? 2027', 'quartz7')[0]).toContain('2027-01-01')
    expect(testCron({ expression: '0 9 * * *', version: 'unix5', start, timezone: 'Asia/Shanghai', count: 1 }).times[0]).toContain('09:00:00+08:00')
    const input = { expression: '* * * * *', version: 'unix5' as const, start, timezone: 'UTC', count: 1 }
    for (const override of [{ start: 'bad' }, { timezone: 'fake' }, { count: 0 }, { count: 21 }]) expect(() => testCron({ ...input, ...override })).toThrow()
    const unmatched = testCron({ ...input, expression: '0 0 0 1 1 ? 2020', version: 'quartz7' })
    expect(unmatched.times).toEqual([])
    expect(unmatched.warning).not.toBe('')
  })
})

describe('各工具方言不能混用', () => {
  it('Linux 是或，node-cron 和 Spring 是且', () => {
    expect(times('0 9 15 * 1', 'unix5')[0]).toContain('2026-10-12')
    expect(times('0 9 15 * 1', 'node5')[0]).toContain('2027-02-15')
    expect(times('0 0 9 15 * 1', 'node6')[0]).toContain('2027-02-15')
    expect(times('0 0 9 15 * 1', 'spring6')[0]).toContain('2027-02-15')
    expect(times('* * * 15 * 1', 'spring6')[0]).toContain('2027-02-15T00:00:00')
    // Vixie/Cronie 将以 * 开头的日字段视为星号规则，不能一概按或执行。
    expect(times('0 9 */2 * MON', 'unix5')[0]).toContain('2026-10-19')
  })
  it('Spring 的问号是通配符，星期 0/7 为周日，与 Quartz 编号不同', () => {
    expect(times('0 0 9 ? * 1', 'spring6')[0]).toContain('2026-10-12')
    expect(times('0 0 9 ? * 1', 'quartz6')[0]).toContain('2026-10-11')
    expect(times('0 0 9 ? * 7L', 'spring6')[0]).toContain('2026-10-25')
    expect(times('0 0 9 * * 5L', 'spring6')[0]).toContain('2026-10-30')
    expect(() => validateCron('0 0 9 * * L', 'spring6')).toThrow()
    expect(() => validateCron('0 0 9 * * *', 'spring6')).not.toThrow()
    expect(() => validateCron('0 0 9 * * *', 'quartz6')).toThrow()
  })
  it('生成器与校验器一致，非法字符不被静默替换，宏按对应工具展开', () => {
    expect(() => generateCron(['0', '0', '9', '?', '*', '*', '*'], 'unix5')).toThrow()
    expect(() => validateCron('0 9 L * *', 'node5')).toThrow()
    expect(() => validateCron('0 0 9 ? * MON', 'node6')).toThrow()
    expect(() => validateCron('0 0 9 * * * 2027', 'spring6')).toThrow()
    expect(validateCron('@daily', 'spring6').fields).toEqual(['0', '0', '0', '*', '*', '*'])
    expect(validateCron('@daily', 'unix5').fields).toEqual(['0', '0', '*', '*', '*'])
    expect(() => validateCron('@daily', 'node6')).toThrow()
    expect(() => validateCron('@daily', 'quartz7')).toThrow()
  })
  it('月末偏移、特殊日期列表及数值步长按方言计算', () => {
    expect(times('0 0 9 L-3 * ?', 'quartz6')[0]).toContain('2026-10-28')
    expect(times('0 0 9 L-3 * *', 'spring6')[0]).toContain('2026-10-28')
    expect(times('0 0 9 15,L * *', 'spring6').slice(0, 2).map(time => time.slice(0, 10))).toEqual(['2026-10-15', '2026-10-31'])
    expect(times('5/10 * * * * *', 'spring6')[0]).toContain('00:00:05')
    expect(() => validateCron('5/10 * * * * *', 'node6')).toThrow('范围')
    expect(times('0 0 9 ? * 7-1', 'quartz6')[0]).toContain('2026-10-10')
    expect(() => validateCron('0 0 9 32W * *', 'spring6')).toThrow()
    expect(testCron({ expression: '0 0 9 * * *', version: 'spring6', start: '2099-12-31T23:59:59Z', timezone: 'UTC', count: 1 }).times).toEqual([])
  })
})
