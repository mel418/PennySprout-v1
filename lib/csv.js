// CSV parsing for uploaded statements. Lives in lib/ (not inside FileUpload.js)
// so the money-math test suite can cover it — a wrong parse here means wrong
// amounts on every chart downstream.
//
// The previous implementation split each line on ',' — which silently misaligns
// every column after a quoted field containing a comma (e.g. Chase exports
// descriptions like "AMAZON.COM, SEATTLE WA"). This is a proper RFC 4180 parser:
// quoted fields, escaped quotes ("" inside quotes), CRLF line endings, and
// newlines embedded inside quoted fields are all handled.

// Parse raw CSV text into rows of fields (string[][]).
export function parseCsvRows(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"' // escaped quote inside a quoted field
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch // includes commas and newlines inside quotes
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++ // CRLF counts as one break
      row.push(field)
      field = ''
      rows.push(row)
      row = []
    } else {
      field += ch
    }
  }

  // Flush the final field/row if the file doesn't end with a newline.
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  // Drop rows that are entirely empty (blank lines).
  return rows.filter(r => r.some(f => f.trim() !== ''))
}

// Columns we keep from CSVs — anything not matching is silently dropped.
// This acts as a privacy filter: account numbers, holder names, addresses,
// routing numbers, and any other PII columns never get stored.
export const ALLOWED_HEADERS = [
  /^trans\.?\s*date$/i,
  /^post\.?\s*date$/i,
  /^transaction\s*date$/i,
  /^date$/i,
  /^posting\s*date$/i,
  /^description$/i,
  /^desc$/i,
  /^memo$/i,
  /^payee$/i,
  /^merchant$/i,
  /^narrative$/i,
  /^details$/i,
  /^amount$/i,
  /^debit$/i,
  /^credit$/i,
  /^transaction\s*amount$/i,
  /^category$/i,
  /^type$/i,
  /^transaction\s*type$/i,
]

export const isAllowedHeader = (h) => ALLOWED_HEADERS.some(pattern => pattern.test(h.trim()))

// Convert raw CSV text into an array of transaction objects, keeping only
// allowlisted (non-PII) columns. Returns { headers, data } — the shape
// FileUpload has always consumed.
export function parseTransactionsCsv(text) {
  const rows = parseCsvRows(text)
  if (rows.length === 0) return { headers: [], data: [] }

  const allHeaders = rows[0].map(h => h.trim())

  const allowedIndices = allHeaders
    .map((h, i) => ({ h, i }))
    .filter(({ h }) => isAllowedHeader(h))

  const headers = allowedIndices.map(({ h }) => h)

  const data = rows.slice(1).map(values =>
    allowedIndices.reduce((obj, { h, i }) => {
      obj[h] = (values[i] || '').trim()
      return obj
    }, {})
  ).filter(row => Object.values(row).some(v => v))

  return { headers, data }
}

// ── Serialization (data export) ──────────────────────────────────────────────

// RFC 4180 field escaping: quote when the value contains a comma, quote, or
// newline; double any quotes inside.
export function escapeCsvField(value) {
  const s = value === null || value === undefined ? '' : String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// rows: array of arrays (first row = headers). CRLF line endings per RFC 4180.
export function serializeCsv(rows) {
  return rows.map(row => row.map(escapeCsvField).join(',')).join('\r\n') + '\r\n'
}
