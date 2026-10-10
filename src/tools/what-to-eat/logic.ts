import data from './menu.json'

export interface Meal {
  name: string
  regions: string[]
  flavors: string[]
  category: string
  sourceId?: string
}

export interface MealFilters {
  regions: string[]
  flavors: string[]
  categories: string[]
}

export type MenuMode = 'builtin' | 'custom' | 'combined'
export const builtinMeals: Meal[] = data.meals
export const menuSources = data.sources
export const menuNote = data.note
export const filterOptions = {
  regions: [...new Set(builtinMeals.flatMap(meal => meal.regions))],
  flavors: [...new Set(builtinMeals.flatMap(meal => meal.flavors))],
  categories: [...new Set(builtinMeals.map(meal => meal.category))],
}

/** 解析手工菜单；text 每行一个名称，返回去重后的餐食，超限时抛出说明。 */
export function parseCustomMenu(text: string): Meal[] {
  if (text.length > 10000) throw new Error('自定义菜单最多输入 10,000 个字符')
  const names = text.split(/\r\n?|\n/).map(line => line.trim().normalize('NFC')).filter(Boolean)
  if (names.length > 100) throw new Error('自定义菜单最多输入 100 个非空行')
  if (names.some(name => [...name].length > 50)) throw new Error('每个选项最多 50 个字符，请将不同选项分行输入')
  return [...new Set(names)].map(name => ({ name, regions: [], flavors: [], category: '自定义' }))
}

/** 筛选内置菜单；meals 为餐食，filters 为多选条件，同维度取并集、不同维度取交集。 */
export function filterMeals(meals: readonly Meal[], filters: MealFilters): Meal[] {
  return meals.filter(meal =>
    (!filters.regions.length || filters.regions.some(region => meal.regions.includes(region)))
    && (!filters.flavors.length || filters.flavors.some(flavor => meal.flavors.includes(flavor)))
    && (!filters.categories.length || filters.categories.includes(meal.category)),
  )
}

/** 组合抽选池；mode 为来源模式，builtin 为已筛选菜单，custom 为手工选项，返回按名称去重的候选。 */
export function buildMealPool(mode: MenuMode, builtin: readonly Meal[], custom: readonly Meal[]): Meal[] {
  const meals = mode === 'builtin' ? builtin : mode === 'custom' ? custom : [...builtin, ...custom]
  const unique = new Map<string, Meal>()
  for (const meal of meals) {
    // 内置与手工重复名称只占一份概率；保留内置标签，方便核对抽选结果。
    const key = meal.name.trim().normalize('NFC')
    if (!unique.has(key)) unique.set(key, meal)
  }
  return [...unique.values()]
}

/** 等概率抽取一份餐食；pool 为非空候选池，返回餐食，空池或随机源不可用时抛错。 */
export function drawMeal(pool: readonly Meal[]): Meal {
  if (!pool.length) throw new Error('没有可抽选的餐食，请放宽筛选或添加自定义选项')
  const limit = Math.floor(0x100000000 / pool.length) * pool.length
  const buffer = new Uint32Array(1)
  // 拒绝尾部无法整除的随机值，避免直接取模让部分餐食概率更高。
  do {
    crypto.getRandomValues(buffer)
  } while (buffer[0]! >= limit)
  return pool[buffer[0]! % pool.length]!
}
