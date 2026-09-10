import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mnemonicToSeedSync } from '@scure/bip39';
import { accountFromSeed, deriveNode, nodeAddress, btcNetwork, RECEIVE_CHAIN, CHANGE_CHAIN } from '../src/lib/hdwallet.js';

// Official BIP84 test vector:
// https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki
const VECTOR_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

test('BIP84 mainnet vector: first receiving address matches spec', () => {
  const seed = mnemonicToSeedSync(VECTOR_MNEMONIC, '');
  const account = accountFromSeed(seed, false);
  const node = deriveNode(account, RECEIVE_CHAIN, 0);
  const address = nodeAddress(node, btcNetwork(false));
  assert.equal(address, 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu');
});

test('BIP84 mainnet vector: second receiving address matches spec', () => {
  const seed = mnemonicToSeedSync(VECTOR_MNEMONIC, '');
  const account = accountFromSeed(seed, false);
  const node = deriveNode(account, RECEIVE_CHAIN, 1);
  const address = nodeAddress(node, btcNetwork(false));
  assert.equal(address, 'bc1qnjg0jd8228aq7egyzacy8cys3knf9xvrerkf9g');
});

test('BIP84 mainnet vector: first change address matches spec', () => {
  const seed = mnemonicToSeedSync(VECTOR_MNEMONIC, '');
  const account = accountFromSeed(seed, false);
  const node = deriveNode(account, CHANGE_CHAIN, 0);
  const address = nodeAddress(node, btcNetwork(false));
  assert.equal(address, 'bc1q8c6fshw2dlwun7ekn9qwf37cu2rn755upcp6el');
});

test('testnet derivation uses coin type 1 and tb1 addresses', () => {
  const seed = mnemonicToSeedSync(VECTOR_MNEMONIC, '');
  const account = accountFromSeed(seed, true);
  const node = deriveNode(account, RECEIVE_CHAIN, 0);
  const address = nodeAddress(node, btcNetwork(true));
  assert.match(address, /^tb1q/);
});

test('different passphrases derive different accounts', () => {
  const seedA = mnemonicToSeedSync(VECTOR_MNEMONIC, '');
  const seedB = mnemonicToSeedSync(VECTOR_MNEMONIC, 'extra');
  const nodeA = deriveNode(accountFromSeed(seedA, false), RECEIVE_CHAIN, 0);
  const nodeB = deriveNode(accountFromSeed(seedB, false), RECEIVE_CHAIN, 0);
  assert.notEqual(nodeAddress(nodeA, btcNetwork(false)), nodeAddress(nodeB, btcNetwork(false)));
});
