"use client";

import { useEffect, useState } from "react";
import { createPublicClient, http, parseAbiItem } from "viem";
import { useAccount, useWalletClient, useConnect, useSwitchChain } from "wagmi";
import { campNetwork } from "../utils/chain";
import IPCard from "./IPCard";
import { IPData } from "../utils/types";
import mitt from "mitt";

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

// Tạo event emitter instance
const emitter = mitt<{ newMint: `0x${string}` }>();

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
        const toBlock =
          currentFromBlock + BigInt(MAX_BLOCK_RANGE) > latestBlock
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
                    console.error(`Lỗi lấy metadata cho token ${tokenId}`);
                  }
                }
              } catch (err) {
                console.error(`Lỗi xử lý tokenURI cho ${tokenId}:`, err);
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
          console.error(
            `Lỗi truy vấn logs cho khoảng block ${currentFromBlock} đến ${toBlock}:`,
            chunkError
          );
        }

        currentFromBlock = toBlock + 1n;
      }

      console.log(`Đã lấy dữ liệu sự kiện:`, results);

      // Lưu dữ liệu vào localStorage và reset flag refresh
      localStorage.setItem(`mintedIPs_${userAddress}`, JSON.stringify(results));
      localStorage.setItem(`needsIPRefresh_${userAddress}`, 'false');
      setIps(results);
    } catch (error) {
      console.error("Lỗi truy vấn IPs đã mint:", error);
      setStatus("Lỗi tải IPs. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadFromLocalStorage = (userAddress: `0x${string}`): ExtendedIPData[] => {
    const cachedData = localStorage.getItem(`mintedIPs_${userAddress}`);
    return cachedData ? JSON.parse(cachedData) : [];
  };

  const handleConnect = async () => {
    try {
      if (!isConnected) {
        setStatus("Đang kết nối ví...");
        await connect({ connector: connectors[0] });
      }
      if (walletClient) {
        const chainId = await walletClient.getChainId();
        if (chainId !== campNetwork.id) {
          setStatus("Đang chuyển sang BaseCAMP...");
          await switchChainAsync({ chainId: campNetwork.id });
        }
      }
    } catch (error) {
      console.error("Lỗi khi kết nối ví:", error);
      setStatus("Kết nối ví thất bại.");
    }
  };

  useEffect(() => {
    if (isConnected && address) {
      const userAddress = address as `0x${string}`;
      // Kiểm tra flag cần refresh
      const needsRefresh = localStorage.getItem(`needsIPRefresh_${userAddress}`) === 'true';
      // Tải dữ liệu từ localStorage trước
      const cachedIPs = loadFromLocalStorage(userAddress);
      if (cachedIPs.length > 0 && !needsRefresh) {
        setIps(cachedIPs);
      } else {
        fetchMintedIPs(userAddress);
      }

      // Lắng nghe sự kiện mint mới (cho trường hợp cùng trang)
      const handleNewMint = (mintedAddress: `0x${string}`) => {
        if (mintedAddress === userAddress) {
          fetchMintedIPs(userAddress);
        }
      };

      emitter.on("newMint", handleNewMint);

      // Dọn dẹp sự kiện khi component unmount
      return () => {
        emitter.off("newMint", handleNewMint);
      };
    }
  }, [isConnected, address]);

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center gap-4 p-4">
        <p className="text-lg">Vui lòng kết nối ví của bạn để xem các IP đã mint.</p>
        <button
          onClick={handleConnect}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition"
        >
          Kết nối ví
        </button>
        {status && <p className="text-sm text-gray-600">{status}</p>}
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Các IP đã mint của bạn</h1>
      {isLoading ? (
        <p>Đang tải IPs...</p>
      ) : ips.length === 0 ? (
        <p>Chưa có IP nào được mint.</p>
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

export const mintEmitter = emitter;