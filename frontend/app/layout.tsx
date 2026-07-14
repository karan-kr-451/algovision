import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AlgoVision",
  description: "Visualize along with code — not after it.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full flex flex-col bg-[var(--background)] text-[var(--foreground)]">
        <nav className="border-b border-zinc-800 px-6 py-3 flex items-center gap-6 shrink-0">
          <a href="/" className="font-semibold tracking-tight">
            AlgoVision
          </a>
          <a href="/problems" className="text-sm text-zinc-400 hover:text-zinc-100">
            Problems
          </a>
        </nav>
        <main className="flex flex-1 flex-col min-h-0">{children}</main>
      </body>
    </html>
  );
}
