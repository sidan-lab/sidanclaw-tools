/**
 * Template repository scaffold. Embedded so `kb init` works offline.
 * Source of truth lives at https://github.com/sidan-lab/sidanclaw-kb-template.
 *
 * Keep these in sync when the template repo changes (or rip them out and
 * shell out to `gh repo create --template` when gh is available).
 */

export const TEMPLATE_REPO = 'https://github.com/sidan-lab/sidanclaw-kb-template'
export const TEMPLATE_REPO_SLUG = 'sidan-lab/sidanclaw-kb-template'

export type TemplateFile = { path: string; content: string }

export function buildTemplateFiles(opts: { kbTitle: string; kbDescription: string }): TemplateFile[] {
  return [
    { path: 'README.md', content: README(opts) },
    { path: 'index.md', content: ROOT_INDEX(opts) },
    { path: 'meta/sensitivity.md', content: META_SENSITIVITY },
    { path: 'meta/tags.md', content: META_TAGS },
    { path: 'example/index.md', content: EXAMPLE_INDEX },
    { path: 'example/sub-entry.md', content: EXAMPLE_SUB_ENTRY },
    { path: '.gitignore', content: '.DS_Store\nnode_modules/\n*.log\n' },
  ]
}

const README = ({ kbTitle }: { kbTitle: string }) => `# ${kbTitle}

A [sidanclaw](https://ai.sidan.io) team knowledge base.

## Getting started

1. Edit \`meta/sensitivity.md\` to match your team's tier policy.
2. Edit \`meta/tags.md\` to set your tag vocabulary.
3. Replace the \`example/\` folder with real content.
4. In the sidanclaw web app, go to your team's settings → **Knowledge** → connect this repo.

## Authoring

See [\`sidan-lab/sidanclaw-kb-template\`](${TEMPLATE_REPO}) for the canonical authoring guide, or invoke the \`kb-author\` skill in any sidanclaw conversation.
`

const ROOT_INDEX = ({ kbTitle, kbDescription }: { kbTitle: string; kbDescription: string }) => `---
title: ${kbTitle}
description: ${kbDescription}
tags: [meta, index]
sensitivity: internal
---

Welcome to the ${kbTitle} knowledge base.

## Top-level areas

- [Example](example/index.md) — illustrative folder. Delete once you have real content.

## Meta

- [Sensitivity policy](meta/sensitivity.md)
- [Tag glossary](meta/tags.md)
`

const META_SENSITIVITY = `---
title: Sensitivity policy
description: Canonical guide for tagging entries with public, internal, or confidential. New entries should match this policy or update it in the same change.
tags: [meta, policy, sensitivity]
sensitivity: internal
---

Every entry must declare a \`sensitivity\` tier in its frontmatter. Default when omitted is \`internal\`.

## Tier definitions

### \`public\`

Safe for any assistant — including customer-facing bots — to read and quote externally. Use for product overviews, FAQs, public-API docs, marketing copy.

### \`internal\` (default)

Safe for the whole team. Not for external-facing output. Use for architecture docs, runbooks, planning notes, most engineering documentation.

### \`confidential\`

Restricted to assistants explicitly granted \`clearance: confidential\`. Use for: anything naming a customer, security-relevant material, vendor contract terms, vuln reports, financials, PII.

When in doubt between \`internal\` and \`confidential\`, pick \`confidential\`.

## Folder defaults

Document your team's per-folder defaults here, e.g.:

- \`security/\` → \`confidential\`
- \`customer/\` → \`confidential\`
- \`architecture/\` → \`internal\`
- \`public-api/\` → \`public\`
`

const META_TAGS = `---
title: Tag glossary
description: Canonical tag vocabulary used across this knowledge base. New entries should reuse these tags before inventing new ones.
tags: [meta, glossary]
sensitivity: internal
---

Aim for 3-6 tags per entry: one or two from "kind", one or two from "domain", optionally one or two free.

## Kind tags

- **spec** — architecture or behavioural specification
- **runbook** — operational steps for a recurring task
- **reference** — lookup material
- **decision** — a recorded decision with rationale
- **glossary** — term definitions
- **policy** — rules the team has agreed to follow
- **postmortem** — incident write-up
- **meta** — about the KB itself

## Domain tags

Edit to match your team:

- **product** — top-level product surfaces
- **infra** — infrastructure, deployment, observability
- **security** — auth, secrets, threat model
- **billing** — pricing, subscriptions, invoicing
`

const EXAMPLE_INDEX = `---
title: Example folder
description: Illustrative folder showing the index.md + sub-entry pattern. Delete once you have real content.
tags: [meta, example]
sensitivity: internal
---

Replace this folder with a real top-level area (e.g. \`products/\`, \`runbooks/\`, \`infra/\`).

## Sub-entries

- [Sub-entry](sub-entry.md) — example sub-entry
`

const EXAMPLE_SUB_ENTRY = `---
title: Example sub-entry
description: Demonstrates frontmatter and cross-linking. Delete with the rest of the example folder.
tags: [meta, example]
sensitivity: internal
related:
  - example/index
  - meta/sensitivity
---

This shows the typical sub-entry shape.

## Cross-linking

- Wikilinks: see [[example/index]] for the parent.
- Markdown links: read the [sensitivity policy](../meta/sensitivity.md).

External URLs (https://...) are ignored by the related-ref collector.
`
