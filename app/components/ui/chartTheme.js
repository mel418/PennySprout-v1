// Shared Recharts styling so every chart tooltip and axis reads the same.
// Values are CSS variables so charts follow the light/dark theme swap.
//
// Charts are financial instruments, not decoration: axis labels stay in the UI
// sans at a legible size, the grid is the faintest line in the palette, and
// series color always comes from the semantic category map (lib/categories) —
// never an ad-hoc chart palette.
export const TOOLTIP_STYLE = {
  backgroundColor: 'var(--surface)',
  color: 'var(--ink)',
  borderRadius: '14px',
  border: '1px solid var(--line)',
  boxShadow: 'var(--shadow-lift)',
  fontSize: '13px',
  padding: '8px 12px',
}

// Spread onto <Tooltip {...TOOLTIP_PROPS}>. contentStyle alone isn't enough:
// Recharts colors the item rows (the "Amount: $751" line) via itemStyle and
// the label via labelStyle, and its defaults are dark-on-dark in dark mode.
export const TOOLTIP_PROPS = {
  contentStyle: TOOLTIP_STYLE,
  itemStyle: { color: 'var(--ink)', fontWeight: 600 },
  labelStyle: { color: 'var(--ink-soft)', marginBottom: 2 },
  cursor: { fill: 'var(--surface-hover)' },
}

// 12px, not 11px: chart labels are information, and they have to survive being
// read on a phone.
export const AXIS_TICK = { fontSize: 12, fill: 'var(--ink-faint)' }
export const GRID_STROKE = 'var(--line)'
