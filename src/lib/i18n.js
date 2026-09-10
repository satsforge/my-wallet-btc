/**
 * Single source of truth for every user-facing string. Mirrors the
 * dictionary/walker pattern from paper-wallet-btc's src/lib/i18n.js so both
 * apps feel like the same family, but scoped to mi-wallet-btc's own screens.
 */
export const LANGS = ['es', 'en'];
export const DEFAULT_LANG = 'es';

const dict = {
  'meta.title': { es: 'Mi Wallet BTC', en: 'My BTC Wallet' },
  'topbar.brand': { es: 'Mi Wallet BTC', en: 'My BTC Wallet' },
  'topbar.mode.tip': {
    es: 'Básico: solo frase semilla + passphrase, lo esencial para acceder. Avanzado: agrega semilla cifrada (AES), clave privada (WIF/BIP38) y carga desde archivo.',
    en: 'Basic: just seed phrase + passphrase, the essentials to unlock. Advanced: adds encrypted seed (AES), private key (WIF/BIP38), and loading from a file.',
  },
  'topbar.mode.prefix': { es: 'Modo:', en: 'Mode:' },
  'topbar.mode.basic': { es: 'Básico', en: 'Basic' },
  'topbar.mode.advanced': { es: 'Avanzado', en: 'Advanced' },
  'topbar.theme.toLight': { es: '☀ Modo claro', en: '☀ Light mode' },
  'topbar.theme.toDark': { es: '🌙 Modo oscuro', en: '🌙 Dark mode' },
  'topbar.lang.toEnglish': { es: '🌐 English', en: '🌐 English' },
  'topbar.lang.toSpanish': { es: '🌐 Español', en: '🌐 Español' },

  'notice.warning': {
    es: '<strong>Aviso:</strong> esta wallet firma y transmite transacciones reales de Bitcoin. Probala primero en <strong>testnet</strong> con monedas sin valor antes de usar mainnet. Nadie ajeno a este proyecto auditó el código todavía: leelo antes de confiarle fondos.',
    en: '<strong>Warning:</strong> this wallet signs and broadcasts real Bitcoin transactions. Try it on <strong>testnet</strong> with worthless coins first before using mainnet. Nobody outside this project has audited the code yet: read it yourself before trusting it with funds.',
  },

  'network.legend': { es: 'Red', en: 'Network' },
  'network.testnet.label': { es: 'Testnet (recomendado para probar)', en: 'Testnet (recommended for testing)' },
  'network.mainnet.label': { es: 'Mainnet (Bitcoin real)', en: 'Mainnet (real Bitcoin)' },
  'network.mainnet.confirm': {
    es: 'Entiendo que voy a operar con Bitcoin real y puedo perder mis fondos si me equivoco.',
    en: 'I understand I am operating with real Bitcoin and can lose my funds if I make a mistake.',
  },
  'network.badge.testnet': { es: 'TESTNET', en: 'TESTNET' },
  'network.badge.mainnet': { es: 'MAINNET', en: 'MAINNET' },

  'unlockMode.legend': { es: 'Como accedés', en: 'How you unlock' },
  'unlockMode.seed.label': { es: 'Frase semilla (BIP39)', en: 'Seed phrase (BIP39)' },
  'unlockMode.key.label': { es: 'Clave privada (WIF)', en: 'Private key (WIF)' },

  'fileLoad.hint': {
    es: '"Cargar desde archivo" lee un .txt directo desde un pendrive con el diálogo nativo del sistema operativo — el contenido nunca pasa por el portapapeles (evita el historial de clipboard de apps de terceros y extensiones).',
    en: '"Load from file" reads a .txt straight from a USB stick via the native OS dialog — the content never touches the clipboard (avoids clipboard history from third-party apps and extensions).',
  },
  'fileLoad.button': { es: '📁 Cargar desde archivo (USB)', en: '📁 Load from file (USB)' },

  'seedEncrypted.checkbox': {
    es: 'La frase está cifrada (bloque AES-256-GCM de paper-wallet-btc)',
    en: 'The phrase is encrypted (paper-wallet-btc AES-256-GCM block)',
  },
  'mnemonic.label': { es: 'Frase semilla (12 o 24 palabras, BIP39)', en: 'Seed phrase (12 or 24 words, BIP39)' },
  'encryptedSeed.label': { es: 'Bloque cifrado (del PDF de paper-wallet-btc)', en: 'Encrypted block (from the paper-wallet-btc PDF)' },
  'decryptPassword.label': { es: 'Contraseña de descifrado', en: 'Decryption password' },
  'passphrase.label': { es: 'Passphrase BIP39 (opcional, "palabra 25")', en: 'BIP39 passphrase (optional, "25th word")' },

  'wif.label': { es: 'Clave privada (WIF, o clave BIP38 cifrada que empieza con "6P...")', en: 'Private key (WIF, or an encrypted BIP38 key starting with "6P...")' },
  'wifPassphrase.label': { es: 'Passphrase BIP38 (solo si la clave empieza con "6P...")', en: 'BIP38 passphrase (only if the key starts with "6P...")' },
  'wif.hint': {
    es: 'Se revisan los 4 formatos de dirección posibles para esta clave (Legacy, P2SH-SegWit, Native SegWit y Taproot), igual que "Direcciones adicionales" en paper-wallet-btc.',
    en: 'All 4 possible address formats for this key are checked (Legacy, P2SH-SegWit, Native SegWit, and Taproot), just like "Additional addresses" in paper-wallet-btc.',
  },

  'unlock.button': { es: 'Acceder a la wallet', en: 'Unlock wallet' },

  'error.badMnemonic': {
    es: 'La frase semilla no es valida (revisa la cantidad de palabras y el checksum BIP39).',
    en: 'The seed phrase is not valid (check the word count and the BIP39 checksum).',
  },
  'error.badWif': { es: 'Clave WIF invalida.', en: 'Invalid WIF key.' },
  'error.unlockFailed': { es: 'Error al acceder: {msg}', en: 'Failed to unlock: {msg}' },
  'error.networkFailed': { es: 'No se pudo consultar la red: {msg}', en: 'Could not reach the network: {msg}' },
  'error.fileReadFailed': { es: 'No se pudo leer el archivo: {msg}', en: 'Could not read the file: {msg}' },

  'scanning.title': { es: 'Buscando direcciones y saldos en la red...', en: 'Looking up addresses and balances on the network...' },
  'scan.used': { es: ' (usada)', en: ' (used)' },
  'scan.hdReceive': { es: 'recepcion', en: 'receiving' },
  'scan.hdChange': { es: 'cambio', en: 'change' },
  'scan.progressHd': { es: 'Revisando direccion {chain} #{index}: {addr}{used}', en: 'Checking {chain} address #{index}: {addr}{used}' },
  'scan.progressType': { es: 'Revisando {label}: {addr}{used}', en: 'Checking {label}: {addr}{used}' },

  'dashboard.balanceLabel': { es: 'Saldo total', en: 'Total balance' },
  'dashboard.importedNotice': {
    es: 'Esta wallet viene de una clave privada importada, no de una frase semilla: no hay direcciones nuevas para rotar. Se recomienda enviar todo el saldo ("Enviar todo") a una wallet HD en vez de reutilizar esta dirección.',
    en: 'This wallet comes from an imported private key, not a seed phrase: there are no new addresses to rotate. Sending everything ("Send all") to an HD wallet instead of reusing this address is recommended.',
  },
  'dashboard.refresh': { es: 'Actualizar', en: 'Refresh' },
  'dashboard.send': { es: 'Enviar', en: 'Send' },
  'dashboard.lock': { es: 'Bloquear', en: 'Lock' },
  'dashboard.receive': { es: 'Recibir', en: 'Receive' },
  'dashboard.copyAddress': { es: 'Copiar dirección', en: 'Copy address' },
  'dashboard.copied': { es: 'Copiado!', en: 'Copied!' },
  'dashboard.fundedAddresses': { es: 'Direcciones con saldo', en: 'Funded addresses' },
  'dashboard.noBalance': { es: 'Todavia no se detecto saldo en esta wallet.', en: 'No balance detected on this wallet yet.' },

  'addressType.legacy': { es: 'Legacy (BIP44)', en: 'Legacy (BIP44)' },
  'addressType.p2sh': { es: 'SegWit compatible (BIP49)', en: 'SegWit compatible (BIP49)' },
  'addressType.bech32': { es: 'Native SegWit (BIP84)', en: 'Native SegWit (BIP84)' },
  'addressType.taproot': { es: 'Taproot (BIP86)', en: 'Taproot (BIP86)' },
  'addressLabel.hd': { es: 'Native SegWit (BIP84) {chain} #{index}', en: 'Native SegWit (BIP84) {chain} #{index}' },
  'addressLabel.paper': { es: '{label} (estilo paper-wallet-btc)', en: '{label} (paper-wallet-btc style)' },
  'addressLabel.imported': { es: '{label} (clave importada)', en: '{label} (imported key)' },

  'send.title': { es: 'Enviar fondos', en: 'Send funds' },
  'send.destination.label': { es: 'Dirección de destino', en: 'Destination address' },
  'send.amount.label': { es: 'Monto (BTC)', en: 'Amount (BTC)' },
  'send.sendMax.label': { es: 'Enviar todo el saldo disponible', en: 'Send the entire available balance' },
  'send.fee.legend': { es: 'Comisión', en: 'Fee' },
  'send.fee.fast': { es: 'Rápida', en: 'Fast' },
  'send.fee.medium': { es: 'Media', en: 'Medium' },
  'send.fee.slow': { es: 'Económica', en: 'Economy' },
  'send.fee.custom': { es: 'Personalizada:', en: 'Custom:' },
  'send.fee.rate': { es: '{label} (~{rate} sat/vB)', en: '{label} (~{rate} sat/vB)' },
  'send.review': { es: 'Revisar envío', en: 'Review send' },
  'send.cancel': { es: 'Cancelar', en: 'Cancel' },

  'error.badAmount': { es: 'Ingresa un monto valido en BTC.', en: 'Enter a valid amount in BTC.' },
  'error.invalidAmount': { es: 'Monto invalido.', en: 'Invalid amount.' },
  'error.badCustomFee': { es: 'Ingresa una comision personalizada valida (sat/vB).', en: 'Enter a valid custom fee (sat/vB).' },
  'error.buildTxFailed': { es: 'No se pudo construir la transaccion: {msg}', en: 'Could not build the transaction: {msg}' },
  'error.insufficientFunds': { es: 'Fondos insuficientes para cubrir el monto y la comision.', en: 'Insufficient funds to cover the amount and the fee.' },

  'review.title': { es: 'Revisar antes de firmar', en: 'Review before signing' },
  'review.destination': { es: 'Destino', en: 'Destination' },
  'review.amount': { es: 'Monto', en: 'Amount' },
  'review.fee': { es: 'Comisión', en: 'Fee' },
  'review.change': { es: 'Cambio', en: 'Change' },
  'review.noChange': { es: 'sin cambio', en: 'no change' },
  'review.changeDetail': { es: '{amount} BTC -> {addr}', en: '{amount} BTC -> {addr}' },
  'review.confirm': {
    es: 'Confirmo que los datos son correctos y quiero firmar y transmitir esta transacción.',
    en: 'I confirm the details are correct and I want to sign and broadcast this transaction.',
  },
  'review.sign': { es: 'Firmar y transmitir', en: 'Sign and broadcast' },
  'error.signFailed': { es: 'Error al firmar/transmitir: {msg}', en: 'Signing/broadcast failed: {msg}' },

  'result.title': { es: 'Transacción transmitida', en: 'Transaction broadcast' },
  'result.txid': { es: 'TXID', en: 'TXID' },
  'result.showHex': { es: 'Ver hex firmado', en: 'View signed hex' },
  'result.back': { es: 'Volver a la wallet', en: 'Back to wallet' },

  'footer.note': {
    es: 'Firma 100% en tu navegador · sin cookies · sin almacenamiento persistente. Consulta saldo y transmite vía mempool.space — revisa el código fuente antes de confiarle fondos.',
    en: 'Signs 100% in your browser · no cookies · no persistent storage. Checks balance and broadcasts via mempool.space — review the source before trusting it with funds.',
  },
};

export function t(key, lang, vars) {
  const entry = dict[key];
  let str = entry ? (entry[lang] ?? entry[DEFAULT_LANG]) : key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) str = str.replaceAll(`{${k}}`, String(v));
  }
  return str;
}
