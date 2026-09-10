import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mnemonicToSeedSync } from '@scure/bip39';
import * as btc from '@scure/btc-signer';
import { accountFromSeed, deriveNode, nodeAddress, nodeScript, btcNetwork, RECEIVE_CHAIN, CHANGE_CHAIN } from '../src/lib/hdwallet.js';
import { buildSendTx, signTx } from '../src/lib/txbuilder.js';

const VECTOR_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

function setup() {
  const seed = mnemonicToSeedSync(VECTOR_MNEMONIC, '');
  const network = btcNetwork(true);
  const account = accountFromSeed(seed, true);
  const sourceNode = deriveNode(account, RECEIVE_CHAIN, 0);
  const changeNode = deriveNode(account, CHANGE_CHAIN, 0);
  const destinationNode = deriveNode(account, RECEIVE_CHAIN, 1);
  return {
    network,
    sourceNode,
    sourceAddress: nodeAddress(sourceNode, network),
    sourceScript: nodeScript(sourceNode, network),
    changeAddress: nodeAddress(changeNode, network),
    destinationAddress: nodeAddress(destinationNode, network),
  };
}

test('builds, signs and finalizes a P2WPKH send transaction', () => {
  const { network, sourceNode, sourceScript, sourceAddress, changeAddress, destinationAddress } = setup();
  const fakeTxid = 'aa'.repeat(32);
  const utxo = {
    txid: fakeTxid,
    index: 0,
    witnessUtxo: { script: sourceScript, amount: 100_000n },
  };
  const signerByOutpoint = new Map([[`${fakeTxid}:0`, sourceNode]]);

  const selected = buildSendTx({
    utxos: [utxo],
    destinationAddress,
    amountSats: 50_000n,
    feePerByte: 2n,
    changeAddress,
    network,
    sendMax: false,
  });

  assert.ok(selected, 'expected enough funds to select a UTXO');
  assert.ok(selected.fee > 0n);
  assert.equal(selected.change, true);

  signTx(selected.tx, signerByOutpoint);

  assert.match(selected.tx.hex, /^[0-9a-f]+$/);
  const decoded = btc.Transaction.fromRaw(Buffer.from(selected.tx.hex, 'hex'));
  const input = decoded.getInput(0);
  assert.ok(input.finalScriptWitness && input.finalScriptWitness.length > 0, 'input should be finalized with a witness');

  const totalOut = decoded.outputs.reduce((sum, o) => sum + o.amount, 0n);
  assert.equal(totalOut + selected.fee, 100_000n);
  void sourceAddress;
});

test('returns undefined when funds are insufficient', () => {
  const { network, sourceScript, changeAddress, destinationAddress } = setup();
  const fakeTxid = 'bb'.repeat(32);
  const utxo = { txid: fakeTxid, index: 0, witnessUtxo: { script: sourceScript, amount: 1_000n } };

  const selected = buildSendTx({
    utxos: [utxo],
    destinationAddress,
    amountSats: 50_000n,
    feePerByte: 2n,
    changeAddress,
    network,
    sendMax: false,
  });

  assert.equal(selected, undefined);
});
