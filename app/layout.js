import { ClerkProvider } from '@clerk/nextjs'
import { Plus_Jakarta_Sans, Bricolage_Grotesque } from 'next/font/google'
import './globals.css'

// Two faces, two jobs (see the typography rules in globals.css):
//   Plus Jakarta Sans — every piece of real UI: money, tables, forms,
//     navigation, chart labels. Geometric, crisp, excellent numerals.
//   Bricolage Grotesque — the display face. Opt in with `.font-display` for
//     page titles, marketing, and single headline figures like the hero balance.
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
})

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  display: 'swap',
})

export const metadata = {
  title: 'Penny Sprout',
  description: 'AI-powered personal finance analyzer',
  icons: {
    icon: '/sprout-svgrepo-com.svg',
  },
}

// Mint canvas in light, green-black in dark — keeps the mobile browser chrome
// on-palette instead of flashing a stark white bar above the page.
export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F2F5F1' },
    { media: '(prefers-color-scheme: dark)',  color: '#090E0B' },
  ],
}

// Applies the saved (or system) theme before first paint so a dark-mode user
// never sees a white flash. Must stay tiny and synchronous.
const themeInit = `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark')}catch(e){}})()`

export default function RootLayout({ children }) {
  return (
    <ClerkProvider telemetry={false}>
      {/* suppressHydrationWarning: the inline script may add .dark before React hydrates */}
      <html lang="en" className={`${jakarta.variable} ${bricolage.variable}`} suppressHydrationWarning>
        <body className="font-sans antialiased">
          <script dangerouslySetInnerHTML={{ __html: themeInit }} />
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
