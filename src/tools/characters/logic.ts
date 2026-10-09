export interface CharacterCounts {
  total: number
  chinese: number
  english: number
  digits: number
  spaces: number
  whitespace: number
  other: number
}

/** 按 Unicode 码点统计文本；text 为原文，CRLF 归一为一个换行；返回互斥分类数量与总数。 */
export function countCharacters(text: string): CharacterCounts {
  const counts: CharacterCounts = { total: 0, chinese: 0, english: 0, digits: 0, spaces: 0, whitespace: 0, other: 0 }
  for (const char of text.replace(/\r\n/g, '\n')) {
    counts.total++
    if (/\p{Script=Han}/u.test(char)) counts.chinese++
    else if (/[a-zA-Z]/.test(char)) counts.english++
    else if (/[0-9]/.test(char)) counts.digits++
    else if (char === ' ') counts.spaces++
    else if (/\s/u.test(char)) counts.whitespace++
    else counts.other++
  }
  return counts
}
