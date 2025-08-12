"use client";

import { useState } from "react";
import { useAuth } from "@campnetwork/origin/react";
import { useAccount } from "wagmi";

interface TransferIPFormProps {
  ipId: bigint;
  onClose: () => void;
}

const TransferIPForm = ({ ipId, onClose }: TransferIPFormProps) => {
  const { origin, jwt } = useAuth();
  const { address } = useAccount(); // Lấy địa chỉ của user hiện tại
  const [newOwner, setNewOwner] = useState(""); // Address mới
  const [status, setStatus] = useState("");

  const handleTransfer = async () => {
    if (!origin || !jwt || !address) {
      setStatus("Please connect your wallet.");
      return;
    }

    if (!newOwner) {
      setStatus("Please enter new owner address.");
      return;
    }

    try {
      setStatus("Transferring IP...");
      // Sử dụng transferFrom từ SDK
      const result = await origin.transferFrom(address, newOwner as `0x${string}`, ipId);
      setStatus(`IP transferred! Transaction: ${result.transactionHash}`);
      console.log("Transfer result:", result);
      onClose();
    } catch (error) {
      setStatus(`Error transferring IP: ${(error as Error).message}`);
      console.error("Transfer error:", error);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white p-6 rounded">
        <h2 className="text-xl mb-4">Transfer IP {ipId.toString()}</h2>
        <label>New Owner Address:</label>
        <input
          type="text"
          value={newOwner}
          onChange={(e) => setNewOwner(e.target.value)}
          className="w-full p-2 border mb-4"
          required
        />
        <button onClick={handleTransfer} className="bg-red-500 text-white px-4 py-2 mr-2">
          Confirm Transfer
        </button>
        <button onClick={onClose} className="bg-gray-500 text-white px-4 py-2">
          Cancel
        </button>
        <p className="mt-4">{status}</p>
      </div>
    </div>
  );
};

export default TransferIPForm;