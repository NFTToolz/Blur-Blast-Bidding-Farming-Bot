import { io } from 'socket.io-client';

import { handleUpdatedBids } from '../actions/collection';
import { failSafeState, turnOffFailsafe, turnOnFailsafe } from '../actions/failsafe';
import { portfolioCheck } from '../actions/portfolioCheck';
import { recoverState } from '../actions/recoverState';
import { createStore } from '../store';
import { UpdatedBids } from '../store/collectionsSlice';
import { collectionsEnv, noWsEnv, wsApiKeyEnv, wsServerEnv } from '../utils/flags';
import { logDebug, logEmergency, logError, logInfo } from '../utils/log';

export const run = async (): Promise<void> => {
  const socket = io(wsServerEnv, {
    autoConnect: false,
	transports: ['websocket'],
    auth: {
      token: wsApiKeyEnv,
    },
  });

  const store = await createStore();
  if (store.wallets.length === 0) {
    logError('Not a single signed in wallet. Exiting.');
    return;
  }

  await recoverState(store);

  void portfolioCheck(store);

  if (noWsEnv) {
    turnOnFailsafe(store, 'noWs', '', true);
    return;
  }

  socket.on('connect', () => {
    logInfo('Connected to WS server');
    turnOffFailsafe('wsDown');
	socket.emit('check-contracts', collectionsEnv.split(','));
  });

  socket.on('connect_error', (msg) => {
    turnOnFailsafe(store, 'wsDown', `WS connect error: ${msg}`);
  });

  socket.on('disconnect', (msg) => {
    turnOnFailsafe(store, 'wsDown', `WS disconnected: ${msg}`);
  });

  socket.on('bids', (data: UpdatedBids) => {

    if (failSafeState.isRunning) return;

    const contractAddress = data.contractAddress;
    if (!store.collections[contractAddress]) return;

    if (!store.collections[contractAddress].updaterRunning) {
      logDebug(
        `Collection [${store.collections[contractAddress].slug}]: Handle updated bids (from ws - top5 bids)`,
      );
      void handleUpdatedBids(store, contractAddress, data);
      return;
    }

    store.collections[contractAddress].queuedUpdate = data;
    logDebug(`Collection [${store.collections[contractAddress].slug}]: Queuing data.`);
  });

  socket.on('ws_error', (msg) => {
    logEmergency(msg);
  });

  socket.connect();
  //socket.emit('check-contracts', collectionsEnv.split(','));
};
