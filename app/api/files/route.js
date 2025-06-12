import { auth } from '@clerk/nextjs/server'  // ← Updated import path
import { getUserFiles, saveUserFile } from '@/lib/fileStorage'

export async function GET() {
  try {
    const { userId } = auth()  // ← Change this from useAuth() to auth()
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const files = getUserFiles(userId)
    return Response.json({ files })
  } catch (error) {
    console.error('Error fetching files:', error)
    return Response.json({ error: 'Failed to fetch files' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const { userId } = auth()  // ← This one is already correct
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const fileData = await request.json()
    const savedFile = saveUserFile(userId, fileData)
    
    return Response.json({ file: savedFile })
  } catch (error) {
    console.error('Error saving file:', error)
    return Response.json({ error: 'Failed to save file' }, { status: 500 })
  }
}