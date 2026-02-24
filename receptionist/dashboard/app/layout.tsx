import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'
import { Nav } from '@/components/Nav'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Reception — AI Phone Receptionist | Never Miss a Lead',
  description: 'Your AI receptionist answers every call, captures every lead, and books appointments. 24/7. Never miss a deal again.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-background text-foreground min-h-screen`}>
        <Nav />
        <main>{children}</main>
        <Toaster position="top-right" theme="dark" />
      </body>
    </html>
  )
}
