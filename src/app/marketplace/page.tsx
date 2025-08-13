"use client";

// Import the IPList component for displaying minted IPs
import IPList from "../../../components/IPList";

// Main component for the marketplace page
export default function MarketplacePage() {
  // Render the marketplace page UI
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-3xl font-bold mb-8">IP Marketplace</h1>
      <p className="text-xl mb-4">Browse, sell IPs</p>
      <IPList />
    </div>
  );
}