export type SimplifiedCollectionBid = {
  price: number;
  bidderAddressesSample: string[];
  numberBidders: number;
  executableSize: number;
  contractAddress: string;
};

type CollectionBid = {
  id: number;
  slug: string;
  contractAddress: string;
  price: number;
  bidderAddressesSample: string[];
  numberBidders: number;
  executableSize: number;
  updatedAt: string;
  createdAt: string;
};

type CollectionBids = {
  total: number;
  bids: CollectionBid[];
};
