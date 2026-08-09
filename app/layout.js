import { ClerkProvider } from '@clerk/nextjs'
import { Nunito_Sans, Quicksand } from 'next/font/google'
import './globals.css'

// Two faces, two jobs (see the typography rules in globals.css):
//   Nunito Sans — every piece of real UI. Rounded enough to feel warm, but a
//     workhorse text face: money, tables, forms, navigation, chart labels.
//   Quicksand — the playful one. Opt in with `.font-display`, and only for
//     marketing, onboarding, empty states, and decorative section titles.
//     Never for amounts, transactions, or anything accessibility-critical.
const nunito = Nunito_Sans({
  subsets: ['latin'],
  variable: '--font-nunito',
  display: 'swap',
})

const quicksand = Quicksand({
  subsets: ['latin'],
  variable: '--font-quicksand',
  display: 'swap',
})

export const metadata = {
  title: 'Penny Sprout',
  description: 'AI-powered personal finance analyzer',
  icons: {
    icon: '/sprout-svgrepo-com.svg',
  },
}

// Warm cream in light, warm charcoal in dark — keeps the mobile browser chrome
// on-palette instead of flashing a stark white bar above the page.
export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFF9F1' },
    { media: '(prefers-color-scheme: dark)',  color: '#1B1714' },
  ],
}

// Applies the saved (or system) theme before first paint so a dark-mode user
// never sees a white flash. Must stay tiny and synchronous.
const themeInit = `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark')}catch(e){}})()`

export default function RootLayout({ children }) {
  return (
    <ClerkProvider telemetry={false}>
      {/* suppressHydrationWarning: the inline script may add .dark before React hydrates */}
      <html lang="en" className={`${nunito.variable} ${quicksand.variable}`} suppressHydrationWarning>
        <body className="font-sans antialiased">
          <script dangerouslySetInnerHTML={{ __html: themeInit }} />
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
