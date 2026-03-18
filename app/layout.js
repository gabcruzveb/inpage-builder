import './globals.css'

export const metadata = {
  title: 'Page Builder',
  description: 'Professional drag-and-drop page builder with GitHub publishing',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className="antialiased bg-black text-white min-h-screen">
        {children}
      </body>
    </html>
  )
}
