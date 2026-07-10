'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Sparkles, SendHorizonal } from 'lucide-react'

// Conversational insights for one calendar month — replaces the old one-shot
// AI report. The server builds all financial context from the database; the
// client only ever sends the conversation itself. History lives in component
// state for the session and resets when the month changes, so answers always
// match the month on screen.
const SUGGESTIONS = [
  'Where did most of my money go?',
  'What subscriptions am I paying for?',
  'Any charges that look unusual?',
  'How could I save $100 next month?',
]

export default function MonthChat({ month, monthLabel }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState(null)
  const scrollRef = useRef(null)

  // New month = new context: clear the conversation.
  useEffect(() => {
    setMessages([])
    setError(null)
  }, [month])

  // Keep the newest message in view while streaming.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  const send = useCallback(async (text) => {
    const question = (text ?? input).trim()
    if (!question || isStreaming) return

    setError(null)
    setInput('')
    const history = [...messages, { role: 'user', content: question }]
    // Optimistic user bubble + an empty assistant bubble the stream fills in.
    setMessages([...history, { role: 'assistant', content: '' }])
    setIsStreaming(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, messages: history }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Chat failed')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let answer = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        answer += decoder.decode(value, { stream: true })
        const current = answer
        setMessages(prev => [
          ...prev.slice(0, -1),
          { role: 'assistant', content: current },
        ])
      }
      if (!answer.trim()) throw new Error('Empty response — try again.')
    } catch (e) {
      // Drop the empty assistant bubble and put the question back in the box
      // so a retry is one click away.
      setMessages(messages)
      setInput(question)
      setError(e.message)
    } finally {
      setIsStreaming(false)
    }
  }, [input, isStreaming, messages, month])

  return (
    <div className="bg-surface rounded-2xl border border-line shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-line flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-sage-500" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-ink">Ask about {monthLabel}</h3>
      </div>

      {/* Conversation */}
      <div ref={scrollRef} className="max-h-96 overflow-y-auto px-5 py-4 space-y-3" aria-live="polite">
        {messages.length === 0 ? (
          <div>
            <p className="text-sm text-ink-soft mb-3">
              Ask anything about this month&apos;s spending — I can see your transactions, categories, and budgets.
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={isStreaming}
                  className="text-xs px-3 py-1.5 rounded-full border border-sage-200 text-sage-700 hover:bg-sage-50 transition-colors disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-sage-600 text-white rounded-br-md'
                  : 'bg-surface-2 text-ink rounded-bl-md'
              }`}>
                {m.content || (
                  <span className="inline-flex gap-1 items-center py-1" aria-label="Thinking">
                    <span className="h-1.5 w-1.5 rounded-full bg-ink-faint animate-pulse" />
                    <span className="h-1.5 w-1.5 rounded-full bg-ink-faint animate-pulse [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-ink-faint animate-pulse [animation-delay:300ms]" />
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {error && (
        <div role="alert" className="mx-5 mb-3 bg-danger-50 border border-danger-200 text-danger-600 text-sm rounded-xl px-4 py-2.5">
          {error}
        </div>
      )}

      {/* Composer */}
      <div className="border-t border-line p-3 flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) send() }}
          placeholder={`Ask about ${monthLabel}…`}
          maxLength={2000}
          disabled={isStreaming}
          aria-label={`Ask a question about ${monthLabel}`}
          className="flex-1 min-w-0 text-sm bg-surface-2 border border-line rounded-xl px-4 py-2.5 text-ink placeholder:text-ink-faint focus:border-sage-500 focus:outline-none disabled:opacity-60"
        />
        <button
          onClick={() => send()}
          disabled={isStreaming || !input.trim()}
          aria-label="Send"
          className="p-2.5 rounded-xl bg-sage-600 hover:bg-sage-700 text-white transition-colors disabled:opacity-40"
        >
          <SendHorizonal className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <p className="px-5 pb-3 text-[11px] text-ink-faint">
        AI answers can contain mistakes and aren&apos;t financial advice. Your notes are never shared with the AI.
      </p>
    </div>
  )
}
