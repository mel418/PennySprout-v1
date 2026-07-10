import { currentUser } from '@clerk/nextjs/server'
import Anthropic from '@anthropic-ai/sdk'
import { extractJson } from '@/lib/aiJson'
import { checkRateLimit } from '@/lib/rateLimit'
import { getPlan } from '@/lib/subscriptionStorage'
import { scrubTransactions } from '@/lib/pii'

// Same Anthropic client we use in /api/analyze
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request) {
  try {
    // Make sure the user is logged in before doing anything
    const user = await currentUser()
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Auth alone doesn't cap Anthropic spend — enforce a per-user daily limit
    // (Pro subscribers get a higher ceiling).
    const plan = await getPlan(user.id)
    const { allowed, limit } = await checkRateLimit(user.id, 'parse-pdf', plan)
    if (!allowed) {
      const upsell = plan === 'free' ? ' Upgrade to Pro for a higher daily limit.' : ''
      return Response.json(
        { error: `Daily PDF upload limit reached (${limit}/day). Try again tomorrow.${upsell}` },
        { status: 429 }
      )
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
      model: 'claude-sonnet-4-6',
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

    // A truncated response means the JSON array is incomplete and unparseable.
    if (message.stop_reason === 'max_tokens') {
      throw new Error('Statement too long — response was truncated (max_tokens).')
    }

    // Pull the text out of Claude's response and parse it robustly
    // (handles bare/json code fences and surrounding prose).
    const responseText = message.content.find(b => b.type === 'text')?.text || ''
    const extracted = extractJson(responseText)

    // The prompt above asks Claude not to extract PII, but a prompt is a
    // request, not a guarantee. scrubTransactions is the enforcement layer:
    // it drops unexpected keys and redacts account/SSN/phone/email patterns
    // from descriptions before anything leaves this route.
    const transactions = scrubTransactions(extracted)

    return Response.json({ transactions })
  } catch (error) {
    console.error('PDF parse error:', error)
    return Response.json({ error: `Failed to parse PDF: ${error.message}` }, { status: 500 })
  }
}
