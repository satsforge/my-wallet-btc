import * as btc from '@scure/btc-signer';
import QRCode from 'qrcode';
import { isValidMnemonic, seedFromMnemonic } from './lib/mnemonic.js';
import { accountFromSeed, btcNetwork, keyNodeFromPrivateKey, RECEIVE_CHAIN } from './lib/hdwallet.js';
import { createProvider } from './lib/network.js';
import { scanWallet, scanImportedKey, collectUtxoPool } from './lib/scan.js';
import { buildSendTx, signTx } from './lib/txbuilder.js';
import { decryptMnemonic } from './lib/seedcipher.js';
import { decryptBip38, isBip38 } from './lib/bip38.js';
import { t, DEFAULT_LANG } from './lib/i18n.js';

const $ = (id) => document.getElementById(id);
const SCREENS = ['unlock', 'scanning', 'dashboard', 'send', 'review', 'result'];

const state = {
  isTestnet: true,
  network: null,
  provider: null,
  lang: DEFAULT_LANG,
  mode: null, // 'seed' | 'key' - how the current session was unlocked
  account: null, // HDKey account (seed mode)
  seed: null, // kept in memory for the session so "Actualizar" can re-check the paper-wallet-btc fixed addresses too
  importedNode: null, // key node (key mode)
  importedCompressed: true,
  scan: null, // unified: { funded, totalBalance, firstUnusedReceive, firstUnusedChange }
  utxoPool: null, // { utxos, signerByOutpoint }
  feeRates: null, // { fast, medium, slow }
  pendingSend: null, // { selected, destinationAddress, sendMax, feePerByte }
};

function tr(key, vars) {
  return t(key, state.lang, vars);
}

function showScreen(name) {
  for (const s of SCREENS) $(`screen-${s}`).hidden = s !== name;
}

function fmtBtc(sats) {
  return btc.Decimal.encode(sats);
}

function fmtAddress(address) {
  return address.length > 20 ? `${address.slice(0, 10)}…${address.slice(-8)}` : address;
}

function setError(elId, message) {
  const el = $(elId);
  el.textContent = message ?? '';
  el.hidden = !message;
}

function updateNetworkBadge() {
  const badge = $('network-badge');
  badge.textContent = tr(state.isTestnet ? 'network.badge.testnet' : 'network.badge.mainnet');
  badge.classList.toggle('badge-testnet', state.isTestnet);
  badge.classList.toggle('badge-mainnet', !state.isTestnet);
}

function addressLabel(addr) {
  if (addr.source === 'hd') {
    const chain = tr(addr.chain === RECEIVE_CHAIN ? 'scan.hdReceive' : 'scan.hdChange');
    return tr('addressLabel.hd', { chain, index: addr.index });
  }
  const label = tr(`addressType.${addr.type}`);
  if (addr.source === 'paper') return tr('addressLabel.paper', { label });
  if (addr.source === 'imported') return tr('addressLabel.imported', { label });
  return label;
}

function describeScanProgress(record) {
  const used = record.used ? tr('scan.used') : '';
  const addr = fmtAddress(record.address);
  if (record.source === 'hd') {
    const chain = tr(record.chain === RECEIVE_CHAIN ? 'scan.hdReceive' : 'scan.hdChange');
    return tr('scan.progressHd', { chain, index: record.index, addr, used });
  }
  return tr('scan.progressType', { label: tr(`addressType.${record.type}`), addr, used });
}

// ---------- Topbar: language / theme / básico-avanzado ----------

function updateThemeButtonLabel() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  $('theme-toggle').textContent = tr(isLight ? 'topbar.theme.toDark' : 'topbar.theme.toLight');
}

function updateLangButtonLabel() {
  $('lang-toggle').textContent = tr(state.lang === 'es' ? 'topbar.lang.toEnglish' : 'topbar.lang.toSpanish');
}

function updateModeButtonLabel() {
  const isAdvanced = document.documentElement.getAttribute('data-mode') === 'advanced';
  $('ui-mode-label').textContent = tr(isAdvanced ? 'topbar.mode.advanced' : 'topbar.mode.basic');
}

/**
 * Applies the current language to every static [data-i18n*] element, then
 * refreshes the dynamic bits the generic walker can't reach: the topbar
 * button labels (which depend on theme/mode state, not just language) and,
 * if a wallet is already unlocked, the dashboard/review screens (pure
 * re-renders from state, so nothing the user typed is lost).
 */
function applyTranslations() {
  document.documentElement.lang = state.lang;
  document.title = tr('meta.title');
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.innerHTML = tr(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-tip]').forEach((el) => { el.setAttribute('data-tip', tr(el.dataset.i18nTip)); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.setAttribute('placeholder', tr(el.dataset.i18nPlaceholder)); });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', tr(el.dataset.i18nAria)); });

  updateThemeButtonLabel();
  updateLangButtonLabel();
  updateModeButtonLabel();
  updateNetworkBadge();
  if (state.feeRates) refreshFeeLabels();
  if (state.scan) renderDashboard();
  if (state.pendingSend) renderReview();
}

function initTopbar() {
  $('lang-toggle').addEventListener('click', () => {
    state.lang = state.lang === 'es' ? 'en' : 'es';
    applyTranslations();
  });

  $('theme-toggle').addEventListener('click', () => {
    const html = document.documentElement;
    html.setAttribute('data-theme', html.getAttribute('data-theme') === 'light' ? 'dark' : 'light');
    updateThemeButtonLabel();
  });

  $('ui-mode-toggle').addEventListener('click', () => {
    const html = document.documentElement;
    const next = html.getAttribute('data-mode') === 'advanced' ? 'basic' : 'advanced';
    html.setAttribute('data-mode', next);
    if (next === 'basic') {
      // The fields Básico hides may still hold values from Avanzado; force
      // the unlock form back to its simplest state so a Básico submit never
      // acts on a hidden/stale WIF or encrypted-seed entry.
      $('mode-seed').checked = true;
      $('mode-key').checked = false;
      $('seed-encrypted-checkbox').checked = false;
      $('seed-fields').hidden = false;
      $('key-fields').hidden = true;
      $('mnemonic-field').hidden = false;
      $('encrypted-seed-fields').hidden = true;
    }
    $('ui-mode-toggle').setAttribute('aria-pressed', String(next === 'advanced'));
    updateModeButtonLabel();
  });
}

// ---------- Unlock ----------

function initUnlockScreen() {
  const mainnetRadio = $('network-mainnet');
  const testnetRadio = $('network-testnet');
  const mainnetConfirm = $('mainnet-confirm-wrap');
  const unlockBtn = $('unlock-btn');

  function syncNetworkUI() {
    mainnetConfirm.hidden = !mainnetRadio.checked;
    unlockBtn.disabled = mainnetRadio.checked && !$('mainnet-confirm-checkbox').checked;
    // Reflect the selected radio in the header badge immediately, not only
    // after unlocking - otherwise it keeps showing the previous network
    // while the user is still choosing.
    state.isTestnet = testnetRadio.checked;
    updateNetworkBadge();
  }
  mainnetRadio.addEventListener('change', syncNetworkUI);
  testnetRadio.addEventListener('change', syncNetworkUI);
  $('mainnet-confirm-checkbox').addEventListener('change', syncNetworkUI);
  syncNetworkUI();

  const modeSeedRadio = $('mode-seed');
  const modeKeyRadio = $('mode-key');
  function syncModeUI() {
    $('seed-fields').hidden = !modeSeedRadio.checked;
    $('key-fields').hidden = !modeKeyRadio.checked;
  }
  modeSeedRadio.addEventListener('change', syncModeUI);
  modeKeyRadio.addEventListener('change', syncModeUI);
  syncModeUI();

  const seedEncryptedCheckbox = $('seed-encrypted-checkbox');
  function syncSeedEncryptedUI() {
    $('mnemonic-field').hidden = seedEncryptedCheckbox.checked;
    $('encrypted-seed-fields').hidden = !seedEncryptedCheckbox.checked;
  }
  seedEncryptedCheckbox.addEventListener('change', syncSeedEncryptedUI);
  syncSeedEncryptedUI();

  $('toggle-passphrase-visibility').addEventListener('click', () => {
    const input = $('passphrase-input');
    input.type = input.type === 'password' ? 'text' : 'password';
  });
  $('toggle-wif-passphrase-visibility').addEventListener('click', () => {
    const input = $('wif-passphrase-input');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  // Reads a .txt straight off disk (e.g. a USB stick) into a field, instead
  // of copy-paste - keeps the secret out of the OS clipboard entirely.
  function wireFileLoad(buttonId, fileInputId, targetId) {
    const button = $(buttonId);
    const fileInput = $(fileInputId);
    button.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      fileInput.value = ''; // drop the File reference once we've read it
      if (!file) return;
      try {
        const text = await file.text();
        $(targetId).value = text.trim();
      } catch (err) {
        setError('unlock-error', tr('error.fileReadFailed', { msg: err.message }));
      }
    });
  }
  wireFileLoad('mnemonic-file-btn', 'mnemonic-file-input', 'mnemonic-input');
  wireFileLoad('encrypted-seed-file-btn', 'encrypted-seed-file-input', 'encrypted-seed-input');
  wireFileLoad('wif-file-btn', 'wif-file-input', 'wif-input');

  function clearUnlockInputs() {
    $('mnemonic-input').value = '';
    $('encrypted-seed-input').value = '';
    $('decrypt-password-input').value = '';
    $('passphrase-input').value = '';
    $('wif-input').value = '';
    $('wif-passphrase-input').value = '';
  }

  $('unlock-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    setError('unlock-error', null);
    state.isTestnet = testnetRadio.checked;
    updateNetworkBadge();
    unlockBtn.disabled = true;
    try {
      if (modeKeyRadio.checked) {
        state.mode = 'key';
        state.network = btcNetwork(state.isTestnet);
        state.provider = createProvider(state.isTestnet);
        const wifRaw = $('wif-input').value.trim();
        const wifPassphrase = $('wif-passphrase-input').value;
        let privateKey, compressed;
        if (isBip38(wifRaw)) {
          const result = await decryptBip38(wifRaw, wifPassphrase);
          privateKey = result.privateKey;
          compressed = result.compressed;
        } else {
          try {
            privateKey = btc.WIF(state.network).decode(wifRaw);
          } catch {
            throw new Error(tr('error.badWif'));
          }
          compressed = true;
        }
        state.importedNode = keyNodeFromPrivateKey(privateKey, compressed);
        state.importedCompressed = compressed;
        privateKey.fill(0);
        clearUnlockInputs();
        await runScanKey();
      } else {
        state.mode = 'seed';
        let mnemonic;
        if (seedEncryptedCheckbox.checked) {
          const blob = $('encrypted-seed-input').value;
          const password = $('decrypt-password-input').value;
          mnemonic = await decryptMnemonic(blob, password);
        } else {
          mnemonic = $('mnemonic-input').value;
        }
        if (!isValidMnemonic(mnemonic)) {
          throw new Error(tr('error.badMnemonic'));
        }
        const passphrase = $('passphrase-input').value;
        const seed = await seedFromMnemonic(mnemonic, passphrase);
        state.account = accountFromSeed(seed, state.isTestnet);
        state.seed = seed;
        state.network = btcNetwork(state.isTestnet);
        state.provider = createProvider(state.isTestnet);
        clearUnlockInputs();
        await runScanSeed();
      }
    } catch (err) {
      setError('unlock-error', tr('error.unlockFailed', { msg: err.message }));
      unlockBtn.disabled = false;
      showScreen('unlock');
    }
  });
}

// ---------- Scanning ----------

async function afterScan() {
  state.utxoPool = state.scan.funded.length
    ? await collectUtxoPool(state.scan.funded, state.provider, state.isTestnet)
    : { utxos: [], signerByOutpoint: new Map() };
  let fast, medium, slow;
  try {
    [fast, medium, slow] = await Promise.all([state.provider.fee(1), state.provider.fee(3), state.provider.fee(6)]);
  } catch {
    fast = medium = slow = 5n;
  }
  state.feeRates = { fast, medium, slow };
  renderDashboard();
  showScreen('dashboard');
}

async function runScanSeed() {
  showScreen('scanning');
  const log = $('scan-log');
  log.textContent = '';
  try {
    const scan = await scanWallet(state.account, state.seed, state.isTestnet, state.provider, (record) => {
      log.textContent = describeScanProgress(record);
    });
    state.scan = scan;
    await afterScan();
  } catch (err) {
    setError('unlock-error', tr('error.networkFailed', { msg: err.message }));
    showScreen('unlock');
    $('unlock-btn').disabled = false;
  }
}

async function runScanKey() {
  showScreen('scanning');
  const log = $('scan-log');
  log.textContent = '';
  try {
    const result = await scanImportedKey(
      state.importedNode,
      state.isTestnet,
      state.provider,
      (record) => { log.textContent = describeScanProgress(record); },
      state.importedCompressed
    );
    const primary = result.addresses.find((a) => a.type === 'bech32') ?? result.addresses[0];
    state.scan = {
      funded: result.funded,
      totalBalance: result.totalBalance,
      firstUnusedReceive: primary,
      firstUnusedChange: primary,
    };
    await afterScan();
  } catch (err) {
    setError('unlock-error', tr('error.networkFailed', { msg: err.message }));
    showScreen('unlock');
    $('unlock-btn').disabled = false;
  }
}

function rescan() {
  return state.mode === 'key' ? runScanKey() : runScanSeed();
}

// ---------- Dashboard ----------

function renderDashboard() {
  $('total-balance').textContent = `${fmtBtc(state.scan.totalBalance)} BTC`;
  $('imported-key-notice').hidden = state.mode !== 'key';
  const list = $('address-list');
  list.innerHTML = '';
  if (state.scan.funded.length === 0) {
    const li = document.createElement('li');
    li.className = 'address-empty';
    li.textContent = tr('dashboard.noBalance');
    list.appendChild(li);
  }
  for (const addr of state.scan.funded) {
    const li = document.createElement('li');
    li.className = 'address-row';
    li.innerHTML = `
      <span class="address-path">${addressLabel(addr)}</span>
      <span class="address-value" title="${addr.address}">${fmtAddress(addr.address)}</span>
      <span class="address-balance">${fmtBtc(addr.balance)} BTC</span>
    `;
    list.appendChild(li);
  }
  renderReceivePanel();
}

async function renderReceivePanel() {
  const addr = state.scan.firstUnusedReceive;
  $('receive-address').textContent = addr.address;
  try {
    const dataUrl = await QRCode.toDataURL(addr.address, { margin: 1, width: 220 });
    $('receive-qr').src = dataUrl;
    $('receive-qr').hidden = false;
  } catch {
    $('receive-qr').hidden = true;
  }
}

function initDashboardScreen() {
  $('refresh-btn').addEventListener('click', rescan);
  $('lock-btn').addEventListener('click', lockWallet);
  $('go-send-btn').addEventListener('click', () => {
    setError('send-error', null);
    initSendForm();
    showScreen('send');
  });
  $('copy-receive-btn').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($('receive-address').textContent);
      const btn = $('copy-receive-btn');
      btn.textContent = tr('dashboard.copied');
      setTimeout(() => { btn.textContent = tr('dashboard.copyAddress'); }, 1500);
    } catch { /* clipboard may be unavailable; address is shown as text regardless */ }
  });
}

function lockWallet() {
  if (state.seed) state.seed.fill(0);
  if (state.importedNode) state.importedNode.wipe();
  state.mode = null;
  state.account = null;
  state.seed = null;
  state.importedNode = null;
  state.scan = null;
  state.utxoPool = null;
  state.feeRates = null;
  state.pendingSend = null;
  state.provider = null;
  state.network = null;
  $('unlock-btn').disabled = false;
  showScreen('unlock');
}

// ---------- Send ----------

function satsForFeeChoice(choice) {
  const rates = state.feeRates;
  if (choice === 'fast') return rates.fast;
  if (choice === 'slow') return rates.slow;
  return rates.medium;
}

function refreshFeeLabels() {
  $('fee-fast-label').textContent = tr('send.fee.rate', { label: tr('send.fee.fast'), rate: state.feeRates.fast });
  $('fee-medium-label').textContent = tr('send.fee.rate', { label: tr('send.fee.medium'), rate: state.feeRates.medium });
  $('fee-slow-label').textContent = tr('send.fee.rate', { label: tr('send.fee.slow'), rate: state.feeRates.slow });
}

function initSendForm() {
  $('send-form').reset();
  $('fee-medium').checked = true;
  $('send-destination').value = '';
  $('send-amount').value = '';
  $('send-max').checked = false;
  refreshFeeLabels();
  syncSendMax();
}

function syncSendMax() {
  $('send-amount').disabled = $('send-max').checked;
}

function initSendScreen() {
  $('send-max').addEventListener('change', syncSendMax);
  $('cancel-send-btn').addEventListener('click', () => { showScreen('dashboard'); });
  $('send-form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    setError('send-error', null);
    const destinationAddress = $('send-destination').value.trim();
    const sendMax = $('send-max').checked;
    let amountSats = 0n;
    if (!sendMax) {
      const raw = $('send-amount').value.trim();
      if (!raw || Number(raw) <= 0) {
        setError('send-error', tr('error.badAmount'));
        return;
      }
      try {
        amountSats = btc.Decimal.decode(raw);
      } catch {
        setError('send-error', tr('error.invalidAmount'));
        return;
      }
    }
    const feeChoiceEl = document.querySelector('input[name="fee-choice"]:checked');
    let feePerByte = feeChoiceEl ? satsForFeeChoice(feeChoiceEl.value) : state.feeRates.medium;
    const customFee = $('fee-custom-input').value.trim();
    if (feeChoiceEl?.value === 'custom') {
      if (!customFee || Number(customFee) <= 0) {
        setError('send-error', tr('error.badCustomFee'));
        return;
      }
      feePerByte = BigInt(Math.round(Number(customFee)));
    }

    let selected;
    try {
      selected = buildSendTx({
        utxos: state.utxoPool.utxos,
        destinationAddress,
        amountSats,
        feePerByte,
        changeAddress: state.scan.firstUnusedChange.address,
        network: state.network,
        sendMax,
      });
    } catch (err) {
      setError('send-error', tr('error.buildTxFailed', { msg: err.message }));
      return;
    }
    if (!selected) {
      setError('send-error', tr('error.insufficientFunds'));
      return;
    }
    state.pendingSend = { selected, destinationAddress, sendMax, feePerByte };
    renderReview();
    showScreen('review');
  });
}

// ---------- Review ----------

function renderReview() {
  const { selected, destinationAddress } = state.pendingSend;
  const sentOutput = selected.outputs.find((o) => o.address === destinationAddress);
  const changeOutput = selected.outputs.find((o) => o.address === state.scan.firstUnusedChange.address);
  $('review-destination').textContent = destinationAddress;
  $('review-amount').textContent = `${fmtBtc(sentOutput ? sentOutput.amount : 0n)} BTC`;
  $('review-fee').textContent = `${fmtBtc(selected.fee)} BTC`;
  $('review-change').textContent = changeOutput
    ? tr('review.changeDetail', { amount: fmtBtc(changeOutput.amount), addr: fmtAddress(state.scan.firstUnusedChange.address) })
    : tr('review.noChange');
  $('review-confirm-checkbox').checked = false;
  $('confirm-send-btn').disabled = true;
  setError('review-error', null);
}

function initReviewScreen() {
  $('review-confirm-checkbox').addEventListener('change', (ev) => {
    $('confirm-send-btn').disabled = !ev.target.checked;
  });
  $('cancel-review-btn').addEventListener('click', () => { showScreen('send'); });
  $('confirm-send-btn').addEventListener('click', async () => {
    setError('review-error', null);
    $('confirm-send-btn').disabled = true;
    try {
      const { selected } = state.pendingSend;
      signTx(selected.tx, state.utxoPool.signerByOutpoint);
      const txid = await state.provider.sendTx(selected.tx.hex);
      renderResult(txid, selected.tx.hex);
      showScreen('result');
    } catch (err) {
      setError('review-error', tr('error.signFailed', { msg: err.message }));
      $('confirm-send-btn').disabled = false;
    }
  });
}

// ---------- Result ----------

function renderResult(txid, txHex) {
  $('result-txid').textContent = txid;
  $('result-hex').textContent = txHex;
  const explorerBase = state.isTestnet ? 'https://mempool.space/testnet/tx/' : 'https://mempool.space/tx/';
  const link = $('result-explorer-link');
  link.href = `${explorerBase}${txid}`;
  link.textContent = link.href;
}

function initResultScreen() {
  $('back-to-dashboard-btn').addEventListener('click', async () => {
    state.pendingSend = null;
    await rescan();
  });
}

// ---------- Boot ----------

function init() {
  initTopbar();
  initUnlockScreen();
  initDashboardScreen();
  initSendScreen();
  initReviewScreen();
  initResultScreen();
  applyTranslations();
  showScreen('unlock');
}

init();
