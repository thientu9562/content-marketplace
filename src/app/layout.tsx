// Import necessary libraries and components
import type { Metadata } from "next";
import "./globals.css"; // Import global CSS styles
import ClientProviders from "./ClientProviders"; // Import client-side provider component

// Define metadata for the application
export const metadata: Metadata = {
  title: "AI Content Marketplace", // Page title
  description: "Mint AI-generated content with attribution on Camp Network", // Page description
};

// Main layout component for the application
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Render the HTML structure with client-side providers
  return (
    <html lang="en">
      <body>
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}