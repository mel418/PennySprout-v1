import { currentUser } from '@clerk/nextjs/server'
import { deleteUserFile, renameUserFile } from '@/lib/fileStorage'

export async function DELETE(_request, { params }) {
  try {
    const user = await currentUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const { fileId } = await params
    await deleteUserFile(user.id, fileId)
    return Response.json({ success: true })
  } catch (error) {
    console.error('Error deleting file:', error)
    return Response.json({ error: 'Failed to delete file' }, { status: 500 })
  }
}

export async function PATCH(request, { params }) {
  try {
    const user = await currentUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const { fileId } = await params
    const { name } = await request.json()
    await renameUserFile(user.id, fileId, name)
    return Response.json({ success: true })
  } catch (error) {
    console.error('Error renaming file:', error)
    return Response.json({ error: 'Failed to rename file' }, { status: 500 })
  }
}