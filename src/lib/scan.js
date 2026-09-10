import { deriveNode, nodeAddress, btcNetwork, RECEIVE_CHAIN, CHANGE_CHAIN } from './hdwallet.js';
import { ADDRESS_TYPES, fixedPath, addressForType, annotateUtxoForType, deriveAllFixedTypeNodes } from './addresstypes.js';

// Standard BIP44/84 gap limit: stop a chain after this many consecutive
// never-used addresses. Matches Electrum/Ledger behavior.
export const GAP_LIMIT = 20;

async function checkAddress(record, provider) {
  const [txCount, balanceInfo] = await Promise.all([
    provider.txCount(record.address),
    provider.balance(record.address),
  ]);
  return { ...record, used: txCount > 0, balance: balanceInfo.balance };
}

async function scanChain(account, chain, network, provider, onProgress) {
  const addresses = [];
  let index = 0;
  let consecutiveUnused = 0;
  while (consecutiveUnused < GAP_LIMIT) {
    const node = deriveNode(account, chain, index);
    const address = nodeAddress(node, network);
    const checked = await checkAddress(
      { type: 'bech32', source: 'hd', chain, index, path: `m/84'/.../0'/${chain}/${index}`, address, node },
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
    scanChain(account, RECEIVE_CHAIN, network, provider, onProgress),
    scanChain(account, CHANGE_CHAIN, network, provider, onProgress),
    scanPaperWalletAddresses(seed, isTestnet, network, provider, onProgress),
  ]);
  const all = [...receive, ...change, ...paper];
  const funded = all.filter((a) => a.used && a.balance > 0n);
  const totalBalance = funded.reduce((sum, a) => sum + a.balance, 0n);
  const firstUnusedReceive = receive.find((a) => !a.used) ?? receive[receive.length - 1];
  const firstUnusedChange = change.find((a) => !a.used) ?? change[change.length - 1];
  return { receive, change, paper, funded, totalBalance, firstUnusedReceive, firstUnusedChange };
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
export async function collectUtxoPool(funded, provider, isTestnet) {
  const network = btcNetwork(isTestnet);
  const utxos = [];
  const signerByOutpoint = new Map();
  for (const addr of funded) {
    const { utxo } = await provider.unspent(addr.address);
    for (const u of utxo) {
      const annotated = annotateUtxoForType(u, addr.node, addr.type, network);
      utxos.push(annotated);
      signerByOutpoint.set(`${u.txid}:${u.index}`, addr.node);
    }
  }
  return { utxos, signerByOutpoint };
}
