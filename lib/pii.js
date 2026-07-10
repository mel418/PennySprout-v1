// Code-level PII scrubbing for AI-extracted transactions.
//
// The parse-pdf prompt instructs Claude not to extract PII, but a prompt is a
// request, not a guarantee — models occasionally echo an account number into a
// description. This module is the enforcement layer: it runs on every
// extracted transaction BEFORE anything is returned to the client or stored.
//
// Two defenses:
//   1. Shape allowlist — only the four expected keys survive; anything else
//      the model invents ("Account Number": ...) is dropped.
//   2. Pattern redaction — descriptions are scrubbed of things that look like
//      account numbers, SSNs, card numbers, phone numbers, and emails.

const EXPECTED_KEYS = ['Trans. Date', 'Description', 'Amount', 'Category']

// Order matters: more specific patterns (SSN, phone) run before the generic
// long-digit-run rule so redactions get the most descriptive label.
const REDACTIONS = [
  // SSN: 123-45-6789
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, label: '[REDACTED-SSN]' },
  // US phone numbers: (555) 123-4567, 555-123-4567, 555.123.4567
  // (no leading \b — it can't match before "(" since parens aren't word chars)
  { pattern: /(?:\(\d{3}\)\s?|\b\d{3}[-.\s])\d{3}[-.\s]\d{4}\b/g, label: '[REDACTED-PHONE]' },
  // Email addresses
  { pattern: /\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, label: '[REDACTED-EMAIL]' },
  // Card/account-like digit runs: 8+ consecutive digits (possibly separated
  // by spaces/dashes, as card numbers are printed). Merchant refs of 4–7
  // digits are common and harmless, so the threshold starts at 8.
  { pattern: /\b(?:\d[ -]?){8,}\d?\b/g, label: '[REDACTED-NUMBER]' },
  // Masked account fragments the bank itself prints: "XXXX1234", "****1234".
  // Low sensitivity but zero analytical value — remove. (No leading \b — it
  // can't match before "*" since asterisks aren't word chars.)
  { pattern: /[Xx*]{2,}[- ]?\d{2,}\b/g, label: '[REDACTED-NUMBER]' },
]

// Scrub a single free-text field.
export function redactPii(text) {
  if (typeof text !== 'string') return text
  let out = text
  for (const { pattern, label } of REDACTIONS) {
    out = out.replace(pattern, label)
  }
  return out.replace(/\s{2,}/g, ' ').trim()
}

// Enforce shape + scrub every transaction from the AI extraction.
// Non-object entries are dropped entirely.
export function scrubTransactions(transactions) {
  if (!Array.isArray(transactions)) return []
  return transactions
    .filter(t => t && typeof t === 'object' && !Array.isArray(t))
    .map(t => {
      const clean = {}
      for (const key of EXPECTED_KEYS) {
        if (key in t) clean[key] = t[key]
      }
      clean['Description'] = redactPii(clean['Description'])
      return clean
    })
}
