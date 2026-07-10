// Budget-exceeded notifications, triggered by statement uploads (the only
// moment spending data actually changes — no cron needed). For every calendar
// month the upload touches, recompute per-category spend across ALL
// transactions in that month and email the user about any budget that is now
// over its limit. sendOnce's dedupe key ('YYYY-MM:Category') guarantees at
// most one email per budget per month, however many uploads follow.
import 'server-only'
import { getBudgets } from '@/lib/budgetStorage'
import { getTransactions } from '@/lib/transactionStorage'
import { normalizeCategory } from '@/lib/categories'
import { parseDate, toKey, monthKey, monthKeyLabel } from '@/lib/date'
import { sendOnce, emailEnabled } from '@/lib/email'

const money = (n) => `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// Never throws — this rides along on the upload request, and a mail hiccup
// must not fail a successful upload.
export async function checkBudgetAlerts(userId, email, uploadedTransactions) {
  if (!emailEnabled || !email) return
  try {
    const budgets = await getBudgets(userId)
    if (budgets.length === 0) return

    // Calendar months this upload touches.
    const months = new Set()
    uploadedTransactions.forEach(t => {
      const d = parseDate(t)
      if (d) months.add(monthKey(d))
    })

    for (const mk of months) {
      const [y, m] = mk.split('-').map(Number)
      const from = `${mk}-01`
      const to = toKey(new Date(y, m, 0)) // last day of that month

      const txns = await getTransactions(userId, { from, to })
      const spend = {}
      txns.forEach(t => {
        const cat = normalizeCategory(t.Category, t.Amount)
        if (cat === 'Income' || cat === 'Bills & Payments') return
        spend[cat] = (spend[cat] || 0) + Math.abs(parseFloat(t.Amount) || 0)
      })

      for (const b of budgets) {
        const spent = spend[b.category] || 0
        if (spent <= b.monthlyLimit) continue

        await sendOnce(userId, 'budget-exceeded', `${mk}:${b.category}`, {
          to: email,
          subject: `Your ${b.category} budget for ${monthKeyLabel(mk)} is over its limit`,
          html: `
            <p style="font-size:15px;color:#2E3830;margin:0 0 12px;">
              Heads up — your <strong>${b.category}</strong> spending in ${monthKeyLabel(mk)}
              is <strong>${money(spent)}</strong>, which is past the
              <strong>${money(b.monthlyLimit)}</strong> budget you set.
            </p>
            <p style="font-size:14px;color:#5B6159;margin:0;">
              No judgment — it happens. Open Penny Sprout to see where it went,
              or adjust the budget if it no longer fits your life.
            </p>`,
        })
      }
    }
  } catch (error) {
    console.error('Budget alert check failed:', error)
  }
}
