import { getCollection } from '../os/collections';
import { readCollections } from '../storage/collections';
import { readCollectionConfigs, saveCollectionConfigs } from '../storage/collectionsConfig';
import { CollectionConfig } from '../store/collectionsSlice';
import { LoggedInWallet } from '../os/login';
import { walletsSlice } from '../store/walletsSlice';

import {
  bidExpirationEnv,
  bidToPool1Env,
  bidToSamePoolEnv,
  collectionsEnv,
  floorCheckEnv,
  floorLimitEnv,
  maxPoolToBidEnv,
  maxQuantityEnv,
  poolSizeLimitBidEnv,
  poolSizeLimitCancelEnv,
  samePoolSizeLimitBidEnv,
  samePoolSizeLimitCancelEnv,
  useMaxQuantityEnv,
} from '../utils/flags';
import { logError } from '../utils/log';

const generateConfig = async (
  contractAddress: string,
  wallets: LoggedInWallet[],
  savedCollections: ReturnType<typeof readCollections>,
): Promise<CollectionConfig> => {
  const details = savedCollections[contractAddress]
    ? savedCollections[contractAddress]
    : await getCollection(contractAddress,wallets[0]);

  return {
    slug: details.slug,
    maxPoolToBid: maxPoolToBidEnv,
    poolSizeLimitBid: poolSizeLimitBidEnv,
    poolSizeLimitCancel: poolSizeLimitCancelEnv,
    bidToPool1: bidToPool1Env,
    bidToSamePool: bidToSamePoolEnv,
    samePoolSizeLimitBid: samePoolSizeLimitBidEnv,
    samePoolSizeLimitCancel: samePoolSizeLimitCancelEnv,
    useMaxQuantity: useMaxQuantityEnv,
    maxQuantity: maxQuantityEnv,
    bidExpiration: bidExpirationEnv,
    floorCheck: floorCheckEnv,
    floorLimit: floorLimitEnv,
  };
};

export const generateCollectionConfigs = async (): Promise<void> => {
  const configs: ReturnType<typeof readCollectionConfigs> = {};

  const addresses = collectionsEnv.split(',');
  const savedCollections = readCollections();

  const promises: Promise<unknown>[] = [];
  const wallets = await walletsSlice();
  
  addresses.forEach((contractAddress) => {
    promises.push(
      generateConfig(contractAddress.toLowerCase(), wallets, savedCollections)
        .then((config) => {
          configs[contractAddress.toLowerCase()] = config;
        })
        .catch(() => {
          logError(`Failed generate collection config ${contractAddress}`);
        }),
    );
  });

  await Promise.all(promises);

  saveCollectionConfigs(configs);
};
