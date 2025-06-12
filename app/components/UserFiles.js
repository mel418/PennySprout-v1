'use client'
import { useState, useEffect } from 'react'
import { Trash2, FileText, Calendar, DollarSign } from 'lucide-react'

export default function UserFiles({ userId, onFileSelected }) {
  const [files, setFiles] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchFiles()
  }, [])

  const fetchFiles = async () => {
    try {
      const response = await fetch('/api/files')
      const data = await response.json()
      setFiles(data.files || [])
    } catch (error) {
      console.error('Error fetching files:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const deleteFile = async (fileId) => {
    if (!confirm('Are you sure you want to delete this file?')) return

    try {
      await fetch(`/api/files/${fileId}`, { method: 'DELETE' })
      setFiles(files.filter(f => f.id !== fileId))
    } catch (error) {
      console.error('Error deleting file:', error)
    }
  }

  const selectFile = (file) => {
    const data = {
      headers: Object.keys(file.transactions[0] || {}),
      data: file.transactions,
      fileId: file.id
    }
    onFileSelected(data)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div className="text-center p-8">
        <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No files uploaded yet</h3>
        <p className="text-gray-600">Upload your first CSV file to get started!</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold mb-6">Your Uploaded Files</h2>
      
      {files.map((file) => (
        <div key={file.id} className="bg-white p-6 rounded-lg shadow border">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {file.name}
              </h3>
              
              <div className="grid grid-cols-3 gap-4 text-sm text-gray-600 mb-4">
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  {new Date(file.uploadDate).toLocaleDateString()}
                </div>
                <div className="flex items-center">
                  <FileText className="h-4 w-4 mr-2" />
                  {file.transactionCount} transactions
                </div>
                <div className="flex items-center">
                  <DollarSign className="h-4 w-4 mr-2" />
                  ${file.totalAmount.toFixed(2)}
                </div>
              </div>

              {file.analysis && (
                <div className="bg-green-50 p-3 rounded mb-4">
                  <p className="text-sm text-green-800">
                    ✅ AI Analysis Complete - Health Score: {file.analysis.healthScore}/10
                  </p>
                </div>
              )}
            </div>
            
            <div className="flex space-x-2 ml-4">
              <button
                onClick={() => selectFile(file)}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Analyze
              </button>
              <button
                onClick={() => deleteFile(file.id)}
                className="p-2 text-red-500 hover:bg-red-50 rounded"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}