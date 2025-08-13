"use client";

// Import necessary libraries and components
import { ReactNode, useEffect, useState } from "react";
import { CampProvider, CampModal } from "@campnetwork/origin/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http, Config } from "wagmi"; // Import Config type for type safety
import { metaMask, walletConnect } from "@wagmi/connectors";
import { campNetwork } from "../../utils/chain";

// Initialize QueryClient for managing server-state
const queryClient = new QueryClient();

// Define props interface for the ClientProviders component
interface ClientProvidersProps {
  children: ReactNode;
}

// Main component to provide client-side context for wallet, query, and Camp network
export default function ClientProviders({ children }: ClientProvidersProps) {
  // State hook to manage Wagmi configuration
  const [config, setConfig] = useState<Config | null>(null); // Use Config type instead of any for type safety

  // Effect to set up Wagmi configuration on component mount
  useEffect(() => {
    // Function to create and set Wagmi configuration
    const setupConfig = async () => {
      const newConfig = createConfig({
        chains: [campNetwork], // Configure supported blockchain networks
        connectors: [
          metaMask(), // MetaMask wallet connector
          walletConnect({ projectId: "your-walletconnect-project-id" }), // WalletConnect connector
        ],
        transports: {
          [campNetwork.id]: http(), // HTTP transport for the Camp network
        },
      });
      setConfig(newConfig); // Update state with the new configuration
    };
    setupConfig();
  }, []); // Empty dependency array to run only on mount

  // Render loading state while configuration is being set up
  if (!config) return <div>Loading wallet configuration...</div>;

  // Render provider stack for Wagmi, React Query, and Camp network
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <CampProvider clientId="fce77d7a-8085-47ca-adff-306a933e76aa">
          <CampModal /> {/* Modal component for Camp network interactions */}
          {children} {/* Render child components */}
        </CampProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}