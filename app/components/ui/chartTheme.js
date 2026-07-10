// Shared Recharts styling so every chart tooltip and axis reads the same.
// Values are CSS variables so charts follow the light/dark theme swap.
export const TOOLTIP_STYLE = {
  backgroundColor: 'var(--surface)',
  color: 'var(--ink)',
  borderRadius: '10px',
  border: '1px solid var(--line)',
  boxShadow: '0 1px 2px rgb(0 0 0 / 0.05)',
  fontSize: '12px',
}

// Spread onto <Tooltip {...TOOLTIP_PROPS}>. contentStyle alone isn't enough:
// Recharts colors the item rows (the "Amount: $751" line) via itemStyle and
// the label via labelStyle, and its defaults are dark-on-dark in dark mode.
export const TOOLTIP_PROPS = {
  contentStyle: TOOLTIP_STYLE,
  itemStyle: { color: 'var(--ink)' },
  labelStyle: { color: 'var(--ink-soft)' },
}

export const AXIS_TICK = { fontSize: 11, fill: 'var(--ink-faint)' }
export const GRID_STROKE = 'var(--line)'
