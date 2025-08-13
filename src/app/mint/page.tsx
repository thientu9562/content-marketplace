"use client";

// Import the MintForm component
import MintForm from "../../../components/MintForm";

// Main component for the minting page
export default function MintPage() {
  // Render the minting page UI
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-3xl font-bold mb-8">Mint Your AI-Generated Content</h1>
      <MintForm />
    </div>
  );
}