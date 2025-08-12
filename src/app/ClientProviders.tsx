"use client";

import { ReactNode } from "react";
import { CampProvider, CampModal } from "@campnetwork/origin/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { metaMask, walletConnect } from "@wagmi/connectors";
import { campNetwork } from "../../utils/chain";


// Wagmi config với MetaMask và WalletConnect
const config = createConfig({
  chains: [campNetwork],
  connectors: [
    metaMask(), // Hỗ trợ MetaMask
    walletConnect({ projectId: "your-walletconnect-project-id" }), // Thay nếu dùng WalletConnect
  ],
  transports: {
    [campNetwork.id]: http(),
  },
});

const queryClient = new QueryClient();

interface ClientProvidersProps {
  children: ReactNode;
}

export default function ClientProviders({ children }: ClientProvidersProps) {
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