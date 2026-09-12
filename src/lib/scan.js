import * as btc from '@scure/btc-signer';
import { hex } from '@scure/base';
import { deriveNode, btcNetwork, RECEIVE_CHAIN, CHANGE_CHAIN } from './hdwallet.js';
import { ADDRESS_TYPES, fixedPath, addressForType, scriptForType, annotateUtxoForType, annotateUtxoOrigin, deriveAllFixedTypeNodes } from './addresstypes.js';

// Standard BIP44/84 gap limit: stop a chain after this many consecutive
// never-used addresses. Matches Electrum/Ledger behavior.
export const GAP_LIMIT = 20;

// Hard ceiling on top of the gap limit: if the provider ever reports
// txCount > 0 for every address it's asked about (a misbehaving API, not a
// real wallet - GAP_LIMIT consecutive unused addresses would otherwise stop
// this on its own), scanChain would loop indefinitely, one sequential
// network round-trip at a time. This bounds that failure mode with a clear
// error instead of an unbounded hang.
export const MAX_SCAN_INDEX = 10000;

async function checkAddress(record, provider) {
  const [txCount, balanceInfo] = await Promise.all([
    provider.txCount(record.address),
    provider.balance(record.address),
  ]);
  return { ...record, used: txCount > 0, balance: balanceInfo.balance };
}

async function scanChain(account, chain, type, network, provider, onProgress, source = 'hd') {
  const addresses = [];
  let index = 0;
  let consecutiveUnused = 0;
  while (consecutiveUnused < GAP_LIMIT) {
    if (index >= MAX_SCAN_INDEX) {
      throw new Error(
        `Se alcanzo el limite de ${MAX_SCAN_INDEX} direcciones escaneadas sin encontrar ${GAP_LIMIT} consecutivas sin uso. Esto no es normal - puede indicar un problema con el proveedor de red.`
      );
    }
    const node = deriveNode(account, chain, index);
    const address = addressForType(node.publicKey, type, network);
    const checked = await checkAddress(
      { type, source, chain, index, path: `m/.../0'/${chain}/${index}`, address, node },
      provider
    );
    addresses.push(checked);
    if (onProgress) onProgress(checked);
    consecutiveUnused = checked.used ? 0 : consecutiveUnused + 1;
    index += 1;
  }
  return addresses;
}

// Checks the 3 non-bech32 fixed addresses (legacy/p2sh/taproot) that
// paper-wallet-btc can print for this same seed. Bech32 is skipped here
// since it's identical to the HD scan's very first receive address
// (m/84'/.../0'/0/0).
async function scanPaperWalletAddresses(seed, isTestnet, network, provider, onProgress) {
  const nodes = deriveAllFixedTypeNodes(seed, isTestnet);
  const results = [];
  for (const type of ADDRESS_TYPES) {
    if (type === 'bech32') continue;
    const node = nodes[type];
    const address = addressForType(node.publicKey, type, network);
    const checked = await checkAddress(
      { type, source: 'paper', chain: null, index: null, path: fixedPath(type, isTestnet), address, node },
      provider
    );
    results.push(checked);
    if (onProgress) onProgress(checked);
  }
  return results;
}

// Derives and checks addresses on both HD chains (receive + change) up to
// the gap limit, plus the 3 fixed paper-wallet-btc address types, tagging
// every entry with whether it has ever been used and its current balance.
export async function scanWallet(account, seed, isTestnet, provider, onProgress) {
  const network = btcNetwork(isTestnet);
  const [receive, change, paper] = await Promise.all([
    scanChain(account, RECEIVE_CHAIN, 'bech32', network, provider, onProgress),
    scanChain(account, CHANGE_CHAIN, 'bech32', network, provider, onProgress),
    scanPaperWalletAddresses(seed, isTestnet, network, provider, onProgress),
  ]);
  const all = [...receive, ...change, ...paper];
  const funded = all.filter((a) => a.used && a.balance > 0n);
  const totalBalance = funded.reduce((sum, a) => sum + a.balance, 0n);
  const firstUnusedReceive = receive.find((a) => !a.used) ?? receive[receive.length - 1];
  const firstUnusedChange = change.find((a) => !a.used) ?? change[change.length - 1];
  return { receive, change, paper, funded, totalBalance, firstUnusedReceive, firstUnusedChange };
}

// Watch-only: same HD gap-limit scan as scanWallet's own account, but from
// an imported public-only node (no private key at all) and for whichever
// single address type the user says that key is for - no "paper" fixed-type
// check here, since those live at a different purpose field the account
// xpub can't reach anyway.
export async function scanWatchOnly(account, addressType, isTestnet, provider, onProgress) {
  const network = btcNetwork(isTestnet);
  const [receive, change] = await Promise.all([
    scanChain(account, RECEIVE_CHAIN, addressType, network, provider, onProgress, 'watch'),
    scanChain(account, CHANGE_CHAIN, addressType, network, provider, onProgress, 'watch'),
  ]);
  const all = [...receive, ...change];
  const funded = all.filter((a) => a.used && a.balance > 0n);
  const totalBalance = funded.reduce((sum, a) => sum + a.balance, 0n);
  const firstUnusedReceive = receive.find((a) => !a.used) ?? receive[receive.length - 1];
  const firstUnusedChange = change.find((a) => !a.used) ?? change[change.length - 1];
  return { receive, change, funded, totalBalance, firstUnusedReceive, firstUnusedChange };
}

// Checks a single imported keypair (WIF / BIP38) against all possible
// address encodings, since we don't know which one the paper wallet
// printed - exactly like paper-wallet-btc's own "direcciones adicionales".
// P2SH-P2WPKH and native SegWit require a compressed pubkey by consensus
// rules, so uncompressed keys only get checked as legacy/taproot.
export async function scanImportedKey(node, isTestnet, provider, onProgress, compressed = true) {
  const network = btcNetwork(isTestnet);
  const types = compressed ? ADDRESS_TYPES : ADDRESS_TYPES.filter((t) => t === 'legacy' || t === 'taproot');
  const results = [];
  for (const type of types) {
    const address = addressForType(node.publicKey, type, network);
    const checked = await checkAddress(
      { type, source: 'imported', chain: null, index: null, path: null, address, node },
      provider
    );
    results.push(checked);
    if (onProgress) onProgress(checked);
  }
  const funded = results.filter((a) => a.used && a.balance > 0n);
  const totalBalance = funded.reduce((sum, a) => sum + a.balance, 0n);
  return { addresses: results, funded, totalBalance };
}

// Fetches the spendable UTXO set for every funded address, keeping a side
// index from "txid:vout" back to the HDKey node that can sign it, and
// attaching whatever extra fields (redeemScript, tapInternalKey) that
// address's script type needs to be spendable.
// A UTXO arrives because it was listed under a given address, and from then
// on the whole pipeline treats it as that address's: it gets that node's
// redeemScript/tapInternalKey, that node's key origin, and that node as its
// signer. Nothing upstream re-checks the claim. The funding transaction is
// the one part of it that can't be misreported (its bytes hash to the txid
// the provider named), so compare the script it really pays against the one
// this wallet derives, and stop here rather than let a mismatch surface
// later as an unexplained signing failure.
function assertUtxoBelongsTo(utxo, addr, network) {
  if (!utxo.nonWitnessUtxo) return; // nothing verifiable was supplied
  const prevout = btc.RawTx.decode(utxo.nonWitnessUtxo).outputs[utxo.index];
  const expected = scriptForType(addr.node.publicKey, addr.type, network);
  if (!prevout || hex.encode(prevout.script) !== hex.encode(expected)) {
    throw new Error(
      `El UTXO ${utxo.txid}:${utxo.index} que el proveedor devolvio para ${addr.address} no paga a esa direccion. ` +
      'Puede ser un problema del proveedor de red - volve a intentar con "Actualizar".'
    );
  }
}

export async function collectUtxoPool(funded, provider, isTestnet, origin = null) {
  const network = btcNetwork(isTestnet);
  const utxos = [];
  const signerByOutpoint = new Map();
  for (const addr of funded) {
    const { utxo } = await provider.unspent(addr.address);
    for (const u of utxo) {
      assertUtxoBelongsTo(u, addr, network);
      let annotated = annotateUtxoForType(u, addr.node, addr.type, network);
      // Key-origin metadata, so a PSBT exported from here can actually be
      // signed somewhere else. Only HD-derived addresses have a path to
      // declare (`chain`/`index` are null for imported keys and for the
      // fixed paper-wallet addresses, which live at their own purpose).
      annotated = annotateUtxoOrigin(annotated, addr.node, addr.type, origin, addr.chain, addr.index);
      utxos.push(annotated);
      signerByOutpoint.set(`${u.txid}:${u.index}`, addr.node);
    }
  }
  return { utxos, signerByOutpoint };
}
