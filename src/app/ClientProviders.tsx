"use client";

import { ReactNode, useEffect, useState } from "react";
import { CampProvider, CampModal } from "@campnetwork/origin/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http, Config } from "wagmi"; // Import Config
import { metaMask, walletConnect } from "@wagmi/connectors";
import { campNetwork } from "../../utils/chain";

const queryClient = new QueryClient();

interface ClientProvidersProps {
  children: ReactNode;
}

export default function ClientProviders({ children }: ClientProvidersProps) {
  const [config, setConfig] = useState<Config | null>(null); // Sử dụng Config thay cho any

  useEffect(() => {
    const setupConfig = async () => {
      const newConfig = createConfig({
        chains: [campNetwork],
        connectors: [
          metaMask(),
          walletConnect({ projectId: "your-walletconnect-project-id" }),
        ],
        transports: {
          [campNetwork.id]: http(),
        },
      });
      setConfig(newConfig);
    };
    setupConfig();
  }, []);

  if (!config) return <div>Loading wallet configuration...</div>;

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <CampProvider clientId="fce77d7a-8085-47ca-adff-306a933e76aa">
          <CampModal />
          {children}
        </CampProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}