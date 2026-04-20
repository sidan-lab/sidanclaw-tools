#!/usr/bin/env node
import { runInit } from './commands/init.js'
import { runLint } from './commands/lint.js'

type ParsedArgs = {
  command: string
  positional: string[]
  flags: Record<string, string | boolean>
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command = '', ...rest] = argv
  const positional: string[] = []
  const flags: Record<string, string | boolean> = {}
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const next = rest[i + 1]
      if (next !== undefined && !next.startsWith('--')) {
        flags[key] = next
        i++
      } else {
        flags[key] = true
      }
    } else {
      positional.push(arg)
    }
  }
  return { command, positional, flags }
}

const HELP = `kb — sidanclaw knowledge base CLI

Usage:
  kb init [<dir>]                          Interactive wizard for a new KB
  kb init --from <src> [--out <dst>] [<dir>]   Migrate an existing markdown tree
  kb lint [<dir>]                          Audit KB hygiene (v0.2 stub)
  kb --help                                Show this help

Examples:
  kb init my-team-kb
  kb init --from ./docs --out ./team-kb
  kb lint ./my-team-kb

Docs: https://github.com/sidan-lab/sidanclaw-tools/tree/main/cli
`

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.command || args.flags.help || args.command === '--help' || args.command === '-h') {
    process.stdout.write(HELP)
    return
  }

  switch (args.command) {
    case 'init':
      await runInit(args.positional, args.flags)
      break
    case 'lint':
      await runLint(args.positional, args.flags)
      break
    default:
      process.stderr.write(`Unknown command: ${args.command}\n\n${HELP}`)
      process.exit(2)
  }
}

main().catch((err) => {
  process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
