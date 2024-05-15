import { handleUpdatedBids } from './collection';
import { getCollectionBids } from '../os/collectionBid';
import { getCollection } from '../os/collections';
import { Store } from '../store';
import { logDebug, logError } from '../utils/log';

const failsafeReasons = {
  noWs: false,
  wsDown: false
};

export const failSafeState = {
  isRunning: false,
};

export const turnOnFailsafe = (
  store: Store,
  reason: keyof typeof failsafeReasons,
  msg = '',
  silent = false,
): void => {
  if (!silent && !failsafeReasons[reason]) {
    logError(`Failsafe started: ${reason}; ${msg}`);
  }

  failsafeReasons[reason] = true;
  if (failSafeState.isRunning) return;

  failSafeState.isRunning = true;
  void failsafe(store);
};

export const turnOffFailsafe = (reason: keyof typeof failsafeReasons): void => {
  if (!failsafeReasons[reason]) return;

  logError(`Failsafe stopped: ${reason}`);
  failsafeReasons[reason] = false;
  console.log("failsafeReasons.wsDown: " + failsafeReasons.wsDown);
  if (!failsafeReasons.wsDown) {
    failSafeState.isRunning = false;
  }
};

const failsafeCheckCollection = async (store: Store, contractAddress: string): Promise<void> => {
  let floor: number | undefined = undefined;
  if (store.collections[contractAddress].config.floorCheck) {
    const collection = await getCollection(contractAddress, store.wallets[0]);
    if (collection.floorPrice) {
      floor = Number(collection.floorPrice.amount);
    }
  }

  const bids = await getCollectionBids(contractAddress, store.wallets[0], 5);
  await handleUpdatedBids(store, contractAddress, {
    floor,
    contractAddress,
    bids,
  });
};

const failsafe = async (store: Store): Promise<void> => {
  if (!failSafeState.isRunning) return;
  logDebug(`Direct: Handle updated bids`);
  const promises: Promise<unknown>[] = [];

  const collections = Object.keys(store.collections);

  collections.forEach((contractAddress) => {
    promises.push(
      failsafeCheckCollection(store, contractAddress).catch((err) => {
        console.log(err);
        logError(
          `Contract: ${store.collections[contractAddress].slug}: Failed to fetch bids from API.`,
        );

        if (err instanceof Error) {
          logError(err.message);
        }
      }),
    );
  });

  await Promise.all(promises);
  if (!failSafeState.isRunning) return;

  setTimeout(() => {
    failsafe(store);
  }, 1000);
};
