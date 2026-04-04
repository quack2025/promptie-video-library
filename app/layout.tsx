import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { LogoutButton } from "./logout-button";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "InsightGenius",
  description: "InsightGenius - RAG Video Testing Tool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 dark:bg-gray-950`}
      >
        <div className="flex flex-col max-w-5xl mx-auto h-full p-4 md:p-6">
          <header className="flex items-center justify-between pb-4 mb-2 border-b border-gray-200 dark:border-gray-800">
              <Link href="/" className="flex items-center gap-3 no-underline hover:no-underline">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                </div>
                <div className="flex flex-col">
                  <h1 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">InsightGenius</h1>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest leading-tight">
                    RAG Video Testing Tool
                  </p>
                </div>
              </Link>
              <div className="flex items-center gap-3">
                <Link href="/search" className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 no-underline">
                  Search
                </Link>
                <LogoutButton />
              </div>
          </header>
          <main className="flex flex-col w-full h-full">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
