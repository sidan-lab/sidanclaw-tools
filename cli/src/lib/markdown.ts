/**
 * Lightweight markdown utilities for migration mode.
 * No external parser — we only need title + summary extraction.
 */

const HEADING_RE = /^#\s+(.+)$/m

export function extractFirstHeading(body: string): string | null {
  const match = body.match(HEADING_RE)
  return match ? match[1].trim() : null
}

export function extractSummary(body: string): string | null {
  // Strip leading H1 if present (would otherwise become the "first paragraph")
  const trimmed = body.replace(/^#\s+.+\n+/, '').trim()
  if (!trimmed) return null

  // Take first non-empty paragraph
  const firstPara = trimmed.split(/\n\s*\n/)[0].trim()

  // Reject if it's a heading, code block, list, or HTML block
  if (
    !firstPara ||
    firstPara.startsWith('#') ||
    firstPara.startsWith('```') ||
    firstPara.startsWith('|') ||
    firstPara.startsWith('-') ||
    firstPara.startsWith('*') ||
    firstPara.startsWith('<') ||
    firstPara.startsWith('>')
  ) {
    return null
  }

  // Collapse internal whitespace + strip markdown link syntax for cleaner display
  const cleaned = firstPara
    .replace(/\s+/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`]/g, '')
    .trim()

  // Cap at ~200 chars (the parser doesn't enforce; just keeps listings readable)
  if (cleaned.length > 200) return cleaned.slice(0, 197).trimEnd() + '…'
  return cleaned
}

export function fileNameToTitle(filePath: string): string {
  const name = filePath.split('/').pop() ?? filePath
  return name
    .replace(/\.md$/i, '')
    .replace(/^\d+[-_]/, '') // strip numeric prefix like "31-"
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function inferTagsFromPath(relativePath: string): string[] {
  const segments = relativePath.split('/').slice(0, -1).filter(Boolean)
  return segments
    .map((s) => s.toLowerCase().replace(/^\d+[-_]/, ''))
    .filter((s) => s && s !== 'docs' && s.length < 30)
}
