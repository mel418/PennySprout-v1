import Link from 'next/link'

export const metadata = {
  title: 'Terms of Service — Penny Sprout',
  description: 'The terms that govern your use of Penny Sprout.',
}

const UPDATED = 'July 8, 2026'
const CONTACT = 'melodygatan@gmail.com' // ← change to your support address if you add one

function Section({ title, children }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-ink-soft">{children}</div>
    </section>
  )
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-app">
      <div className="mx-auto max-w-2xl px-5 py-12 sm:py-16">
        <Link href="/" className="text-sm font-medium text-sage-600 hover:text-sage-700">
          ← Back to Penny Sprout
        </Link>

        <h1 className="mt-6 text-2xl font-bold text-ink">Terms of Service</h1>
        <p className="mt-1 text-xs text-ink-faint">Last updated {UPDATED}</p>

        <p className="mt-6 text-sm leading-relaxed text-ink-soft">
          These terms govern your use of Penny Sprout. By creating an account or using the app,
          you agree to them. We&apos;ve written them in plain language on purpose — if anything is
          unclear, ask us.
        </p>

        <Section title="What Penny Sprout is">
          <p>
            Penny Sprout is a personal finance tool: you upload your own bank and card statements,
            and the app organizes them into calendars, charts, and AI-generated insights about your
            spending. How we handle your data is covered in our{' '}
            <Link href="/privacy" className="text-sage-600 underline decoration-sage-300 underline-offset-2 hover:text-sage-700">
              Privacy Policy
            </Link>, which is part of these terms.
          </p>
        </Section>

        <Section title="What Penny Sprout is not">
          <p>
            Penny Sprout is <strong>not financial, investment, tax, or legal advice</strong>. The
            insights, scores, and recommendations are automatically generated to help you reflect on
            your own spending — they are informational only. Make financial decisions based on your
            own judgment or the advice of a qualified professional, not on what this app tells you.
          </p>
        </Section>

        <Section title="Accuracy and AI-generated content">
          <p>
            Transaction extraction and analysis are performed in part by an AI model. AI output can
            be incomplete or wrong: a transaction may be mis-read, mis-categorized, or missed
            entirely, and totals or insights may reflect those errors. We work to make parsing
            accurate, but <strong>you are responsible for verifying the numbers against your actual
            statements</strong> before relying on them.
          </p>
        </Section>

        <Section title="Your account">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>You must provide accurate sign-in information and keep your credentials secure.</li>
            <li>You are responsible for activity that happens under your account.</li>
            <li>Only upload statements for accounts you own or are authorized to manage.</li>
          </ul>
        </Section>

        <Section title="Acceptable use">
          <p>Don&apos;t misuse the service. In particular, you agree not to:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Upload files containing other people&apos;s financial data without their authorization.</li>
            <li>Attempt to access other users&apos; data or probe, scan, or test the security of the service.</li>
            <li>Use automated scripts to overload the service or its AI analysis features (usage limits apply).</li>
            <li>Use the service for anything unlawful.</li>
          </ul>
        </Section>

        <Section title="Your content">
          <p>
            The statements you upload and the transaction data extracted from them remain yours. You
            give us permission to process that data solely to provide the app&apos;s features — parsing,
            storage, charts, and AI analysis — as described in the Privacy Policy. You can delete
            your uploaded files at any time from within the app.
          </p>
        </Section>

        <Section title="Availability and changes">
          <p>
            Penny Sprout is provided as-is and may change, gain or lose features, or be interrupted.
            We do our best to keep it available and your data intact, but we do not guarantee
            uninterrupted service, and you should keep your original statements — the app is a lens
            on your data, not a system of record.
          </p>
        </Section>

        <Section title="Termination">
          <p>
            You can stop using Penny Sprout at any time and ask us to delete your account and data
            (see the Privacy Policy). We may suspend or close accounts that violate these terms or
            abuse the service.
          </p>
        </Section>

        <Section title="Disclaimers and limitation of liability">
          <p>
            To the maximum extent permitted by law, Penny Sprout is provided <strong>without
            warranties of any kind</strong>, express or implied, and we are <strong>not liable for
            indirect, incidental, or consequential damages</strong> — including financial decisions
            made in reliance on the app&apos;s output. Our total liability for any claim relating to the
            service is limited to the amount you paid us for it in the twelve months before the
            claim (currently: nothing, as the service is free).
          </p>
        </Section>

        <Section title="Changes to these terms">
          <p>
            If we make material changes to these terms, we&apos;ll update the date at the top and, for
            significant changes, let you know in the app. Continuing to use Penny Sprout after a
            change means you accept the updated terms.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about these terms? Reach us at{' '}
            <a href={`mailto:${CONTACT}`} className="text-sage-600 underline decoration-sage-300 underline-offset-2 hover:text-sage-700">
              {CONTACT}
            </a>.
          </p>
        </Section>
      </div>
    </main>
  )
}
