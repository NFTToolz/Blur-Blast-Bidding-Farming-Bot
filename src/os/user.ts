import { LoggedInWallet } from './login';
import { blastAxios } from '../utils/axios';
import { osRateLimit } from '../utils/rateLimit';

type UserBid = {
  price: string;
  contractAddress: string;
  executableSize: number;
  openSize: number;
};

export const getUsersCollectionBids = async (wallet: LoggedInWallet): Promise<UserBid[]> => {
  await osRateLimit();

  const response = await blastAxios.get<{ success: boolean; priceLevels: UserBid[] }>(
    `/v1/collection-bids/user/${wallet.address.toLowerCase()}`,
    {
      headers: {
        authToken: wallet.authKey,
        walletAddress: wallet.address,
      },
      params: {
        filters: '{}',
      },
    },
  );

  if (!response.data.success) {
    throw new Error('failed to load users bids');
  }

  return response.data.priceLevels;
};

type UserPortfolio = {
  success: boolean;
  totalCount: number;
  tokens: {
    tokenId: string;
    contractAddress: string;
    name: string;
  }[];
};

export const getUserPortfolio = async (wallet: LoggedInWallet): Promise<UserPortfolio> => {
  await osRateLimit();

  const response = await blastAxios.get<UserPortfolio>(
    `/v1/portfolio/${wallet.address.toLowerCase()}/owned`,
    {
      headers: {
        authToken: wallet.authKey,
        walletAddress: wallet.address,
      },
      params: {
        filters: '{}',
      },
    },
  );

  if (!response.data.success) {
    throw new Error('failed to load users bids');
  }

  return response.data;
};
