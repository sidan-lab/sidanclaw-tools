# @sidanclaw/kb

CLI for initializing and migrating [sidanclaw](https://ai.sidan.io) knowledge bases.

## Install

```
npm install -g @sidanclaw/kb
# or invoke directly:
npx @sidanclaw/kb <command>
```

## Commands

### `kb init [<dir>]`

Initialize a new KB. Interactive wizard.

```
kb init my-team-kb
```

If the GitHub CLI (`gh`) is installed and authenticated, the wizard offers to create the GitHub repo from [`sidan-lab/sidanclaw-kb-template`](https://github.com/sidan-lab/sidanclaw-kb-template) directly. Otherwise it writes the skeleton locally and prints next steps.

### `kb init --from <source-dir> [--out <target-dir>] [<dir>]`

Migrate an existing markdown tree (e.g. an existing `docs/`) into KB form. Walks the source, generates frontmatter for each `.md`, infers `sensitivity` from path heuristics, and writes the result to `<target-dir>` (default: `<source-dir>-kb`).

```
kb init --from ./docs --out ./my-team-kb
```

Produces a `MIGRATION_REPORT.md` at the target listing every decision so the user can review before pushing.

### `kb lint [<dir>]`

Audit a KB for missing frontmatter, cross-tier body links, mixed-tier indices, and tag drift. **(v0.2 — currently a stub.)**

## Sensitivity heuristics

The migrator picks a default `sensitivity` per file based on path keywords. See `src/lib/sensitivity.ts` for the rules. Always review `MIGRATION_REPORT.md` before pushing — the heuristics are conservative but not infallible.

## License

MIT
