"use client";

import { ReactNode } from "react";
import { CampProvider, CampModal } from "@campnetwork/origin/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { defineChain } from "viem";
import { metaMask, walletConnect } from "@wagmi/connectors";

// Define BaseCAMP chain
const baseCamp = defineChain({
      id: 123420001114,
    name: "Basecamp",
    nativeCurrency: {
      decimals: 18,
      name: "Camp",
      symbol: "CAMP",
    },
    rpcUrls: {
      default: {
        http: [
          "https://rpc-campnetwork.xyz",
          "https://rpc.basecamp.t.raas.gelato.cloud",
        ],
      },
    },
    blockExplorers: {
      default: {
        name: "Explorer",
        url: "https://basecamp.cloud.blockscout.com/",
      },
    },
});

// Wagmi config với MetaMask và WalletConnect
const config = createConfig({
  chains: [baseCamp],
  connectors: [
    metaMask(), // Hỗ trợ MetaMask
    walletConnect({ projectId: "your-walletconnect-project-id" }), // Thay nếu dùng WalletConnect
  ],
  transports: {
    [baseCamp.id]: http(),
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
        <CampProvider clientId="fce77d7a-8085-47ca-adff-306a933e76aa"> {/* clientId từ bạn */}
          <CampModal />
          {children}
        </CampProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}