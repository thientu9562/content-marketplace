"use client";

import { useState } from "react";
import { useAuth } from "@campnetwork/origin/react";
import { TwitterAPI } from "@campnetwork/origin";
import { useAccount, useWalletClient, useConnect, useSwitchChain, useBalance } from "wagmi";
import { mintEmitter } from "./IPList";
import Link from "next/link";
import { baseCampChain } from "../utils/chain";

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
  const [preview, setPreview] = useState<string | null>(null);

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

  const fetchSocialData = async () => {
    if (!jwt || !twitterUsername) {
      setStatus("Vui lòng xác thực và cung cấp tên người dùng Twitter.");
      return;
    }

    try {
      setStatus("Đang lấy dữ liệu Twitter để ghi nhận...");
      const twitterAPI = new TwitterAPI({ apiKey: "4f1a2c9c-008e-4a2e-8712-055fa04f9ffa" });
      const userData = await twitterAPI.fetchUserByUsername(twitterUsername) as TwitterUserData;
      setAttributionData({
        username: userData.data.username,
        followers: userData.data.public_metrics.followers_count,
      });
      setStatus(`Dữ liệu Twitter đã lấy: @${userData.data.username} (Người theo dõi: ${userData.data.public_metrics.followers_count})`);
    } catch (error) {
      setStatus(`Lỗi khi lấy dữ liệu mạng xã hội: ${(error as Error).message}`);
    }
  };

  const handleConnect = async () => {
    try {
      setStatus("Đang kết nối ví...");
      await connect();
      setStatus(isConnected ? `Đã kết nối với ${address}` : "Kết nối thành công");
      if (walletClient) {
        try {
          await walletClient.addChain({ chain: baseCampChain });
          await switchChainAsync({ chainId: 123420001114 });
          console.log("Đã chuyển sang BaseCAMP");
          setStatus("Đã kết nối và chuyển sang BaseCAMP");
        } catch (switchError) {
          setStatus(`Không thể chuyển chain: ${(switchError as Error).message}`);
        }
      }
    } catch (error) {
      setStatus(`Kết nối Camp thất bại: ${(error as Error).message}`);
      try {
        setStatus("Đang thử kết nối qua wagmi...");
        await wagmiConnect({ connector: connectors[0] });
        setStatus(isConnected ? `Đã kết nối với ${address}` : "Kết nối wagmi thành công");
        if (walletClient) {
          await walletClient.addChain({ chain: baseCampChain });
          await switchChainAsync({ chainId: 123420001114 });
          console.log("Đã chuyển sang BaseCAMP qua wagmi");
          setStatus("Đã kết nối và chuyển sang BaseCAMP");
        }
      } catch (wagmiError) {
        setStatus(`Kết nối wagmi thất bại: ${(wagmiError as Error).message}`);
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
        throw new Error("Không thể lấy hash IPFS sau khi tải lên");
      }

      const url = `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`;
      setStatus(`Tệp đã được tải lên IPFS: ${url}`);
      return url;
    } catch (error) {
      setStatus(`Lỗi tải lên IPFS: ${(error as Error).message}`);
      throw error;
    }
  };

  const clearForm = () => {
    setTitle("");
    setDescription("");
    setLicense("CC-BY");
    setTwitterUsername("");
    setFile(null);
    setPreview(null);
    setAttributionData(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!origin || !jwt || !isConnected) {
      setStatus("Vui lòng kết nối ví của bạn trước.");
      return;
    }
    if (!file) {
      setStatus("Vui lòng chọn một tệp.");
      return;
    }
    if (!walletClient) {
      setStatus("WalletClient chưa kết nối. Vui lòng kết nối lại ví.");
      return;
    }

    try {
      // Verify WalletClient and chain
      setStatus("Đang xác minh WalletClient...");
      const chainId = await walletClient.getChainId();
      if (chainId !== 123420001114) {
        setStatus("Chain không đúng. Đang chuyển sang BaseCAMP...");
        try {
          await walletClient.addChain({ chain: baseCampChain });
          await switchChainAsync({ chainId: 123420001114 });
          setStatus("Đã chuyển sang BaseCAMP");
        } catch (switchError) {
          setStatus(`Không thể chuyển chain: ${(switchError as Error).message}`);
          return;
        }
      }

      // Check CAMP balance
      if (balance && balance.value === 0n) {
        setStatus("Không có CAMP trong ví. Vui lòng thêm testnet CAMP từ faucet.");
        return;
      }

      // Upload file to IPFS
      setStatus("Đang tải tệp lên IPFS...");
      const ipfsUrl = await uploadToIPFS(file);

      // Prepare metadata with IPFS URL
      const meta = {
        title: title || "Nội dung không có tiêu đề",
        description: description || "Không có mô tả",
        category: file.type.startsWith("image/") ? "Image" : file.type.startsWith("audio/") ? "Music" : "Text",
        image: ipfsUrl,
        attribution: attributionData ? `Tạo bởi @${attributionData.username} (Người theo dõi: ${attributionData.followers})` : "Ẩn danh",
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

      setStatus("Đang mint IP trên BaseCAMP...");
      const progressCallback = (percent: number) => {
        console.log(`Tiến trình mint: ${percent}%`);
        setStatus(`Đang mint IP trên BaseCAMP... (${percent}%)`);
      };

      await origin.mintFile(file, meta, licence, parentId, { progressCallback });
      setStatus(`IP đã được mint!`);

      // Phát sự kiện để thông báo mint mới (cho trường hợp cùng trang)
      if (address) {
        mintEmitter.emit("newMint", address as `0x${string}`);
      }

      // Set flag cần refresh trong localStorage (cho trường hợp reload hoặc trang khác)
      if (address) {
        localStorage.setItem(`needsIPRefresh_${address}`, 'true');
      }

      // Automatically clear the form after successful mint
      clearForm();
    } catch (error) {
      const errMessage = (error as Error).message;
      setStatus(`Lỗi khi mint: ${errMessage}`);
      console.error("Chi tiết lỗi mint:", error);
      if (errMessage.includes("signature")) {
        setStatus("Ký giao dịch thất bại. Vui lòng phê duyệt giao dịch trong MetaMask và đảm bảo đủ CAMP để trả phí gas.");
      } else if (errMessage.includes("gas")) {
        setStatus("Không đủ gas. Vui lòng thêm CAMP vào ví của bạn.");
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md bg-white p-8 rounded-lg shadow-lg">
      <div className="mb-6">
        <label className="form-label">Tiêu đề:</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="form-input"
          required
        />
      </div>
      <div className="mb-6">
        <label className="form-label">Mô tả:</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="form-input h-32 resize-none"
          required
        />
      </div>
      <div className="mb-6">
        <label className="form-label">Giấy phép:</label>
        <select value={license} onChange={(e) => setLicense(e.target.value)} className="form-select">
          <option value="CC-BY">CC-BY (Ghi nhận)</option>
          <option value="CC-BY-SA">CC-BY-SA (Chia sẻ tương tự)</option>
          <option value="Custom">Tùy chỉnh</option>
        </select>
      </div>
      <div className="mb-6">
        <label className="form-label">Tên người dùng Twitter để ghi nhận:</label>
        <input
          type="text"
          value={twitterUsername}
          onChange={(e) => setTwitterUsername(e.target.value)}
          className="form-input"
        />
        <button type="button" onClick={fetchSocialData} className="form-button button-yellow mt-3">
          Lấy dữ liệu Twitter
        </button>
      </div>
      <div className="mb-6">
        <label className="form-label">Tệp (Hình ảnh/Văn bản/Âm nhạc):</label>
        <div className="relative">
          <input
            type="file"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            id="file-upload"
            required
          />
          <label htmlFor="file-upload" className="file-upload-button">
            Chọn tệp
          </label>
        </div>
        {preview && (
          <div className="mt-4">
            <p className="text-sm text-gray-600 mb-2">Xem trước hình ảnh:</p>
            <img src={preview} alt="Xem trước đã tải lên" className="preview-image" />
          </div>
        )}
      </div>
      {!isConnected && (
        <button type="button" onClick={handleConnect} className="form-button button-green mb-6">
          Kết nối ví & Xác thực
        </button>
      )}
      <button
        type="submit"
        disabled={!isConnected || !walletClient}
        className="form-button button-blue"
      >
        Mint nội dung
      </button>
      <p className="status-text">{status}</p>
      {connectError && <p className="error-text">Lỗi kết nối: {connectError.message}</p>}
      {!walletClient && <p className="error-text">WalletClient chưa kết nối. Vui lòng kết nối lại ví.</p>}
      {balance && <p className="mt-4 text-center text-gray-700">Số dư: {parseFloat(balance.formatted).toFixed(4).replace(/\.?0+$/, "")} CAMP</p>}
      <Link href="/marketplace" className="link-text">
        Đi đến Marketplace
      </Link>
    </form>
  );
};

export default MintForm;