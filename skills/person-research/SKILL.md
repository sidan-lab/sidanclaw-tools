---
name: person-research
description: Research and identify a specific person given their name and company/organization. Use when asked to do a background check, find someone, research a professional, verify identity, or do due diligence on a person. Handles name collisions and disambiguation.
---

# Person Background Research

Systematic workflow for identifying and profiling a specific individual from limited starting information (typically a name + company/organization). Designed to handle common pitfalls: name collisions, similar company names, and plausible-but-wrong matches.

## Inputs

Gather from the user before starting:

- **Full name** (and any known aliases, Chinese/local name, spelling variants)
- **Company or organization** (exact name if possible)
- **Role or title** (if known)
- **Any other anchoring details**: city, industry, event where they met, etc.

If the user provides only a name and company, that is enough to begin.

## Phase 1: Separate Searches (Do NOT combine name + company in first search)

The most common mistake is searching "Alex Wong Riverstone Capital" as a single query. This often returns wrong matches due to keyword blending.

Instead, run these as independent searches:

1. **Company search**: Search for the company/organization alone. Find its official website, leadership page, LinkedIn company page, and any press releases. Goal: understand what the company does, where it operates, and who its known leaders are.

2. **Name + role search**: Search the person's name with their known title or industry — NOT the company name. Goal: see what universe of people share this name.

3. **Name in local language** (if applicable): For Chinese, Japanese, Korean, or other non-Latin names, search the romanized name AND attempt the local-language version. Many disambiguation breakthroughs come from local-language sources.

## Phase 2: Cross-Reference and Disambiguate

This is where most research fails or succeeds.

**Check for name collisions:**
- List ALL individuals found with the same or similar name
- For each candidate, note: full name (including middle name or local name), title, company, city
- Flag any "near-miss" company names (e.g., "Riverstone" vs. "Stone River") — these cause the most confusion

**Apply disambiguation filters (in order of reliability):**

| Filter              | Reliability | Example                                         |
|---------------------|-------------|--------------------------------------------------|
| Full local name     | Very high   | Different characters in local script = different people |
| Specific job title   | High        | "Managing Director" vs. "CEO" vs. "Professor"    |
| Board/org memberships| High        | Different institutions with similar names         |
| City/region         | Medium      | Different cities or countries                     |
| Photo cross-check   | Medium      | Same person in company page and LinkedIn?          |
| Industry overlap    | Lower       | Finance vs. Healthcare vs. Tech                   |

**CRITICAL RULE**: If you find a plausible match early, do NOT stop. Search for at least one additional confirming source that independently links the person's full name to the company. A single source is not confirmation — it is a hypothesis.

## Phase 3: Deep Profile

Once you have a confirmed identity (2+ independent sources linking person to company), build the profile:

**Professional:**
- Current role and company (with start date if available)
- Previous roles and companies
- Board memberships and advisory positions
- Industry and specialization
- Notable deals, projects, publications, or public appearances

**Education & Credentials:**
- Degrees and institutions
- Professional certifications or licenses
- Awards or recognitions

**Public Presence:**
- LinkedIn profile (note: do NOT assume the first LinkedIn result is correct — verify against confirmed details)
- Conference appearances or speaking engagements
- News mentions or press quotes
- Published articles or interviews

**Network & Associations:**
- Professional organizations and memberships
- Board positions (corporate, NGO, government advisory)
- Known business partners or co-founders

## Phase 4: Confidence Assessment

Rate every key finding using this scale:

| Grade | Meaning                        | Standard                                    |
|-------|--------------------------------|---------------------------------------------|
| A     | Confirmed                      | 3+ independent sources agree                |
| B     | Likely correct                 | 2 independent sources agree                 |
| C     | Plausible but unverified       | 1 source only, or sources are not independent |
| D     | Uncertain                      | Inferred or deduced, not directly stated     |

**A finding is only "confirmed" if the sources are truly independent.** Two news articles quoting the same press release count as one source, not two.

## Output Format

Present findings as a structured briefing note:

```
# Person Research: [Name]

## Identity (Confidence: [A/B/C/D])
- **Full Name**: [English name] ([Local name if found])
- **Company**: [Company name]
- **Title**: [Current title]
- **Location**: [City, Country]

## Professional Background
[Career history, key roles — each with confidence grade]

## Education & Credentials
[Degrees, certifications — each with confidence grade]

## Board & Advisory Positions
[List with confidence grades]

## Public Presence
[LinkedIn, news mentions, speaking engagements]

## Disambiguation Notes
[Who this person is NOT — list any near-misses encountered and why they were ruled out. This section is critical for the user's future reference.]

## Sources
[Numbered list of key sources used, with URLs where available]
```

## Common Pitfalls to Avoid

1. **Company name reversal**: "Riverstone" and "Stone River" are different companies. Always verify the exact company name.
2. **Premature lock-in**: Finding one plausible match and stopping. Always seek a second confirming source.
3. **LinkedIn-first bias**: LinkedIn profiles can be outdated, fake, or belong to a different person with the same name. Use LinkedIn to corroborate, not as the primary source.
4. **Ignoring local-language sources**: For people in non-English-speaking regions, the most reliable sources are often in the local language (government registries, local news, official company pages in local script).
5. **Conflating credentials**: Two people can share a name AND a credential (e.g., both sit on hospital boards). Look for the specific institution and specific role, not just the category.
6. **Single-query syndrome**: Running one search and treating whatever comes back as the answer. Use multiple targeted queries with different keyword strategies.

## Escalation

If after Phase 2 you cannot confidently identify the correct person:

1. Tell the user what candidates you found and why none is a confirmed match
2. Ask the user for additional anchoring details (e.g., "Do you know their local name?" or "Which industry are they in?")
3. Try alternative search strategies: search for the company's recent events/press releases and look for the person mentioned by name, or search for the specific board/organization mentioned by the user

Do NOT guess. An honest "I found 3 possible matches but cannot confirm which one" is far more valuable than a confident wrong answer.
