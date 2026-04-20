/**
 * Path-based sensitivity heuristics for migration mode.
 *
 * Conservative bias: prefer false positives (over-restricting) over false negatives.
 * The MIGRATION_REPORT.md surfaces every decision so the user can downgrade
 * deliberately, instead of silently leaving something exposed.
 *
 * Order matters — first match wins.
 */

export type Sensitivity = 'public' | 'internal' | 'confidential'

export type SensitivityDecision = {
  tier: Sensitivity
  reason: string
  matched: string
}

type Rule = {
  tier: Sensitivity | 'skip'
  pattern: RegExp
  reason: string
}

const RULES: Rule[] = [
  // Skip — not real KB content
  { tier: 'skip', pattern: /(^|\/)(historical|archive|deprecated)\//i, reason: 'archived/deprecated content — explicitly skipped per skill guidance' },
  { tier: 'skip', pattern: /(^|\/)CLAUDE\.md$/, reason: 'per-package session pointer — skipped to avoid duplicating architecture docs' },

  // Confidential — security, customers, secrets, financials
  { tier: 'confidential', pattern: /(^|\/)(security|auth|secrets?|threat[- ]?model|key[- ]?rotation|vuln(erability)?|incidents?|customers?|cap[- ]?table|fundrais|legal|contracts?|hr|payroll)(\/|\.|$)/i, reason: 'name suggests security / customer / contractual / financial content' },
  { tier: 'confidential', pattern: /(^|\/)(postmortems?|investigations?)(\/|\.|$)/i, reason: 'incident reports usually name customers or vendors' },
  { tier: 'confidential', pattern: /(secret|password|credential|api[- ]?key|token)/i, reason: 'filename suggests secret material' },

  // Public — explicitly customer-facing
  { tier: 'public', pattern: /(^|\/)(public[- ]?api|customer[- ]?faq|marketing|landing|pricing|brand|press)(\/|\.|$)/i, reason: 'name suggests customer-facing material' },

  // Internal (default fallback handled outside the rule list)
]

export function inferSensitivity(relativePath: string): SensitivityDecision | { tier: 'skip'; reason: string; matched: string } {
  for (const rule of RULES) {
    const match = relativePath.match(rule.pattern)
    if (match) {
      if (rule.tier === 'skip') {
        return { tier: 'skip', reason: rule.reason, matched: match[0] }
      }
      return { tier: rule.tier, reason: rule.reason, matched: match[0] }
    }
  }
  return { tier: 'internal', reason: 'no specific signal — using safe team-wide default', matched: '(default)' }
}
