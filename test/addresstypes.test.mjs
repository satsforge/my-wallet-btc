import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from '@noble/hashes/utils.js';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { btcNetwork } from '../src/lib/hdwallet.js';
import { ADDRESS_TYPES, fixedPath, addressForType, deriveFixedTypeNode, deriveAllFixedTypeNodes } from '../src/lib/addresstypes.js';
// Cross-project interop check: paper-wallet-btc's own derivation, compared
// against this project's port, for the exact same seed and fixed paths.
import { deriveAllWallets } from '../../paper-wallet-btc/src/lib/wallet.js';

test('fixed paths match paper-wallet-btc\'s own account-0/chain-0/index-0 convention', () => {
  assert.equal(fixedPath('legacy', false), "m/44'/0'/0'/0/0");
  assert.equal(fixedPath('p2sh', false), "m/49'/0'/0'/0/0");
  assert.equal(fixedPath('bech32', false), "m/84'/0'/0'/0/0");
  assert.equal(fixedPath('taproot', false), "m/86'/0'/0'/0/0");
});

test('every mainnet address matches paper-wallet-btc\'s deriveAllWallets for the same seed', () => {
  const seed = randomBytes(64);
  const reference = deriveAllWallets(seed.slice());
  const network = btcNetwork(false);
  for (const type of ADDRESS_TYPES) {
    const node = deriveFixedTypeNode(seed.slice(), type, false);
    const address = addressForType(node.publicKey, type, network);
    assert.equal(address, reference[type].address, `${type} address`);
  }
});

test('deriveAllFixedTypeNodes agrees with deriving each type individually', () => {
  const seed = randomBytes(64);
  const network = btcNetwork(false);
  const all = deriveAllFixedTypeNodes(seed.slice(), false);
  for (const type of ADDRESS_TYPES) {
    const solo = deriveFixedTypeNode(seed.slice(), type, false);
    assert.equal(
      addressForType(all[type].publicKey, type, network),
      addressForType(solo.publicKey, type, network),
      type
    );
  }
});

test('testnet paths use coin type 1 and produce tb1/2/m/n-style addresses', () => {
  const seed = randomBytes(64);
  const network = btcNetwork(true);
  assert.equal(fixedPath('bech32', true), "m/84'/1'/0'/0/0");
  const node = deriveFixedTypeNode(seed, 'bech32', true);
  assert.match(addressForType(node.publicKey, 'bech32', network), /^tb1q/);
});

test('addressForType matches raw pubkey-to-address helpers for an arbitrary keypair', () => {
  const privateKey = randomBytes(32);
  const pubkey = secp256k1.getPublicKey(privateKey, true);
  const network = btcNetwork(false);
  const addresses = ADDRESS_TYPES.map((t) => addressForType(pubkey, t, network));
  assert.equal(new Set(addresses).size, ADDRESS_TYPES.length, 'every type must produce a distinct address');
  assert.ok(addresses[ADDRESS_TYPES.indexOf('legacy')].startsWith('1'));
  assert.ok(addresses[ADDRESS_TYPES.indexOf('p2sh')].startsWith('3'));
  assert.ok(addresses[ADDRESS_TYPES.indexOf('bech32')].startsWith('bc1q'));
  assert.ok(addresses[ADDRESS_TYPES.indexOf('taproot')].startsWith('bc1p'));
});
