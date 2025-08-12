"use client";

import { useEffect, useState } from "react";
import { createPublicClient, http, parseAbiItem } from "viem";
import { useAccount, useWalletClient, useConnect, useSwitchChain } from "wagmi";
import { campNetwork } from "../utils/chain";
import IPCard from "./IPCard";
import { IPData } from "../utils/types";

const CONTRACT_ADDRESS = "0xF90733b9eCDa3b49C250B2C3E3E42c96fC93324E" as `0x${string}`;
const MAX_BLOCK_RANGE = 100000; // Maximum block range allowed by RPC

const dataMintedEvent = parseAbiItem(
  "event DataMinted(uint256 indexed tokenId, address indexed creator, bytes32 contentHash)"
);

// Định nghĩa interface cho metadata từ IPFS
interface IPMetadata {
  title: string;
  description: string;
  category: string;
  attribution: string;
  image: string;
}

// Cập nhật interface IPData để bao gồm metadata
interface ExtendedIPData extends IPData {
  metadata?: IPMetadata;
}

export default function MintedIPsList() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { connect, connectors } = useConnect();
  const { switchChainAsync } = useSwitchChain();
  const [ips, setIps] = useState<ExtendedIPData[]>([]);
  const [status, setStatus] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchMintedIPs = async (userAddress: `0x${string}`) => {
    try {
      setIsLoading(true);
      const publicClient = createPublicClient({
        chain: campNetwork,
        transport: http(),
      });

      // Get the latest block number
      const latestBlock = await publicClient.getBlockNumber();
      const fromBlock = 0n;
      let currentFromBlock = fromBlock;
      const results: ExtendedIPData[] = [];

      // Query logs in chunks of MAX_BLOCK_RANGE
      while (currentFromBlock <= latestBlock) {
        const toBlock = currentFromBlock + BigInt(MAX_BLOCK_RANGE) > latestBlock
          ? latestBlock
          : currentFromBlock + BigInt(MAX_BLOCK_RANGE);

        try {
          const logs = await publicClient.getLogs({
            address: CONTRACT_ADDRESS,
            event: dataMintedEvent,
            args: { creator: userAddress },
            fromBlock: currentFromBlock,
            toBlock,
          });

          

          const chunkResults = await Promise.all(
            logs.map(async (log) => {
              const { tokenId, contentHash, creator } = log.args;

              let tokenURI = "";
              let metadata: IPMetadata | undefined;
              try {
                tokenURI = await publicClient.readContract({
                  address: CONTRACT_ADDRESS,
                  abi: [
                    parseAbiItem(
                      "function tokenURI(uint256) view returns (string)"
                    ),
                  ],
                  functionName: "tokenURI",
                  args: [tokenId as bigint],
                });

                // Fetch metadata từ link IPFS
                if (tokenURI) {
                  const response = await fetch(tokenURI);
                  if (response.ok) {
                    metadata = await response.json();
                  } else {
                    console.error(`Error fetching metadata for token ${tokenId}`);
                  }
                }
              } catch (err) {
                console.error(`Error processing tokenURI for ${tokenId}:`, err);
              }

              return {
                tokenId: Number(tokenId),
                creator: creator as `0x${string}`,
                contentHash: contentHash as `0x${string}`,
                tokenURI,
                transactionHash: log.transactionHash,
                metadata,
              };
            })
          );

          results.push(...chunkResults);

        } catch (chunkError) {
          console.error(`Error querying logs for block range ${currentFromBlock} to ${toBlock}:`, chunkError);
        }

        currentFromBlock = toBlock + 1n;
      }
console.log(`đây là log event:`, results);
      setIps(results);
    } catch (error) {
      console.error("Error querying minted IPs:", error);
      setStatus("Error loading IPs. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      if (!isConnected) {
        setStatus("Connecting wallet...");
        await connect({ connector: connectors[0] });
      }
      if (walletClient) {
        const chainId = await walletClient.getChainId();
        if (chainId !== campNetwork.id) {
          setStatus("Switching to BaseCAMP...");
          await switchChainAsync({ chainId: campNetwork.id });
        }
      }
    } catch (error) {
      console.error("Error connecting wallet:", error);
      setStatus("Failed to connect wallet.");
    }
  };

  useEffect(() => {
    if (isConnected && address) {
      fetchMintedIPs(address as `0x${string}`);
    }
  }, [isConnected, address]);

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center gap-4 p-4">
        <p className="text-lg">Please connect your wallet to view minted IPs.</p>
        <button
          onClick={handleConnect}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition"
        >
          Connect Wallet
        </button>
        {status && <p className="text-sm text-gray-600">{status}</p>}
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Your Minted IPs</h1>
      {isLoading ? (
        <p>Loading IPs...</p>
      ) : ips.length === 0 ? (
        <p>No IPs minted yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ips.map((ip) => (
            <IPCard key={ip.tokenId} ip={ip} />
          ))}
        </div>
      )}
      {status && <p className="text-sm text-red-600 mt-2">{status}</p>}
    </div>
  );
}