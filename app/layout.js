import { ClerkProvider } from '@clerk/nextjs'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata = {
  title: 'Penny Sprout',
  description: 'AI-powered personal finance analyzer',
  icons: {
    icon: '/sprout-svgrepo-com.svg',
  },
}

// Applies the saved (or system) theme before first paint so a dark-mode user
// never sees a white flash. Must stay tiny and synchronous.
const themeInit = `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark')}catch(e){}})()`

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      {/* suppressHydrationWarning: the inline script may add .dark before React hydrates */}
      <html lang="en" className={inter.variable} suppressHydrationWarning>
        <body className="font-sans antialiased">
          <script dangerouslySetInnerHTML={{ __html: themeInit }} />
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
