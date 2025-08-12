"use client";

import IPList from "../../../components/IPList";

export default function MarketplacePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-3xl font-bold mb-8">IP Marketplace</h1>
      <p className="text-xl mb-4">Browse, sell IPs</p>
      <IPList />
    </div>
  );
}