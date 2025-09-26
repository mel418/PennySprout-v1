import { currentUser } from '@clerk/nextjs/server'
import { getUserFiles, saveUserFile } from '@/lib/fileStorage'

export async function GET() {
  try {
    const user = await currentUser()
    console.log('Current user:', user?.id)
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const files = await getUserFiles(user.id)  // ← ADD await HERE!
    return Response.json({ files })
  } catch (error) {
    console.error('Error fetching files:', error)
    return Response.json({ error: 'Failed to fetch files' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const user = await currentUser()
    console.log('POST - Current user:', user?.id)
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const fileData = await request.json()
    console.log('Saving file for user:', user.id, 'File:', fileData.name)
    
    const savedFile = await saveUserFile(user.id, fileData)  // ← ADD await HERE too!
    console.log('File saved successfully:', savedFile.id)
    
    return Response.json({ file: savedFile })
  } catch (error) {
    console.error('Error saving file:', error)
    return Response.json({ error: 'Failed to save file' }, { status: 500 })
  }
}