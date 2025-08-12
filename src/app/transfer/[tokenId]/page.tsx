"use client";

import { useEffect, useState } from "react";
import { useAccount, useWalletClient, useSwitchChain } from "wagmi";
import { ExtendedIPData } from "../../../../utils/types";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@campnetwork/origin/react";
import { campNetwork } from "../../../../utils/chain";
import Link from "next/link";

export default function TransferPage() {
  const params = useParams<{ tokenId: string }>();
  const tokenId = params.tokenId;
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();
  const { origin } = useAuth();
  const router = useRouter();
  const [ip, setIp] = useState<ExtendedIPData | null>(null);
  const [toAddress, setToAddress] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const loadIPFromLocalStorage = (userAddress: `0x${string}`, tokenId: string): ExtendedIPData | null => {
    const cachedData = localStorage.getItem(`mintedIPs_${userAddress}`);
    if (cachedData) {
      const ips: ExtendedIPData[] = JSON.parse(cachedData);
      return ips.find((item) => item.tokenId === tokenId) || null;
    }
    return null;
  };

  const updateLocalStorageAfterTransfer = (userAddress: `0x${string}`, tokenId: string) => {
    const cachedData = localStorage.getItem(`mintedIPs_${userAddress}`);
    if (cachedData) {
      let ips: ExtendedIPData[] = JSON.parse(cachedData);
      ips = ips.filter((item) => item.tokenId !== tokenId);
      localStorage.setItem(`mintedIPs_${userAddress}`, JSON.stringify(ips));
    }
    localStorage.setItem(`needsIPRefresh_${userAddress}`, "true");
  };

  useEffect(() => {
    if (isConnected && address) {
      const loadedIp = loadIPFromLocalStorage(address as `0x${string}`, tokenId);
      if (loadedIp) {
        setIp(loadedIp);
      } else {
        setStatus("Không tìm thấy IP trong bộ nhớ đệm. Vui lòng quay lại danh sách và làm mới.");
      }
    }
  }, [isConnected, address, tokenId]);

  const handleTransfer = async () => {
    if (!origin || !walletClient || !address || !toAddress) {
      setStatus("Vui lòng nhập địa chỉ nhận và đảm bảo ví đã kết nối.");
      return;
    }

    // Kiểm tra định dạng địa chỉ nhận
    if (!toAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      setStatus("Địa chỉ nhận không hợp lệ. Vui lòng nhập địa chỉ Ethereum hợp lệ.");
      return;
    }

    setIsLoading(true);
    setStatus("Đang chuẩn bị transfer...");

    try {
      const chainId = await walletClient.getChainId();
      if (chainId !== campNetwork.id) {
        setStatus("Chain không đúng. Đang chuyển sang BaseCAMP...");
        await switchChainAsync({ chainId: campNetwork.id });
      }

      // Kiểm tra owner bằng SDK
      const owner = await origin.ownerOf(BigInt(tokenId));
      if (owner.toLowerCase() !== address.toLowerCase()) {
        setStatus("Bạn không phải chủ sở hữu của IP này.");
        setIsLoading(false);
        return;
      }

      // Thực hiện transfer bằng SDK
      const result = await origin.safeTransferFrom(address, toAddress as `0x${string}`, BigInt(tokenId));
      setStatus(`Transfer thành công!`);

      // Xóa IP khỏi localStorage
      updateLocalStorageAfterTransfer(address as `0x${string}`, tokenId);

      // Redirect về danh sách sau 3 giây
      setTimeout(() => {
        router.push("/marketplace");
      }, 3000);
    } catch (error) {
      console.error("Lỗi transfer:", error);
      const errMessage = (error as Error).message;
      setStatus(`Lỗi: ${errMessage}`);
      if (errMessage.includes("signature")) {
        setStatus("Ký giao dịch thất bại.");
      } else if (errMessage.includes("gas")) {
        setStatus("Không đủ gas. Vui lòng thêm CAMP vào ví của bạn.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!isConnected) {
    return <p>Vui lòng kết nối ví để transfer IP.</p>;
  }

  if (!ip) {
    return <p>Đang tải dữ liệu IP... {status}</p>;
  }

  return (
  <div className="bg-white p-6 rounded-lg shadow-lg max-w-md mx-auto mt-10">
    <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6 text-center">
      Transfer IP: {ip.metadata?.title || "Untitled"}
    </h1>
    <p className="text-gray-600 mb-2">Token ID: {ip.tokenId.slice(0, 5)}...${tokenId.slice(-4)}</p>
    <p className="text-gray-600 mb-2">Creator: {ip.creator}</p>
    {ip.metadata?.image && (
      <img
        src={ip.metadata.image}
        alt={ip.metadata.title}
        className="w-48 h-48 object-cover rounded-lg mt-4 shadow-md border border-gray-200"
      />
    )}
    <div className="mt-6">
      <label className="block text-lg font-semibold text-gray-700 mb-2">Địa chỉ nhận:</label>
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
        {isLoading ? "Đang transfer..." : "Transfer"}
      </button>
    </div>
    {status && <p className="mt-4 text-center text-red-600 text-sm">{status}</p>}
    <Link href="/marketplace" className="link-text">
        Đi đến Marketplace
    </Link>
  </div>
  );
}