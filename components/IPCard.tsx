import { ExtendedIPData } from "../utils/types";

interface IPCardProps {
  ip: ExtendedIPData;
}

export default function IPCard({ ip }: IPCardProps) {
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
      <p className="text-xs text-gray-500 mt-2">Token ID: {ip.tokenId}</p>
      <p className="text-xs text-gray-500">Creator: {ip.creator}</p>
    </div>
  );
}