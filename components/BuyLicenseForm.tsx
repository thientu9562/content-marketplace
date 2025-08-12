"use client";

import { useState } from "react";
import { useAuth } from "@campnetwork/origin/react";

interface BuyLicenseFormProps {
  ipId: bigint;
  onClose: () => void;
}

const BuyLicenseForm = ({ ipId, onClose }: BuyLicenseFormProps) => {
  const { origin, jwt } = useAuth();
  const [periods, setPeriods] = useState(""); // Số lượng periods (thay vì duration)
  const [status, setStatus] = useState("");

  const handleBuy = async () => {
    if (!origin || !jwt) {
      setStatus("Please connect your wallet.");
      return;
    }

    if (!periods || Number(periods) <= 0) {
      setStatus("Please enter a valid number of periods.");
      return;
    }

    try {
      setStatus("Buying license...");
      // Sử dụng buyAccess từ SDK
      const result = await origin.buyAccess(ipId, Number(periods));
      setStatus(`License bought! Transaction: ${result.transactionHash}`);
      console.log("Buy license result:", result);
      onClose();
    } catch (error) {
      setStatus(`Error buying license: ${(error as Error).message}`);
      console.error("Buy license error:", error);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white p-6 rounded">
        <h2 className="text-xl mb-4">Buy License for IP {ipId.toString()}</h2>
        <label>Number of Periods:</label>
        <input
          type="number"
          value={periods}
          onChange={(e) => setPeriods(e.target.value)}
          className="w-full p-2 border mb-4"
          min="1"
        />
        <button onClick={handleBuy} className="bg-blue-500 text-white px-4 py-2 mr-2">
          Confirm Buy
        </button>
        <button onClick={onClose} className="bg-gray-500 text-white px-4 py-2">
          Cancel
        </button>
        <p className="mt-4">{status}</p>
      </div>
    </div>
  );
};

export default BuyLicenseForm;