import { currentUser } from '@clerk/nextjs/server'
import { deleteUserFile } from '@/lib/fileStorage'

export async function DELETE(request, { params }) {
  try {
    const user = await currentUser()
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await deleteUserFile(user.id, params.fileId)  // ← ADD await HERE!
    return Response.json({ success: true })
  } catch (error) {
    console.error('Error deleting file:', error)
    return Response.json({ error: 'Failed to delete file' }, { status: 500 })
  }
}