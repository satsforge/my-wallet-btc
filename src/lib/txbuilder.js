import * as btc from '@scure/btc-signer';
import { hex } from '@scure/base';

// Builds (but does not sign or broadcast) a send transaction. Returns
// undefined if the selected UTXOs can't cover amount + fee.
export function buildSendTx({ utxos, destinationAddress, amountSats, feePerByte, changeAddress, network, sendMax }) {
  const outputs = sendMax ? [] : [{ address: destinationAddress, amount: amountSats }];
  const strategy = sendMax ? 'all' : 'default';
  return btc.selectUTXO(utxos, outputs, strategy, {
    changeAddress: sendMax ? destinationAddress : changeAddress,
    feePerByte,
    network,
    bip69: true,
    createTx: true,
  });
}

// Signs every input with the HDKey node that owns it (looked up by
// "txid:vout"), then finalizes the transaction in place. Zeroes each
// derived private key from memory right after it's used.
export function signTx(tx, signerByOutpoint) {
  const neededNodes = new Map();
  for (let i = 0; i < tx.inputsLength; i++) {
    const input = tx.getInput(i);
    const txid = typeof input.txid === 'string' ? input.txid : hex.encode(input.txid);
    const node = signerByOutpoint.get(`${txid}:${input.index}`);
    if (!node) throw new Error(`No se encontro la clave para firmar el input ${txid}:${input.index}`);
    neededNodes.set(hex.encode(node.publicKey), node);
  }
  for (const node of neededNodes.values()) {
    const privKey = node.privateKey;
    tx.sign(privKey);
    privKey.fill(0);
  }
  tx.finalize();
}
