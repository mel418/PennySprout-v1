'use client'

// ─── The sprout metaphor, in one component ───────────────────────────────────
//
// Penny Sprout's core idea is that money is something you grow. This is the
// single illustration that expresses it: a plant with four growth stages,
// reused by the financial health score and by savings goals so "progress"
// looks the same everywhere in the app.
//
// It SUPPORTS a number, it never replaces one. Callers always render the real
// figure (7/10, 62%, $1,240 of $2,000) next to it, and pass the stage's label
// through so screen readers and color-blind users get the state in words.
//
// Colors come from the sage/blush tokens, so it follows the light/dark swap.

export const STAGES = [
  { key: 'seedling', label: 'Just getting started', emoji: '🌱' },
  { key: 'growing',  label: "You're growing",       emoji: '🌿' },
  { key: 'budding',  label: 'Looking healthy',      emoji: '🌷' },
  { key: 'blooming', label: "You're thriving",      emoji: '🌸' },
]

// 1–10 health score → stage. Mirrors the bands in the design spec:
// 1–3 seedling · 4–6 growing · 7–8 budding · 9–10 blooming.
export function stageForScore(score) {
  if (score == null) return 0
  if (score >= 9) return 3
  if (score >= 7) return 2
  if (score >= 4) return 1
  return 0
}

// 0–1 completion ratio → stage. Used by savings goals.
export function stageForRatio(ratio) {
  if (!Number.isFinite(ratio)) return 0
  if (ratio >= 1) return 3
  if (ratio >= 0.6) return 2
  if (ratio >= 0.25) return 1
  return 0
}

function Flower({ cx, cy, r = 3.4, petal = 'var(--spend-200)', center = 'var(--butter-300)' }) {
  const petals = [0, 72, 144, 216, 288]
  return (
    <g>
      {petals.map(a => {
        const rad = (a * Math.PI) / 180
        return (
          <circle
            key={a}
            cx={cx + Math.cos(rad) * r}
            cy={cy + Math.sin(rad) * r}
            r={r * 0.78}
            fill={petal}
          />
        )
      })}
      <circle cx={cx} cy={cy} r={r * 0.62} fill={center} />
    </g>
  )
}

// `stage` 0–3. `label` overrides the default stage label used for the
// accessible name; pass the caller's own phrasing when it's more specific.
export default function GrowthPlant({ stage = 0, className = 'h-16 w-16', label, animate = true }) {
  const s = Math.max(0, Math.min(3, stage))
  const stem = 'var(--sage-500)'
  const leaf = 'var(--sage-400)'
  const leafDeep = 'var(--sage-600)'

  // Stem height grows with the stage.
  const stemTop = [34, 26, 19, 14][s]

  return (
    <svg
      viewBox="0 0 64 64"
      className={`${className} ${animate ? 'animate-bloom' : ''}`}
      role="img"
      aria-label={label || STAGES[s].label}
    >
      {/* Soil mound */}
      <path d="M12 54c0-5.5 8.9-9 20-9s20 3.5 20 9z" fill="var(--peach-100)" />
      <path d="M8 54h48" stroke="var(--peach-300)" strokeWidth="2.5" strokeLinecap="round" />

      {/* Stem */}
      <path
        d={`M32 54 C32 46 32 ${stemTop + 6} 32 ${stemTop}`}
        stroke={stem}
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
      />

      {/* First leaf pair — always present */}
      <path d="M32 44c-6.5-.4-10-3.4-10.6-9 6.6.4 10.1 3.4 10.6 9z" fill={leaf} />
      <path d="M32 44c.5-6 4-9 10.6-9.4C42 40.3 38.5 43.4 32 44z" fill={leafDeep} opacity="0.85" />

      {/* Second leaf pair — stage 1+ */}
      {s >= 1 && (
        <>
          <path d="M32 33c-5.2-.3-8-2.7-8.5-7.2 5.3.3 8.1 2.7 8.5 7.2z" fill={leaf} />
          <path d="M32 33c.4-4.8 3.2-7.2 8.5-7.5-.5 4.5-3.3 7-8.5 7.5z" fill={leafDeep} opacity="0.85" />
        </>
      )}

      {/* Bud / crown leaf — stage 2+ */}
      {s >= 2 && (
        <path d="M32 24c-4-.2-6.2-2.1-6.6-5.6 4.1.2 6.3 2.1 6.6 5.6z" fill={leaf} />
      )}

      {/* Blooms */}
      {s === 2 && <Flower cx={32} cy={16} r={4} />}
      {s === 3 && (
        <>
          <Flower cx={32} cy={13} r={4.4} />
          <Flower cx={21} cy={24} r={3.2} petal="var(--butter-300)" center="var(--spend-200)" />
          <Flower cx={43} cy={26} r={3.2} petal="var(--lavender-300)" center="var(--butter-300)" />
        </>
      )}

      {/* A single twinkle at full bloom — the only ambient motion here */}
      {s === 3 && (
        <g className="animate-sparkle" style={{ transformOrigin: '50px 12px' }}>
          <path
            d="M50 6c.5 3.4 1.1 4 4.5 4.5-3.4.5-4 1.1-4.5 4.5-.5-3.4-1.1-4-4.5-4.5 3.4-.5 4-1.1 4.5-4.5z"
            fill="var(--butter-500)"
          />
        </g>
      )}
    </svg>
  )
}
