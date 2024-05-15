import { ethers, Wallet } from 'ethers';
import { jwtDecode } from 'jwt-decode';

import { readWallets } from '../storage/wallets';
import { blastAxios } from '../utils/axios';
import { logDebug } from '../utils/log';
import { blurContract } from '../utils/provider';
import { osRateLimit } from '../utils/rateLimit';

type Challenge = {
  message: string;
  walletAddress: string;
  expiresOn: string;
  hmac: string;
};

type Login = {
  accessToken: string;
};

export type LoggedInWallet = {
  address: string;
  signer: Wallet;
  authKey: string;
  balance: number;
};

export const login = async (walletAddress: string, signer: Wallet): Promise<LoggedInWallet> => {

  const balance = await blurContract.balanceOf(walletAddress);

  const savedWallets = readWallets();

  if (savedWallets[walletAddress]) {
    const decodedAuthKey = jwtDecode(savedWallets[walletAddress].authKey);
    if (
      decodedAuthKey &&
      typeof decodedAuthKey === 'object' &&
      'exp' in decodedAuthKey &&
      typeof decodedAuthKey.exp === 'number'
    ) {
      if (Date.now() < decodedAuthKey.exp * 1000) {
        logDebug(`Wallet [${walletAddress}]: Loading auth key from cache`);

        return {
          address: walletAddress,
          signer,
          authKey: savedWallets[walletAddress].authKey,
          balance: Number(ethers.formatEther(balance)),
        };
      }
    }
  }

  await osRateLimit();

  const response = await blastAxios.post<Challenge>('/auth/challenge', {
    walletAddress,
  });

  const signature = await signer.signMessage(response.data.message);

  await osRateLimit();
  const loginResponse = await blastAxios.post<Login>('/auth/login', {
    message: response.data.message,
    walletAddress,
    expiresOn: response.data.expiresOn,
    hmac: response.data.hmac,
    signature,
  });

  return {
    address: walletAddress,
    signer,
    authKey: loginResponse.data.accessToken,
    balance: Number(ethers.formatEther(balance)),
  };
};
