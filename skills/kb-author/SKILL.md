---
name: kb-author
description: Convert internal documentation (architecture docs, specs, runbooks) into sidanclaw knowledge-base markdown entries that the assistant can search, browse, and cross-link. Use when the user wants to seed or extend a team knowledge base from existing docs (e.g. a `docs/` tree → a synced `*-kb` GitHub repo), author a new entry from scratch, or reorganize existing KB content.
license: MIT
compatibility: Designed for sidanclaw
metadata:
  author: sidanclaw
  category: productivity
  when_to_use: When the user wants to convert a `docs/` tree into KB entries, author a new KB entry, restructure an existing KB, or audit KB hygiene (missing summaries, broken wikilinks, stale tags). Skip when the user is asking general writing questions unrelated to the KB sync format.
  tags: official
---

# Knowledge Base Authoring

Author markdown files for a sidanclaw team knowledge base — the GitHub repo that the team-scoped sync worker mirrors into `knowledge_entries`. The assistant searches, browses, and cross-links these entries via the `searchKnowledge` / `browseKnowledge` / `readKnowledgeEntry` tools.

This skill teaches you the **target format the parser actually consumes** (frontmatter, path, wikilinks, sensitivity), and the **editorial decisions** that make a KB useful instead of a dumping ground.

## Fast paths — suggest these first

Before walking the user through hand-authoring everything, surface the two opinionated shortcuts:

- **For a brand-new KB:** point them at [`sidan-lab/sidanclaw-kb-template`](https://github.com/sidan-lab/sidanclaw-kb-template). One click on **Use this template** gives them a working skeleton with the right folder shape, a sensitivity policy stub, and a tag glossary stub. They edit the meta files, push, and connect in team settings.
- **For migrating an existing `docs/` tree:** suggest `npx @sidanclaw/kb init --from ./docs`. The wizard generates frontmatter, picks default sensitivity per file using path-based heuristics, and produces a review report — much faster than file-by-file authoring.

Use the rest of this skill when those shortcuts don't fit (e.g. authoring a single new entry into an existing KB, restructuring an existing tree, or auditing hygiene).

## What this skill does NOT do

- **Run the sync worker.** Pushing to the synced repo is enough — the worker polls every 15 minutes. If you need an immediate sync, ask the user to trigger it from the team settings page.
- **Edit a live entry directly via API.** When a team has a connected source repo, the in-app `addKnowledgeEntry` tool is disabled — the repo is the source of truth. Always edit the repo.
- **Replace memories.** Memories are per-user behavioral signal (what *this user* prefers). The KB is shared, curated truth (what the team *knows*). Don't migrate memories into KB entries; the consolidation dedup layers prevent the assistant from mirroring KB facts back into memories anyway.
- **Decide repo wiring.** Repo URL, branch, and root path are configured in team settings — not in this skill.
- **Set assistant `clearance`.** Clearance is configured per-assistant in the assistant detail page. The skill author chooses each entry's `sensitivity`; an operator decides which assistants get to see which tiers. Two different jobs.
- **Enforce emit guards.** sidanclaw's sensitivity model is read-side and write-stamp only. There is no automatic "do not output `confidential` content to a public channel" guard — the operator wires audiences correctly when assigning channels and connectors. Don't pretend otherwise to the user.

## Mental model

| Layer | Lives in | Lifecycle | Who reads it |
|---|---|---|---|
| **Knowledge base** | A GitHub repo, mirrored into `knowledge_entries` | Curated, edited via PRs, rarely decayed, team-scoped | Any assistant whose `clearance` ≥ the entry's `sensitivity` |
| **Memory** | `memories` rows | Organic, per-user, scored, decayed over time | The owning user's assistants only, filtered by clearance |
| **Session** | `session_messages` | Ephemeral conversation buffer | Only the session participants |

Rule of thumb: if it's a *fact about the product/team that two people would write the same way*, it belongs in the KB. If it's *something this user prefers*, it's a memory. If it's *what we're talking about right now*, it's session.

## The target format

The parser is `packages/core/src/knowledge/parser.ts`. It is deterministic — no LLM. Three tiers:

1. **Tier 1 (preferred)** — YAML frontmatter present.
2. **Tier 2** — no frontmatter but body has `[text](path.md)` links → those become related refs.
3. **Tier 3 (fallback)** — bare file → title from first `#` heading (or filename), summary `null`, no tags, no related.

Always aim for Tier 1. The skill below assumes Tier 1.

### Frontmatter fields the parser reads

| Field | Type | Goes to | Notes |
|---|---|---|---|
| `title` | string | `entries.title` | Display title. Falls back to first `#` heading, then filename. |
| `description` | string | `entries.summary` | One-line summary, ~50 tokens. Shown in `browseKnowledge` listings. |
| `tags` | array OR comma-string | `entries.tags` | Used in FTS weighting (B-band) and for filtering in UI. |
| `related` | array of strings | `entries.related_ids` (after wikilink resolution) | Paths to other entries. Same syntax as wikilinks below. |
| `sensitivity` | enum (`public` / `internal` / `confidential`) | `entries.sensitivity` | Access tier. Defaults to `internal` if absent. Controls which assistants can read the entry — see "Decide the sensitivity" in Step 3. |
| _any other key_ | scalar | `entries.metadata` JSONB | Free-form: `status`, `owner`, `last_reviewed`, `slack_channel`, etc. |

The parser is tolerant but limited:

- Only **flat keys** (no nested objects). `owner: alice` works; `owner: { name: alice }` does not — it gets stringified.
- **Inline arrays** `[a, b, c]` and **block arrays** (`-` items on the next lines) both work.
- **Booleans** (`true`/`false`) and **numbers** are typed correctly.
- Quoted strings are unquoted.

### Path & filename rules

| Filesystem | KB path | Notes |
|---|---|---|
| `products/vault/fees.md` | `products/vault/fees` | `.md` stripped |
| `products/vault/index.md` | `products/vault` | `index.md` IS the directory's entry — there is no separate parent |
| `index.md` (root) | `index` | Single-segment fallback |
| `Products/Vault/Fees.md` | (case preserved) | Path lookup is case-sensitive — pick a casing convention and stick to it; lowercase-kebab is conventional |

**One file = one entry.** There is no concept of multiple entries per file. Split sections into siblings when they want their own URL.

## Sensitivity tiers

Every entry carries a `sensitivity` tier. Three levels, hierarchical:

| Tier | Rank | Used for |
|---|---|---|
| `public` | 1 | Customer-facing material — FAQs, public-API docs, marketing copy. Safe for any assistant to quote externally. |
| `internal` | 2 (default) | Most engineering documentation — architecture, runbooks, planning notes. Safe team-wide. |
| `confidential` | 3 | Anything naming customers, security-relevant material, contract terms, vuln details, financials, PII. |

Two enforcement mechanisms back this up — both already shipped:

1. **Read filter** — every store query adds `WHERE sensitivity_rank(sensitivity) <= sensitivity_rank($clearance)`. Above-clearance rows are invisible. The `related_ids` array is *also* filtered, so a confidential sibling can't be enumerated via the related list.
2. **Write stamp** — when the model writes a memory or KB entry inside a session, the row inherits `max(accumulator, requested)` — the highest tier the model saw that turn. Prevents downgrade laundering. *This stamp does not apply to repo-driven authoring*: when you commit markdown to the synced repo, the parser reads `frontmatter.sensitivity` literally. The frontmatter is the source of truth.

**The `related_ids` filter is structural, not lexical.** That matters: a `public` entry whose body contains a wikilink `[[security/key-rotation]]` will render the path string `security/key-rotation` to a public-cleared reader, even though the resolved entry is hidden. The filter only protects the structured related list. **When you cross tiers, prefer `frontmatter.related[]` over body links.** See "Cross-linking" below for the full rule.

**Default behavior:** when `sensitivity:` is absent, the parser uses `internal`. This is safer than `public` for most engineering content but it means **forgetting to set the field is itself a decision**. Make it consciously, especially for content that could be confidential.

**Defining the policy:** every team should commit a `meta/sensitivity.md` entry that says "in our KB, X folder is `confidential`, Y folder is `internal`, Z folder is `public`." The template repo ships a starter you can adapt. With a written policy, per-file decisions become lookups instead of judgment calls.

For the canonical 5-assistant team pattern (Fundraising / Triage / Marketing / Research / CS) and the full design rationale, see `docs/architecture/platform/sensitivity.md` in the sidanclaw repo.

### Cross-linking — wikilinks vs. markdown links

The parser collects related refs from three places: `frontmatter.related[]`, body wikilinks `[[...]]`, and standard markdown links `[text](path.md)`. After Pass 1 of the sync worker resolves all entries, Pass 2 walks each entry's related refs and resolves them to UUIDs in `related_ids`.

Resolution order for a wikilink target:

1. **Exact path match** against the path index (e.g. `[[products/vault/fees]]` → entry at `products/vault/fees`).
2. **Relative-from-current-file** (e.g. inside `products/vault/index.md`, `[[../perpetual-futures/index]]` → `products/perpetual-futures`).
3. **Filename search** in the index (e.g. `[[vault-spec]]` → first entry whose path ends in `vault-spec`).

Three wikilink formats:

```markdown
[[products/vault/index|Vault]]    # absolute path with display alias
[[../perpetual-futures/index]]    # relative from this file
[[vault-spec]]                    # bare filename — searches the index
```

Standard markdown links to `.md` files also become related refs (and survive as clickable links in the UI):

```markdown
See the [fee schedule](../vault/fees.md) for current rates.
```

Prefer markdown links when you want the rendered text to be different from the path; prefer wikilinks for terse internal cross-references.

External links (`http://`, `https://`) are ignored for related-ref purposes.

**Cross-tier cross-linking:** the `related_ids` filter strips above-clearance UUIDs from query results, but the body text of an entry renders as-is. So:

- If you want a cross-tier reference *with no path leakage*, put the target in `frontmatter.related[]`. The filter applies; lower-cleared readers see no trace.
- If you put the link in the body (`[[security/key-rotation]]` or `[Key rotation](security/key-rotation.md)`), the path string is visible to anyone who can read the body — even though the target itself is filtered. Sometimes that's fine (you're OK exposing the path), sometimes it's a leak.
- An `index.md` for a mixed-tier folder must be **at least as restrictive as anything its body lists by name**. If `products/index.md` lists a `confidential` sub-entry inline, the index has to be `confidential` too — or omit that sub-entry from the body and let `browseKnowledge`'s children query handle discovery (which respects the filter).

## The `index.md` convention

Every directory should have an `index.md`. It is:

- The entry that browsers land on when they open that directory.
- The canonical "what is this folder" answer.
- The natural target for `[[products/vault]]` (which resolves to `products/vault/index`).

A good `index.md`:

```markdown
---
title: Vault Product
description: Yield-generating product family. Sub-entries cover fees, custody model, and supported chains.
tags: [product, vault]
related:
  - perpetual-futures/index
---

The vault product accepts user deposits and routes them to a curated set of strategies...

## Sub-entries

- [Fees](fees.md) — fee schedule and rebate tiers
- [Custody](custody.md) — how funds are held
- [Supported chains](chains.md) — current chain coverage
```

Without `index.md`, browsing a directory shows children but no orientation.

## Authoring workflow — converting an existing `docs/` tree

If you can use `npx @sidanclaw/kb init --from ./docs`, do that — it automates Steps 1-3 and leaves you a review report. The steps below are for when the wizard isn't an option (no Node, novel doc layout, custom rules).

When the user points at a `docs/` directory and says "make this the team KB", do the following.

### Step 1 — Survey what's there

Read `docs/INDEX.md` (or equivalent top-level index). Most well-organized doc trees already have a folder taxonomy — preserve it. List every `.md` file and bucket each one as:

| Bucket | Action | Default sensitivity |
|---|---|---|
| **Spec / architecture / reference** | → KB. The bulk of useful KB content. | `internal` |
| **Workflow / process** | → KB if team-relevant; skip if it's purely "how Claude Code sessions behave". | `internal` |
| **Security / auth / secrets / threat model** | → KB but think carefully — usually `confidential`, especially anything naming key material, vendor secrets, or vuln reports. | `confidential` |
| **Customer-facing / public API / product overview** | → KB. Often `public`, but only if you'd be comfortable seeing it on a public docs site. | `public` |
| **Plans / proposals (not yet built)** | → Skip, OR convert with `status: proposed` in frontmatter and a clear callout. The KB should not mislead readers into thinking unbuilt features are live. | `internal` |
| **Historical / archived** | → Skip. Do not migrate "do not trust" docs into the KB — confuses search results. | — |
| **Research / external notes** | → Skip unless the team explicitly wants them browsable. They tend to be long, citation-heavy, and noisy in FTS. | `internal` |
| **Per-package `CLAUDE.md`** | → Skip. These are session pointers; they duplicate architecture docs and add noise. | — |
| **Incident postmortems / customer accounts / contracts** | → KB if the team wants them searchable. Always `confidential`. | `confidential` |

If the user disagrees with a bucket, follow their call — these are defaults, not laws.

### Step 2 — Decide the path mapping

Default: mirror the source tree. `docs/architecture/features/knowledge-base.md` → `architecture/features/knowledge-base.md`. Numeric prefixes (`docs/architecture/31-knowledge-base.md`) are noise — strip them when copying so paths are stable across reorderings.

If the source has multiple parallel taxonomies (e.g. `architecture/`, `workflow/`, `plans/`), surface them as top-level KB folders. Don't flatten — depth helps `browseKnowledge` stay readable.

Always create a root `index.md` summarizing what this KB covers and who it's for.

### Step 3 — Add frontmatter to every file

If a source doc has no frontmatter, add it. At minimum:

```yaml
---
title: <Display Title>
description: <One sentence — what this entry is about. Keep under 200 chars.>
tags: [<3-6 tags>]
---
```

**Title.** If the file's first heading is good, use that. Otherwise rewrite — titles show up in search results and tool listings, so make them scannable. "Knowledge Base" is fine; "31 — Knowledge Base" is not (numeric prefix is internal ordering, not part of the name).

**Description.** This is what `browseKnowledge` and `searchKnowledge` show in the listing. It is the single highest-leverage field. Bad: "Documentation for the knowledge base feature." Good: "How team-shared markdown repos sync into searchable knowledge entries, with the four built-in tools the assistant uses to query them." Lead with the *thing*, then the *what-for*. Avoid "this document describes..." — wasted tokens.

**Tags.** Use 3–6. Mix two axes: (a) **kind** — one of `spec`, `runbook`, `reference`, `decision`, `glossary`; (b) **domain** — product/area names (`memory`, `billing`, `telegram`). Tags get FTS B-band weight, so they help retrieval, but only if they're consistent. Maintain a tag glossary entry — see Step 5.

**Optional metadata** worth adding when known:

```yaml
status: stable        # stable | proposed | deprecated
owner: alice          # who to ping
last_reviewed: 2026-04-20
source: docs/architecture/features/knowledge-base.md   # where this was migrated from
```

`status: deprecated` entries should usually not be migrated at all — but if there's a strong reason to keep them visible (e.g. a known-bad pattern that searches keep surfacing), the field lets the UI render a banner.

#### Decide the sensitivity

The frontmatter field `sensitivity` is the access-control knob for this entry. Three choices, hierarchical:

```yaml
sensitivity: public         # any assistant can read
sensitivity: internal       # team-wide; the default if you omit the field
sensitivity: confidential   # only assistants with clearance: confidential
```

**Heuristics for picking the tier**, in order of precedence:

1. **If a customer-facing assistant might quote this back to a customer**, ask: *would I be OK with the customer seeing it?* If no → at least `internal`. If it names another customer → `confidential`.
2. **Does it identify a real customer, contract counterparty, or named individual outside the team?** → `confidential`.
3. **Is it security-relevant** (auth flow, key rotation, secret handling, vuln details, threat model)? → `confidential`.
4. **Does it name internal infrastructure that's not public** (GCP project IDs, internal hostnames, private API endpoints, vendor account IDs)? → `confidential`.
5. **Is it something you'd publish on a public docs site as-is**? → `public`. If you hesitate, → `internal`.
6. **Otherwise** → `internal` (the default).

When genuinely uncertain between `internal` and `confidential`, pick `confidential`. An over-restricted entry is recoverable (downgrade in a later PR); an under-restricted one already leaked.

The team's canonical policy lives in `meta/sensitivity.md` — if that entry exists, follow it. If your decision contradicts the policy, update the policy in the same PR rather than diverging silently.

**Declassifying an entry is just a frontmatter edit + push** — the sync worker overwrites the DB column on the next tick. No DB surgery needed. (Reclassification *upward* is just as easy, but the data was already exposed during the window before the change synced — treat it as a leak, not a re-do.)

See [`docs/architecture/platform/sensitivity.md`](../../../docs/architecture/platform/sensitivity.md) for the full enforcement model (read filter + write stamp).

### Step 4 — Rewrite cross-references

The most common source of broken KB content is link rot from migration. For every link in the body:

- **Internal `.md` link to a doc you're migrating** → rewrite the path to the new KB path. Drop the `.md` extension only inside wikilinks; keep it inside markdown links (the parser handles both).
- **Internal `.md` link to a doc you're NOT migrating** → either migrate that doc too, replace with prose, or leave the link with a comment noting the gap. A wikilink that doesn't resolve becomes a no-op related ref — silent. Prefer prose if there's nothing to point at.
- **Path to source code** (`packages/core/src/...`) → keep as-is. The KB is read alongside the code; engineers will recognize paths. Do NOT convert these to wikilinks.
- **External URLs** → keep as-is.

Run a final pass with grep to catch leftover `docs/...` paths that should now be KB-relative.

### Step 5 — Author the meta glossaries

Two meta entries pay for themselves many times over:

#### `meta/sensitivity.md`

Encodes the team's tier policy so future authors don't have to re-derive it. Lists which folders default to which tier, and gives illustrative examples per tier. The template repo ships a starter — adapt it to your team. Without this, `sensitivity` decisions drift over time and nobody knows the policy.

#### `meta/tags.md`

Canonical tag vocabulary. Without this, tags drift (`vault`, `vaults`, `vault-product`) and search becomes worse over time. The template repo ships a starter — it lists kind tags (`spec`, `runbook`, `reference`, `decision`, `glossary`, `policy`, `postmortem`, `meta`) and a domain-tag stub that adopters customize.

Together these two entries are the highest-ROI single thing to write. They prevent drift, make search predictable, and serve as the reviewer checklist for new entries.

### Step 6 — Audit before committing

If the `kb lint` CLI is available, run `npx @sidanclaw/kb lint` — it automates most of the checks below. Otherwise verify manually:

**Structure:**
- [ ] Every directory has an `index.md`.
- [ ] Every entry has `title`, `description`, and at least one tag.
- [ ] No file uses a numeric or date prefix in the filename (`01-`, `2026-`).
- [ ] Root `index.md` orients a new reader: what this KB is, who it's for, where to start.

**Cross-references:**
- [ ] Wikilinks resolve — for each `[[target]]`, confirm a file exists at `target.md` or `target/index.md`, OR confirm a relative resolution will succeed.
- [ ] No `docs/...` paths remain in the body (would link out of the KB).
- [ ] Tag glossary covers every tag actually used.

**Sensitivity:**
- [ ] Every entry has explicit `sensitivity`, OR you have consciously accepted `internal` as the default for it (don't let omission be a silent decision for content that could be confidential).
- [ ] No body wikilink/markdown-link from a lower-tier entry to a higher-tier target *that you didn't intend to expose as a path string*. (The structured related list is filtered; the body text is not.)
- [ ] Every `index.md` is at least the highest tier of any sub-entry it lists by name in body text.
- [ ] No `confidential`-shaped strings (customer names, GCP project IDs, internal hostnames, vendor account IDs, employee names) in `public` or `internal` entries' bodies.

**Hygiene:**
- [ ] No deprecated content migrated. (If migrated for visibility, it has `status: deprecated`.)
- [ ] No secrets, tokens, or `.env` content. Sensitivity gates *who can read* but committed secrets are still secrets — operators rotate keys, not repos.

A 50-file PR with these checks done is far more useful than a 200-file PR without.

## Authoring a single new entry

When the user says "add an entry for X":

1. **Pick the path.** Walk the existing tree first — `browseKnowledge` or read the repo. If a parent already exists (`products/vault/`), drop the new entry there. If you're creating a new branch of the tree, also create its `index.md` in the same change.
2. **Write title + description first.** Both are visible in listings; both are what the model sees during retrieval *before* it reads the full body. They are the entry's hook. Spend the disproportionate effort here.
3. **Body structure.** Lead with the *what & why* in 2–3 sentences. Then the *how / details*. Section headings (`##`) are fine and improve readability — they don't change parsing.
4. **Cross-link generously.** Every concept that has its own entry should be linked. Wikilinks are cheap and the assistant uses `related_ids` heavily during browse.
5. **Don't repeat the source code.** Link to it (`packages/core/src/...`). The KB is *about* the system, not a copy of it.

## Hygiene & maintenance prompts

These are common follow-up jobs the user might ask for once a KB exists. Each is a one-shot pass.

| Job | What to do |
|---|---|
| "Find missing summaries" | Grep the repo for files where frontmatter `description` is absent or empty. List them. |
| "Find broken wikilinks" | For every `[[target]]`, check whether `target.md`, `target/index.md`, or a file ending in `target.md` exists. Report unresolved. |
| "Audit tag drift" | Collect all distinct tags used; diff against `meta/tags.md`. Surface tags used once or with near-duplicates (`vault`, `vaults`, `vault-product`). |
| "Audit sensitivity drift" | Grep `public` and `internal` entries for confidential-shaped strings (customer names, GCP project IDs, internal hostnames, vendor account IDs, employee names, contract counterparties). List candidates for re-tiering. Cross-check against `meta/sensitivity.md` policy. |
| "Find cross-tier body links" | For each entry, scan body wikilinks/markdown-links to other entries. Flag any whose target tier exceeds the source tier — these leak the path string to lower-cleared readers. |
| "Audit mixed-tier indices" | For each `index.md`, check the tier of every sub-entry listed by name in its body. If any sub-entry has a higher tier than the index, the index needs to be raised (or the body listing needs to drop that name). |
| "Detect deprecated content still surfacing" | Find entries with `status: deprecated`. Confirm whether they should still be in the repo at all. |
| "Find orphans" | List entries that no other entry links to. Many will legitimately be leaves — but a top-level orphan is usually a missing nav fix. |

Each of these is a small PR. Bundle them only if the user asks. Most are automated by `kb lint` once the CLI lands — call out which job the user could automate, in case they want to script it instead of one-shot it.

## Common pitfalls to avoid

1. **Writing for the model, not for humans.** The KB is read by both. If your description reads like prompt-engineering, rewrite it as documentation.
2. **Migrating `historical/` or `archive/` content.** "Do not trust" docs become "trust this" once they're in the KB. Skip unless explicitly told otherwise.
3. **Per-package `CLAUDE.md` files in the KB.** They are session pointers, not knowledge. They duplicate architecture docs and confuse search.
4. **One giant `everything.md`.** Defeats `browseKnowledge`. Split aggressively — each topic gets its own file.
5. **Using `[link](https://github.com/.../docs/foo.md)` for internal refs.** External URLs are NOT collected as related refs and don't survive repo-internal moves. Use wikilinks or relative paths.
6. **Numeric prefixes in filenames.** `31-knowledge-base.md` becomes the path `31-knowledge-base`, which is ugly in URLs and search results, AND brittle to reordering. Strip them.
7. **Frontmatter with nested objects.** The parser flattens them. Use flat scalars or arrays only.
8. **Inventing tags freely.** Every new tag should either match `meta/tags.md` or be added to it in the same change.
9. **Dropping `index.md` in a non-empty directory.** Without it, browsers see children but no orientation. Even a 3-line `index.md` is better than none.
10. **Forgetting the root `index.md`.** It's the entry point. A KB without one feels uninhabited.
11. **Bulk-migrating internal docs without marking confidential ones.** Auto-default-`internal` is safe, but migration is exactly when mis-classification gets baked in. If even 5% of a doc tree is confidential (investor material, security runbooks, HR), scan for those first and mark them explicitly before opening the PR.
12. **Downgrading sensitivity to "make search work".** If a customer-facing assistant can't find what it needs, the answer is *raise its `clearance`* (in assistant settings) or *split the entry* into a public summary + a confidential body — not lower the tier of the whole entry. Lowering tier to fix a search miss is the most common laundering path.
13. **Treating `metadata.sensitivity` as the field.** It's a top-level frontmatter key, not part of the generic `metadata` JSONB. The parser special-cases it. Putting it under a `metadata:` block does nothing.
14. **Confidential body content in a public-tier index.** A `public` `index.md` whose body lists `[Customer X incident](customer-x-incident.md)` leaks the customer name in the link text, even if the target file is `confidential` and filtered. Treat link text as user-readable content, not a structured pointer.
15. **Assuming the `addKnowledgeEntry` write stamp protects repo authoring.** It doesn't. The accumulator-based write stamp only fires when the *model* writes via the in-app tool. When you commit markdown to the synced repo, the parser reads `frontmatter.sensitivity` literally and the DB row is whatever you wrote. There is no guardrail at sync time.

## When to skip this skill

- The user is editing the system prompt, building a new tool, or working on the assistant runtime — that's product code, not KB authoring.
- The user wants to save a personal preference for the assistant — that is a memory, not a KB entry.
- The user is asking how to *use* the KB tools (`searchKnowledge` etc.) — point them at `docs/architecture/features/knowledge-base.md` instead.
- The user wants to wire up sync — that's a team-settings flow in the web app, not an authoring task.
