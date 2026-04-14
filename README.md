# sidanclaw-tools

Community connectors and skills for [sidanclaw](https://ai.sidan.io).

```
sidanclaw-tools/
├── connectors/
│   └── <name>/
│       └── connector.json
├── skills/
│   └── <name>/
│       ├── SKILL.md              # Required
│       ├── references/           # Optional
│       └── assets/               # Optional
└── README.md
```

---

## Skills

Skills follow the [Agent Skills Spec](https://agentskills.io/specification). sidanclaw-specific extensions live under `metadata`.

### SKILL.md format

```markdown
---
name: my-skill
description: What this skill does and when to use it.
license: MIT
compatibility: Designed for sidanclaw
metadata:
  author: your-name
  author_url: https://github.com/your-name
  category: productivity
  when_to_use: When the user asks for X
  requires_connectors: gcal,gmail
---

Instructions the assistant follows when this skill is activated...
```

### Required fields

| Field | Constraints |
|---|---|
| `name` | Lowercase, hyphens, max 64 chars. Must match directory name. |
| `description` | What it does + when to use it. Max 1024 chars. |

### Optional fields (Agent Skills Spec)

| Field | Description |
|---|---|
| `license` | License name or reference to LICENSE.txt |
| `compatibility` | Environment requirements (max 500 chars) |
| `allowed-tools` | Space-separated pre-approved tool names |

### sidanclaw metadata extensions

| Key | Description |
|---|---|
| `metadata.author` | Author name |
| `metadata.author_url` | Author URL |
| `metadata.category` | `productivity`, `communication`, `research`, or `custom` |
| `metadata.when_to_use` | When the model should invoke this skill |
| `metadata.requires_connectors` | Comma-separated connector IDs (e.g. `gcal,gmail`) |

### Example

`skills/daily-briefing/SKILL.md`:

```markdown
---
name: daily-briefing
description: Morning summary of calendar, emails, and tasks. Use when the user asks for a briefing or daily agenda.
metadata:
  author: sidanclaw
  category: productivity
  when_to_use: When the user asks for a briefing, morning summary, or daily agenda
  requires_connectors: gcal,gmail
---

When activated, gather the user's day at a glance:

1. Check today's calendar events
2. Check unread important emails from the last 12 hours
3. Present as a concise summary with 3-5 bullet points
```

### Progressive disclosure

1. **Listing** (~100 tokens): `name` + `description` shown each turn
2. **Activation** (< 5000 tokens): Full body loaded when the model invokes `useSkill`
3. **Resources**: Files in `references/` loaded on demand

Keep `SKILL.md` under 500 lines.

---

## Connectors

Connectors are [MCP](https://modelcontextprotocol.io) servers that add external service integrations.

### connector.json format

```json
{
  "id": "my-connector",
  "name": "My Connector",
  "description": "What this connector provides.",
  "icon_url": "https://example.com/icon.png",
  "mcp_url": "https://example.com/mcp",
  "auth_type": "none",
  "author": "your-name",
  "author_url": "https://github.com/your-name",
  "tags": ["category", "domain"]
}
```

### Fields

| Field | Required | Description |
|---|---|---|
| `id` | Yes | Unique identifier. Must match directory name. |
| `name` | Yes | Display name |
| `description` | Yes | What the connector provides |
| `mcp_url` | Yes | MCP server endpoint URL |
| `auth_type` | Yes | `none`, `oauth`, or `api_key` |
| `icon_url` | No | Square icon URL (min 64x64) |
| `author` | No | Author or organization name |
| `author_url` | No | Author URL |
| `tags` | No | Category tags for filtering |

### Example

`connectors/cgov/connector.json`:

```json
{
  "id": "cgov",
  "name": "Cardano Onchain Governance",
  "description": "Query proposals, DRep registrations, votes, and governance actions.",
  "icon_url": "https://app.cgov.io/favicon.ico",
  "mcp_url": "https://cgov-mcp-589811450826.asia-south1.run.app/mcp",
  "auth_type": "none",
  "author": "NOMOS",
  "author_url": "https://app.cgov.io",
  "tags": ["blockchain", "cardano", "governance"]
}
```

---

## Contributing

1. Fork this repo
2. Add your connector or skill in the appropriate directory
3. Follow the specs above
4. Submit a PR

## License

MIT
