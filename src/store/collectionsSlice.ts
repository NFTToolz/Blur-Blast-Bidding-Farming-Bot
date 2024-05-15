import { getCollection } from '../os/collections';
import { readCollections, saveCollections } from '../storage/collections';
import { readCollectionConfigs } from '../storage/collectionsConfig';
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
import { logDebug, logError, logInfo } from '../utils/log';

export type UpdatedBids = {
  contractAddress: string;
  floor?: number;
  bids: { price: number; executableSize: number; numberBidders: number }[];
};

export type WalletAddress = string;

type MyBid = {
  bids: Record<string, number>;
};
type MyBids = Record<WalletAddress, MyBid>;

type Bid = {
  price: number;
  executableSize: number;
};

export type CollectionConfig = {
  slug?: string;
  useMaxQuantity: boolean;
  maxQuantity: number;
  bidToPool1: boolean;
  poolSizeLimitBid: number;
  poolSizeLimitCancel: number;
  samePoolSizeLimitBid: number;
  samePoolSizeLimitCancel: number;
  bidToSamePool: boolean;
  maxPoolToBid: number;
  bidExpiration: number;
  floorCheck: boolean;
  floorLimit: number;
};

export type Collection = {
  contractAddress: string;
  bids: Bid[];
  myBids: MyBids;
  updaterRunning: boolean;
  queuedUpdate?: UpdatedBids;
  name: string;
  slug: string;
  config: CollectionConfig;
  floor?: number;
};
export type Collections = Record<string, Collection>;

const getCollectionDetails = async (
  contractAddress: string,
  wallets: LoggedInWallet[],
  savedCollections: ReturnType<typeof readCollections>,
  collectionsConfig: ReturnType<typeof readCollectionConfigs>,
): Promise<Collection> => {
  const savedConfig = collectionsConfig[contractAddress] || {};
  const floorCheck = savedConfig.floorCheck ?? floorCheckEnv;

  const details = savedCollections[contractAddress]
    ? savedCollections[contractAddress]
    : await getCollection(contractAddress,wallets[0]);

  let slug = '';
  if ('collectionSlug' in details) {
    slug = details.collectionSlug as string;
  } else if ('slug' in details) {
    slug = details.slug as string;
  }
  const collectionDetails = {
    name: details.name,
    slug: slug,
    contractAddress,
    bids: [],
    myBids: {},
    updaterRunning: false,
    floor: undefined,
    queuedUpdate: undefined,
    config: {
      maxPoolToBid: savedConfig.maxPoolToBid ?? maxPoolToBidEnv,
      poolSizeLimitBid: savedConfig.poolSizeLimitBid ?? poolSizeLimitBidEnv,
      poolSizeLimitCancel: savedConfig.poolSizeLimitCancel ?? poolSizeLimitCancelEnv,
      bidToPool1: savedConfig.bidToPool1 ?? bidToPool1Env,
      bidToSamePool: savedConfig.bidToSamePool ?? bidToSamePoolEnv,
      samePoolSizeLimitBid: savedConfig.samePoolSizeLimitBid ?? samePoolSizeLimitBidEnv,
      samePoolSizeLimitCancel: savedConfig.samePoolSizeLimitCancel ?? samePoolSizeLimitCancelEnv,
      useMaxQuantity: savedConfig.useMaxQuantity ?? useMaxQuantityEnv,
      maxQuantity: savedConfig.maxQuantity ?? maxQuantityEnv,
      bidExpiration: savedConfig.bidExpiration ?? bidExpirationEnv,
      floorCheck,
      floorLimit: (savedConfig.floorLimit ?? floorLimitEnv) / 100 + 1,
    },
  };

  logDebug(`Contract ${collectionDetails.slug} (${contractAddress}) loaded`, collectionDetails);

  return collectionDetails;
};

export const collectionSlice = async (): Promise<Collections> => {
  const collections: Collections = {};

  const addresses = collectionsEnv.split(',');
  const savedCollections = readCollections();
  const collectionsConfig = readCollectionConfigs();
  const wallets = await walletsSlice();
  const promises: Promise<unknown>[] = [];

  addresses.forEach((contractAddress) => {
    promises.push(
      getCollectionDetails(contractAddress.toLowerCase(), wallets, savedCollections, collectionsConfig)
        .then((collection) => {
          collections[collection.contractAddress] = collection;
          logInfo(
            `Contract ${collection.slug} (${collection.contractAddress}) loaded${
              collectionsConfig[contractAddress] ? ' with custom config' : ''
            }.`,
          );
        })
        .catch((error) => {
          console.log(error);
          logError(`Failed loading collection ${contractAddress}` + error);
        }),
    );
  });

  await Promise.all(promises);

  saveCollections(Object.values(collections));

  return collections;
};
