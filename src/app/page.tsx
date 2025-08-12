"use client";

import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 md:p-24">
      <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-8 text-center">
        AI-Generated Content Marketplace
      </h1>
      <p className="text-xl md:text-2xl text-gray-600 mb-8 text-center max-w-2xl">
        Mint your AI content with attribution on Camp Network (BaseCAMP)
      </p>
      <div className="flex flex-col md:flex-row items-center justify-center space-y-4 md:space-y-0 md:space-x-6">
        <Link href="/mint" className="bg-blue-500 text-white px-6 py-3 rounded-lg text-lg font-medium hover:bg-blue-600 transition duration-300">
          Mint Page
        </Link>
        <Link href="/marketplace" className="bg-green-500 text-white px-6 py-3 rounded-lg text-lg font-medium hover:bg-green-600 transition duration-300">
          Marketplace
        </Link>
      </div>
    </main>
  );
}