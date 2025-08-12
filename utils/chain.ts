import { defineChain } from "viem";

export const campNetwork = defineChain({
  id: 123420001114,
  name: "basecamp",
  nativeCurrency: { name: "CAMP", symbol: "CAMP", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc-campnetwork.xyz"] }, 
    public: { http: ["https://rpc-campnetwork.xyz"] },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: "https://basecamp.cloud.blockscout.com",
    },
  },
  contracts: { origin: { address: "0xF90733b9eCDa3b49C250B2C3E3E42c96fC93324E" } }
});