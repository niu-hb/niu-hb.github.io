import { describe, expect, it } from 'vitest'
import { maxTodoCount, normalizeTodoContent, parseTodos } from './logic'

describe('待办输入与存档校验', () => {
  it('整理首尾空白，保留 Unicode、换行和作为文本的 HTML', () => {
    expect(normalizeTodoContent('  买菜😀\n<script>文本</script>  ')).toBe('买菜😀\n<script>文本</script>')
    expect(normalizeTodoContent('😀'.repeat(500))).toHaveLength(1000)
    expect(() => normalizeTodoContent('😀'.repeat(501))).toThrow('500')
    expect(() => normalizeTodoContent(' \n\t　')).toThrow('空白')
  })

  it('恢复三个状态并拒绝非法结构、状态、内容和重复标识', () => {
    const items = ['pending', 'in-progress', 'done'].map((status, index) => ({ id: `${index}`, content: '做事😀', status }))
    expect(parseTodos(JSON.stringify(items))).toEqual(items)
    expect(parseTodos('[]')).toEqual([])
    for (const raw of ['{', '{}', '[null]', '[{"id":"a","content":" ","status":"pending"}]', JSON.stringify([{ ...items[0], status: 'unknown' }]), JSON.stringify([items[0], items[0]]), JSON.stringify([{ ...items[0], content: 123 }])]) {
      expect(() => parseTodos(raw)).toThrow()
    }
  })

  it('限制存档大小和条目数量，接受最大数量', () => {
    const items = Array.from({ length: maxTodoCount }, (_, index) => ({ id: `${index}`, content: '事项', status: 'pending' }))
    expect(parseTodos(JSON.stringify(items))).toHaveLength(maxTodoCount)
    expect(() => parseTodos(JSON.stringify([...items, { id: 'extra', content: '事项', status: 'pending' }]))).toThrow('1000')
    expect(parseTodos(JSON.stringify(items.map(item => ({ ...item, content: '\u0000'.repeat(500) }))))).toHaveLength(maxTodoCount)
    expect(() => parseTodos(' '.repeat(4_000_001))).toThrow('过大')
  })
})
