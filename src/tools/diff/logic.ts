export interface DiffLine {
  kind: 'equal' | 'removed' | 'added'
  text: string
  leftLine: number | null
  rightLine: number | null
}

export interface SplitDiffRow {
  left: DiffLine | null
  right: DiffLine | null
}

/** 将 lines 合并差异转换为左右对齐行；同一修改区块按顺序配对，缺少一侧时返回 null 占位。 */
export function splitDiffLines(lines: DiffLine[]): SplitDiffRow[] {
  const rows: SplitDiffRow[] = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index]!
    if (line.kind === 'equal') {
      rows.push({ left: line, right: line })
      index++
      continue
    }
    const removed: DiffLine[] = []
    const added: DiffLine[] = []
    while (index < lines.length && lines[index]!.kind !== 'equal') {
      const change = lines[index++]!
      if (change.kind === 'removed') {
        removed.push(change)
      } else {
        added.push(change)
      }
    }
    for (let i = 0; i < Math.max(removed.length, added.length); i++) {
      rows.push({ left: removed[i] ?? null, right: added[i] ?? null })
    }
  }
  return rows
}

/** 将 text 按行拆分并统一换行风格；空文本返回空数组，末尾换行保留为空行。 */
function splitLines(text: string): string[] {
  return text === '' ? [] : text.replace(/\r\n?/g, '\n').split('\n')
}

/** 对比 left 原文与 right 新文本，返回带双侧行号的行差异；超过处理上限时抛出可展示的错误。 */
export function compareTexts(left: string, right: string): DiffLine[] {
  // 限制输入与矩阵规模，避免浏览器主线程因大文本的二次方计算而长时间阻塞。
  if (left.length + right.length > 200000) throw new Error('两段文本合计不能超过 200,000 个 UTF-16 单元，请分段对比')
  const a = splitLines(left)
  const b = splitLines(right)
  if ((a.length + 1) * (b.length + 1) > 1000000) throw new Error('行数过多，请分段对比（行数矩阵最多 1,000,000 个单元）')
  const width = b.length + 1
  const lengths = new Uint32Array((a.length + 1) * width)
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lengths[i * width + j] = a[i] === b[j]
        ? 1 + lengths[(i + 1) * width + j + 1]!
        : Math.max(lengths[(i + 1) * width + j]!, lengths[i * width + j + 1]!)
    }
  }
  const result: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      result.push({ kind: 'equal', text: a[i]!, leftLine: ++i, rightLine: ++j })
    } else if (i < a.length && (j === b.length || lengths[(i + 1) * width + j]! >= lengths[i * width + j + 1]!)) {
      result.push({ kind: 'removed', text: a[i]!, leftLine: ++i, rightLine: null })
    } else {
      result.push({ kind: 'added', text: b[j]!, leftLine: null, rightLine: ++j })
    }
  }
  return result
}
