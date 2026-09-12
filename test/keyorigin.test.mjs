import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mnemonicToSeedSync } from '@scure/bip39';
import { HDKey } from '@scure/bip32';
import * as btc from '@scure/btc-signer';
import { hex } from '@scure/base';
import { annotateUtxoForType, annotateUtxoOrigin, addressForType, scriptForType } from '../src/lib/addresstypes.js';
import { parseFingerprint, parseAccountPath, parseKeyOrigin, validateXpubDepth, defaultAccountPath } from '../src/lib/watchonly.js';

const HARDENED = 0x80000000;
const VECTOR_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

test('parseFingerprint accepts 8 hex characters and rejects anything else', () => {
  assert.equal(parseFingerprint('73c5da0a'), 0x73c5da0a);
  assert.equal(parseFingerprint('  73C5DA0A  '), 0x73c5da0a);
  assert.equal(parseFingerprint('0x73c5da0a'), 0x73c5da0a);
  for (const bad of ['73c5da', '73c5da0a0', 'zzzzzzzz', '']) {
    assert.throws(() => parseFingerprint(bad), /8 caracteres hexadecimales/);
  }
});

test('parseAccountPath folds hardened segments and rejects trailing garbage', () => {
  assert.deepEqual(parseAccountPath("84'/0'/0'"), [84 + HARDENED, HARDENED, HARDENED]);
  assert.deepEqual(parseAccountPath('m/84h/0h/0h'), parseAccountPath("84'/0'/0'"));
  assert.deepEqual(parseAccountPath('84/0/0'), [84, 0, 0]);
  // parseInt alone would read these as 84 and 0, silently changing the path.
  assert.throws(() => parseAccountPath("84x/0'/0'"), /Segmento de ruta invalido/);
  assert.throws(() => parseAccountPath("0x10/0'/0'"), /Segmento de ruta invalido/);
  assert.throws(() => parseAccountPath(''), /Falta la ruta/);
});

test('parseKeyOrigin is optional as a pair, but not half-filled', () => {
  assert.equal(parseKeyOrigin('', ''), null);
  assert.equal(parseKeyOrigin('   ', '  '), null);
  assert.throws(() => parseKeyOrigin('', "84'/0'/0'"), /falta el fingerprint/);
  const origin = parseKeyOrigin('73c5da0a', "84'/0'/0'");
  assert.equal(origin.fingerprint, 0x73c5da0a);
  assert.deepEqual(origin.accountPath, [84 + HARDENED, HARDENED, HARDENED]);
});

test('defaultAccountPath follows BIP44/49/84/86 and SLIP-44 coin types', () => {
  assert.equal(defaultAccountPath('legacy', false), "44'/0'/0'");
  assert.equal(defaultAccountPath('p2sh', false), "49'/0'/0'");
  assert.equal(defaultAccountPath('bech32', true), "84'/1'/0'");
  assert.equal(defaultAccountPath('taproot', true), "86'/1'/0'");
});

// Regression: a watch-only PSBT used to carry no key origin at all, which
// left PSBT Signer BTC brute-forcing its own conventions - it only ever
// computes Native SegWit scripts for an account's chains, so legacy, P2SH
// and Taproot watch-only wallets produced PSBTs it could not sign, with the
// failure only surfacing at the offline machine.
test('annotateUtxoOrigin declares the key origin a signer needs, per address type', () => {
  const seed = mnemonicToSeedSync(VECTOR_MNEMONIC, '');
  const master = HDKey.fromMasterSeed(seed);
  const fingerprint = master.fingerprint;
  const network = btc.TEST_NETWORK;

  for (const [type, purpose] of [['bech32', 84], ['legacy', 44], ['p2sh', 49], ['taproot', 86]]) {
    const accountPath = [purpose + HARDENED, 1 + HARDENED, HARDENED];
    const node = master.derive(`m/${purpose}'/1'/0'`).deriveChild(0).deriveChild(7);
    const origin = { fingerprint, accountPath };

    const annotated = annotateUtxoOrigin({ txid: 'aa'.repeat(32), index: 0 }, node, type, origin, 0, 7);

    if (type === 'taproot') {
      assert.ok(annotated.tapBip32Derivation, `${type}: expected tapBip32Derivation`);
      const [xOnly, { hashes, der }] = annotated.tapBip32Derivation[0];
      assert.equal(hex.encode(xOnly), hex.encode(node.publicKey.slice(1, 33)));
      assert.deepEqual(hashes, []); // key-path spend: no script leaves
      assert.equal(der.fingerprint, fingerprint);
      assert.deepEqual(der.path, [...accountPath, 0, 7]);
    } else {
      assert.ok(annotated.bip32Derivation, `${type}: expected bip32Derivation`);
      const [pubkey, der] = annotated.bip32Derivation[0];
      assert.equal(hex.encode(pubkey), hex.encode(node.publicKey));
      assert.equal(der.fingerprint, fingerprint);
      assert.deepEqual(der.path, [...accountPath, 0, 7]);
    }
  }
});

test('annotateUtxoOrigin leaves a UTXO untouched when there is no honest origin to declare', () => {
  const seed = mnemonicToSeedSync(VECTOR_MNEMONIC, '');
  const node = HDKey.fromMasterSeed(seed).derive("m/84'/1'/0'").deriveChild(0).deriveChild(0);
  const utxo = { txid: 'aa'.repeat(32), index: 0 };
  const origin = { fingerprint: 1, accountPath: [1] };

  // No origin provided (the user left the optional fields empty).
  assert.equal(annotateUtxoOrigin(utxo, node, 'bech32', null, 0, 0), utxo);
  // An imported single key / fixed paper-wallet address has no chain+index.
  assert.equal(annotateUtxoOrigin(utxo, node, 'bech32', origin, null, null), utxo);
});

test('the origin survives into the exported PSBT alongside the type-specific fields', () => {
  const seed = mnemonicToSeedSync(VECTOR_MNEMONIC, '');
  const master = HDKey.fromMasterSeed(seed);
  const network = btc.TEST_NETWORK;
  const node = master.derive("m/49'/1'/0'").deriveChild(0).deriveChild(0);

  const funding = new btc.Transaction({ version: 1 });
  funding.addInput({ txid: new Uint8Array(32), index: 0xffffffff });
  funding.addOutput({ script: btc.p2sh(btc.p2wpkh(node.publicKey, network), network).script, amount: 100_000n });

  let utxo = { txid: funding.id, index: 0, nonWitnessUtxo: funding.unsignedTx };
  utxo = annotateUtxoForType(utxo, node, 'p2sh', network);
  utxo = annotateUtxoOrigin(utxo, node, 'p2sh', { fingerprint: master.fingerprint, accountPath: [49 + HARDENED, 1 + HARDENED, HARDENED] }, 0, 0);

  const tx = new btc.Transaction();
  tx.addInput(utxo);
  tx.addOutputAddress(btc.p2wpkh(node.publicKey, network).address, 90_000n, network);

  const roundTripped = btc.Transaction.fromPSBT(tx.toPSBT(), { allowUnknown: true });
  const input = roundTripped.getInput(0);
  assert.ok(input.redeemScript, 'p2sh redeemScript must still be there');
  assert.ok(input.bip32Derivation, 'key origin must survive PSBT encoding');
  assert.equal(input.bip32Derivation[0][1].fingerprint, master.fingerprint);
});

test('validateXpubDepth catches a key pasted from the wrong level', () => {
  const seed = mnemonicToSeedSync(VECTOR_MNEMONIC, '');
  const master = HDKey.fromMasterSeed(seed);
  const accountPath = [84 + HARDENED, 1 + HARDENED, HARDENED];

  // Regression: derivation works from any node, so a master xpub under an
  // account path produces real-looking addresses that simply aren't the
  // wallet's - an empty balance and a PSBT whose origin points nowhere.
  assert.equal(master.depth, 0);
  assert.throws(() => validateXpubDepth(master, accountPath), /profundidad 0.*3 niveles/s);

  const account = master.derive("m/84'/1'/0'");
  assert.equal(account.depth, 3);
  assert.doesNotThrow(() => validateXpubDepth(account, accountPath));

  // With no declared path there is nothing to compare against.
  assert.doesNotThrow(() => validateXpubDepth(master, undefined));
});

test('scriptForType matches the script each address type actually pays to', () => {
  const seed = mnemonicToSeedSync(VECTOR_MNEMONIC, '');
  const node = HDKey.fromMasterSeed(seed).derive("m/84'/1'/0'").deriveChild(0).deriveChild(0);
  const network = btc.TEST_NETWORK;
  for (const type of ['legacy', 'p2sh', 'bech32', 'taproot']) {
    const address = addressForType(node.publicKey, type, network);
    const script = scriptForType(node.publicKey, type, network);
    // Re-deriving the address from the script must land back on the same one.
    assert.equal(btc.Address(network).encode(btc.OutScript.decode(script)), address, type);
  }
});
