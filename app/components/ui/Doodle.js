'use client'

// ─── Hand-drawn doodle set ────────────────────────────────────────────────────
//
// The app's decorative vocabulary: tiny botanicals, stars, sparkles, hearts,
// clouds, mushrooms, washi tape. Every shape is stroked in `currentColor` at a
// consistent 1.6 weight on a 24×24 grid, so a doodle inherits its color from a
// text-* class and always looks like it came from the same pen.
//
// Rules of use (enforced by convention, not code):
//   • Doodles are DECORATION. They are rendered aria-hidden and must never be
//     the only carrier of meaning — no doodle-only status, no doodle-only
//     category identity.
//   • Never place one behind financial text. Anchor them to card corners,
//     section headers, empty states, and celebration moments instead.
//   • Density scales inversely with how important the numbers are: generous on
//     marketing and empty states, near-zero on transactions and settings.

const PATHS = {
  // A single leaf on a stem
  leaf: (
    <>
      <path d="M12 21c0-5 0-8 0-11" />
      <path d="M12 10c0-4 2.6-6.6 7-7 .4 4.4-2.2 7.4-7 7z" />
    </>
  ),
  // Two-leaf seedling — the brand mark in miniature
  sprout: (
    <>
      <path d="M12 21v-7" />
      <path d="M12 14c-3.4 0-5.4-2-5.6-5.4 3.4-.2 5.4 1.8 5.6 5.4z" />
      <path d="M12 14c.2-3.9 2.4-6 6.1-5.8C17.9 11.9 15.8 14 12 14z" />
    </>
  ),
  // Botanical sprig — a stem with paired leaves
  sprig: (
    <>
      <path d="M12 22V4" />
      <path d="M12 9c-2.4-.3-3.6-1.6-3.8-4C10.6 5.2 11.8 6.5 12 9z" />
      <path d="M12 9c.2-2.5 1.4-3.8 3.8-4-.2 2.4-1.4 3.7-3.8 4z" />
      <path d="M12 15c-2.4-.3-3.6-1.6-3.8-4 2.4.2 3.6 1.5 3.8 4z" />
      <path d="M12 15c.2-2.5 1.4-3.8 3.8-4-.2 2.4-1.4 3.7-3.8 4z" />
    </>
  ),
  // Five-petal flower
  flower: (
    <>
      <circle cx="12" cy="10" r="2" />
      <path d="M12 8c0-2.4.7-3.6 2-3.6S16 5.6 16 8" />
      <path d="M13.7 9.2c2-1.3 3.4-1.4 4.1-.3.7 1.1-.1 2.3-2.1 3.6" />
      <path d="M13 12.6c1.2 2 1.3 3.5.2 4.2-1.1.7-2.3-.1-3.5-2.1" />
      <path d="M10.3 12.5c-2 1.3-3.4 1.4-4.1.3-.7-1.1.1-2.3 2.1-3.6" />
      <path d="M10 8.4c-1.2-2-1.3-3.5-.2-4.2 1.1-.7 2.3.1 3.5 2.1" />
      <path d="M12 17v4" />
    </>
  ),
  // Tulip — used for savings goals
  tulip: (
    <>
      <path d="M12 21v-9" />
      <path d="M7.5 5.5c1.6-.6 3.2 0 4.5 1.6 1.3-1.6 2.9-2.2 4.5-1.6.4 3.9-1.5 6.3-4.5 6.3s-4.9-2.4-4.5-6.3z" />
      <path d="M12 17c-2-.2-3.1-1.4-3.3-3.5 2.1.2 3.2 1.4 3.3 3.5z" />
    </>
  ),
  // Four-point twinkle
  sparkle: <path d="M12 3.5c.6 4.4 1.5 5.3 5.9 5.9-4.4.6-5.3 1.5-5.9 5.9-.6-4.4-1.5-5.3-5.9-5.9 4.4-.6 5.3-1.5 5.9-5.9z" />,
  // Five-point star
  star: <path d="M12 4.2l2.3 4.7 5.2.8-3.7 3.6.9 5.1-4.7-2.4-4.7 2.4.9-5.1L4.5 9.7l5.2-.8L12 4.2z" />,
  heart: <path d="M12 20s-7-4.3-7-9a3.9 3.9 0 017-2.4A3.9 3.9 0 0119 11c0 4.7-7 9-7 9z" />,
  cloud: (
    <path d="M7 18h10a3.5 3.5 0 00.4-7 5 5 0 00-9.6-.9A3.6 3.6 0 007 18z" />
  ),
  mushroom: (
    <>
      <path d="M4.5 11a7.5 7.5 0 0115 0z" />
      <path d="M10 11v6a2 2 0 004 0v-6" />
    </>
  ),
  // A trail of three dots — a soft divider or breadcrumb flourish
  dots: (
    <>
      <circle cx="6" cy="12" r="1.1" />
      <circle cx="12" cy="12" r="1.1" />
      <circle cx="18" cy="12" r="1.1" />
    </>
  ),
  // Hand-drawn curved arrow — points at a call to action
  arrow: (
    <>
      <path d="M4 17c4.5.6 8.8-1.2 11.6-5.7" />
      <path d="M12.6 11.6l3.6-.6.9 3.6" />
    </>
  ),
  // Loose circle, like something ringed in pencil
  circleScribble: <path d="M15.5 5.2C11 3.4 5.6 5.6 4.7 10c-.9 4.2 3 8 7.6 8.3 4.4.3 7.9-2.7 7.6-6.5-.2-3.1-2.6-5.6-6.2-6.2" />,
  // Soft swirl
  swirl: <path d="M4 15c2-4 5-6 8-5.5 2.4.4 3.4 3 1.9 4.6-1.2 1.3-3.2.6-3-1.2.2-1.8 2.4-3.3 5-2.9 2.4.4 4 2.3 4.1 4.5" />,
}

export const DOODLE_NAMES = Object.keys(PATHS)

// One doodle. Size with a Tailwind h-/w- class, color with a text-* class.
export default function Doodle({ name = 'sprout', className = 'h-5 w-5', strokeWidth = 1.6 }) {
  const path = PATHS[name] || PATHS.sprout
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {path}
    </svg>
  )
}

// A washi-tape strip, for pinning a card to the "page". Purely decorative.
// `tone` picks the pastel; `className` places it (usually -top-2 with a rotate).
export function WashiTape({ tone = 'sage', className = '' }) {
  const TONES = {
    sage:     'var(--sage-300)',
    blush:    'var(--spend-200)',
    peach:    'var(--peach-300)',
    butter:   'var(--butter-300)',
    lavender: 'var(--lavender-300)',
    blue:     'var(--blue-200)',
  }
  return (
    <span
      aria-hidden="true"
      className={`washi ${className}`}
      style={{ backgroundColor: TONES[tone] || TONES.sage }}
    />
  )
}

// A small scattered cluster for empty states and celebration moments. Kept to
// three marks at low opacity so it reads as a flourish, not a sticker sheet.
export function DoodleCluster({ className = '' }) {
  return (
    <span aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <Doodle name="sparkle" className="absolute left-[12%] top-[18%] h-4 w-4 text-sage-300 opacity-70" />
      <Doodle name="leaf"    className="absolute right-[14%] top-[26%] h-5 w-5 text-sage-300 opacity-60 -rotate-12" />
      <Doodle name="dots"    className="absolute bottom-[16%] left-[22%] h-4 w-4 text-sage-300 opacity-50" />
    </span>
  )
}
