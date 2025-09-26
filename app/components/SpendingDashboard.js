'use client'
import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, DollarSign, AlertCircle, Lightbulb } from 'lucide-react'

export default function SpendingDashboard({ data, analysis, onAnalysisComplete }) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [chartData, setChartData] = useState([])

  useEffect(() => {
    if (data && !analysis) {
      analyzeSpending()
    }
    if (data) {
      prepareChartData()
    }
  }, [data, analysis])

  const analyzeSpending = async () => {
    setIsAnalyzing(true)
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: data.data })
      })
      
      const result = await response.json()
      onAnalysisComplete(result.analysis)

      // Save analysis to file if we have a fileId
      if (data.fileId) {
        await fetch('api/files/analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileId: data.fileId,
            analysis: result.analysis
          })
        })
      }
    } catch (error) {
      console.error('Analysis failed:', error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const prepareChartData = () => {
    // Group spending by category
    const categoryTotals = {}
    data.data.forEach(transaction => {
      const amount = Math.abs(parseFloat(transaction.Amount) || 0)
      const category = transaction.Category || 'Unknown'
      categoryTotals[category] = (categoryTotals[category] || 0) + amount
    })

    const chartData = Object.entries(categoryTotals)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)

    setChartData(chartData)
  }

  const colors = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <DollarSign className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Spending</p>
              <p className="text-2xl font-bold text-gray-900">
                ${data.data.reduce((sum, t) => sum + Math.abs(parseFloat(t.Amount) || 0), 0).toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Transactions</p>
              <p className="text-2xl font-bold text-gray-900">{data.data.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <AlertCircle className="h-8 w-8 text-orange-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Health Score</p>
              <p className="text-2xl font-bold text-gray-900">
                {analysis ? `${analysis.healthScore}/10` : 'Analyzing...'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Spending by Category</h3>
          <BarChart width={400} height={300} data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="category" angle={-45} textAnchor="end" height={100} />
            <YAxis />
            <Tooltip formatter={(value) => [`$${value.toFixed(2)}`, 'Amount']} />
            <Bar dataKey="amount" fill="#8884d8" />
          </BarChart>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Category Distribution</h3>
          <PieChart width={400} height={300}>
            <Pie
              data={chartData.slice(0, 5)}
              cx={200}
              cy={150}
              outerRadius={80}
              fill="#8884d8"
              dataKey="amount"
              label={(entry) => entry.category}
            >
              {chartData.slice(0, 5).map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => [`$${value.toFixed(2)}`, 'Amount']} />
          </PieChart>
        </div>
      </div>

      {/* AI Analysis */}
      {isAnalyzing && (
        <div className="bg-blue-50 p-6 rounded-lg">
          <p className="text-blue-800">🤖 AI is analyzing your spending patterns...</p>
        </div>
      )}

      {analysis && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-xl font-semibold mb-4 flex items-center">
            <Lightbulb className="h-6 w-6 text-yellow-500 mr-2" />
            AI Insights
          </h3>
          
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-900">Summary</h4>
              <p className="text-gray-700">{analysis.summary}</p>
            </div>

            <div>
              <h4 className="font-medium text-gray-900">Recommendations</h4>
              <ul className="list-disc list-inside text-gray-700 space-y-1">
                {analysis.recommendations?.map((rec, index) => (
                  <li key={index}>{rec}</li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-gray-900">Spending Patterns</h4>
              <ul className="list-disc list-inside text-gray-700 space-y-1">
                {analysis.patterns?.map((pattern, index) => (
                  <li key={index}>{pattern}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}