import { currentUser } from '@clerk/nextjs/server'
import { getMonthlyAnalysis, saveMonthlyAnalysis } from '@/lib/monthlyAnalysis'

export async function GET(request) {
  try {
    const user = await currentUser()
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const month = new URL(request.url).searchParams.get('month')
    if (!month) {
      return Response.json({ error: 'Missing month parameter' }, { status: 400 })
    }

    const record = await getMonthlyAnalysis(user.id, month)
    return Response.json({ record })
  } catch (error) {
    console.error('Error fetching monthly analysis:', error)
    return Response.json({ error: 'Failed to fetch monthly analysis' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const user = await currentUser()
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { month, analysis } = await request.json()
    if (!month || !analysis) {
      return Response.json({ error: 'Missing month or analysis' }, { status: 400 })
    }

    const record = await saveMonthlyAnalysis(user.id, month, analysis)
    return Response.json({ record })
  } catch (error) {
    console.error('Error saving monthly analysis:', error)
    return Response.json({ error: 'Failed to save monthly analysis' }, { status: 500 })
  }
}
