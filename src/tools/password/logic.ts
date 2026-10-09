export interface PasswordOptions {
  length: number
  lowercase: boolean
  uppercase: boolean
  digits: boolean
  symbols: boolean
  excludeSimilar: boolean
}

export const passwordSymbols = '!@#$%^&*_-'

const characterSets = {
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: passwordSymbols,
}

/** 从 [0, upper) 无偏抽样；upper 为正整数，返回加密随机索引；拒绝取模偏差。 */
function randomIndex(upper: number): number {
  const limit = Math.floor(0x100000000 / upper) * upper
  const buffer = new Uint32Array(1)
  let value: number
  do {
    crypto.getRandomValues(buffer)
    value = buffer[0]!
  } while (value >= limit)
  return value % upper
}

/** 根据长度和字符类型生成密码；options 为设置，返回包含所有选中类型的随机密码，不保存内容。 */
export function generatePassword(options: PasswordOptions): string {
  if (!Number.isInteger(options.length) || options.length < 1 || options.length > 128) throw new Error('密码长度必须为 1–128 的整数')
  const sets = Object.entries(characterSets)
    .filter(([key]) => options[key as keyof typeof characterSets])
    .map(([, characters]) => options.excludeSimilar ? characters.replace(/[Il1O0o]/g, '') : characters)
  if (sets.length === 0) throw new Error('请至少选择一种字符类型')
  if (options.length < sets.length) throw new Error('长度不能少于选中的字符类型数量')
  const alphabet = sets.join('')
  // 整体拒绝采样，保证合规密码在允许字符空间中等概率；避免固定补位造成分布偏差。
  for (;;) {
    const characters = Array.from({ length: options.length }, () => alphabet[randomIndex(alphabet.length)]!)
    if (sets.every(set => characters.some(character => set.includes(character)))) return characters.join('')
  }
}
