import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hexToBytes, bytesToHex } from '@noble/hashes/utils.js';
import { decryptBip38, isBip38 } from '../src/lib/bip38.js';

const vectors = JSON.parse(readFileSync(new URL('./fixtures/bip38-vectors.json', import.meta.url)));

test('isBip38 recognizes the 6P... prefix', () => {
  assert.equal(isBip38('6PYNKZ1EAgYgmQfmNVamxyXVWHzK5s6DGhwP4J5o44cvXdoY7sRzhtpUeo'), true);
  assert.equal(isBip38('L44B5gGEpqEDRS9vVPz7QT35jcBG2r3CZwSwQ4fCewXAhAhqGVpP'), false);
});

test('decrypts the official BIP38 compressed-key test vectors (same ones paper-wallet-btc encrypts)', async () => {
  for (const v of vectors) {
    const { privateKey, compressed } = await decryptBip38(v.encrypted, v.passphrase);
    assert.equal(bytesToHex(privateKey), v.privateKeyHex.toLowerCase(), v.passphrase);
    assert.equal(compressed, true);
  }
});

test('throws a clear error on a wrong passphrase instead of returning garbage', async () => {
  const v = vectors[0];
  await assert.rejects(
    () => decryptBip38(v.encrypted, 'definitely-the-wrong-passphrase'),
    /[Pp]assphrase incorrecta/
  );
});

test('throws on a malformed/non-BIP38 string', async () => {
  await assert.rejects(() => decryptBip38('not-a-real-key', 'whatever'));
});
