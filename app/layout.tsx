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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="flex flex-col max-w-4xl mx-auto h-full p-4">
          <header className="flex items-center justify-between pb-4">
              <div className="flex flex-col">
                <h1 className="text-2xl font-bold">InsightGenius</h1>
                <p className="text-sm text-gray-500">
                  RAG Video Testing Tool
                </p>
              </div>
              <LogoutButton />
          </header>
          <main className="flex flex-col w-full h-full">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
