'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { SendHorizonal } from 'lucide-react'
import { ActionChip } from './ui/Chip'
import { Banner } from './ui/Field'
import Doodle from './ui/Doodle'

// Conversational insights for one calendar month — replaces the old one-shot
// AI report. The server builds all financial context from the database; the
// client only ever sends the conversation itself. History lives in component
// state for the session and resets when the month changes, so answers always
// match the month on screen.
//
// Presented as "Ask Penny", a small financial companion. The personality is
// entirely in the framing — the avatar, the prompt chips, the greeting. The
// answers themselves stay plain, accurate, and easy to scan, and the
// AI-can-be-wrong disclaimer is never dressed up.
const SUGGESTIONS = [
  { emoji: '🌸', text: 'Where did most of my money go?' },
  { emoji: '☁️', text: 'What subscriptions am I paying for?' },
  { emoji: '🌱', text: 'Any charges that look unusual?' },
  { emoji: '🌼', text: 'How could I save $100 next month?' },
]

// The mascot. Decorative, so it carries no alt text of its own — the heading
// beside it names the feature.
function PennyAvatar({ className = 'h-9 w-9' }) {
  return (
    <span className={`flex items-center justify-center rounded-full bg-sage-50 ${className}`} aria-hidden="true">
      <Image src="/sprout-svgrepo-com.svg" alt="" width={22} height={22} className="h-[60%] w-[60%]" />
    </span>
  )
}

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
    <div className="card-soft relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-line bg-sage-50 px-5 py-4 sm:px-6">
        <PennyAvatar className="h-10 w-10 flex-shrink-0" />
        <div className="min-w-0">
          <h3 className="font-display text-base font-bold text-ink">Ask Penny</h3>
          <p className="truncate text-xs text-ink-soft">Your little financial sidekick · {monthLabel}</p>
        </div>
        <Doodle name="sparkle" className="ml-auto h-5 w-5 flex-shrink-0 text-sage-400" />
      </div>

      {/* Conversation */}
      <div ref={scrollRef} className="max-h-96 space-y-3 overflow-y-auto px-4 py-5 sm:px-5" aria-live="polite">
        {messages.length === 0 ? (
          <div>
            <p className="mb-4 text-sm leading-relaxed text-ink-soft">
              I can see this month&apos;s transactions, categories, and budgets. What would you like to know?
            </p>
            <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {SUGGESTIONS.map(({ emoji, text }) => (
                <li key={text}>
                  <ActionChip onClick={() => send(text)} disabled={isStreaming} className="w-full sm:w-auto">
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
              <div className={`max-w-[85%] whitespace-pre-wrap px-4 py-3 text-sm leading-relaxed ${
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
        <div className="mx-4 mb-3 sm:mx-5">
          <Banner tone="error" role="alert">{error}</Banner>
        </div>
      )}

      {/* Composer */}
      <div className="flex items-center gap-2 border-t border-line p-3 sm:p-4">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) send() }}
          placeholder={`Ask about ${monthLabel}…`}
          maxLength={2000}
          disabled={isStreaming}
          aria-label={`Ask a question about ${monthLabel}`}
          className="min-h-11 min-w-0 flex-1 rounded-full border border-line bg-surface-2 px-4 text-base text-ink
            placeholder:text-ink-faint transition-colors focus:border-sage-500 focus:outline-none
            disabled:opacity-60 sm:text-sm"
        />
        <button
          onClick={() => send()}
          disabled={isStreaming || !input.trim()}
          aria-label="Send question"
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-sage-600
            text-white transition-colors hover:bg-sage-700 disabled:opacity-40 disabled:hover:bg-sage-600"
        >
          <SendHorizonal className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <p className="px-5 pb-4 text-xs leading-relaxed text-ink-faint">
        AI answers can contain mistakes and aren&apos;t financial advice. Your notes are never shared with the AI.
      </p>
    </div>
  )
}
