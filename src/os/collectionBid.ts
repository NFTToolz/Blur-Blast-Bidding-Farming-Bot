import axios from 'axios';
import { TypedDataDomain, TypedDataField } from 'ethers';

import { LoggedInWallet } from './login';
import { SimplifiedCollectionBid } from '../blur/bids';
import { Collection } from '../store/collectionsSlice';
import { blastAxios } from '../utils/axios';
import { dryRunEnv } from '../utils/flags';
import { logDebug, logError } from '../utils/log';
import { osRateLimit } from '../utils/rateLimit';
import {BigNumber} from "@ethersproject/bignumber";

type CollectionBidFormat = {
  success: true;
  signatures: {
    type: 'signTypedData_v4';
    signData: {
      domain: TypedDataDomain;
      types: Record<string, Array<TypedDataField>>;
      value: Record<string, unknown>;
    };
    marketplace: string;
    marketplaceData: string;
    tokens: unknown[];
  }[];
};

export const createCollectionBid = async (
  collection: Collection,
  amount: number,
  quantities: number[],
  wallet: LoggedInWallet,
): Promise<number> => {
  await osRateLimit();

  const expirationMs = Date.now() + collection.config.bidExpiration * 60 * 1000;
  const in30Mins = new Date(expirationMs);

  if (dryRunEnv) {
    return expirationMs;
  }

  const promises: Promise<unknown>[] = [];

  quantities.forEach((quantity) => {
    promises.push(
      executeCollectionBid(wallet, collection, quantity, amount, in30Mins.toISOString()),
    );
  });

  await Promise.all(promises);

  return expirationMs;
};

const executeCollectionBid = async (
  wallet: LoggedInWallet,
  collection: Collection,
  quantity: number,
  amount: number,
  expiration: string,
  retry = false,
): Promise<void> => {
  try {
    const response = await blastAxios.post<CollectionBidFormat>(
      '/v1/collection-bids/format',
      {
        price: {
          unit: 'BETH',
          amount: String(amount),
        },
        criteria: {
          type: "COLLECTION",
          value: {},
        },
        quantity,
        expirationTime: expiration,
        contractAddress: collection.contractAddress,
      },
      {
        headers: {
          authToken: wallet.authKey,
          walletAddress: wallet.address,
        },
      },
    );

    if (!response.data.success) {
      throw new Error('failure');
    }


    const toSign = response.data.signatures[0];

    toSign.signData.value.nonce = BigNumber.from(toSign.signData.value.nonce).toString();
    const signature = await wallet.signer.signTypedData(
      toSign.signData.domain,
      toSign.signData.types,
      toSign.signData.value,
    );

    await osRateLimit();

    await blastAxios.post<CollectionBidFormat>(
      '/v1/collection-bids/submit',
      {
        signature,
        marketplaceData: toSign.marketplaceData,
      },
      {
        headers: {
          authToken: wallet.authKey,
          walletAddress: wallet.address,
        },
      },
    );
  } catch (err) {
    console.log(err);
    logError(
      `Wallet: ${wallet.address} Contract: ${collection.slug}: Failed to create bid for ${quantity}x${amount}`,
    );

    if (err instanceof Error) {
      logError(err.message);
    }

    if (axios.isAxiosError(err)) {
      if (
        !retry &&
        (err.response?.data.message === 'Limit exceeded' ||
          err.response?.data.message === 'Insufficient funds')
      ) {
        throw new Error('Limit exceeded');
      }

      logError(
        `Error response: ${err.response?.status} ${err.response?.statusText}`,
        err.response?.data,
      );
    }
  }
};

export const cancelCollectionBid = async (
  collection: Pick<Collection, 'slug' | 'contractAddress'>,
  prices: number[],
  wallet: LoggedInWallet,
): Promise<void> => {
  try {
    await osRateLimit();

    logDebug(
      `Wallet [${wallet.address}] Contract [${
        collection.slug
      }]: Cancelling bid for ${JSON.stringify(prices)}`,
    );

    if (dryRunEnv) {
      return;
    }

    await blastAxios.post(
      '/v1/collection-bids/cancel',
      {
        prices: prices.map((price) => String(price)),
        contractAddress: collection.contractAddress,
      },
      {
        headers: {
          authToken: wallet.authKey,
          walletAddress: wallet.address,
        },
      },
    );
  } catch (err) {
    logDebug(`Failed to cancel bids`, {
      message: err instanceof Error ? err.message : 'unknown',
      response: axios.isAxiosError(err) ? err.response?.data : null,
    });
    if (axios.isAxiosError(err) && err.response) {
      if (err.response.data.message === 'No bids found') return;
    }

    throw err;
  }
};

type CollectionBid = {
  price: string;
  bidderAddressesSample: string[];
  numberBidders: number;
  executableSize: number;
};

type CollectionBids = {
  success: boolean;
  priceLevels: CollectionBid[];
};

export const getCollectionBids = async (
  contractAddress: string,
  wallet: LoggedInWallet,
  take = 50,
): Promise<SimplifiedCollectionBid[]> => {
  await osRateLimit();
  const response = await blastAxios.get<CollectionBids>(
    `/v1/collections/${contractAddress}/executable-bids`,
    {
      params: {
        filters: '{}',
      },
      headers: {
        authToken: wallet.authKey,
        walletAddress: wallet.address,
      },
    },
  );

  if (!response.data.success) {
    throw new Error('failed to load collection bids');
  }

  return response.data.priceLevels.slice(0, take).map((bid) => ({
    price: Number(bid.price),
    bidderAddressesSample: bid.bidderAddressesSample,
    executableSize: bid.executableSize,
    numberBidders: bid.numberBidders,
    contractAddress,
  }));
};
