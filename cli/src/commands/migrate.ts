/**
 * Migrate an existing markdown tree into KB form.
 *
 * For each .md file under <source>:
 *   1. Read existing frontmatter (if any) and body.
 *   2. Apply sensitivity heuristic to the relative path.
 *   3. Skip if the heuristic says skip (archived, CLAUDE.md).
 *   4. Otherwise: derive title/description/tags/sensitivity, merge with
 *      existing frontmatter (existing values win), write to <target>.
 *   5. Record the decision in the migration report.
 *
 * Writes <target>/MIGRATION_REPORT.md so every choice is auditable.
 * Also seeds meta/sensitivity.md + meta/tags.md if missing.
 */

import { mkdir, readFile, writeFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { readFrontmatter, writeFrontmatter, type Frontmatter } from '../lib/frontmatter.js'
import { inferSensitivity } from '../lib/sensitivity.js'
import { extractFirstHeading, extractSummary, fileNameToTitle, inferTagsFromPath } from '../lib/markdown.js'
import { buildTemplateFiles } from '../lib/template.js'

export type MigrateOptions = {
  source: string
  target: string
  kbTitle: string
  kbDescription: string
}

export type MigrationDecision = {
  source: string
  target: string | null
  status: 'migrated' | 'skipped'
  sensitivity: string | null
  reason: string
  matched: string
  derivedTitle: string | null
  derivedDescription: string | null
  preservedFrontmatterKeys: string[]
}

export async function runMigrate(opts: MigrateOptions): Promise<MigrationDecision[]> {
  const sourceAbs = path.resolve(opts.source)
  const targetAbs = path.resolve(opts.target)

  const files = await walkMarkdown(sourceAbs)
  const decisions: MigrationDecision[] = []

  for (const sourceFile of files) {
    const rel = path.relative(sourceAbs, sourceFile)
    const decision = await migrateOne(sourceFile, rel, targetAbs)
    decisions.push(decision)
  }

  await seedMetaIfMissing(targetAbs, opts)
  await seedRootIndexIfMissing(targetAbs, opts)
  await writeMigrationReport(targetAbs, decisions, opts)

  return decisions
}

async function migrateOne(sourceFile: string, rel: string, targetAbs: string): Promise<MigrationDecision> {
  const inferred = inferSensitivity(rel)
  if (inferred.tier === 'skip') {
    return {
      source: rel,
      target: null,
      status: 'skipped',
      sensitivity: null,
      reason: inferred.reason,
      matched: inferred.matched,
      derivedTitle: null,
      derivedDescription: null,
      preservedFrontmatterKeys: [],
    }
  }

  const raw = await readFile(sourceFile, 'utf8')
  const { frontmatter: existing, body } = readFrontmatter(raw)

  const derivedTitle =
    (typeof existing.title === 'string' ? existing.title : null) ??
    extractFirstHeading(body) ??
    fileNameToTitle(rel)

  const derivedDescription =
    (typeof existing.description === 'string' ? existing.description : null) ??
    extractSummary(body)

  const existingTags = Array.isArray(existing.tags) ? existing.tags : []
  const inferredTags = inferTagsFromPath(rel)
  const tags = uniq([...existingTags, ...inferredTags]).slice(0, 6)

  const merged: Frontmatter = {
    title: derivedTitle,
    description: derivedDescription ?? `TODO: write a one-line summary for ${derivedTitle}`,
    tags,
    sensitivity: typeof existing.sensitivity === 'string' ? existing.sensitivity : inferred.tier,
  }

  // Preserve any other existing frontmatter keys (status, owner, last_reviewed, etc.)
  const preserved: string[] = []
  for (const [k, v] of Object.entries(existing)) {
    if (!(k in merged)) {
      merged[k] = v as Frontmatter[string]
      preserved.push(k)
    }
  }

  const targetFile = path.join(targetAbs, normaliseTargetPath(rel))
  await mkdir(path.dirname(targetFile), { recursive: true })
  await writeFile(targetFile, writeFrontmatter(merged, body))

  return {
    source: rel,
    target: path.relative(targetAbs, targetFile),
    status: 'migrated',
    sensitivity: String(merged.sensitivity),
    reason: inferred.reason,
    matched: inferred.matched,
    derivedTitle,
    derivedDescription,
    preservedFrontmatterKeys: preserved,
  }
}

function normaliseTargetPath(rel: string): string {
  return rel
    .split('/')
    .map((seg, i, arr) => {
      // Strip numeric prefixes per the skill's "no numeric filenames" rule.
      let s = seg.replace(/^\d+[-_]/, '')
      // Folder-index convention: INDEX.md / README.md → index.md so the parser
      // recognises it as the directory's entry (parser strips /index lowercase).
      if (i === arr.length - 1 && /^(INDEX|README)\.md$/i.test(s)) s = 'index.md'
      return s
    })
    .join('/')
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr))
}

async function walkMarkdown(dir: string): Promise<string[]> {
  const out: string[] = []
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    if (entry.name === 'node_modules') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...(await walkMarkdown(full)))
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      out.push(full)
    }
  }
  return out
}

async function seedMetaIfMissing(targetAbs: string, opts: MigrateOptions): Promise<void> {
  const templateFiles = buildTemplateFiles({ kbTitle: opts.kbTitle, kbDescription: opts.kbDescription })
  for (const tf of templateFiles) {
    if (!tf.path.startsWith('meta/')) continue
    const dest = path.join(targetAbs, tf.path)
    if (await fileExists(dest)) continue
    await mkdir(path.dirname(dest), { recursive: true })
    await writeFile(dest, tf.content)
  }
}

async function seedRootIndexIfMissing(targetAbs: string, opts: MigrateOptions): Promise<void> {
  const dest = path.join(targetAbs, 'index.md')
  if (await fileExists(dest)) return
  const templateFiles = buildTemplateFiles({ kbTitle: opts.kbTitle, kbDescription: opts.kbDescription })
  const rootIndex = templateFiles.find((f) => f.path === 'index.md')
  if (rootIndex) await writeFile(dest, rootIndex.content)
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

async function writeMigrationReport(targetAbs: string, decisions: MigrationDecision[], opts: MigrateOptions): Promise<void> {
  const migrated = decisions.filter((d) => d.status === 'migrated')
  const skipped = decisions.filter((d) => d.status === 'skipped')
  const tierCounts: Record<string, number> = {}
  for (const d of migrated) {
    if (!d.sensitivity) continue
    tierCounts[d.sensitivity] = (tierCounts[d.sensitivity] ?? 0) + 1
  }

  const lines: string[] = []
  lines.push(`# Migration report`)
  lines.push('')
  lines.push(`Generated by \`@sidanclaw/kb\` from \`${opts.source}\` → \`${opts.target}\`.`)
  lines.push('')
  lines.push(`**Total source files:** ${decisions.length}  `)
  lines.push(`**Migrated:** ${migrated.length}  `)
  lines.push(`**Skipped:** ${skipped.length}`)
  lines.push('')
  lines.push(`**Tier breakdown:**`)
  for (const [tier, count] of Object.entries(tierCounts)) {
    lines.push(`- \`${tier}\`: ${count}`)
  }
  lines.push('')
  lines.push(`> ⚠️ Review every \`confidential\` and \`public\` decision before pushing. The heuristics are conservative but not infallible — a single mis-classification can leak.`)
  lines.push('')

  lines.push(`## Migrated entries`)
  lines.push('')
  lines.push(`| Source | Target | Tier | Reason |`)
  lines.push(`|---|---|---|---|`)
  for (const d of migrated) {
    lines.push(`| \`${d.source}\` | \`${d.target}\` | \`${d.sensitivity}\` | ${d.reason} |`)
  }
  lines.push('')

  if (skipped.length > 0) {
    lines.push(`## Skipped`)
    lines.push('')
    lines.push(`| Source | Reason |`)
    lines.push(`|---|---|`)
    for (const d of skipped) {
      lines.push(`| \`${d.source}\` | ${d.reason} |`)
    }
    lines.push('')
  }

  lines.push(`## Next steps`)
  lines.push('')
  lines.push(`1. Review the table above. Spot-check every \`confidential\` and \`public\` row.`)
  lines.push(`2. Edit \`meta/sensitivity.md\` and \`meta/tags.md\` to encode your team's policy.`)
  lines.push(`3. Replace any \`TODO: write a one-line summary\` placeholders.`)
  lines.push(`4. Commit and push.`)
  lines.push(`5. In the sidanclaw web app, connect this repo via team settings → Knowledge.`)
  lines.push('')
  lines.push(`Once the \`kb lint\` CLI ships (v0.2), run it before pushing to catch missing summaries, cross-tier body links, and mixed-tier indices.`)
  lines.push('')

  await writeFile(path.join(targetAbs, 'MIGRATION_REPORT.md'), lines.join('\n'))
}
