import { currentUser } from '@clerk/nextjs/server'
import Anthropic from '@anthropic-ai/sdk'

// Same Anthropic client we use in /api/analyze
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request) {
  try {
    // Make sure the user is logged in before doing anything
    const user = await currentUser()
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // request.formData() reads a multipart form upload (how browsers send files)
    // This is different from request.json() which only handles plain JSON text
    const formData = await request.formData()

    // formData.get('file') pulls out the file the browser attached under the key 'file'
    const file = formData.get('file')
    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 })
    }

    // file.arrayBuffer() reads the raw binary content of the PDF into memory
    // We then wrap it in Buffer (Node.js's binary data type) so we can convert it
    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    // toString('base64') encodes the binary data as a base64 string —
    // Claude's API requires PDFs to be sent this way (not as raw binary)

    // Send the PDF directly to Claude using the 'document' content block type.
    // Claude can read PDFs natively — no PDF parsing library needed.
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          {
            // This block tells Claude "here is a PDF document to read"
            type: 'document',
            source: {
              type: 'base64',           // we're sending it as base64 text
              media_type: 'application/pdf',
              data: base64              // the actual PDF content
            }
          },
          {
            // This block is the instruction that follows the document
            type: 'text',
            text: `Extract all real spending transactions from this bank statement.

PRIVACY — do NOT extract or include anywhere in the output:
- Account holder name, address, phone number, or email
- Account numbers, routing numbers, or any full or partial account identifiers
- Social Security numbers or tax IDs
- Bank branch information
- Any other personally identifiable information (PII)

Transaction extraction rules:
- EXCLUDE internal transfers between accounts (lines containing "Home Banking Transfer", "Transfer To Share", "Transfer From Share") — these are just moving money between the same person's accounts and would cause double-counting
- INCLUDE real purchases, bill payments, subscriptions, payroll deposits, Zelle transfers, etc.
- Withdrawals and payments: Amount must be a negative number
- Deposits and income: Amount must be a positive number
- Description field: use only the merchant or payee name — never include account numbers, reference numbers, or personal details

Return ONLY a valid JSON array, no explanation or extra text. Each object must have exactly these keys:
{
  "Trans. Date": "MM/DD/YY",
  "Description": "merchant or payee name only",
  "Amount": -12.34,
  "Category": "one of: Shopping, Food, Entertainment, Bills, Subscriptions, Income, Fitness, Transfer, Other"
}`
          }
        ]
      }]
    })

    // Pull the text out of Claude's response (same pattern as /api/analyze)
    const responseText = message.content[0].text

    // Claude sometimes wraps JSON in a ```json code block — strip that if present
    let transactions
    if (responseText.includes('```json')) {
      const match = responseText.match(/```json\s*([\s\S]*?)\s*```/)
      transactions = JSON.parse(match[1])
    } else {
      transactions = JSON.parse(responseText)
    }

    return Response.json({ transactions })
  } catch (error) {
    console.error('PDF parse error:', error)
    return Response.json({ error: 'Failed to parse PDF' }, { status: 500 })
  }
}
