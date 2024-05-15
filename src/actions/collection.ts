import axios from 'axios';
import { ethers } from 'ethers';

import { getCollectionBids } from '../os/collectionBid';
import { cancelCollectionBid, createCollectionBid } from '../os/collectionBid';
import { LoggedInWallet } from '../os/login';
import { saveMyBids } from '../storage/myBids';
import { Store } from '../store';
import { UpdatedBids } from '../store/collectionsSlice';
import { logDebug, logEmergency, logError, logInfo } from '../utils/log';
import { blurContract } from '../utils/provider';
import { getQuantity } from '../utils/quantity';

export const setupCollection = async (store: Store, contractAddress: string): Promise<void> => {
  const bids = await getCollectionBids(contractAddress, store.wallets[0], 5);
  store.collections[contractAddress].bids = bids.map((bid) => ({
    price: bid.price,
    executableSize: bid.executableSize,
  }));

  const promises: Promise<unknown>[] = [];

  for (const wallet of store.wallets) {
    promises.push(syncMyBids(store, contractAddress, wallet));
  }

  await Promise.all(promises);
};

const sendCollectionBid = async (
  store: Store,
  contractAddress: string,
  price: number,
  quantities: number[],
  wallet: LoggedInWallet,
  retry = false,
): Promise<void> => {
  const collection = store.collections[contractAddress];
  if (!store.collections[contractAddress].myBids[wallet.address]) {
    store.collections[contractAddress].myBids[wallet.address] = { bids: {} };
  }

  try {
    store.collections[contractAddress].myBids[wallet.address].bids[String(price)] =
      await createCollectionBid(collection, price, quantities, wallet);
  } catch (err) {
    logError(
      `Wallet: ${wallet.address} Contract: ${collection.slug}: Failed to create bid for ${price}`,
    );

    if (err instanceof Error) {
      logError(err.message);

      if (!retry && err.message === 'Limit exceeded') {
        const currentBalance = await blurContract.balanceOf(wallet.address);
        wallet.balance = Number(ethers.formatEther(currentBalance));

        await cancelCollectionBid(collection, [price], wallet).catch((err) => {
          logEmergency(`Failed to cancel bid ${price} for contract ${collection.slug}.`);
          if (axios.isAxiosError(err)) {
            logError(
              `Failed to cancel bid ${price} for contract ${collection.slug}.`,
              err.response?.data,
            );
          }
        });

        delete store.collections[contractAddress].myBids[wallet.address].bids[price];

        const quantities = getQuantity(
          wallet.balance,
          price,
          collection.config.useMaxQuantity,
          collection.config.maxQuantity,
        );

        return sendCollectionBid(store, contractAddress, price, quantities, wallet, true);
      }
    }
  }
};

const syncMyBids = async (
  store: Store,
  contractAddress: string,
  wallet: LoggedInWallet,
): Promise<void> => {
  const collection = store.collections[contractAddress];
  if (!store.collections[contractAddress].myBids[wallet.address]) {
    store.collections[contractAddress].myBids[wallet.address] = { bids: {} };
  }

  logDebug(`Wallet [${wallet.address}] Contract [${collection.slug}]: Syncing bids`);
  const myBids = collection.myBids[wallet.address];

  let myExecutableSizeSum = 0;
  let aboveExecutableSizeSum = 0;
  const promises: Promise<unknown>[] = [];

  for (let i = 0; i < collection.bids.length; i++) {
    const pool = i + 1;
    const bid = collection.bids[i];

    myExecutableSizeSum += bid.executableSize;

    if (pool === 1 && !collection.config.bidToPool1) {
      if (myBids.bids[bid.price]) {
        logInfo(
          `Wallet [${wallet.address}] Contract [${collection.slug}]: Cancelling bid from pool #${pool} ${bid.price}`,
        );
        promises.push(
          cancelCollectionBid(collection, [bid.price], wallet).catch((err) => {
            logEmergency(`Failed to cancel bid ${bid.price} for contract ${collection.slug}.`);
            if (axios.isAxiosError(err)) {
              logError(
                `Failed to cancel bid ${bid.price} for contract ${collection.slug}.`,
                err.response?.data,
              );
            }
          }),
        );

        delete myBids.bids[bid.price];
      }

      aboveExecutableSizeSum += bid.executableSize;
      continue;
    }

    if (myBids.bids[bid.price]) {
      if (
        !(
          collection.config.floorCheck &&
          collection.floor &&
          bid.price > collection.floor * collection.config.floorLimit
        ) &&
        (aboveExecutableSizeSum >= collection.config.poolSizeLimitCancel ||
          (collection.config.bidToSamePool &&
            myExecutableSizeSum >= collection.config.samePoolSizeLimitCancel))
      ) {
        break;
      }

      if (
        collection.config.floorCheck &&
        collection.floor &&
        bid.price > collection.floor * collection.config.floorLimit
      ) {
        logInfo(
          `Wallet [${wallet.address}] Contract [${collection.slug}]: Cancelling bid from pool #${pool} for ${bid.price}, floor ${collection.floor}*${collection.config.floorLimit} < ${bid.price}`,
        );
      } else {
        if (aboveExecutableSizeSum < collection.config.poolSizeLimitCancel) {
          logInfo(
            `Wallet [${wallet.address}] Contract [${collection.slug}]: Cancelling bid from pool #${pool} for ${bid.price}, above executable size ${aboveExecutableSizeSum} < ${collection.config.poolSizeLimitCancel}`,
          );
        } else {
          logInfo(
            `Wallet [${wallet.address}] Contract [${collection.slug}]: Cancelling bid from pool #${pool} for ${bid.price}, my executable size ${myExecutableSizeSum} < ${collection.config.samePoolSizeLimitCancel}`,
          );
        }
      }

      promises.push(
        cancelCollectionBid(collection, [bid.price], wallet).catch((err) => {
          logEmergency(`Failed to cancel bid ${bid.price} for contract ${collection.slug}.`);
          if (axios.isAxiosError(err)) {
            logError(
              `Failed to cancel bid ${bid.price} for contract ${collection.slug}.`,
              err.response?.data,
            );
          }
        }),
      );

      delete myBids.bids[bid.price];
      aboveExecutableSizeSum += bid.executableSize;

      continue;
    }

    if (pool > collection.config.maxPoolToBid) {
      logDebug(
        `Wallet [${wallet.address}] Contract [${collection.slug}]: Skipping pool #${pool} as it's > ${collection.config.maxPoolToBid}`,
      );
      continue;
    }

    if (wallet.balance < bid.price) {
      logDebug(
        `Wallet [${wallet.address}] Contract [${collection.slug}]: Not enough balance (${wallet.balance}) to bid ${contractAddress} in pool #${pool} for ${bid.price}`,
      );
      aboveExecutableSizeSum += bid.executableSize;
      continue;
    }

    if (
      collection.config.floorCheck &&
      collection.floor &&
      bid.price > collection.floor * collection.config.floorLimit
    ) {
      logDebug(
        `Wallet [${wallet.address}] Contract [${collection.slug}]: Floor is too low to bid in pool #${pool} for ${bid.price} > ${collection.floor}*${collection.config.floorLimit}`,
      );
      aboveExecutableSizeSum += bid.executableSize;
      continue;
    }

    if (
      aboveExecutableSizeSum >= collection.config.poolSizeLimitBid ||
      (collection.config.bidToSamePool &&
        myExecutableSizeSum >= collection.config.samePoolSizeLimitBid)
    ) {
      const quantities = getQuantity(
        wallet.balance,
        bid.price,
        collection.config.useMaxQuantity,
        collection.config.maxQuantity,
      );
      if (aboveExecutableSizeSum >= collection.config.poolSizeLimitBid) {
        logInfo(
          `Wallet [${wallet.address}] Contract [${
            collection.slug
          }]: Will send bid [${quantities.join(',')}]x${
            bid.price
          } to pool #${pool}, above executable size is ${aboveExecutableSizeSum} >= ${
            collection.config.poolSizeLimitBid
          }.`,
        );
      } else {
        logInfo(
          `Wallet [${wallet.address}] Contract [${
            collection.slug
          }]: Will send bid [${quantities.join(',')}]x${
            bid.price
          } to pool #${pool}, my executable size is ${myExecutableSizeSum} >= ${
            collection.config.samePoolSizeLimitBid
          }`,
        );
      }
      promises.push(sendCollectionBid(store, contractAddress, bid.price, quantities, wallet));
      break;
    }

    if (aboveExecutableSizeSum < collection.config.poolSizeLimitBid) {
      logDebug(
        `Wallet [${wallet.address}] Contract [${collection.slug}]: Skipping pool #${pool} ${bid.price}, above executableSize ${aboveExecutableSizeSum} < ${collection.config.poolSizeLimitBid}`,
      );
    }

    if (
      collection.config.bidToSamePool &&
      myExecutableSizeSum < collection.config.samePoolSizeLimitBid
    ) {
      logDebug(
        `Wallet [${wallet.address}] Contract [${collection.slug}]: Skipping pool #${pool} ${bid.price}, my executableSize ${myExecutableSizeSum} < ${collection.config.samePoolSizeLimitBid}`,
      );
    }

    aboveExecutableSizeSum += bid.executableSize;
  }

  await Promise.all(promises);

  saveMyBids(
    contractAddress,
    wallet.address,
    store.collections[contractAddress].myBids[wallet.address].bids,
  );

  logDebug(`Wallet [${wallet.address}] Contract [${collection.slug}]: Current bids`, myBids);
};

export const handleUpdatedBids = async (
  store: Store,
  contractAddress: string,
  updatedBids: UpdatedBids,
): Promise<void> => {
  const collection = store.collections[contractAddress];
  collection.updaterRunning = true;
  collection.bids = updatedBids.bids;
  collection.floor = updatedBids.floor;

  const promises: Promise<unknown>[] = [];

  for (const wallet of store.wallets) {
    if (!collection.myBids[wallet.address]) {
      collection.myBids[wallet.address] = { bids: {} };
    }

    const now = Date.now();
    Object.entries(collection.myBids[wallet.address].bids).forEach(([bid, expires]) => {
      if (now > expires) {
        delete collection.myBids[wallet.address].bids[bid];
      }
    });

    promises.push(
      syncMyBids(store, contractAddress, wallet).catch(() => {
        logError(`Failed syncing bids for ${collection.slug}`);
      }),
    );
  }

  await Promise.all(promises);

  const queuedUpdate = store.collections[contractAddress].queuedUpdate;
  if (queuedUpdate) {
    logDebug(`Contract [${collection.slug}]: Handle updated bids (from queue)`);
    store.collections[contractAddress].queuedUpdate = undefined;

    void handleUpdatedBids(store, contractAddress, queuedUpdate);

    return;
  }

  store.collections[contractAddress].updaterRunning = false;
  logDebug(`Contract [${collection.slug}]: Updater finished.`);
};
