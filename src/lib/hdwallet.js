import { HDKey } from '@scure/bip32';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import * as btc from '@scure/btc-signer';

// BIP84 (Native SegWit). Coin type 1' for any testnet/signet, per SLIP-44.
const COIN_TYPE = { mainnet: 0, testnet: 1 };
export const RECEIVE_CHAIN = 0;
export const CHANGE_CHAIN = 1;

export function btcNetwork(isTestnet) {
  return isTestnet ? btc.TEST_NETWORK : btc.NETWORK;
}

export function accountFromSeed(seed, isTestnet) {
  const coinType = isTestnet ? COIN_TYPE.testnet : COIN_TYPE.mainnet;
  const root = HDKey.fromMasterSeed(seed);
  const account = root.derive(`m/84'/${coinType}'/0'`);
  root.wipePrivateData();
  return account;
}

export function deriveNode(account, chain, index) {
  return account.derive(`m/${chain}/${index}`);
}

export function nodeAddress(node, network) {
  return btc.p2wpkh(node.publicKey, network).address;
}

export function nodeScript(node, network) {
  return btc.p2wpkh(node.publicKey, network).script;
}

// Minimal HDKey-compatible node for a standalone imported key (WIF/BIP38 -
// no HD derivation). Mirrors HDKey's copy-on-read getters so callers that
// zero their own copy of .privateKey after signing never touch the source.
export function keyNodeFromPrivateKey(privateKey, compressed = true) {
  const raw = Uint8Array.from(privateKey);
  const pub = secp256k1.getPublicKey(raw, compressed);
  return {
    get privateKey() { return Uint8Array.from(raw); },
    get publicKey() { return Uint8Array.from(pub); },
    wipe() { raw.fill(0); },
  };
}
