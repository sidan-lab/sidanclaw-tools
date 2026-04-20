/**
 * `kb init` — interactive wizard for creating a new KB.
 *
 * Three modes:
 *   1. `kb init --from <src>` — migration from an existing markdown tree.
 *   2. `kb init` with gh CLI available — offer to clone the template repo via gh.
 *   3. `kb init` without gh — write the template skeleton to a local directory.
 *
 * The wizard prompts only for the few things the user really has to decide:
 * directory name, KB title, KB description. Everything else uses opinionated
 * defaults that the user can edit afterward.
 */

import { mkdir, writeFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { ask, askYesNo, closePrompts } from '../lib/prompts.js'
import { buildTemplateFiles, TEMPLATE_REPO, TEMPLATE_REPO_SLUG } from '../lib/template.js'
import { runMigrate } from './migrate.js'

export async function runInit(positional: string[], flags: Record<string, string | boolean>): Promise<void> {
  try {
    if (typeof flags.from === 'string') {
      await initFromSource(positional, flags)
      return
    }
    await initFresh(positional)
  } finally {
    closePrompts()
  }
}

async function initFresh(positional: string[]): Promise<void> {
  const initialDir = positional[0]
  const dirName = initialDir || (await ask('Directory name for the new KB', 'my-team-kb'))
  const targetAbs = path.resolve(dirName)

  if (await pathExists(targetAbs)) {
    process.stderr.write(`Path already exists: ${targetAbs}\nAbort.\n`)
    process.exit(1)
  }

  const kbTitle = await ask('KB title (shown as the root index title)', titleFromDirName(dirName))
  const kbDescription = await ask(
    'One-sentence description of this KB',
    `Team knowledge base for ${kbTitle}. Spec, runbook, and reference content.`,
  )

  const ghAvailable = await isGhAvailable()
  let usedGh = false

  if (ghAvailable) {
    const useGh = await askYesNo(
      `gh CLI detected. Create a new GitHub repo from the template (${TEMPLATE_REPO_SLUG})?`,
      true,
    )
    if (useGh) {
      const repoName = await ask('GitHub repo name (owner/name or just name)', dirName)
      const visibility = (await ask('Visibility (public/private)', 'private')).toLowerCase()
      const visFlag = visibility.startsWith('pub') ? '--public' : '--private'
      process.stdout.write(`\nRunning: gh repo create ${repoName} --template ${TEMPLATE_REPO_SLUG} ${visFlag} --clone --disable-wiki\n\n`)
      const ok = await runShell('gh', ['repo', 'create', repoName, '--template', TEMPLATE_REPO_SLUG, visFlag, '--clone', '--disable-wiki'])
      if (ok) {
        usedGh = true
        const localDir = repoName.includes('/') ? repoName.split('/').pop()! : repoName
        printNextSteps(path.resolve(localDir), { skipEdits: false })
        return
      }
      process.stderr.write(`\ngh failed — falling back to local skeleton.\n\n`)
    }
  }

  // Local skeleton fallback
  await mkdir(targetAbs, { recursive: true })
  const files = buildTemplateFiles({ kbTitle, kbDescription })
  for (const tf of files) {
    const dest = path.join(targetAbs, tf.path)
    await mkdir(path.dirname(dest), { recursive: true })
    await writeFile(dest, tf.content)
  }
  process.stdout.write(`\n✓ Wrote ${files.length} starter files to ${targetAbs}\n`)
  printNextSteps(targetAbs, { skipEdits: false, localOnly: !usedGh })
}

async function initFromSource(positional: string[], flags: Record<string, string | boolean>): Promise<void> {
  const source = String(flags.from)
  if (!(await pathExists(source))) {
    process.stderr.write(`Source path not found: ${source}\n`)
    process.exit(1)
  }

  const defaultTarget = (typeof flags.out === 'string' ? flags.out : positional[0]) ?? `${path.basename(path.resolve(source))}-kb`
  const target = String(defaultTarget)
  const targetAbs = path.resolve(target)

  if (await pathExists(targetAbs)) {
    process.stderr.write(`Target path already exists: ${targetAbs}\nMove or remove it before running migrate.\n`)
    process.exit(1)
  }

  const kbTitle = await ask('KB title', titleFromDirName(target))
  const kbDescription = await ask(
    'One-sentence description of this KB',
    `Team knowledge base migrated from ${source}.`,
  )

  process.stdout.write(`\nWalking ${path.resolve(source)} ...\n`)
  const decisions = await runMigrate({ source, target, kbTitle, kbDescription })

  const migrated = decisions.filter((d) => d.status === 'migrated').length
  const skipped = decisions.filter((d) => d.status === 'skipped').length
  const confidential = decisions.filter((d) => d.sensitivity === 'confidential').length
  const publicCount = decisions.filter((d) => d.sensitivity === 'public').length

  process.stdout.write(`\n✓ Migration complete: ${migrated} migrated, ${skipped} skipped\n`)
  process.stdout.write(`  → ${confidential} marked confidential, ${publicCount} marked public, rest internal\n`)
  process.stdout.write(`  → Review ${path.join(targetAbs, 'MIGRATION_REPORT.md')} before pushing\n`)
  printNextSteps(targetAbs, { skipEdits: true, localOnly: true })
}

function printNextSteps(targetAbs: string, opts: { skipEdits?: boolean; localOnly?: boolean }) {
  process.stdout.write(`\nNext steps:\n`)
  process.stdout.write(`  cd ${targetAbs}\n`)
  if (!opts.skipEdits) {
    process.stdout.write(`  # Edit meta/sensitivity.md, meta/tags.md, and index.md to match your team.\n`)
  } else {
    process.stdout.write(`  # Review MIGRATION_REPORT.md, then spot-check confidential/public entries.\n`)
  }
  if (opts.localOnly) {
    process.stdout.write(`  git init && git add . && git commit -m "chore: initial kb"\n`)
    process.stdout.write(`  # Create a GitHub repo, set as remote, and push.\n`)
  } else {
    process.stdout.write(`  # The repo is already on GitHub.\n`)
  }
  process.stdout.write(`  # In sidanclaw web app: team settings → Knowledge → connect repo.\n`)
  process.stdout.write(`\nTemplate reference: ${TEMPLATE_REPO}\n`)
}

function titleFromDirName(dir: string): string {
  return path
    .basename(dir)
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

async function isGhAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('gh', ['--version'], { stdio: 'ignore' })
    proc.on('error', () => resolve(false))
    proc.on('exit', (code) => resolve(code === 0))
  })
}

async function runShell(cmd: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { stdio: 'inherit' })
    proc.on('error', () => resolve(false))
    proc.on('exit', (code) => resolve(code === 0))
  })
}
