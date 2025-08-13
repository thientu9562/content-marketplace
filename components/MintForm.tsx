"use client";

// Import necessary libraries and components
import { useState } from "react";
import { useAuth } from "@campnetwork/origin/react";
import { TwitterAPI } from "@campnetwork/origin";
import { useAccount, useWalletClient, useConnect, useSwitchChain, useBalance } from "wagmi";
import { mintEmitter } from "./IPList";
import Link from "next/link";
import { baseCampChain } from "../utils/chain";

// Define interface for Twitter user data
interface TwitterUserData {
  data: {
    username: string;
    public_metrics: { followers_count: number };
  };
}

// Main component for the minting form
const MintForm = () => {
  // State hooks for managing form inputs, authentication, and status
  const { origin, jwt, connect } = useAuth();
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { connect: wagmiConnect, connectors, error: connectError } = useConnect();
  const { switchChainAsync } = useSwitchChain();
  const { data: balance } = useBalance({ address });
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [license, setLicense] = useState("CC-BY");
  const [twitterUsername, setTwitterUsername] = useState("");
  const [status, setStatus] = useState("");
  const [attributionData, setAttributionData] = useState<{ username?: string; followers?: number } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // Handle file input changes and generate preview for images
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);

      if (selectedFile.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target) {
            setPreview(event.target.result as string);
          }
        };
        reader.readAsDataURL(selectedFile);
      } else {
        setPreview(null);
      }
    }
  };

  // Fetch Twitter user data for attribution
  const fetchSocialData = async () => {
    if (!jwt || !twitterUsername) {
      setStatus("Please authenticate and provide a Twitter username.");
      return;
    }

    try {
      setStatus("Fetching Twitter data for attribution...");
      const twitterAPI = new TwitterAPI({ apiKey: "4f1a2c9c-008e-4a2e-8712-055fa04f9ffa" });
      const userData = await twitterAPI.fetchUserByUsername(twitterUsername) as TwitterUserData;
      setAttributionData({
        username: userData.data.username,
        followers: userData.data.public_metrics.followers_count,
      });
      setStatus(`Twitter data fetched: @${userData.data.username} (Followers: ${userData.data.public_metrics.followers_count})`);
    } catch (error) {
      setStatus(`Error fetching social data: ${(error as Error).message}`);
    }
  };

  // Handle wallet connection and chain switching
  const handleConnect = async () => {
    try {
      setStatus("Connecting wallet...");
      await connect();
      setStatus(isConnected ? `Connected to ${address}` : "Connection successful");
      if (walletClient) {
        try {
          await walletClient.addChain({ chain: baseCampChain });
          await switchChainAsync({ chainId: 123420001114 });
          console.log("Switched to BaseCAMP");
          setStatus("Connected and switched to BaseCAMP");
        } catch (switchError) {
          setStatus(`Failed to switch chain: ${(switchError as Error).message}`);
        }
      }
    } catch (error) {
      setStatus(`Camp connection failed: ${(error as Error).message}`);
      try {
        setStatus("Attempting connection via wagmi...");
        await wagmiConnect({ connector: connectors[0] });
        setStatus(isConnected ? `Connected to ${address}` : "Wagmi connection successful");
        if (walletClient) {
          await walletClient.addChain({ chain: baseCampChain });
          await switchChainAsync({ chainId: 123420001114 });
          console.log("Switched to BaseCAMP via wagmi");
          setStatus("Connected and switched to BaseCAMP");
        }
      } catch (wagmiError) {
        setStatus(`Wagmi connection failed: ${(wagmiError as Error).message}`);
      }
    }
  };

  // Upload file to IPFS and return the URL
  const uploadToIPFS = async (file: File): Promise<string> => {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_PINATA_JWT}`,
        },
        body: formData,
      });

      const result = await response.json();
      if (!result.IpfsHash) {
        throw new Error("Failed to retrieve IPFS hash after upload");
      }

      const url = `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`;
      setStatus(`File uploaded to IPFS: ${url}`);
      return url;
    } catch (error) {
      setStatus(`IPFS upload error: ${(error as Error).message}`);
      throw error;
    }
  };

  // Clear form inputs
  const clearForm = () => {
    setTitle("");
    setDescription("");
    setLicense("CC-BY");
    setTwitterUsername("");
    setFile(null);
    setPreview(null);
    setAttributionData(null);
  };

  // Handle form submission for minting IP
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!origin || !jwt || !isConnected) {
      setStatus("Please connect your wallet first.");
      return;
    }
    if (!file) {
      setStatus("Please select a file.");
      return;
    }
    if (!walletClient) {
      setStatus("WalletClient not connected. Please reconnect wallet.");
      return;
    }

    try {
      // Verify WalletClient and chain
      setStatus("Verifying WalletClient...");
      const chainId = await walletClient.getChainId();
      if (chainId !== 123420001114) {
        setStatus("Incorrect chain. Switching to BaseCAMP...");
        try {
          await walletClient.addChain({ chain: baseCampChain });
          await switchChainAsync({ chainId: 123420001114 });
          setStatus("Switched to BaseCAMP");
        } catch (switchError) {
          setStatus(`Failed to switch chain: ${(switchError as Error).message}`);
          return;
        }
      }

      // Check CAMP balance
      if (balance && balance.value === 0n) {
        setStatus("No CAMP in wallet. Please add testnet CAMP from faucet.");
        return;
      }

      // Upload file to IPFS
      setStatus("Uploading file to IPFS...");
      const ipfsUrl = await uploadToIPFS(file);

      // Prepare metadata with IPFS URL
      const meta = {
        title: title || "Untitled content",
        description: description || "No description",
        category: file.type.startsWith("image/") ? "Image" : file.type.startsWith("audio/") ? "Music" : "Text",
        image: ipfsUrl,
        attribution: attributionData ? `Created by @${attributionData.username} (Followers: ${attributionData.followers})` : "Anonymous",
        attributes: [
          {
            trait_type: "Type",
            value: file.type.startsWith("image/") ? "Image" : file.type.startsWith("audio/") ? "Music" : "Text",
          },
          {
            trait_type: "License",
            value: license,
          },
        ],
      };

      // Prepare license
      const licence = {
        price: 0n,
        duration: 200,
        royaltyBps: 1000,
        paymentToken: "0x0000000000000000000000000000000000000000" as `0x${string}`,
      };

      const parentId = 0n;

      setStatus("Minting IP on BaseCAMP...");
      const progressCallback = (percent: number) => {
        console.log(`Mint progress: ${percent}%`);
        setStatus(`Minting IP on BaseCAMP... (${percent}%)`);
      };

      await origin.mintFile(file, meta, licence, parentId, { progressCallback });
      setStatus(`IP minted successfully!`);

      // Emit event to notify new mint (for same-page updates)
      if (address) {
        mintEmitter.emit("newMint", address as `0x${string}`);
      }

      // Set refresh flag in localStorage (for reload or other pages)
      if (address) {
        localStorage.setItem(`needsIPRefresh_${address}`, 'true');
      }

      // Automatically clear the form after successful mint
      clearForm();
    } catch (error) {
      const errMessage = (error as Error).message;
      setStatus(`Mint error: ${errMessage}`);
      console.error("Mint error details:", error);
      if (errMessage.includes("signature")) {
        setStatus("Transaction signing failed. Please approve the transaction in MetaMask and ensure sufficient CAMP for gas fees.");
      } else if (errMessage.includes("gas")) {
        setStatus("Insufficient gas. Please add CAMP to your wallet.");
      }
    }
  };

  // Render the minting form UI
  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md bg-white p-8 rounded-lg shadow-lg">
      <div className="mb-6">
        <label className="form-label">Title:</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="form-input"
          required
        />
      </div>
      <div className="mb-6">
        <label className="form-label">Description:</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="form-input h-32 resize-none"
          required
        />
      </div>
      <div className="mb-6">
        <label className="form-label">License:</label>
        <select value={license} onChange={(e) => setLicense(e.target.value)} className="form-select">
          <option value="CC-BY">CC-BY (Attribution)</option>
          <option value="CC-BY-SA">CC-BY-SA (ShareAlike)</option>
          <option value="Custom">Custom</option>
        </select>
      </div>
      <div className="mb-6">
        <label className="form-label">Twitter username for attribution:</label>
        <input
          type="text"
          value={twitterUsername}
          onChange={(e) => setTwitterUsername(e.target.value)}
          className="form-input"
        />
        <button type="button" onClick={fetchSocialData} className="form-button button-yellow mt-3">
          Fetch Twitter data
        </button>
      </div>
      <div className="mb-6">
        <label className="form-label">File (Image/Text/Music):</label>
        <div className="relative">
          <input
            type="file"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            id="file-upload"
            required
          />
          <label htmlFor="file-upload" className="file-upload-button">
            Choose file
          </label>
        </div>
        {preview && (
          <div className="mt-4">
            <p className="text-sm text-gray-600 mb-2">Image preview:</p>
            <img src={preview} alt="Uploaded preview" className="preview-image" />
          </div>
        )}
      </div>
      {!isConnected && (
        <button type="button" onClick={handleConnect} className="form-button button-green mb-6">
          Connect wallet & Authenticate
        </button>
      )}
      <button
        type="submit"
        disabled={!isConnected || !walletClient}
        className="form-button button-blue"
      >
        Mint content
      </button>
      <p className="status-text">{status}</p>
      {connectError && <p className="error-text">Connection error: {connectError.message}</p>}
      {!walletClient && <p className="error-text">WalletClient not connected. Please reconnect wallet.</p>}
      {balance && <p className="mt-4 text-center text-gray-700">Balance: {parseFloat(balance.formatted).toFixed(4).replace(/\.?0+$/, "")} CAMP</p>}
      <Link href="/marketplace" className="link-text">
        Go to Marketplace
      </Link>
    </form>
  );
};

export default MintForm;