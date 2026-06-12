import { currentUser } from '@clerk/nextjs/server'
import { getUserFiles, saveUserFile } from '@/lib/fileStorage'

export async function GET() {
  try {
    const user = await currentUser()

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const files = await getUserFiles(user.id)
    return Response.json({ files })
  } catch (error) {
    console.error('Error fetching files:', error)
    return Response.json({ error: 'Failed to fetch files' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const user = await currentUser()

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const fileData = await request.json()
    const savedFile = await saveUserFile(user.id, fileData)

    return Response.json({ file: savedFile })
  } catch (error) {
    console.error('Error saving file:', error)
    return Response.json({ error: 'Failed to save file' }, { status: 500 })
  }
}