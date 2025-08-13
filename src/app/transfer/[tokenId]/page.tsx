"use client";

import { useEffect, useState } from "react";
import { useAccount, useWalletClient, useSwitchChain } from "wagmi";
import { ExtendedIPData } from "../../../../utils/types";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@campnetwork/origin/react";
import { campNetwork } from "../../../../utils/chain";
import Link from "next/link";
import { createPublicClient, http, parseAbiItem } from "viem";
import { mintEmitter } from "../../../../components/IPList";

// Định nghĩa địa chỉ hợp đồng
const CONTRACT_ADDRESS = "0xF90733b9eCDa3b49C250B2C3E3E42c96fC93324E" as `0x${string}`;

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

  // Tải dữ liệu IP từ localStorage
  const loadIPFromLocalStorage = (userAddress: `0x${string}`, tokenId: string): ExtendedIPData | null => {
    const cachedData = localStorage.getItem(`mintedIPs_${userAddress}`);
    if (cachedData) {
      const ips: ExtendedIPData[] = JSON.parse(cachedData);
      return ips.find((item) => item.tokenId === tokenId) || null;
    }
    return null;
  };

  // Lấy dữ liệu IP trực tiếp từ hợp đồng nếu không có trong localStorage
  const fetchIPData = async (tokenId: bigint, userAddress: `0x${string}`): Promise<ExtendedIPData | null> => {
    if (!origin) {
      setStatus("SDK chưa được khởi tạo.");
      return null;
    }

    try {
      // Kiểm tra quyền sở hữu
      const owner = await origin.ownerOf(tokenId);
      if (owner.toLowerCase() !== userAddress.toLowerCase()) {
        setStatus("Bạn không phải chủ sở hữu của IP này.");
        return null;
      }

      // Kiểm tra trạng thái token
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
        // Giả định: 1 là trạng thái đã xóa
        setStatus("Token này không tồn tại hoặc đã bị xóa.");
        return null;
      }

      // Lấy token URI
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
            console.error(`Lỗi khi lấy metadata cho token ${tokenId}`);
          }
        }
      } catch (err) {
        console.error(`Lỗi khi lấy tokenURI cho ${tokenId}:`, err);
      }

      return {
        tokenId: tokenId.toString(),
        creator: userAddress,
        contentHash: "0x" as `0x${string}`,
        tokenURI,
        transactionHash: "0x" as `0x${string}`,
        metadata,
      };
    } catch (err) {
      console.error(`Lỗi khi lấy dữ liệu IP cho token ${tokenId}:`, err);
      setStatus("Không thể tải dữ liệu IP từ hợp đồng.");
      return null;
    }
  };

  // Cập nhật localStorage sau khi chuyển giao
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

  // Tải dữ liệu IP khi trang được tải
  useEffect(() => {
    if (isConnected && address && origin) {
      const userAddress = address as `0x${string}`;
      const loadIP = async () => {
        setIsLoading(true);
        let loadedIp = loadIPFromLocalStorage(userAddress, tokenId);
        if (!loadedIp) {
          // Nếu không tìm thấy trong localStorage, lấy từ hợp đồng
          loadedIp = await fetchIPData(BigInt(tokenId), userAddress);
        }
        setIp(loadedIp);
        if (!loadedIp) {
          setStatus("Không tìm thấy IP hoặc bạn không phải chủ sở hữu.");
        }
        setIsLoading(false);
      };
      loadIP();
    }
  }, [isConnected, address, tokenId, origin]);

  // Xử lý chuyển giao
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

      // Kiểm tra trạng thái token
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
        setStatus("Token này không tồn tại hoặc đã bị xóa.");
        setIsLoading(false);
        return;
      }

      // Thực hiện transfer bằng SDK
      const txHash = await origin.safeTransferFrom(address, toAddress as `0x${string}`, BigInt(tokenId));

      // Chờ xác nhận giao dịch
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      setStatus(`Transfer thành công! Đang chuyển hướng...`);

      // Cập nhật localStorage và phát sự kiện
      updateLocalStorageAfterTransfer(address as `0x${string}`, tokenId);

      // Chuyển hướng về danh sách sau khi giao dịch được xác nhận
      setTimeout(() => {
        router.push("/marketplace");
      }, 1000); // Giảm thời gian chờ để cải thiện UX
    } catch (error) {
      console.error("Lỗi transfer:", error);
      const errMessage = error instanceof Error ? error.message : String(error);
      if (errMessage.includes("signature")) {
        setStatus("Ký giao dịch thất bại.");
      } else if (errMessage.includes("gas")) {
        setStatus("Không đủ gas. Vui lòng thêm CAMP vào ví của bạn.");
      } else if (errMessage.includes("NotTokenOwner")) {
        setStatus("Bạn không phải chủ sở hữu của IP này.");
      } else if (errMessage.includes("ERC721NonexistentToken")) {
        setStatus("Token này không tồn tại hoặc đã bị xóa.");
      } else {
        setStatus(`Lỗi: ${errMessage}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="text-center mt-10">
        <p className="text-lg text-gray-600">Vui lòng kết nối ví để transfer IP.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="text-center mt-10">
        <p className="text-lg text-gray-600">Đang tải dữ liệu IP...</p>
        {status && <p className="text-sm text-red-600 mt-2">{status}</p>}
      </div>
    );
  }

  if (!ip) {
    return (
      <div className="text-center mt-10">
        <p className="text-lg text-gray-600">Không tìm thấy IP. {status}</p>
        <Link href="/marketplace" className="text-blue-500 hover:underline mt-4 inline-block">
          Quay lại Marketplace
        </Link>
      </div>
    );
  }

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
      <Link href="/marketplace" className="text-blue-500 hover:underline mt-4 block text-center">
        Đi đến Marketplace
      </Link>
    </div>
  );
}