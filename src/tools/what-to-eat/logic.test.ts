import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildMealPool, builtinMeals, drawMeal, filterMeals, filterOptions, menuSources, parseCustomMenu } from './logic'

afterEach(() => vi.restoreAllMocks())

describe('吃什么菜单与筛选', () => {
  it('内置数据名称唯一、标签完整、引用来源有效', () => {
    expect(builtinMeals.length).toBeGreaterThanOrEqual(50)
    expect(new Set(builtinMeals.map(meal => meal.name)).size).toBe(builtinMeals.length)
    expect(new Set(menuSources.map(source => source.id)).size).toBe(menuSources.length)
    for (const source of menuSources) expect(new URL(source.url).protocol).toBe('https:')
    for (const meal of builtinMeals) {
      expect(meal.name.trim()).toBe(meal.name)
      expect(meal.regions.length).toBeGreaterThan(0)
      expect(meal.flavors.length).toBeGreaterThan(0)
      expect(new Set(meal.regions).size).toBe(meal.regions.length)
      expect(new Set(meal.flavors).size).toBe(meal.flavors.length)
      expect(filterOptions.categories).toContain(meal.category)
      expect(menuSources.some(source => source.id === meal.sourceId)).toBe(true)
    }
  })

  it('空条件返回全部，同维度取并集，跨维度取交集', () => {
    expect(filterMeals(builtinMeals, { regions: [], flavors: [], categories: [] })).toEqual(builtinMeals)
    const result = filterMeals(builtinMeals, { regions: ['四川', '湖南'], flavors: ['麻辣', '香辣'], categories: ['家常菜'] })
    expect(result.map(meal => meal.name)).toContain('麻婆豆腐')
    expect(result.map(meal => meal.name)).toContain('剁椒鱼头')
    expect(result.every(meal => meal.category === '家常菜' && meal.regions.some(region => ['四川', '湖南'].includes(region)))).toBe(true)
    expect(filterMeals(builtinMeals, { regions: ['北京'], flavors: ['甜口'], categories: [] })).toEqual([])
    expect(filterMeals(builtinMeals, { regions: ['不存在'], flavors: [], categories: [] })).toEqual([])
  })

  it('日常餐食覆盖米饭、面、粉及炒蒸煮炖，排除宴席名菜', () => {
    const names = new Set(builtinMeals.map(meal => meal.name))
    for (const name of ['鸡蛋炒饭', '黄焖鸡饭', '西红柿鸡蛋面', '红烧牛肉面', '排骨米粉', '炒米粉', '酸辣土豆丝', '肉末蒸蛋', '粉蒸排骨', '水煮肉片', '小鸡炖蘑菇', '白菜炖豆泡']) {
      expect(names.has(name), name).toBe(true)
    }
    for (const name of ['西湖醋鱼', '龙井虾仁', '宋嫂鱼羹', '北京烤鸭']) expect(names.has(name), name).toBe(false)
    const daily = filterMeals(builtinMeals, { regions: ['日常家常'], flavors: [], categories: ['家常菜'] })
    expect(daily.length).toBeGreaterThanOrEqual(35)
    expect(filterMeals(builtinMeals, { regions: [], flavors: [], categories: ['主食'] }).length).toBeGreaterThanOrEqual(30)
  })

  it('解析换行、空白和 Unicode，名称去重，标签与脚本仅作为文本', () => {
    expect(parseCustomMenu(' \r\n 饺子\r面条\n饺子 \n 🍜\n')).toEqual([
      { name: '饺子', regions: [], flavors: [], category: '自定义' },
      { name: '面条', regions: [], flavors: [], category: '自定义' },
      { name: '🍜', regions: [], flavors: [], category: '自定义' },
    ])
    expect(parseCustomMenu('é\ne\u0301')).toHaveLength(1)
    expect(parseCustomMenu(' \n\t')).toEqual([])
    expect(parseCustomMenu('<img src=x onerror=alert(1)>')[0]?.name).toBe('<img src=x onerror=alert(1)>')
  })

  it('拒绝超长输入、超多行，允许 Unicode 长度边界', () => {
    expect(() => parseCustomMenu('a'.repeat(10001))).toThrow('10,000')
    expect(() => parseCustomMenu(Array(101).fill('饺子').join('\n'))).toThrow('100')
    expect(() => parseCustomMenu('中'.repeat(51))).toThrow('50')
    expect(parseCustomMenu('😀'.repeat(50))).toHaveLength(1)
    expect(parseCustomMenu(Array.from({ length: 100 }, (_, index) => `选项${index}`).join('\n'))).toHaveLength(100)
  })

  it('三个来源模式独立且混合池去重，不用内置标签过滤手工选项', () => {
    const builtin = builtinMeals.slice(0, 2)
    const custom = parseCustomMenu('麻婆豆腐\n饺子')
    expect(buildMealPool('builtin', builtin, custom)).toEqual(builtin)
    expect(buildMealPool('custom', builtin, custom)).toEqual(custom)
    expect(buildMealPool('combined', builtin, custom).map(meal => meal.name)).toEqual(['麻婆豆腐', '回锅肉', '饺子'])
    expect(buildMealPool('combined', [], custom)).toEqual(custom)
    expect(buildMealPool('custom', builtin, [])).toEqual([])
  })

  it('拒绝空池，拒绝取模偏差并可抽到首尾选项', () => {
    expect(() => drawMeal([])).toThrow('没有可抽选')
    const pool = parseCustomMenu('一\n二\n三')
    const random = vi.spyOn(crypto, 'getRandomValues')
    random.mockImplementationOnce(array => { (array as Uint32Array)[0] = 0xffffffff; return array })
    random.mockImplementationOnce(array => { (array as Uint32Array)[0] = 2; return array })
    expect(drawMeal(pool).name).toBe('三')
    expect(random).toHaveBeenCalledTimes(2)
    random.mockImplementation(array => { (array as Uint32Array)[0] = 0; return array })
    expect(drawMeal(pool).name).toBe('一')
    expect(drawMeal(pool.slice(0, 1)).name).toBe('一')
  })
})
