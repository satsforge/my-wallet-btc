import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from '@noble/hashes/utils.js';
import * as btc from '@scure/btc-signer';
import { btcNetwork, keyNodeFromPrivateKey } from '../src/lib/hdwallet.js';
import { addressForType, annotateUtxoForType } from '../src/lib/addresstypes.js';
import { buildSendTx, signTx } from '../src/lib/txbuilder.js';

function buildFundingTx(script, amount) {
  const funding = new btc.Transaction({ version: 1, allowUnknownInputs: true });
  // A zero-input tx doesn't round-trip through raw (de)serialization; a
  // dummy unsigned input is enough to make this a well-formed tx.
  funding.addInput({ txid: new Uint8Array(32), index: 0xffffffff });
  funding.addOutput({ script, amount });
  return funding;
}

for (const type of ['p2sh', 'taproot']) {
  test(`spends a ${type} UTXO end-to-end (build -> annotate -> sign -> finalize)`, () => {
    const network = btcNetwork(true);
    const privateKey = randomBytes(32);
    const node = keyNodeFromPrivateKey(privateKey, true);
    const address = addressForType(node.publicKey, type, network);

    const spendScript =
      type === 'p2sh'
        ? btc.p2sh(btc.p2wpkh(node.publicKey, network), network).script
        : btc.p2tr(node.publicKey.slice(1, 33), undefined, network).script;

    const funding = buildFundingTx(spendScript, 100_000n);
    const fundingTxid = funding.id;

    const rawUtxo = { txid: fundingTxid, index: 0, nonWitnessUtxo: funding.unsignedTx };
    const annotated = annotateUtxoForType(rawUtxo, node, type, network);

    const destination = addressForType(keyNodeFromPrivateKey(randomBytes(32)).publicKey, 'bech32', network);
    const selected = buildSendTx({
      utxos: [annotated],
      destinationAddress: destination,
      amountSats: 0n,
      feePerByte: 2n,
      changeAddress: address,
      network,
      sendMax: true,
    });

    assert.ok(selected, `expected ${type} UTXO to be selectable`);
    signTx(selected.tx, new Map([[`${fundingTxid}:0`, node]]));

    const decoded = btc.Transaction.fromRaw(Buffer.from(selected.tx.hex, 'hex'));
    const input = decoded.getInput(0);
    const isFinalized =
      (input.finalScriptWitness && input.finalScriptWitness.length > 0) ||
      (input.finalScriptSig && input.finalScriptSig.length > 0);
    assert.ok(isFinalized, `${type} input should be finalized with a signature`);
  });
}
