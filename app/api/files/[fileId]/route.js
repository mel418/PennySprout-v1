import { auth } from '@clerk/nextjs/server'  // ← Updated import path
import { deleteUserFile } from '@/lib/fileStorage'

export async function DELETE(request, { params }) {
  try {
    const { userId } = auth()  // ← Change this from useAuth() to auth()
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    deleteUserFile(userId, params.fileId)
    return Response.json({ success: true })
  } catch (error) {
    console.error('Error deleting file:', error)
    return Response.json({ error: 'Failed to delete file' }, { status: 500 })
  }
}