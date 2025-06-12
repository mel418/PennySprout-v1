import { currentUser } from '@clerk/nextjs/server'
import { getUserFiles, saveUserFile } from '@/lib/fileStorage'

export async function GET() {
  try {
    const user = await currentUser()
    console.log('Current user:', user?.id)
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const files = getUserFiles(user.id)
    return Response.json({ files })
  } catch (error) {
    console.error('Error fetching files:', error)
    return Response.json({ error: 'Failed to fetch files' }, { status: 500 })
  }
}