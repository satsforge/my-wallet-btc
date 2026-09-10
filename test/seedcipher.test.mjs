import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decryptMnemonic } from '../src/lib/seedcipher.js';
// Cross-project interop check: encrypt with paper-wallet-btc's own module,
// decrypt with this project's port, to prove the two are byte-compatible
// (not just symmetric with itself).
import { encryptMnemonic } from '../../paper-wallet-btc/src/lib/seedCipher.js';

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

test('decrypts a blob produced by paper-wallet-btc\'s own encryptMnemonic', async () => {
  const blob = await encryptMnemonic(MNEMONIC, 'correct horse battery staple');
  const recovered = await decryptMnemonic(blob, 'correct horse battery staple');
  assert.equal(recovered, MNEMONIC);
});

test('tolerates the line breaks/whitespace a printed PDF block would have', async () => {
  const blob = await encryptMnemonic(MNEMONIC, 'pw');
  const wrapped = blob.match(/.{1,20}/g).join('\n  ');
  const recovered = await decryptMnemonic(wrapped, 'pw');
  assert.equal(recovered, MNEMONIC);
});

test('throws on a wrong password instead of returning garbage', async () => {
  const blob = await encryptMnemonic(MNEMONIC, 'right-password');
  await assert.rejects(() => decryptMnemonic(blob, 'wrong-password'), /incorrecta|invalido/);
});
