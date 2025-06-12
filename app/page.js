'use client'
import { useState } from 'react'
import { useUser, SignInButton, UserButton } from '@clerk/nextjs'
import FileUpload from './components/FileUpload'
import SpendingDashboard from './components/SpendingDashboard'
import UserFiles from './components/UserFiles'

export default function Home() {
  const { isSignedIn, user, isLoaded } = useUser()
  const [spendingData, setSpendingData] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [activeView, setActiveView] = useState('upload') // 'upload', 'dashboard', 'files'

  // Show loading while Clerk initializes
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  // Show sign-in if not authenticated
  if (!isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              💰 Personal Spending Analyzer
            </h2>
            <p className="text-gray-600 mb-8">
              Analyze your spending habits with AI-powered insights
            </p>
            <SignInButton mode="modal">
              <button className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                Sign In to Get Started
              </button>
            </SignInButton>
          </div>
        </div>
      </div>
    )
  }

  return (
    <main className="container mx-auto p-8 max-w-6xl">
      {/* Header with user info and navigation */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">
          💰 Personal Spending Analyzer
        </h1>
        <div className="flex items-center space-x-4">
          <span className="text-gray-600">
            Welcome, {user.firstName || user.emailAddresses[0].emailAddress}!
          </span>
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>

      {/* Navigation */}
      <div className="flex space-x-4 mb-8">
        <button
          onClick={() => setActiveView('upload')}
          className={`px-4 py-2 rounded-lg ${
            activeView === 'upload' 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Upload New File
        </button>
        <button
          onClick={() => setActiveView('files')}
          className={`px-4 py-2 rounded-lg ${
            activeView === 'files' 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          My Files
        </button>
        {spendingData && (
          <button
            onClick={() => setActiveView('dashboard')}
            className={`px-4 py-2 rounded-lg ${
              activeView === 'dashboard' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Current Analysis
          </button>
        )}
      </div>

      {/* Content based on active view */}
      {activeView === 'upload' && (
        <FileUpload 
          onDataLoaded={(data) => {
            setSpendingData(data)
            setActiveView('dashboard')
          }} 
          userId={user.id}
        />
      )}
      
      {activeView === 'files' && (
        <UserFiles 
          userId={user.id}
          onFileSelected={(data) => {
            setSpendingData(data)
            setActiveView('dashboard')
          }}
        />
      )}
      
      {activeView === 'dashboard' && spendingData && (
        <SpendingDashboard 
          data={spendingData} 
          analysis={analysis}
          onAnalysisComplete={setAnalysis}
          userId={user.id}
        />
      )}
    </main>
  )
}