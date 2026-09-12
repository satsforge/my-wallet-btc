import { HDKey } from '@scure/bip32';
import { base58check } from '@scure/base';
import { sha256 } from '@noble/hashes/sha2.js';

const b58c = base58check(sha256);

// SLIP132 extended-public-key prefixes. The BIP32 data underneath
// xpub/ypub/zpub (or tpub/upub/vpub) is identical - only the version bytes
// differ, as a hint about which script type the wallet that exported it
// intends (legacy/P2SH-SegWit/Native SegWit). We ask the user which type
// explicitly anyway (mirrors paper-wallet-btc/My Wallet BTC's own address
// type choice elsewhere), so this table only needs to let HDKey parse
// whichever prefix was pasted - it isn't used to pick the address type.
const KNOWN_VERSIONS = {
  0x0488b21e: { isTestnet: false, label: 'xpub' },
  0x049d7cb2: { isTestnet: false, label: 'ypub' },
  0x04b24746: { isTestnet: false, label: 'zpub' },
  0x043587cf: { isTestnet: true, label: 'tpub' },
  0x044a5262: { isTestnet: true, label: 'upub' },
  0x045f1cf6: { isTestnet: true, label: 'vpub' },
};
const PRIVATE_VERSION = { false: 0x0488ade4, true: 0x04358394 };

// SLIP132 private-key counterparts of KNOWN_VERSIONS above, used ONLY to
// recognize "this is a private key" and produce a specific error message -
// never to actually construct a node from one. Without this table, none of
// these ever hit the "esto es una clave privada" check further down: their
// version bytes simply aren't in KNOWN_VERSIONS, so parsing already throws
// the generic "prefijo no reconocido" error first. A user who pastes a
// private key by mistake into a watch-only field deserves the specific
// warning, not a generic one that reads like a typo.
const KNOWN_PRIVATE_VERSIONS = {
  0x0488ade4: 'xprv',
  0x049d7878: 'yprv',
  0x04b2430c: 'zprv',
  0x04358394: 'tprv',
  0x044a4e28: 'uprv',
  0x045f18bc: 'vprv',
};

/**
 * Parses an account-level extended PUBLIC key (any of xpub/ypub/zpub or
 * their testnet equivalents) into a public-only HDKey. Throws a clear
 * error if it's not a recognized extended public key, or if its encoded
 * network doesn't match what the user selected.
 */
export function parseExtendedPubkey(text, expectedTestnet) {
  const trimmed = text.trim();
  let payload;
  try {
    payload = b58c.decode(trimmed);
  } catch {
    throw new Error('No es una clave publica extendida valida (xpub/ypub/zpub...).');
  }
  if (payload.length < 4) {
    throw new Error('No es una clave publica extendida valida (xpub/ypub/zpub...).');
  }
  const version = ((payload[0] << 24) | (payload[1] << 16) | (payload[2] << 8) | payload[3]) >>> 0;
  const known = KNOWN_VERSIONS[version];
  if (!known) {
    const privateLabel = KNOWN_PRIVATE_VERSIONS[version];
    if (privateLabel) {
      throw new Error(
        `Esto es una clave privada (${privateLabel}), no publica - usa el modo "Clave privada" en vez de "Solo consulta".`
      );
    }
    throw new Error('Prefijo de clave publica extendida no reconocido (se esperaba xpub/ypub/zpub/tpub/upub/vpub).');
  }
  if (known.isTestnet !== expectedTestnet) {
    throw new Error(
      `Esta clave (${known.label}) es de ${known.isTestnet ? 'testnet' : 'mainnet'}, pero elegiste ${expectedTestnet ? 'testnet' : 'mainnet'}.`
    );
  }

  let node;
  try {
    node = HDKey.fromExtendedKey(trimmed, { public: version, private: PRIVATE_VERSION[known.isTestnet] });
  } catch (err) {
    throw new Error(`No se pudo leer la clave publica: ${err.message}`);
  }
  if (node.privateKey) {
    throw new Error('Esto es una clave privada, no publica - usa el modo "Clave privada" en vez de "Solo consulta".');
  }
  if (!node.publicKey) {
    throw new Error('No se pudo leer la clave publica.');
  }
  return node;
}

// ---------- Key origin (for a signable PSBT) ----------
//
// An account xpub says nothing about where it came from: not which master
// key derived it, nor by which path. A PSBT built from it therefore can't
// declare a BIP32 key origin, and whoever signs it later has to guess.
// Both values have to come from the wallet that exported the xpub - every
// wallet that shows you an xpub shows these next to it.

const HARDENED_OFFSET = 0x80000000;

// Purpose field per BIP44/49/84/86, matching addresstypes.js's own table.
const PURPOSE = { legacy: 44, p2sh: 49, bech32: 84, taproot: 86 };

/** The conventional account path for an address type, as a display string. */
export function defaultAccountPath(addressType, isTestnet) {
  return `${PURPOSE[addressType] ?? 84}'/${isTestnet ? 1 : 0}'/0'`;
}

/** 8 hex characters -> the 32-bit number BIP32 key origins use. */
export function parseFingerprint(text) {
  const cleaned = text.trim().toLowerCase().replace(/^0x/, '');
  if (!/^[0-9a-f]{8}$/.test(cleaned)) {
    throw new Error('El fingerprint tiene que ser exactamente 8 caracteres hexadecimales (por ejemplo: 73c5da0a).');
  }
  return parseInt(cleaned, 16);
}

// Whole segments only: digits plus an optional hardened marker. parseInt
// alone would read "84x" as 84 and "0x10" as 0, silently turning a typo
// into a different (and unsignable) derivation.
const PATH_SEGMENT_RE = /^(\d+)([hH']?)$/;

/** "84'/0'/0'" (or 84h/0h/0h, with or without a leading m/) -> [2147483732, ...] */
export function parseAccountPath(text) {
  const cleaned = text.trim().replace(/^m\/?/i, '');
  if (!cleaned) throw new Error('Falta la ruta de la cuenta (por ejemplo: 84\'/0\'/0\').');
  return cleaned.split('/').map((segment) => {
    const match = PATH_SEGMENT_RE.exec(segment);
    if (!match) throw new Error(`Segmento de ruta invalido: "${segment}"`);
    const index = parseInt(match[1], 10);
    if (!Number.isSafeInteger(index) || index < 0 || index >= HARDENED_OFFSET) {
      throw new Error(`Segmento de ruta invalido: "${segment}"`);
    }
    return match[2] ? index + HARDENED_OFFSET : index;
  });
}

/**
 * Builds the {fingerprint, accountPath} a PSBT needs to declare where its
 * keys come from. Both fields are optional in the UI (watching a balance
 * needs neither), so an empty pair returns null and the PSBT simply carries
 * no origin - the caller is expected to warn about that before exporting.
 */
export function parseKeyOrigin(fingerprintText, pathText) {
  const hasFingerprint = fingerprintText.trim() !== '';
  const hasPath = pathText.trim() !== '';
  if (!hasFingerprint && !hasPath) return null;
  if (!hasFingerprint) {
    throw new Error('Pusiste la ruta de la cuenta pero falta el fingerprint de la clave maestra.');
  }
  return { fingerprint: parseFingerprint(fingerprintText), accountPath: parseAccountPath(pathText) };
}

/**
 * Cross-checks the pasted xpub against the account path declared next to
 * it: an extended key carries its own depth, and an account key's depth is
 * exactly the number of path elements that reached it.
 *
 * Nothing else would catch the mismatch. Derivation works from any node, so
 * pasting the master key (depth 0) under an account path derives real,
 * plausible-looking addresses - just not the wallet's, which shows up as an
 * empty balance and a PSBT whose declared origin points somewhere the key
 * never was. Only checked when a path was given; without one there is
 * nothing to compare against.
 */
export function validateXpubDepth(node, accountPath) {
  if (!accountPath) return;
  if (node.depth !== accountPath.length) {
    throw new Error(
      `La clave publica tiene profundidad ${node.depth}, pero la ruta declarada tiene ${accountPath.length} niveles. ` +
      'Probablemente pegaste una clave de otro nivel (por ejemplo la maestra en vez de la de cuenta), o la ruta no corresponde a este xpub.'
    );
  }
}
