export interface IPData {
  tokenId: number;
  creator?: `0x${string}`;
  contentHash?: `0x${string}`;
  tokenURI: string;
  transactionHash: `0x${string}`;
}

export interface IPMetadata {
  title: string;
  description: string;
  category: string;
  attribution: string;
  image: string;
}

export interface ExtendedIPData extends IPData {
  metadata?: IPMetadata;
}