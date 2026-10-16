// NEXT_PUBLIC_BILLING_ENABLED=false hides all Stripe/pricing UI and turns off
// checkout and the billing portal. NEXT_PUBLIC_ so the same flag is readable
// from client components (it's inlined at build time — restart/rebuild after
// changing it). Plans can still be granted by hand from /admin/plans.
export const billingHidden = process.env.NEXT_PUBLIC_BILLING_ENABLED === 'false'
