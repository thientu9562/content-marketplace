// Import necessary libraries and components
import { ExtendedIPData } from "../utils/types";
import { useAccount, useWalletClient } from "wagmi";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@campnetwork/origin/react";
import { mintEmitter } from "./IPList";
import { createPublicClient, http, parseAbiItem } from "viem";
import { campNetwork } from "../utils/chain";

// Define contract address as a constant
const CONTRACT_ADDRESS = "0xF90733b9eCDa3b49C250B2C3E3E42c96fC93324E" as `0x${string}`;

// Define props interface for the IPCard component
interface IPCardProps {
  ip: ExtendedIPData;
}

// Component to display a single IP card
export default function IPCard({ ip }: IPCardProps) {
  // State hooks for managing user address, connection status, deletion state, and status messages
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { origin } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [status, setStatus] = useState<string>("");

  // Function to handle IP deletion
  const handleDelete = async (tokenId: bigint) => {
    // Check if wallet is connected and SDK is initialized
    if (!isConnected || !walletClient || !address || !origin) {
      setStatus("Please connect your wallet and ensure the SDK is initialized.");
      return;
    }

    try {
      setIsDeleting(true);
      setStatus("Checking permission to delete IP...");

      // Verify chain
      const chainId = await walletClient.getChainId();
      if (chainId !== campNetwork.id) {
        setStatus("Please switch to the BaseCAMP network.");
        return;
      }

      // Check token ownership using the SDK
      const owner = await origin.ownerOf(tokenId);
      if (owner.toLowerCase() !== address.toLowerCase()) {
        throw new Error("NotTokenOwner");
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
      if (tokenStatus === 1) { // Assumption: 1 indicates Deleted status (verify with contract)
        throw new Error("ERC721NonexistentToken");
      }

      setStatus("Requesting IP deletion...");

      // Call requestDelete via origin SDK
      const txHash = await origin.requestDelete(tokenId);

      // Wait for transaction confirmation
      await publicClient.waitForTransactionReceipt({ hash: txHash });

      // Update localStorage
      const cachedData = localStorage.getItem(`mintedIPs_${address}`);
      if (cachedData) {
        const parsedData: ExtendedIPData[] = JSON.parse(cachedData);
        const updatedData = parsedData.filter((item) => item.tokenId !== tokenId.toString());
        localStorage.setItem(`mintedIPs_${address}`, JSON.stringify(updatedData));
      }

      // Set refresh flag and emit event to trigger reload
      localStorage.setItem(`needsIPRefresh_${address}`, "true");
      if (address) {
        mintEmitter.emit("newMint", address as `0x${string}`);
      }

      setStatus("IP deletion requested successfully! List will update after on-chain confirmation.");
    } catch (error: unknown) {
      console.error("Error deleting IP:", error);

      let errMessage: string;
      if (error instanceof Error) {
        errMessage = error.message;
      } else {
        errMessage = String(error) || "Unknown error";
      }

      // Handle specific error cases
      if (errMessage.includes("NotTokenOwner")) {
        setStatus("You are not the owner of this IP.");
      } else if (errMessage.includes("signature")) {
        setStatus("Transaction signing failed. Please approve the transaction in your wallet.");
      } else if (errMessage.includes("gas")) {
        setStatus("Insufficient gas. Please add CAMP to your wallet.");
      } else if (errMessage.includes("Unauthorized")) {
        setStatus("You are not authorized to delete this IP (admin may be required).");
      } else if (errMessage.includes("ERC721NonexistentToken")) {
        setStatus("This token does not exist or has already been deleted.");
      } else {
        setStatus(`Error requesting deletion: ${errMessage}`);
      }
    } finally {
      // Reset deletion state
      setIsDeleting(false);
    }
  };

  // Render the IP card UI
  return (
    <div className="border rounded-lg p-4 shadow-md">
      <h2 className="text-lg font-semibold">{ip.metadata?.title || "Untitled"}</h2>
      <p className="text-sm text-gray-600">{ip.metadata?.description || "No description"}</p>
      <p className="text-sm">Category: {ip.metadata?.category || "N/A"}</p>
      <p className="text-sm">Attribution: {ip.metadata?.attribution || "N/A"}</p>
      {ip.metadata?.image && (
        <img
          src={ip.metadata.image}
          alt={ip.metadata.title}
          className="w-full h-48 object-cover rounded mt-2"
        />
      )}
      <p className="text-xs text-gray-500">Creator: {ip.creator}</p>
      <div className="mt-4 flex space-x-2">
        <Link href={`/transfer/${ip.tokenId}`}>
          <button className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition">
            Transfer
          </button>
        </Link>
        <button
          onClick={() => handleDelete(BigInt(ip.tokenId))}
          disabled={isDeleting || !isConnected}
          className={`bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 transition ${
            isDeleting || !isConnected ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {isDeleting ? "Deleting..." : "Delete"}
        </button>
      </div>
      {status && <p className="text-sm text-red-600 mt-2">{status}</p>}
    </div>
  );
}