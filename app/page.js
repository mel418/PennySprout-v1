'use client'
import { useState } from 'react'
import FileUpload from './components/FileUpload'
import SpendingDashboard from './components/SpendingDashboard'

export default function Home() {
  const [spendingData, setSpendingData] = useState(null)
  const [analysis, setAnalysis] = useState(null)

  return (
    <main className="container mx-auto p-8 max-w-6xl">
      <h1 className="text-4xl font-bold text-center mb-8">
        💰 Personal Spending Analyzer
      </h1>
      
      {!spendingData ? (
        <FileUpload onDataLoaded={setSpendingData} />
      ) : (
        <SpendingDashboard 
          data={spendingData} 
          analysis={analysis}
          onAnalysisComplete={setAnalysis}
        />
      )}
    </main>
  )
}