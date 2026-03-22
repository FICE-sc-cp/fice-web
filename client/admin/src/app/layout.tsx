import type { Metadata } from 'next'
import { TelegramProvider } from '@/components/TelegramProvider'
import './globals.css'

export const metadata: Metadata = {
  title: 'Admin',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script src="https://telegram.org/js/telegram-web-app.js" />
      </head>
      <body>
        <TelegramProvider>
          {children}
        </TelegramProvider>
      </body>
    </html>
  )
}