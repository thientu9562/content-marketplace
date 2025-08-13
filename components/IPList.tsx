"use client";

// Import necessary libraries and components
import { useEffect, useState } from "react";
import { createPublicClient, http, parseAbiItem } from "viem";
import { useAccount, useWalletClient, useConnect, useSwitchChain } from "wagmi";
import { useAuth } from "@campnetwork/origin/react";
import { campNetwork } from "../utils/chain";
import IPCard from "./IPCard";
import { IPData } from "../utils/types";
import mitt from "mitt";
import Link from "next/link";

// Define contract address as a constant
const CONTRACT_ADDRESS = "0xF90733b9eCDa3b49C250B2C3E3E42c96fC93324E" as `0x${string}`;
// Maximum block range allowed by RPC for querying logs
const MAX_BLOCK_RANGE = 100000;

// Parse the DataMinted event ABI for querying minting events
const dataMintedEvent = parseAbiItem(
  "event DataMinted(uint256 indexed tokenId, address indexed creator, bytes32 contentHash)"
);

// Define interface for metadata fetched from IPFS
interface IPMetadata {
  title: string;
  description: string;
  category: string;
  attribution: string;
  image: string;
}

// Extend IPData interface to include metadata
interface ExtendedIPData extends IPData {
  metadata?: IPMetadata;
}

// Create an event emitter instance for handling mint events
const emitter = mitt<{ newMint: `0x${string}` }>();

// Main component to display the list of minted IPs
export default function MintedIPsList() {
  // State hooks for managing user address, connection status, IPs, loading, status messages, and pagination
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { connect, connectors } = useConnect();
  const { switchChainAsync } = useSwitchChain();
  const { origin } = useAuth();
  const [ips, setIps] = useState<ExtendedIPData[]>([]);
  const [status, setStatus] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 20;

  // Calculate total pages and paginated IPs
  const totalPages = Math.ceil(ips.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedIps = ips.slice(startIndex, endIndex);

  // Function to fetch minted IPs for a given user address
  const fetchMintedIPs = async (userAddress: `0x${string}`) => {
    if (!origin) {
      setStatus("SDK not initialized. Please try again.");
      return;
    }

    try {
      // Set loading state to true
      setIsLoading(true);

      // Initialize public client for interacting with the blockchain
      const publicClient = createPublicClient({
        chain: campNetwork,
        transport: http(),
      });

      // Get the latest block number
      const latestBlock = await publicClient.getBlockNumber();
      const fromBlock = 0n;
      let currentFromBlock = fromBlock;
      const results: ExtendedIPData[] = [];

      // Query logs in chunks to avoid RPC limits
      while (currentFromBlock <= latestBlock) {
        const toBlock =
          currentFromBlock + BigInt(MAX_BLOCK_RANGE) > latestBlock
            ? latestBlock
            : currentFromBlock + BigInt(MAX_BLOCK_RANGE);

        try {
          // Fetch logs for DataMinted events for the user
          const logs = await publicClient.getLogs({
            address: CONTRACT_ADDRESS,
            event: dataMintedEvent,
            args: { creator: userAddress },
            fromBlock: currentFromBlock,
            toBlock,
          });

          // Process logs concurrently to extract IP data
          const chunkResults = await Promise.all(
            logs.map(async (log) => {
              const { tokenId, contentHash, creator } = log.args;

              // Check if the user is still the owner using origin SDK
              let isOwner = false;
              try {
                const owner = await origin.ownerOf(tokenId as bigint);
                isOwner = owner.toLowerCase() === userAddress.toLowerCase();
              } catch (err) {
                // Skip if token is invalid or deleted
                console.error(`Token ${tokenId} invalid or deleted:`, err);
                return null;
              }

              // Skip if the user is no longer the owner
              if (!isOwner) {
                return null;
              }

              let tokenURI = "";
              let metadata: IPMetadata | undefined;
              try {
                // Fetch token URI from the contract
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

                // Fetch metadata from IPFS link
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

              // Return structured IP data
              return {
                tokenId: tokenId?.toString() || "",
                creator: creator as `0x${string}`,
                contentHash: contentHash as `0x${string}`,
                tokenURI,
                transactionHash: log.transactionHash,
                metadata,
              };
            })
          );

          // Filter out null results (invalid tokens)
          results.push(...chunkResults.filter((item) => item !== null) as ExtendedIPData[]);
        } catch (chunkError) {
          console.error(
            `Error querying logs for block range ${currentFromBlock} to ${toBlock}:`,
            chunkError
          );
        }

        // Move to the next block range
        currentFromBlock = toBlock + 1n;
      }

      console.log(`Fetched event data:`, results);

      // Save data to localStorage and reset refresh flag
      localStorage.setItem(`mintedIPs_${userAddress}`, JSON.stringify(results));
      localStorage.setItem(`needsIPRefresh_${userAddress}`, 'false');
      setIps(results);
      // Reset to first page when new data is fetched
      setCurrentPage(1);
    } catch (error) {
      console.error("Error fetching minted IPs:", error);
      setStatus("Error loading IPs. Please try again.");
    } finally {
      // Reset loading state
      setIsLoading(false);
    }
  };

  // Load cached IP data from localStorage
  const loadFromLocalStorage = (userAddress: `0x${string}`): ExtendedIPData[] => {
    const cachedData = localStorage.getItem(`mintedIPs_${userAddress}`);
    return cachedData ? JSON.parse(cachedData) : [];
  };

  // Handle wallet connection and chain switching
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
      setStatus("Wallet connection failed.");
    }
  };

  // Handle page navigation
  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  // Effect to fetch IPs when the user is connected
  useEffect(() => {
    if (isConnected && address && origin) {
      const userAddress = address as `0x${string}`;
      // Check if refresh is needed
      const needsRefresh = localStorage.getItem(`needsIPRefresh_${userAddress}`) === 'true';
      // Load from cache if available and no refresh is needed
      const cachedIPs = loadFromLocalStorage(userAddress);
      if (cachedIPs.length > 0 && !needsRefresh) {
        // Filter cached IPs to ensure only owned IPs are displayed
        const fetchOwnership = async () => {
          const ownedIps = await Promise.all(
            cachedIPs.map(async (ip) => {
              try {
                const owner = await origin.ownerOf(BigInt(ip.tokenId));
                return owner.toLowerCase() === userAddress.toLowerCase() ? ip : null;
              } catch (err) {
                console.error(`Error checking ownership for token ${ip.tokenId}:`, err);
                return null;
              }
            })
          );
          setIps(ownedIps.filter((ip) => ip !== null) as ExtendedIPData[]);
        };
        fetchOwnership();
      } else {
        fetchMintedIPs(userAddress);
      }

      // Handle new mint events
      const handleNewMint = (mintedAddress: `0x${string}`) => {
        if (mintedAddress === userAddress) {
          fetchMintedIPs(userAddress);
        }
      };

      // Subscribe to mint events
      emitter.on("newMint", handleNewMint);

      // Cleanup event listener on component unmount
      return () => {
        emitter.off("newMint", handleNewMint);
      };
    }
  }, [isConnected, address, origin]);

  // Render UI for unconnected users
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

  // Render UI for connected users
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Your Minted IPs</h1>
      {isLoading ? (
        <p>Loading IPs...</p>
      ) : ips.length === 0 ? (
        <p>No IPs have been minted yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedIps.map((ip) => (
              <IPCard key={ip.tokenId} ip={ip} />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-4">
              <button
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
                className={`px-4 py-2 rounded transition ${
                  currentPage === 1
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-blue-500 text-white hover:bg-blue-600"
                }`}
              >
                Previous
              </button>
              <p className="text-sm">
                Page {currentPage} of {totalPages}
              </p>
              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className={`px-4 py-2 rounded transition ${
                  currentPage === totalPages
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-blue-500 text-white hover:bg-blue-600"
                }`}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
      {status && <p className="text-sm text-red-600 mt-2">{status}</p>}
      <Link href="/mint" className="link-text">
        Mint page
      </Link>
    </div>
  );
}

// Export the event emitter for use in other components
export const mintEmitter = emitter;
