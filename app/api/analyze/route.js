import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request) {
  try {
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
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })

    // Parse AI response (handle markdown code blocks)
    const responseText = message.content[0].text
    let analysis

    // Check if response is wrapped in code blocks
    if (responseText.includes('```json')) {
      // Extract JSON from markdown code blocks
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/)
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[1])
      } else {
        throw new Error('Could not extract JSON from response')
      }
    } else {
      // Try parsing as direct JSON
      analysis = JSON.parse(responseText)
    }
    
    return Response.json({ analysis })
  } catch (error) {
    console.error('Analysis error:', error)
    return Response.json({ error: 'Analysis failed' }, { status: 500 })
  }
}