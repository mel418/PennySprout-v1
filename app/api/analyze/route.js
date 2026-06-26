import { currentUser } from '@clerk/nextjs/server'
import Anthropic from '@anthropic-ai/sdk'
import { extractJson } from '@/lib/aiJson'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request) {
  try {
    // Require a signed-in user. Without this, anyone could POST to this route and
    // run up Anthropic API charges on your account.
    const user = await currentUser()
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { transactions } = await request.json()
    
    // Prepare data for AI analysis
    const dataForAnalysis = transactions.slice(0, 50).map(t => ({
      date: t['Trans. Date'] || t['Date'],
      description: t['Description'],
      amount: parseFloat(t['Amount']) || 0,
      category: t['Category'] || 'Unknown'
    }))

    const prompt = `Analyze this spending data and provide insights:

${JSON.stringify(dataForAnalysis, null, 2)}

Please provide:
1. Top spending categories and patterns
2. Unusual or concerning spending habits
3. Money-saving opportunities
4. Budget recommendations
5. Overall financial health assessment

Format your response as JSON with these keys:
- topCategories: array of {category, amount, percentage}
- patterns: array of insights
- recommendations: array of actionable advice
- healthScore: number 1-10
- summary: brief overview`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })

    // If the model ran out of tokens the JSON is truncated and unparseable —
    // report that clearly instead of a confusing parse error.
    if (message.stop_reason === 'max_tokens') {
      throw new Error('Response was truncated (max_tokens). Try fewer transactions.')
    }

    const responseText = message.content.find(b => b.type === 'text')?.text || ''
    const analysis = extractJson(responseText)

    return Response.json({ analysis })
  } catch (error) {
    console.error('Analysis error:', error)
    // Surface the real reason so the UI can show something actionable.
    return Response.json({ error: `Analysis failed: ${error.message}` }, { status: 500 })
  }
}