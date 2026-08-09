'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { SendHorizonal } from 'lucide-react'
import { ActionChip } from './ui/Chip'
import { Banner } from './ui/Field'

// "Ask Penny" scoped to the user's ENTIRE transaction history — the chat tab
// inside the floating search widget. Same conversational contract as
// MonthChat (server builds all financial context from the database, client
// only ever sends the conversation), but calls /api/chat with
// { scope: 'all' } instead of a specific month, and fills the widget panel's
// full height instead of sitting in a card with a capped message area.
const SUGGESTIONS = [
  { emoji: '🌿', text: 'Where does most of my money go overall?' },
  { emoji: '📈', text: 'Which month did I spend the most?' },
  { emoji: '☁️', text: 'Any subscriptions I might have forgotten about?' },
  { emoji: '🌱', text: 'How has my spending trended over time?' },
]

function PennyAvatar({ className = 'h-9 w-9' }) {
  return (
    <span className={`flex items-center justify-center rounded-full bg-sage-50 ${className}`} aria-hidden="true">
      <Image src="/sprout-svgrepo-com.svg" alt="" width={22} height={22} className="h-[60%] w-[60%]" />
    </span>
  )
}

export default function TransactionsChat() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState(null)
  const scrollRef = useRef(null)

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
        body: JSON.stringify({ scope: 'all', messages: history }),
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
  }, [input, isStreaming, messages])

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Conversation */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3" aria-live="polite">
        {messages.length === 0 ? (
          <div>
            <p className="mb-3 text-sm leading-relaxed text-ink-soft">
              I can see every transaction you&apos;ve uploaded, across every file and month. What would you like to know?
            </p>
            <ul className="flex flex-col gap-2">
              {SUGGESTIONS.map(({ emoji, text }) => (
                <li key={text}>
                  <ActionChip onClick={() => send(text)} disabled={isStreaming} className="w-full">
                    <span aria-hidden="true">{emoji}</span> {text}
                  </ActionChip>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex items-end gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && <PennyAvatar className="h-7 w-7 flex-shrink-0" />}
              <div className={`max-w-[85%] whitespace-pre-wrap px-3.5 py-2.5 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'rounded-[var(--radius-lg)] rounded-br-md bg-sage-600 text-white'
                  : 'rounded-[var(--radius-lg)] rounded-bl-md bg-surface-2 text-ink'
              }`}>
                {m.content || (
                  <span className="inline-flex items-center gap-1 py-1" aria-label="Penny is thinking">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sage-400" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sage-400 [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sage-400 [animation-delay:300ms]" />
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {error && (
        <div className="px-3 pb-2">
          <Banner tone="error" role="alert">{error}</Banner>
        </div>
      )}

      {/* Composer */}
      <div className="flex flex-shrink-0 items-center gap-2 border-t border-line p-2.5">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) send() }}
          placeholder="Ask about your spending…"
          maxLength={2000}
          disabled={isStreaming}
          aria-label="Ask a question about all your transactions"
          className="min-h-10 min-w-0 flex-1 rounded-full border border-line bg-surface-2 px-4 text-sm text-ink
            placeholder:text-ink-faint transition-colors focus:border-sage-500 focus:outline-none
            disabled:opacity-60"
        />
        <button
          onClick={() => send()}
          disabled={isStreaming || !input.trim()}
          aria-label="Send question"
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-sage-600
            text-white transition-colors hover:bg-sage-700 disabled:opacity-40 disabled:hover:bg-sage-600"
        >
          <SendHorizonal className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <p className="px-3 pb-2.5 text-[11px] leading-relaxed text-ink-faint">
        AI answers can contain mistakes and aren&apos;t financial advice.
      </p>
    </div>
  )
}
