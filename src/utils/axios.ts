import ax from 'axios';
import axiosRetry from 'axios-retry';

import { NftApiKeyEnv } from './flags';

export const osAxios = ax.create({
  baseURL: 'https://nfttools.pro/blur/',
  // timeout: 10000,
  headers: {
    'X-NFT-API-KEY': NftApiKeyEnv
  },
});

interface ApiErrorResponse {
  message?: string; // Make it optional as not all responses may have a message
}


export const blastAxios = ax.create({
  baseURL: 'https://nfttools.pro/blur_blast/',
  // timeout: 10000,
  headers: {
    'X-NFT-API-KEY': NftApiKeyEnv
  },
});

axiosRetry(blastAxios, {
  retries: 2,
  retryCondition: (error): boolean => {
    const errorData = error.response?.data as ApiErrorResponse; // Type assertion

    return (
        !error.response ||
        (error.response.status >= 400 &&
            error.response.status <= 599 &&
            errorData.message !== 'Limit exceeded' &&
            errorData.message !== 'No bids found' &&
            errorData.message !== 'Insufficient funds')
    );
  },
});

export const blurAxios = ax.create({
  baseURL: 'https://nfttools.pro/openlur/',
  timeout: 5000,
  headers: {
    'X-NFT-API-KEY': NftApiKeyEnv
  },
});
