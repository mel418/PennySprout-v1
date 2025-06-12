'use client'
import { useState } from 'react'

export default function FileUpload({ onDataLoaded }) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleFileUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      // Read file content
      const text = await file.text()
      
      // Parse CSV data
      const parsedData = parseCSV(text)
      
      // Pass data to parent component
      onDataLoaded(parsedData)
    } catch (err) {
      setError('Error reading file: ' + err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const parseCSV = (text) => {
    const lines = text.split('\n')
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
    
    const data = lines.slice(1)
      .filter(line => line.trim()) // Remove empty lines
      .map(line => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
        const row = {}
        headers.forEach((header, index) => {
          row[header] = values[index]
        })
        return row
      })

    return { headers, data }
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
        <div className="mb-4">
          <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        
        <h3 className="text-lg font-medium mb-2">Upload Your Bank Statement</h3>
        <p className="text-gray-600 mb-4">
          Upload a CSV file from your bank (Discover, Chase, etc.)
        </p>
        
        <input
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          disabled={isLoading}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 
                     file:rounded-full file:border-0 file:text-sm file:font-semibold 
                     file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        
        {isLoading && <p className="mt-2 text-blue-600">Processing file...</p>}
        {error && <p className="mt-2 text-red-600">{error}</p>}
      </div>
      
      <div className="mt-6 text-sm text-gray-600">
        <h4 className="font-medium mb-2">Supported formats:</h4>
        <ul className="list-disc list-inside space-y-1">
          <li>CSV files from most major banks</li>
          <li>Expected columns: Date, Description, Amount</li>
          <li>Your data stays private - processed locally</li>
        </ul>
      </div>
    </div>
  )
}