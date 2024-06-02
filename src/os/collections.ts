import { LoggedInWallet } from './login';
//import { Collection } from '../blur/collections';
import { blastAxios } from '../utils/axios';
import { osRateLimit } from '../utils/rateLimit';

type Amount = {
  amount: string;
  unit: string;
};

type Token = {
  tokenId: string;
  name: string;
  price: Amount;
};

type TokenApiResponse = {
  success: boolean;
  tokens: Token[];
};

export const getCollectionFloorPrice = async (
  contractAddress: string,
  wallet: LoggedInWallet
): Promise<Amount | null> => {
  await osRateLimit();
  try {
    const response = await blastAxios.get<TokenApiResponse>(
      `/v1/collections/${contractAddress}/tokens`,
      {
        headers: {
          authToken: wallet.authKey,
          walletAddress: wallet.address,
        },
        params: {
          filters: JSON.stringify({traits: [], hasAsks: true})
        }
      }
    );
    
    if (!response.data.success) {
      throw new Error(`Failed to fetch tokens for collection ${contractAddress}`);
    }

    const tokens = response.data.tokens;
    if (tokens.length === 0) {
      console.log('No tokens with asks available.');
      return null;
    }
    // Assuming tokens are returned in the order of asking prices ascending
    return tokens[0].price;
  } catch (error) {
    console.error('Error fetching floor price:', error);
    throw error;
  }
};

export type Collection = {
  contractAddress: string;
  name: string;
  slug: string;
  imageUrl: string;
  totalSupply: number;
  numberOwners: number;
  floorPrice: Amount | null;
  floorPriceOneDay: Amount | null;
  floorPriceOneWeek: Amount | null;
  volumeFifteenMinutes: Amount | null;
  volumeOneDay: Amount | null;
  volumeOneWeek: Amount | null;
  bestCollectionBid: Amount | null;
  totalCollectionBidValue: Amount | null;
};

export const getCollection = async (
  contractAddress: string,
  wallet: LoggedInWallet,
): Promise<Collection> => {
  await osRateLimit();
  const response = await blastAxios.get<{ success: boolean; collection: Collection }>(
    `/v1/collections/${contractAddress}`,
    {
      headers: {
        authToken: wallet.authKey,
        walletAddress: wallet.address,
      },
    },
  );

  if (response.data.success === false) {
    throw new Error(`Failed to fetch collection ${contractAddress}`);
  }
  return response.data.collection;
};


// Define a type for your API response
interface CollectionApiResponse {
  success: boolean;
  collections: Collection[];
}

export const getCollections = async (
  pageSize = 300,
  wallet: LoggedInWallet,
): Promise<Collection[]> => {
  let allCollections: Collection[] = [];
  let lastContractAddress: string | null = null;
  let lastVolumeOneDay: string | null = null;

  await osRateLimit();

  while (allCollections.length < pageSize) {
    let filters;
    if (lastContractAddress && lastVolumeOneDay) {
      filters = {
        cursor: {
          contractAddress: lastContractAddress,
          volumeOneDay: lastVolumeOneDay,
        },
        sort: "VOLUME_ONE_DAY",
        order: "DESC",
      };
    } else {
      filters = {
        sort: "VOLUME_ONE_DAY",
        order: "DESC",
      };
    }

    const response = await blastAxios.get<CollectionApiResponse>(
      `/v1/collections`,
      {
        headers: {
          authToken: wallet.authKey,
          walletAddress: wallet.address,
        },
        params: {
          filters: JSON.stringify(filters),
        },
      },
    );

    if (!response.data.success) {
      throw new Error(`Failed to fetch collections`);
    }

    const collections: Collection[] = response.data.collections;
    allCollections.push(...collections);

    if (collections.length === 0) {
      break;
    }

    const lastCollection: Collection = collections[collections.length - 1];
    lastContractAddress = lastCollection.contractAddress;
    lastVolumeOneDay = lastCollection.volumeOneDay ? lastCollection.volumeOneDay.amount.toString() : null;
  }

  // Trimming the array to the desired pageSize in case it exceeds
  return allCollections.slice(0, pageSize);
};

