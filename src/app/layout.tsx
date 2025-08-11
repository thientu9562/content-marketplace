import type { Metadata } from "next";
import "./globals.css";
import ClientProviders from "./ClientProviders"; // Import wrapper client-side

export const metadata: Metadata = {
  title: "AI Content Marketplace",
  description: "Mint AI-generated content with attribution on Camp Network",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ClientProviders>{children}</ClientProviders> {/* Wrap children với Providers ở client */}
      </body>
    </html>
  );
}