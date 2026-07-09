import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy — Penny Sprout',
  description: 'How Penny Sprout handles, stores, and protects your financial data.',
}

const UPDATED = 'June 12, 2026'
const CONTACT = 'melodygatan@gmail.com' // ← change to your support address if you add one

function Section({ title, children }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-ink-soft">{children}</div>
    </section>
  )
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-app">
      <div className="mx-auto max-w-2xl px-5 py-12 sm:py-16">
        <Link href="/" className="text-sm font-medium text-sage-600 hover:text-sage-700">
          ← Back to Penny Sprout
        </Link>

        <h1 className="mt-6 text-2xl font-bold text-ink">Privacy Policy</h1>
        <p className="mt-1 text-xs text-ink-faint">Last updated {UPDATED}</p>

        <p className="mt-6 text-sm leading-relaxed text-ink-soft">
          Penny Sprout helps you understand your own spending. We designed it to hold as little
          of your personal information as possible. This page explains, in plain language, exactly
          what we do and do not do with your data.
        </p>

        <Section title="The short version">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>We <strong>strip personal identifiers from your statements before storing anything</strong>.</li>
            <li>We <strong>never sell, rent, or share</strong> your financial data, and we run no advertising or behavioral-tracking SDKs.</li>
            <li>Your data is <strong>encrypted in transit (TLS) and at rest (AES-256)</strong>.</li>
            <li>You can <strong>delete any uploaded statement at any time</strong>, which removes it from our database.</li>
          </ul>
        </Section>

        <Section title="What we collect">
          <p>
            When you upload a bank or card statement, we send the file to our parsing service to
            extract transactions. <strong>Before we save anything</strong>, we instruct the parser to
            discard personally identifiable information — your name, address, phone, email, account
            and routing numbers, and similar identifiers are <strong>not</strong> extracted or stored.
          </p>
          <p>
            What we actually store for each transaction is limited to: the <strong>merchant or payee
            name</strong>, the <strong>date</strong>, the <strong>amount</strong>, and a <strong>spending
            category</strong>. The original uploaded file itself is processed in memory and is not
            retained on our servers.
          </p>
          <p>
            To sign you in, we also store the account identifier and email associated with your login,
            handled by our authentication provider (below).
          </p>
        </Section>

        <Section title="Where your data is stored">
          <p>
            Your transaction data is stored in a managed Postgres database (Supabase). It is encrypted
            at rest with AES-256 and transmitted over TLS. Access is restricted at the database level
            (Row Level Security) so the data is only reachable through our authenticated server, scoped
            to your account.
          </p>
          <p>
            <strong>To be clear about what this is not:</strong> this is not end-to-end encryption. Our
            server can read your transaction data in order to generate the charts and AI insights you
            asked for. We do not claim otherwise.
          </p>
        </Section>

        <Section title="Service providers we use">
          <p>We rely on a small number of trusted providers to operate the app. We share only what each one needs to do its job:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li><strong>Clerk</strong> — handles sign-in and account security.</li>
            <li><strong>Supabase</strong> — stores your de-identified transaction data.</li>
            <li>
              <strong>Anthropic (Claude API)</strong> — parses your uploaded statements and generates
              spending insights. Anthropic does not train its models on data sent through its API.
            </li>
          </ul>
        </Section>

        <Section title="How we make money">
          <p>
            We do <strong>not</strong> sell, rent, or monetize your spending data, and we do not build
            advertising profiles from it. Your financial information is used solely to provide the
            features you see in the app.
          </p>
        </Section>

        <Section title="Your control over your data">
          <p>
            You can delete any uploaded statement from within the app at any time; deleting it removes
            the associated transactions from our database. If you would like your entire account and all
            associated data deleted, contact us at the address below and we will remove it.
          </p>
        </Section>

        <Section title="Security practices">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Sign-in requires a verified email and password, handled by our authentication provider.</li>
            <li>Every request that touches your data requires an authenticated session.</li>
            <li>Database access is locked down with Row Level Security and reached only through our server.</li>
            <li>We minimize what we collect — de-identifying statements before storage.</li>
            <li>Multi-factor authentication (MFA) is not available yet; it is on our roadmap.</li>
          </ul>
        </Section>

        <Section title="Contact">
          <p>
            Questions about your privacy or this policy? Reach us at{' '}
            <a href={`mailto:${CONTACT}`} className="font-medium text-sage-600 hover:text-sage-700">
              {CONTACT}
            </a>.
          </p>
        </Section>
      </div>
    </main>
  )
}
