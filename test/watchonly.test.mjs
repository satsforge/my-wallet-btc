import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mnemonicToSeedSync } from '@scure/bip39';
import { base58check } from '@scure/base';
import { sha256 } from '@noble/hashes/sha2.js';
import { accountFromSeed, deriveNode, nodeAddress, btcNetwork, RECEIVE_CHAIN } from '../src/lib/hdwallet.js';
import { parseExtendedPubkey } from '../src/lib/watchonly.js';

const b58c = base58check(sha256);
const VECTOR_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

test('parses a standard xpub and derives the same addresses as the real seed', () => {
  const seed = mnemonicToSeedSync(VECTOR_MNEMONIC, '');
  const network = btcNetwork(false);
  const account = accountFromSeed(seed.slice(), false);
  const xpub = account.publicExtendedKey;

  const watchAccount = parseExtendedPubkey(xpub, false);
  assert.equal(watchAccount.privateKey, null);

  for (const index of [0, 1, 5]) {
    const real = nodeAddress(deriveNode(account, RECEIVE_CHAIN, index), network);
    const watched = nodeAddress(deriveNode(watchAccount, RECEIVE_CHAIN, index), network);
    assert.equal(watched, real, `index ${index}`);
  }
});

test('parses a standard tpub for testnet, rejecting it if mainnet was expected', () => {
  const seed = mnemonicToSeedSync(VECTOR_MNEMONIC, '');
  const account = accountFromSeed(seed.slice(), true);
  // HDKey always serializes with the default (mainnet xpub) version bytes
  // unless told otherwise - re-encode the same payload under the tpub
  // version, the way a real testnet wallet would actually export it.
  const payload = b58c.decode(account.publicExtendedKey);
  const tpubPayload = new Uint8Array(payload.length);
  tpubPayload.set(payload);
  tpubPayload.set([0x04, 0x35, 0x87, 0xcf], 0); // tpub version
  const tpub = b58c.encode(tpubPayload);
  assert.match(tpub, /^tpub/);

  const watchAccount = parseExtendedPubkey(tpub, true);
  assert.equal(nodeAddress(deriveNode(watchAccount, RECEIVE_CHAIN, 0), btcNetwork(true)), nodeAddress(deriveNode(account, RECEIVE_CHAIN, 0), btcNetwork(true)));

  assert.throws(() => parseExtendedPubkey(tpub, false), /mainnet/);
});

test('parses a zpub (SLIP132 BIP84 prefix) with the same underlying key as its xpub form', () => {
  const seed = mnemonicToSeedSync(VECTOR_MNEMONIC, '');
  const network = btcNetwork(false);
  const account = accountFromSeed(seed.slice(), false);
  const xpub = account.publicExtendedKey;

  // Re-encode the exact same payload (depth/fingerprint/chaincode/pubkey)
  // under the zpub version bytes, the way a BIP84 wallet would export it.
  const payload = b58c.decode(xpub);
  const zpubPayload = new Uint8Array(payload.length);
  zpubPayload.set(payload);
  zpubPayload.set([0x04, 0xb2, 0x47, 0x46], 0); // zpub version
  const zpub = b58c.encode(zpubPayload);
  assert.match(zpub, /^zpub/);

  const watchAccount = parseExtendedPubkey(zpub, false);
  assert.equal(
    nodeAddress(deriveNode(watchAccount, RECEIVE_CHAIN, 3), network),
    nodeAddress(deriveNode(account, RECEIVE_CHAIN, 3), network)
  );
});

test('rejects a plain private extended key (xprv) with the specific "this is a private key" error, not the generic one', () => {
  const seed = mnemonicToSeedSync(VECTOR_MNEMONIC, '');
  const account = accountFromSeed(seed.slice(), false);
  assert.throws(() => parseExtendedPubkey(account.privateExtendedKey, false), /clave privada \(xprv\)/);
});

test('rejects a testnet private extended key (tprv) with the specific error too', () => {
  const seed = mnemonicToSeedSync(VECTOR_MNEMONIC, '');
  const account = accountFromSeed(seed.slice(), true);
  // Same quirk as the tpub test above: HDKey always serializes with the
  // default (mainnet xprv) version bytes unless told otherwise.
  const payload = b58c.decode(account.privateExtendedKey);
  const tprvPayload = new Uint8Array(payload.length);
  tprvPayload.set(payload);
  tprvPayload.set([0x04, 0x35, 0x83, 0x94], 0); // tprv version
  const tprv = b58c.encode(tprvPayload);
  assert.match(tprv, /^tprv/);
  assert.throws(() => parseExtendedPubkey(tprv, true), /clave privada \(tprv\)/);
});

test('rejects a zprv (SLIP132 BIP84 private prefix) with the specific error too', () => {
  // Cross-checks the KNOWN_PRIVATE_VERSIONS constant for zprv, which - unlike
  // xprv/tprv - wasn't already used elsewhere in this codebase before this
  // fix, so nothing had verified it against a real base58check round trip.
  const seed = mnemonicToSeedSync(VECTOR_MNEMONIC, '');
  const account = accountFromSeed(seed.slice(), false);
  const payload = b58c.decode(account.privateExtendedKey);
  const zprvPayload = new Uint8Array(payload.length);
  zprvPayload.set(payload);
  zprvPayload.set([0x04, 0xb2, 0x43, 0x0c], 0); // zprv version
  const zprv = b58c.encode(zprvPayload);
  assert.match(zprv, /^zprv/);
  assert.throws(() => parseExtendedPubkey(zprv, false), /clave privada \(zprv\)/);
});

test('a truly unrecognized version prefix still gets the generic error, not the private-key one', () => {
  const seed = mnemonicToSeedSync(VECTOR_MNEMONIC, '');
  const account = accountFromSeed(seed.slice(), false);
  const payload = b58c.decode(account.publicExtendedKey);
  const bogusPayload = new Uint8Array(payload.length);
  bogusPayload.set(payload);
  bogusPayload.set([0xde, 0xad, 0xbe, 0xef], 0); // not a real xpub/xprv version
  const bogus = b58c.encode(bogusPayload);
  assert.throws(() => parseExtendedPubkey(bogus, false), /no reconocido/);
});

test('rejects garbage input with a clear error', () => {
  assert.throws(() => parseExtendedPubkey('not-a-key', false), /No es una clave/);
});
