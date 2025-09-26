import { currentUser } from '@clerk/nextjs/server'
import { updateFileAnalysis } from '@/lib/fileStorage'

export async function POST(request) {
  try {
    const user = await currentUser()
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { fileId, analysis } = await request.json()
    await updateFileAnalysis(user.id, fileId, analysis)
    
    return Response.json({ success: true })
  } catch (error) {
    console.error('Error updating analysis:', error)
    return Response.json({ error: 'Failed to update analysis' }, { status: 500 })
  }
}