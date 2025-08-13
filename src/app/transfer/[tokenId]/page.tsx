"use client";

// Import necessary libraries and components
import { useEffect, useState } from "react";
import { useAccount, useWalletClient, useSwitchChain } from "wagmi";
import { ExtendedIPData } from "../../../../utils/types";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@campnetwork/origin/react";
import { campNetwork } from "../../../../utils/chain";
import Link from "next/link";
import { createPublicClient, http, parseAbiItem } from "viem";
import { mintEmitter } from "../../../../components/IPList";

// Define contract address as a constant
const CONTRACT_ADDRESS = "0xF90733b9eCDa3b49C250B2C3E3E42c96fC93324E" as `0x${string}`;

// Main component for the IP transfer page
export default function TransferPage() {
  // Extract tokenId from URL parameters
  const params = useParams<{ tokenId: string }>();
  const tokenId = params.tokenId;
  // Get wallet account details, client, and chain switching functionality
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();
  // Get authentication context for Camp network
  const { origin } = useAuth();
  // Initialize router for navigation
  const router = useRouter();
  // State hooks for IP data, recipient address, status, and loading state
  const [ip, setIp] = useState<ExtendedIPData | null>(null);
  const [toAddress, setToAddress] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Load IP data from localStorage
  const loadIPFromLocalStorage = (userAddress: `0x${string}`, tokenId: string): ExtendedIPData | null => {
    const cachedData = localStorage.getItem(`mintedIPs_${userAddress}`);
    if (cachedData) {
      const ips: ExtendedIPData[] = JSON.parse(cachedData);
      return ips.find((item) => item.tokenId === tokenId) || null;
    }
    return null;
  };

  // Fetch IP data directly from the contract if not found in localStorage
  const fetchIPData = async (tokenId: bigint, userAddress: `0x${string}`): Promise<ExtendedIPData | null> => {
    if (!origin) {
      setStatus("SDK not initialized.");
      return null;
    }

    try {
      // Check token ownership
      const owner = await origin.ownerOf(tokenId);
      if (owner.toLowerCase() !== userAddress.toLowerCase()) {
        setStatus("You are not the owner of this IP.");
        return null;
      }

      // Check token status
      const publicClient = createPublicClient({
        chain: campNetwork,
        transport: http(),
      });
      const tokenStatus = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: [parseAbiItem("function dataStatus(uint256) view returns (uint8)")],
        functionName: "dataStatus",
        args: [tokenId],
      });
      if (tokenStatus === 1) {
        // Assumption: 1 indicates deleted status
        setStatus("This token does not exist or has been deleted.");
        return null;
      }

      // Fetch token URI
      let tokenURI = "";
      let metadata: { title: string; description: string; category: string; attribution: string; image: string } | undefined;
      try {
        tokenURI = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: [parseAbiItem("function tokenURI(uint256) view returns (string)")],
          functionName: "tokenURI",
          args: [tokenId],
        });

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
        tokenId: tokenId.toString(),
        creator: userAddress,
        contentHash: "0x" as `0x${string}`,
        tokenURI,
        transactionHash: "0x" as `0x${string}`,
        metadata,
      };
    } catch (err) {
      console.error(`Error fetching IP data for token ${tokenId}:`, err);
      setStatus("Failed to load IP data from contract.");
      return null;
    }
  };

  // Update localStorage after a successful transfer
  const updateLocalStorageAfterTransfer = (userAddress: `0x${string}`, tokenId: string) => {
    const cachedData = localStorage.getItem(`mintedIPs_${userAddress}`);
    if (cachedData) {
      let ips: ExtendedIPData[] = JSON.parse(cachedData);
      ips = ips.filter((item) => item.tokenId !== tokenId);
      localStorage.setItem(`mintedIPs_${userAddress}`, JSON.stringify(ips));
    }
    localStorage.setItem(`needsIPRefresh_${userAddress}`, "true");
    if (userAddress) {
      mintEmitter.emit("newMint", userAddress);
    }
  };

  // Load IP data when the page is loaded
  useEffect(() => {
    if (isConnected && address && origin) {
      const userAddress = address as `0x${string}`;
      const loadIP = async () => {
        setIsLoading(true);
        let loadedIp = loadIPFromLocalStorage(userAddress, tokenId);
        if (!loadedIp) {
          // If not found in localStorage, fetch from contract
          loadedIp = await fetchIPData(BigInt(tokenId), userAddress);
        }
        setIp(loadedIp);
        if (!loadedIp) {
          setStatus("IP not found or you are not the owner.");
        }
        setIsLoading(false);
      };
      loadIP();
    }
  }, [isConnected, address, tokenId, origin]);

  // Handle IP transfer
  const handleTransfer = async () => {
    if (!origin || !walletClient || !address || !toAddress) {
      setStatus("Please enter recipient address and ensure wallet is connected.");
      return;
    }

    // Validate recipient address format
    if (!toAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      setStatus("Invalid recipient address. Please enter a valid Ethereum address.");
      return;
    }

    setIsLoading(true);
    setStatus("Preparing transfer...");

    try {
      const chainId = await walletClient.getChainId();
      if (chainId !== campNetwork.id) {
        setStatus("Incorrect chain. Switching to BaseCAMP...");
        await switchChainAsync({ chainId: campNetwork.id });
      }

      // Verify ownership using SDK
      const owner = await origin.ownerOf(BigInt(tokenId));
      if (owner.toLowerCase() !== address.toLowerCase()) {
        setStatus("You are not the owner of this IP.");
        setIsLoading(false);
        return;
      }

      // Check token status
      const publicClient = createPublicClient({
        chain: campNetwork,
        transport: http(),
      });
      const tokenStatus = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: [parseAbiItem("function dataStatus(uint256) view returns (uint8)")],
        functionName: "dataStatus",
        args: [BigInt(tokenId)],
      });
      if (tokenStatus === 1) {
        setStatus("This token does not exist or has been deleted.");
        setIsLoading(false);
        return;
      }

      // Perform transfer using SDK
      const txHash = await origin.safeTransferFrom(address, toAddress as `0x${string}`, BigInt(tokenId));

      // Wait for transaction confirmation
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      setStatus(`Transfer successful! Redirecting...`);

      // Update localStorage and emit event
      updateLocalStorageAfterTransfer(address as `0x${string}`, tokenId);

      // Redirect to marketplace after transaction confirmation
      setTimeout(() => {
        router.push("/marketplace");
      }, 1000); // Short delay to improve UX
    } catch (error) {
      console.error("Transfer error:", error);
      const errMessage = error instanceof Error ? error.message : String(error);
      if (errMessage.includes("signature")) {
        setStatus("Transaction signing failed.");
      } else if (errMessage.includes("gas")) {
        setStatus("Insufficient gas. Please add CAMP to your wallet.");
      } else if (errMessage.includes("NotTokenOwner")) {
        setStatus("You are not the owner of this IP.");
      } else if (errMessage.includes("ERC721NonexistentToken")) {
        setStatus("This token does not exist or has been deleted.");
      } else {
        setStatus(`Error: ${errMessage}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Render UI for unconnected wallet
  if (!isConnected) {
    return (
      <div className="text-center mt-10">
        <p className="text-lg text-gray-600">Please connect your wallet to transfer IP.</p>
      </div>
    );
  }

  // Render UI while loading IP data
  if (isLoading) {
    return (
      <div className="text-center mt-10">
        <p className="text-lg text-gray-600">Loading IP data...</p>
        {status && <p className="text-sm text-red-600 mt-2">{status}</p>}
      </div>
    );
  }

  // Render UI if IP data is not found
  if (!ip) {
    return (
      <div className="text-center mt-10">
        <p className="text-lg text-gray-600">IP not found. {status}</p>
        <Link href="/marketplace" className="text-blue-500 hover:underline mt-4 inline-block">
          Return to Marketplace
        </Link>
      </div>
    );
  }

  // Render transfer form UI
  return (
    <div className="bg-white p-6 rounded-lg shadow-lg max-w-md mx-auto mt-10">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6 text-center">
        Transfer IP: {ip.metadata?.title || "Untitled"}
      </h1>
      <p className="text-gray-600 mb-2">Token ID: {ip.tokenId.slice(0, 5)}...{ip.tokenId.slice(-4)}</p>
      <p className="text-gray-600 mb-2">Creator: {ip.creator}</p>
      {ip.metadata?.image && (
        <img
          src={ip.metadata.image}
          alt={ip.metadata.title}
          className="w-48 h-48 object-cover rounded-lg mt-4 shadow-md border border-gray-200 mx-auto"
        />
      )}
      <div className="mt-6">
        <label className="block text-lg font-semibold text-gray-700 mb-2">Recipient Address:</label>
        <input
          type="text"
          value={toAddress}
          onChange={(e) => setToAddress(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent mb-4"
          placeholder="0x..."
          required
        />
        <button
          onClick={handleTransfer}
          disabled={isLoading}
          className="w-full px-6 py-3 bg-red-500 text-white font-medium rounded-lg shadow-md hover:bg-red-600 transition duration-300 ease-in-out disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isLoading ? "Transferring..." : "Transfer"}
        </button>
      </div>
      {status && <p className="mt-4 text-center text-red-600 text-sm">{status}</p>}
      <Link href="/marketplace" className="text-blue-500 hover:underline mt-4 block text-center">
        Go to Marketplace
      </Link>
    </div>
  );
}