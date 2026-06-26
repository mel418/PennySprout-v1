// Robustly pull a JSON value out of a Claude text response.
//
// Models sometimes wrap JSON in a ```json fence, sometimes in a bare ``` fence,
// sometimes add a sentence of prose before/after it, and occasionally emit
// smart quotes or trailing commas. JSON.parse on the raw text then throws and
// the caller reports a useless generic error. This normalizes those cases.

export function extractJson(text) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Empty response from model')
  }

  let candidate = text.trim()

  // 1) Prefer the contents of a fenced code block (```json … ``` or ``` … ```).
  const fence = candidate.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fence) {
    candidate = fence[1].trim()
  } else {
    // 2) Otherwise slice from the first bracket to the last matching one,
    //    dropping any surrounding prose.
    const firstObj = candidate.indexOf('{')
    const firstArr = candidate.indexOf('[')
    const start = firstArr === -1 ? firstObj
                : firstObj === -1 ? firstArr
                : Math.min(firstObj, firstArr)
    const lastObj = candidate.lastIndexOf('}')
    const lastArr = candidate.lastIndexOf(']')
    const end = Math.max(lastObj, lastArr)
    if (start !== -1 && end !== -1 && end > start) {
      candidate = candidate.slice(start, end + 1)
    }
  }

  try {
    return JSON.parse(candidate)
  } catch {
    // 3) Last-ditch cleanup: trailing commas and smart quotes.
    const cleaned = candidate
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
    return JSON.parse(cleaned)
  }
}
