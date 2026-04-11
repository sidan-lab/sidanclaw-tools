# sidanclaw-tools

Community connector registry for [sidanclaw](https://ai.sidan.io) — add your MCP server so every sidanclaw user can discover and connect it.

## How it works

`registry.json` contains an array of connector entries. sidanclaw loads this file at boot and surfaces the connectors in **Settings > Connectors > Browse Connectors** under the Community section.

## Adding a connector

1. Fork this repo
2. Add your entry to the `connectors` array in `registry.json`
3. Open a pull request

### Entry format

```json
{
  "id": "your-tool-id",
  "name": "Your Tool Name",
  "description": "Short description of what it does.",
  "icon_url": "https://example.com/icon.png",
  "mcp_url": "https://your-mcp-server.com/mcp",
  "auth_type": "none",
  "author": "Your Name",
  "author_url": "https://your-site.com",
  "tags": ["category", "tags"]
}
```

| Field | Required | Description |
|---|---|---|
| `id` | yes | Unique lowercase identifier |
| `name` | yes | Display name |
| `description` | yes | What the connector does (keep it under ~100 chars) |
| `mcp_url` | yes | Your MCP server endpoint |
| `auth_type` | yes | `"none"`, `"oauth"`, or `"api_key"` |
| `icon_url` | no | URL to a square icon (recommended) |
| `author` | no | Author or org name |
| `author_url` | no | Link to author's site |
| `tags` | no | Array of category tags for search/filtering |

## Requirements

- Your MCP server must be publicly reachable at the provided `mcp_url`
- The endpoint must follow the [Model Context Protocol](https://modelcontextprotocol.io) spec

## License

MIT
