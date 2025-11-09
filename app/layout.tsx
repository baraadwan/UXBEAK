import type React from "react"
import type { Metadata } from "next"
import { Inter, Unbounded } from "next/font/google"
import "./globals.css"
import { AuthProvider } from "@/context/AuthContext"

const inter = Inter({ subsets: ["latin"] })
const unbounded = Unbounded({
  subsets: ["latin"],
  variable: "--font-unbounded",
})

export const metadata: Metadata = {
  title: "UXbreak - AI-Powered UX Analysis",
  description: "Your AI copilot for diagnosing UX problems before they kill conversions",
    generator: 'v0.app'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${unbounded.variable}`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
