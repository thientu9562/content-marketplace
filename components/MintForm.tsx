"use client";

import { useState } from "react";
import { useAuth } from "@campnetwork/origin/react";
import { TwitterAPI } from "@campnetwork/origin";
import { useAccount, useWalletClient, useConnect, useSwitchChain, useBalance } from "wagmi";

interface TwitterUserData {
  data: {
    username: string;
    public_metrics: { followers_count: number };
  };
}

const MintForm = () => {
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

  const baseCampChain = {
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
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const fetchSocialData = async () => {
    if (!jwt || !twitterUsername) {
      setStatus("Please authenticate and provide Twitter username.");
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

  const handleConnect = async () => {
    try {
      setStatus("Connecting wallet...");
      await connect();
      setStatus(isConnected ? `Connected to ${address}` : "Connected successfully");
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
      setStatus(`Camp connect failed: ${(error as Error).message}`);
      try {
        setStatus("Falling back to wagmi connect...");
        await wagmiConnect({ connector: connectors[0] });
        setStatus(isConnected ? `Connected to ${address}` : "Wagmi connect successful");
        if (walletClient) {
          await walletClient.addChain({ chain: baseCampChain });
          await switchChainAsync({ chainId: 123420001114 });
          console.log("Switched to BaseCAMP via wagmi");
          setStatus("Connected and switched to BaseCAMP");
        }
      } catch (wagmiError) {
        setStatus(`Wagmi connect failed: ${(wagmiError as Error).message}`);
      }
    }
  };

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
      setStatus("WalletClient not connected. Please reconnect your wallet.");
      return;
    }

    try {
      // Verify WalletClient và chain
      setStatus("Verifying WalletClient...");
      const chainId = await walletClient.getChainId();
      console.log("WalletClient chainId:", chainId);
      if (chainId !== 123420001114) {
        setStatus("Wrong chain. Switching to BaseCAMP...");
        try {
          await walletClient.addChain({ chain: baseCampChain });
          await switchChainAsync({ chainId: 123420001114 });
          setStatus("Switched to BaseCAMP");
        } catch (switchError) {
          setStatus(`Failed to switch chain: ${(switchError as Error).message}`);
          return;
        }
      }

      // Kiểm tra balance ETH
      if (balance && balance.value === 0n) {
        setStatus("No ETH in wallet. Please add testnet ETH from faucet.");
        return;
      }

      // Prepare metadata với attribution từ social data
      const meta = {
        title,
        description,
        category: file.type.startsWith("image/") ? "Image" : file.type.startsWith("audio/") ? "Music" : "Text",
        attribution: attributionData ? `Created by @${attributionData.username} (Followers: ${attributionData.followers})` : "Anonymous",
      };

      // Prepare license (sửa duration thành 0n cho BigInt)
      const licence = {
        price: 0n,
        duration: 200, // Sửa từ 0 thành 0n để đúng BigInt
        royaltyBps: 1000,
        paymentToken: "0x0000000000000000000000000000000000000000" as `0x${string}`,
      };

      const parentId = 0n;

      setStatus("Minting IP on BaseCAMP...");
      // Thêm progressCallback để debug upload/mint
      const progressCallback = (percent: number) => {
        console.log(`Mint progress: ${percent}%`);
        setStatus(`Minting IP on BaseCAMP... (${percent}%)`);
      };
      // Gọi mintFile với progressCallback
      const result = await origin.mintFile(file, meta, licence, parentId, { progressCallback });
      console.log("Kết quả mint file trả về:", result);
      setStatus(`IP Minted! Transaction: ${JSON.stringify(result)}`);
    } catch (error) {
      const errMessage = (error as Error).message;
      setStatus(`Mint error: ${errMessage}`);
      console.error("Mint error details:", error);
      if (errMessage.includes("signature")) {
        setStatus("Signature failed. Please approve the transaction in MetaMask and ensure enough ETH for gas.");
      } else if (errMessage.includes("gas")) {
        setStatus("Insufficient gas. Please add more ETH to your wallet.");
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md">
      <div className="mb-4">
        <label>Title:</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full p-2 border"
          required
        />
      </div>
      <div className="mb-4">
        <label>Description:</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full p-2 border"
          required
        />
      </div>
      <div className="mb-4">
        <label>License:</label>
        <select value={license} onChange={(e) => setLicense(e.target.value)} className="w-full p-2 border">
          <option value="CC-BY">CC-BY (Attribution)</option>
          <option value="CC-BY-SA">CC-BY-SA (Share Alike)</option>
          <option value="Custom">Custom</option>
        </select>
      </div>
      <div className="mb-4">
        <label>Twitter Username for Attribution:</label>
        <input
          type="text"
          value={twitterUsername}
          onChange={(e) => setTwitterUsername(e.target.value)}
          className="w-full p-2 border"
        />
        <button type="button" onClick={fetchSocialData} className="bg-yellow-500 text-white px-4 py-2 mt-2">
          Fetch Twitter Data
        </button>
      </div>
      <div className="mb-4">
        <label>File (Image/Text/Music):</label>
        <input type="file" onChange={handleFileChange} className="w-full" required />
      </div>
      {!isConnected && (
        <button type="button" onClick={handleConnect} className="bg-green-500 text-white px-4 py-2 mb-4">
          Connect Wallet & Auth
        </button>
      )}
      {isConnected && <p className="mb-4">Connected: {address}</p>}
      <button
        type="submit"
        disabled={!isConnected || !walletClient}
        className="bg-blue-500 text-white px-4 py-2 disabled:bg-gray-500"
      >
        Mint Content
      </button>
      <p className="mt-4">{status}</p>
      {connectError && <p className="mt-4 text-red-500">Connect Error: {connectError.message}</p>}
      {!walletClient && <p className="mt-4 text-red-500">WalletClient not connected. Please reconnect ví.</p>}
      {balance && <p className="mt-4">Balance: {balance.formatted} ETH</p>}
    </form>
  );
};

export default MintForm;