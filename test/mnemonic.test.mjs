import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidMnemonic, normalizeMnemonic, seedFromMnemonic } from '../src/lib/mnemonic.js';

const VALID = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

test('accepts a valid BIP39 mnemonic', () => {
  assert.equal(isValidMnemonic(VALID), true);
});

test('rejects wrong word count', () => {
  assert.equal(isValidMnemonic('abandon abandon abandon'), false);
});

test('rejects a bad checksum', () => {
  const words = VALID.split(' ');
  words[words.length - 1] = 'zoo';
  assert.equal(isValidMnemonic(words.join(' ')), false);
});

test('normalizes case and whitespace', () => {
  assert.equal(normalizeMnemonic('  Abandon   ABANDON  about '), 'abandon abandon about');
});

test('derives a 64-byte seed', async () => {
  const seed = await seedFromMnemonic(VALID, '');
  assert.equal(seed.length, 64);
});

test('passphrase changes the derived seed', async () => {
  const a = await seedFromMnemonic(VALID, '');
  const b = await seedFromMnemonic(VALID, 'extra');
  assert.notEqual(Buffer.from(a).toString('hex'), Buffer.from(b).toString('hex'));
});
