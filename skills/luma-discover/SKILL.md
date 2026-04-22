---
name: luma-discover
description: Discover upcoming events on Luma (lu.ma) by city, category, or topic. Use when the user asks for meetups, events to attend, or community gatherings — especially in tech, AI, climate, crypto, arts, fitness, or food/drink. Returns event names with registration URLs the user opens to RSVP. Supports both a curated top-picks answer (default) and a comprehensive full-list mode when the user pushes for breadth.
license: MIT
compatibility: Designed for sidanclaw
metadata:
  author: sidanclaw
  category: research
  when_to_use: When the user asks "any AI/climate/crypto/tech meetups in <city>?", "what's happening on Luma this week?", "find events about <topic>", wants a "full list" / "everything on" for a city+topic, or asks for "more" after a curated answer. Skip when the user is asking about events they already RSVPed to (those flow through Google Calendar).
---

# Luma Event Discovery

Luma (lu.ma) is the dominant platform for tech, AI, climate, crypto, arts, fitness, and food/drink community events worldwide. It exposes a public, unauthenticated discovery JSON endpoint that returns the same data its own frontend consumes.

This skill teaches you how to query that endpoint via `urlReader`, with a `webSearch` fallback when the API is unreachable.

## What this skill does NOT do

- **Programmatic RSVP** — you cannot register a user for an event. Always hand the user the `lu.ma/<slug>` URL and tell them to tap it.
- **Manage existing attendance** — events the user has already RSVPed to land in their Google Calendar via the Luma confirmation email. If the user asks about *their* upcoming events, use Google Calendar tools, not this skill.
- **Search past events** — the discovery endpoint is forward-chronological by default; do not try to query past events.

## The endpoint

```
GET https://api.lu.ma/discover/get-paginated-events?pagination_limit=N&discover_place_api_id=...&discover_category_api_id=...
```

Use `urlReader` to fetch this URL. The response is JSON with shape:

```jsonc
{
  "entries": [
    {
      "event": {
        "name": "...",
        "url": "abc12345",                  // append to "https://lu.ma/" for the registration link
        "start_at": "2026-05-01T18:00:00Z",
        "end_at": "...",
        "timezone": "Asia/Singapore",
        "cover_url": "...",
        "location_type": "in_person" | "online",
        "geo_address_info": { "city": "...", "country": "..." }
      },
      "calendar": { "name": "...", "slug": "..." },   // the host's Luma calendar
      "hosts": [{ "name": "..." }],
      "guest_count": 87
    }
  ],
  "has_more": true,
  "next_cursor": "..."
}
```

## Param rules — read carefully

**These are the ONLY params that work:**

| Param | Notes |
|---|---|
| `pagination_limit` | Soft-cap ~45. Use 10–20 for chat answers. |
| `pagination_cursor` | Opaque token from prior response's `next_cursor`. Use only if the user wants more results after seeing the first page. |
| `discover_place_api_id` | Must be a `discplace-...` ID from the city catalog below. |
| `discover_category_api_id` | Must be a `cat-...` ID from the category catalog below. |

**TRAP PARAMS — never use these.** The server returns HTTP 200 with the *unfiltered* baseline result if you pass them, which makes it look like filtering is working when it isn't:

`city`, `category`, `category_slug`, `category_api_id`, `period`, `start_date`, `end_date`, `tag`, `q`, `query`

If the user wants date filtering or free-text search, do it **after** fetching by filtering the `entries` array yourself.

## City catalog

**Bootstrapping is the default path.** Only three cities are pre-verified below; anything else requires a one-shot lookup (fast — one fetch).

| City | `discover_place_api_id` |
|---|---|
| Singapore | `discplace-mUbtdfNjfWaLQ72` |
| New York | `discplace-Izx1rQVSh8njYpP` |
| Tokyo | `discplace-9H7asQEvWiv6DA9` |

### Bootstrapping a new city

The Luma discover page embeds the ~78-city catalog in a `<script id="__NEXT_DATA__">` JSON block. Fetch the raw HTML and grep out the `discplace-*` id.

**Gotchas — both matter:**
- `lu.ma/*` 301-redirects to `luma.com/*`. Hit `https://luma.com/...` directly to skip the redirect hop.
- Summarizing fetchers (e.g. `urlReader`, `WebFetch`) strip `<script>` tags. Use a raw-HTML fetch — `curl` via bash works — so the `__NEXT_DATA__` block survives.

**Fast path** (slug known or guessable): fetch `https://luma.com/<slug>` and grep `discplace-[A-Za-z0-9]*`. The id appears many times on the page. City slugs are lowercase, no spaces or punctuation (e.g. `london`, `berlin`, `saopaulo`, `hongkong`).

```bash
curl -s "https://luma.com/${CITY_SLUG}" | grep -o 'discplace-[A-Za-z0-9]*' | head -1
```

**Full path** (slug unknown): fetch `https://luma.com/discover` and parse `props.pageProps.initialData.places` from `__NEXT_DATA__` — an array of `{ api_id, slug, name }` objects. Match by case-insensitive name or slug.

Cache the resolved id mentally for the rest of the conversation. If you still cannot resolve the city, omit `discover_place_api_id` and tell the user "I couldn't filter to <city>, here are general results — let me know if you want me to look up something more specific."

## Category catalog

| Topic | `discover_category_api_id` | Notes |
|---|---|---|
| Tech | `cat-tech` | Software, hardware, general tech meetups |
| AI | `cat-ai` | LLMs, ML, AI builder events |
| Climate | `cat-climate` | Climate tech, sustainability |
| Crypto | `cat-crypto` | Web3, blockchain, DeFi |
| Food & Drink | `cat-fooddrink` | Tastings, supper clubs |

Three categories — Arts, Fitness, Wellness — have non-slug `api_id`s that change. If the user asks for one of those, bootstrap from `__NEXT_DATA__` (`props.pageProps.initialData.categories`) the same way as cities.

## Workflow

### Step 1 — Parse the request

Identify four things from the user's message:

1. **City** (if mentioned) — match against the catalog above.
2. **Category/topic** (if mentioned) — match against the catalog above.
3. **Free-text refinement** (e.g. "Rust", "for beginners", "in Mandarin") — keep this aside for client-side filtering.
4. **Mode** — `curated` (default) vs `comprehensive`. Pick `comprehensive` when any of these signals are present:
   - Explicit breadth cues: "full list", "all", "everything", "complete", "comprehensive", "entire", "every", "list them all", "show me all".
   - Follow-up after a prior curated answer in this conversation: "more", "what else", "keep going", "anything else", "next page", "continue", "expand".
   - The user asking to compare or scan for planning ("I want to plan my week", "help me pick", "show me what's on").

   Default to `curated` for first-turn requests like "any AI meetups in Singapore?" — users scanning for one-or-two-to-RSVP are better served by a short, highly readable list.

If neither city nor category is provided and the user isn't asking globally, ASK before fetching. A bare "find me events" returns a worldwide grab bag that wastes a turn.

### Step 2 — Build the URL

Choose `pagination_limit` from mode:

- `curated` → `pagination_limit=15`
- `comprehensive` → `pagination_limit=45` (the soft cap — bigger values are silently clamped)

If this is a **pagination follow-up** (user already saw page 1 and is asking for "more" / "next page"), also append `pagination_cursor=<next_cursor>` from the prior response. The cursor is opaque — pass it verbatim.

Example (comprehensive, page 1):

```
https://api.lu.ma/discover/get-paginated-events?pagination_limit=45&discover_place_api_id=discplace-mUbtdfNjfWaLQ72&discover_category_api_id=cat-ai
```

Example (comprehensive, page 2):

```
https://api.lu.ma/discover/get-paginated-events?pagination_limit=45&pagination_cursor=<token>&discover_place_api_id=discplace-mUbtdfNjfWaLQ72&discover_category_api_id=cat-ai
```

### Step 3 — Fetch via `urlReader`

Call `urlReader({ url: "<the URL>" })`. The response will be JSON-as-text — parse the `entries` array.

If `urlReader` returns an error or the response isn't valid JSON (Cloudflare may occasionally rate-limit), proceed to Step 5 (fallback).

### Step 4 — Filter and present

**Date filtering.** The API returns forward-chronological entries with no `period`/`start_date` params, so handle "this week", "tomorrow", "next weekend" client-side against `event.start_at` (ISO-8601, UTC with `Z` suffix). Convert to the user's timezone before bucketing by day — a 6pm PT event shows `start_at` as the next UTC day.

Example — "this week" (Mon–Sun, in the user's timezone):

```python
from datetime import datetime, timedelta, timezone
user_tz = timezone(timedelta(hours=<offset>))  # derive from user locale / city
now = datetime.now(user_tz)
week_start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
week_end = week_start + timedelta(days=7)

def in_week(e):
    dt = datetime.fromisoformat(e['event']['start_at'].replace('Z', '+00:00')).astimezone(user_tz)
    return week_start <= dt < week_end

entries = [e for e in entries if in_week(e)]
```

For "today" / "tomorrow" / "this weekend", adjust the window accordingly. If the user didn't give a date hint, skip this step — they probably want the next ~15 events regardless of date.

**Free-text refinement.** If the user gave one (e.g. "Rust", "for beginners"), filter by case-insensitive substring match over `event.name` and `calendar.name`.

Pick the output shape from mode:

**Curated mode — top 5–8 events, rich format:**

```
📅 [Event Name]
   📍 [city] • [day/time in user's timezone if known, else event timezone]
   👥 hosted by [host names] • [guest_count] going
   🔗 https://lu.ma/[event.url]
```

**Comprehensive mode — every entry that survived filtering, compact one-line format:**

```
📅 [day/time] — [Event Name] — [city or "online"] — [host] — https://lu.ma/[event.url]
```

Group by day when the range spans more than ~3 days (e.g. `### Thu May 1` headers). Skip group headers for short windows like "this weekend".

Always include the full `https://lu.ma/<event.url>` URL — that is the user's registration link. Do not shorten.

**Closing offer — match it to the mode and the pagination state:**

- After a **curated** answer: "Want the full list, narrower by topic/date, or a different city?"
- After a **comprehensive** answer where `has_more: true`: "That's page 1 (N events). Want the next page, or should I narrow this down?"
- After a **comprehensive** answer where `has_more: false`: "That's everything on Luma matching your filters. Want to widen the city/topic or try a neighbouring category?"

### Step 4b — Handle pagination follow-ups

When the user asks for "more" / "next page" / "keep going" after a comprehensive answer:

1. Reuse the exact same filters from the prior fetch (same `discover_place_api_id` and `discover_category_api_id`).
2. Append `pagination_cursor=<next_cursor>` from the prior response.
3. Keep `pagination_limit=45`.
4. Present in the same compact format; continue any day grouping from the previous message (don't restart the day headers mid-stream).
5. Stop when `has_more: false` — tell the user that was the last page.

If the user pushes past ~3 pages without narrowing, suggest adding a filter ("There are a lot — want me to narrow to AI or to this weekend?"). The goal is a useful answer, not a firehose.

### Step 5 — webSearch fallback

If the API path fails, call `webSearch({ query: "site:lu.ma <topic> <city> 2026" })`, then `urlReader` the most relevant `lu.ma/...` URLs to extract event details from the SSR'd pages (each event page has Open Graph metadata in the HTML head). Present the same way as Step 4.

## Output shape — what to tell the user

For each event include: name, location (city or "online"), start time in the user's timezone if you know it (otherwise the event's timezone), host name(s), and the URL. In curated mode, keep guest count if it's notable (e.g. "143 going" signals a high-demand event); in comprehensive mode, drop guest count to keep lines scannable.

Be honest about what you couldn't resolve. If the user said "Lisbon" and you couldn't find it in the catalog, say so, return unfiltered global results, and suggest they confirm the spelling or try a different city.

## Common pitfalls to avoid

1. **Using trap params.** If you pass `city=Singapore` instead of `discover_place_api_id=discplace-mUbtdfNjfWaLQ72`, the API returns the global baseline and the user thinks you searched Singapore. Always use the `discover_place_api_id` form.
2. **Inventing api_ids.** If you don't know a city's `discover_place_api_id`, bootstrap from `/discover` — never guess. Wrong `api_id`s return zero results, which is misleading.
3. **Searching past events.** The endpoint is future-only. If the user asks "what happened last week?", explain the limitation and offer to search webSearch for write-ups instead.
4. **Auto-RSVPing.** You cannot register the user. Always end with "tap the link to register" or similar — not "I've signed you up."
5. **Forgetting the `https://` prefix.** `event.url` is just a slug like `m85abh0i`. The clickable link is `https://lu.ma/m85abh0i`.
6. **Verifying capacity in real time.** `guest_count` reflects when the page was generated, which may be minutes-stale. Don't promise the user "20 spots left" — say "popular event, register soon" if the count is high.
7. **Giving a curated 5–8 answer when the user asked for breadth.** Phrases like "full list", "show me all", "what else is on" mean comprehensive mode. Re-fetching with `pagination_limit=45` is cheap — one API call — and dumping 30+ events in the compact format is exactly what the user asked for. Don't pre-trim to "keep it tidy" when the user explicitly wants the full scan.
8. **Dropping filters on pagination.** When handling a "more" follow-up, you must reuse the same `discover_place_api_id` and `discover_category_api_id` from the original fetch. The cursor alone does not carry filters — a bare `pagination_cursor` call against a different filter context returns junk.

## When to skip this skill

- The user already RSVPed and wants to know "what am I going to this week?" → use Google Calendar tools.
- The user is asking about Eventbrite / Meetup / a non-Luma platform → use `webSearch`.
- The user wants to *create* an event on Luma → outside scope; tell them to use the Luma app or web.
