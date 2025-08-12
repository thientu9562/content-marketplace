"use client";

import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">AI-Generated Content Marketplace</h1>
      <p className="text-xl mb-4">Mint your AI content with attribution on Camp Network (BaseCAMP)</p>
      <Link href="/mint" className="bg-blue-500 text-white px-4 py-2 rounded mr-4">
        Go to Mint Page
      </Link>
      <Link href="/marketplace" className="bg-green-500 text-white px-4 py-2 rounded">
        Go to Marketplace
      </Link>
    </main>
  );
}