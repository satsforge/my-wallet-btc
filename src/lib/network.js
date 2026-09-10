import { EsploraProvider } from '@scure/btc-signer/net.js';
import { btcNetwork } from './hdwallet.js';

const BASE_URL = {
  mainnet: 'https://mempool.space/api',
  testnet: 'https://mempool.space/testnet/api',
};

export function createProvider(isTestnet) {
  const url = isTestnet ? BASE_URL.testnet : BASE_URL.mainnet;
  return new EsploraProvider(fetch.bind(globalThis), url, btcNetwork(isTestnet));
}
