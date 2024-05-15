import { Contract, ethers, Wallet } from 'ethers';

import { infuraKeyEnv, privateKeysEnv } from './flags';

// export const provider = new ethers.InfuraProvider('mainnet', infuraKeyEnv);
export const provider = new ethers.JsonRpcProvider(`https://rpc.blast.io/`);

export const getSigners = async (): Promise<[string, Wallet][]> => {
  const privateKeys = privateKeysEnv.split(',');

  const signers: [string, Wallet][] = [];
  const promises: Promise<unknown>[] = [];

  privateKeys.forEach((key) => {
    const signer = new ethers.Wallet(key, provider);
    const promise = signer.getAddress().then((address) => {
      signers.push([address.toLowerCase(), signer]);
    });

    promises.push(promise);
  });

  await Promise.all(promises);

  return signers;
};

export const blurContract = new Contract(
  '0xB772d5C5F4A2Eef67dfbc89AA658D2711341b8E5',
  [
    {
      inputs: [{ internalType: 'address', name: 'user', type: 'address' }],
      name: 'balanceOf',
      outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
      stateMutability: 'view',
      type: 'function',
    },
  ],
  provider,
);

// export const blurContract = new Contract(
//   '0x0000000000A39bb272e79075ade125fd351887Ac',
//   [
//     {
//       inputs: [{ internalType: 'address', name: 'user', type: 'address' }],
//       name: 'balanceOf',
//       outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
//       stateMutability: 'view',
//       type: 'function',
//     },
//   ],
//   provider,
// );
