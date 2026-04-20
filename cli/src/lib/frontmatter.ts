/**
 * Frontmatter read/write — mirrors the rules of packages/core/src/knowledge/parser.ts
 * so the CLI emits frontmatter the sync worker can parse without surprises.
 *
 * Supports: scalar string/number/boolean, inline arrays [a,b], block arrays.
 * No nested objects (parser doesn't read them).
 */

export type Frontmatter = Record<string, string | number | boolean | string[]>

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

export function readFrontmatter(content: string): { frontmatter: Frontmatter; body: string } {
  const match = content.match(FRONTMATTER_RE)
  if (!match) return { frontmatter: {}, body: content }
  return {
    frontmatter: parseYamlSubset(match[1]),
    body: content.slice(match[0].length),
  }
}

export function writeFrontmatter(fm: Frontmatter, body: string): string {
  const lines: string[] = ['---']
  for (const [key, value] of Object.entries(fm)) {
    if (value === undefined || value === null) continue
    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`)
      } else if (value.every((v) => typeof v === 'string' && !needsQuoting(v) && v.length < 30)) {
        lines.push(`${key}: [${value.join(', ')}]`)
      } else {
        lines.push(`${key}:`)
        for (const item of value) {
          lines.push(`  - ${formatScalar(String(item))}`)
        }
      }
    } else {
      lines.push(`${key}: ${formatScalar(String(value))}`)
    }
  }
  lines.push('---', '')
  return lines.join('\n') + body.replace(/^\n+/, '')
}

function parseYamlSubset(raw: string): Frontmatter {
  const result: Frontmatter = {}
  const lines = raw.split('\n')
  let currentKey: string | null = null

  for (const line of lines) {
    const arrayItem = line.match(/^\s+-\s+(.+)$/)
    if (arrayItem && currentKey) {
      const arr = result[currentKey]
      if (Array.isArray(arr)) arr.push(arrayItem[1].trim())
      continue
    }

    const kv = line.match(/^([a-zA-Z_-]+)\s*:\s*(.*)$/)
    if (!kv) continue
    const key = kv[1].trim()
    let value = kv[2].trim()
    currentKey = key

    if (value.startsWith('[') && value.endsWith(']')) {
      result[key] = value
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      continue
    }
    if (!value) {
      result[key] = []
      continue
    }
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (value === 'true') {
      result[key] = true
      continue
    }
    if (value === 'false') {
      result[key] = false
      continue
    }
    const num = Number(value)
    if (!isNaN(num) && value !== '') {
      result[key] = num
      continue
    }
    result[key] = value
  }
  return result
}

function needsQuoting(value: string): boolean {
  return /[:#,\[\]{}|>&*!%@`]/.test(value) || /^\s|\s$/.test(value)
}

function formatScalar(value: string): string {
  if (value === 'true' || value === 'false') return `"${value}"`
  if (!isNaN(Number(value)) && value !== '') return `"${value}"`
  if (needsQuoting(value)) return `"${value.replace(/"/g, '\\"')}"`
  return value
}
