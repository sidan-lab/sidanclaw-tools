export async function runLint(_positional: string[], _flags: Record<string, string | boolean>): Promise<void> {
  process.stderr.write(
    `kb lint is not implemented yet (planned for v0.2).\n\n` +
    `In the meantime, the kb-author skill ships a manual checklist (Step 6).\n` +
    `See: https://github.com/sidan-lab/sidanclaw-tools/tree/main/skills/kb-author\n`,
  )
  process.exit(2)
}
