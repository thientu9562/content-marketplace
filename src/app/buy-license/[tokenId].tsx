"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@campnetwork/origin/react";
import { useAccount, useWalletClient } from "wagmi";

const BuyLicensePage = () => {
  const { origin } = useAuth();
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const router = useRouter();
  const { tokenId } = router.query;
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  // Mock IP data fetch (replace with actual blockchain/API call)
  const [ipData, setIpData] = useState<{
    tokenId: bigint;
    meta: { title: string; description: string; image: string; attribution: string; category: string };
    owner: string;
  } | null>(null);

  useEffect(() => {
    if (tokenId) {
      // Replace with actual data fetching logic
      const fetchIP = async () => {
        setStatus("Fetching IP data...");
        try {
          // Mock data; replace with blockchain query or API call
          const mockData = {
            tokenId: BigInt(tokenId as string),
            meta: {
              title: "Sample IP",
              description: "A sample intellectual property",
              image: "https://gateway.pinata.cloud/ipfs/sample-hash",
              attribution: "Created by @user (Followers: 1000)",
              category: "Image",
            },
            owner: "0x1234567890abcdef1234567890abcdef12345678",
          };
          setIpData(mockData);
          setStatus("");
        } catch (error) {
          setStatus(`Error fetching IP: ${(error as Error).message}`);
        }
      };
      fetchIP();
    }
  }, [tokenId]);

  const handleNewFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFile = e.target.files[0];
      setNewFile(selectedFile);
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
        throw new Error("Failed to get IPFS hash after upload");
      }

      const url = `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`;
      setStatus(`File uploaded to IPFS: ${url}`);
      return url;
    } catch (error) {
      setStatus(`IPFS upload error: ${(error as Error).message}`);
      throw error;
    }
  };

  const handleBuyLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!origin || !walletClient || !address) {
      setStatus("Please connect your wallet.");
      return;
    }
    if (!newFile || !newTitle || !newDescription) {
      setStatus("Please provide all required fields for the derivative IP.");
      return;
    }
    if (!ipData) {
      setStatus("IP data not loaded.");
      return;
    }

    try {
      setStatus("Uploading file to IPFS...");
      const ipfsUrl = await uploadToIPFS(newFile);

      setStatus("Minting derivative IP...");
      const newMeta = {
        title: newTitle || "Untitled Derivative",
        description: newDescription || "No description provided",
        category: newFile.type.startsWith("image/") ? "Image" : newFile.type.startsWith("audio/") ? "Music" : "Text",
        attribution: `Derivative of ${ipData.meta.attribution}`,
        image: ipfsUrl,
        attributes: [
          {
            trait_type: "Type",
            value: newFile.type.startsWith("image/") ? "Image" : newFile.type.startsWith("audio/") ? "Music" : "Text",
          },
          {
            trait_type: "License",
            value: "Derivative",
          },
        ],
      };

      const newLicence = {
        price: 0n,
        duration: 200,
        royaltyBps: 1000,
        paymentToken: "0x0000000000000000000000000000000000000000" as `0x${string}`,
      };

      const parentId = ipData.tokenId;

      const progressCallback = (percent: number) => {
        setStatus(`Minting derivative... (${percent}%)`);
      };

      const result = await origin.mintFile(newFile, newMeta, newLicence, parentId, { progressCallback });
      setStatus(`Derivative IP minted! Transaction: ${JSON.stringify(result)}`);
      router.push("/ips"); // Redirect back to IP list
    } catch (error) {
      setStatus(`Mint error: ${(error as Error).message}`);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Buy License for IP #{tokenId}</h1>
      {ipData ? (
        <div className="mb-4">
          <h2 className="text-xl font-bold">{ipData.meta.title}</h2>
          {ipData.meta.image && <img src={ipData.meta.image} alt={ipData.meta.title} className="w-64 h-auto mb-2" />}
          <p>{ipData.meta.description}</p>
          <p>Category: {ipData.meta.category}</p>
          <p>Attribution: {ipData.meta.attribution}</p>
          <p>Owner: {ipData.owner}</p>
        </div>
      ) : (
        <p>Loading IP data...</p>
      )}

      <form onSubmit={handleBuyLicense} className="w-full max-w-md">
        <div className="mb-4">
          <label>New Title:</label>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full p-2 border"
            required
          />
        </div>
        <div className="mb-4">
          <label>New Description:</label>
          <textarea
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            className="w-full p-2 border"
            required
          />
        </div>
        <div className="mb-4">
          <label>New File (Image/Text/Music):</label>
          <input type="file" onChange={handleNewFileChange} className="w-full" required />
          {preview && (
            <div className="mt-2">
              <p>Image Preview:</p>
              <img src={preview} alt="Uploaded preview" className="max-w-full h-auto rounded" />
            </div>
          )}
        </div>
        <button type="submit" className="bg-blue-500 text-white px-4 py-2 mr-2">
          Buy License & Mint Derivative
        </button>
        <button
          type="button"
          onClick={() => router.push("/ips")}
          className="bg-gray-500 text-white px-4 py-2"
        >
          Cancel
        </button>
      </form>
      {status && <p className="mt-4">{status}</p>}
    </div>
  );
};

export default BuyLicensePage;