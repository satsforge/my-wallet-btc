# My Wallet BTC

Repo: [github.com/satsforge/my-wallet-btc](https://github.com/satsforge/my-wallet-btc)

Wallet de Bitcoin 100% del lado del cliente. A diferencia de un generador de
carteras de papel, esta herramienta **importa** una wallet existente (frase
semilla BIP39 + passphrase opcional) y permite **consultar el saldo real y
enviar fondos**, firmando siempre en el navegador. También tiene un **modo
"Solo consulta" (watch-only)**: importando únicamente una clave pública
extendida (xpub/ypub/zpub) se puede ver el saldo y armar transacciones sin
firmar (PSBT) para firmar en otra herramienta — sin que ninguna clave
privada toque nunca esta pestaña. El entregable es un único archivo
`index.html` autocontenido, igual en espíritu a
[`paper-wallet-btc`](../paper-wallet-btc), pero con una diferencia central:
**esta wallet sí necesita red** (paper-wallet-btc es deliberadamente
air-gapped y nunca se conecta a internet).

> ⚠️ **Aviso importante — proyecto sin auditoría externa todavía.**
> Firma y transmite transacciones reales de Bitcoin. La lógica de derivación
> está verificada contra el vector de prueba oficial de BIP84, pero nadie
> ajeno a este repositorio la auditó. Es software "tal cual", sin garantía.
> **Probá primero en testnet** con monedas sin valor. Antes de confiarle
> fondos reales en mainnet: leé el código fuente vos mismo.

## Cómo usarlo

```bash
npm install
npm run build     # genera dist/index.html e index.html
```

Abrí `index.html` en un navegador moderno (Chrome, Firefox, Edge). Podés
abrirlo directamente como `file://` o servirlo con cualquier servidor
estático — no requiere backend propio.

### Modo Básico / Avanzado, idioma y tema

La barra superior — igual en espíritu a la de paper-wallet-btc — tiene tres
interruptores, ninguno persiste entre recargas (ni `localStorage` ni cookies,
mismo criterio "cero persistencia" que su app hermana):

- **Modo: Básico/Avanzado**: en Básico solo se ve el flujo esencial (red +
  frase semilla en texto plano + passphrase). Avanzado agrega: acceder por
  clave privada (WIF/BIP38), frase semilla cifrada (AES), y "Cargar desde
  archivo" para el bloque cifrado y la clave privada. Al volver a Básico, el
  formulario se resetea a su estado más simple (evita enviar un WIF o un
  bloque cifrado oculto que quedó cargado desde Avanzado).
- **🌐 Idioma**: Español/English, con diccionario propio en `src/lib/i18n.js`
  (mismo patrón `data-i18n`/`t()` que paper-wallet-btc). Cambiarlo re-renderiza
  el dashboard/revisión de envío si ya hay una wallet desbloqueada.
- **☀/🌙 Tema**: claro/oscuro, variables CSS bajo `[data-theme='light']`
  (misma paleta que paper-wallet-btc, en vez de una paleta propia).

1. Elegí la red (Testnet por defecto; Mainnet exige tildar un checkbox de
   confirmación explícita).
2. Elegí cómo accedés:
   - **Frase semilla (BIP39)**: pegá las 12/24 palabras (en texto plano, o
     el **bloque cifrado AES-256-GCM** que imprime paper-wallet-btc con su
     contraseña de descifrado) y, si corresponde, la passphrase BIP39
     ("palabra 25", independiente de esa contraseña de descifrado).
   - **Clave privada (WIF)**: pegá un WIF plano, o una clave **BIP38**
     cifrada (empieza con `6P...`, como la que imprime paper-wallet-btc)
     junto con su passphrase.
   - **Solo consulta (xpub/ypub/zpub)** *(modo avanzado)*: pegá una clave
     pública extendida (`xpub`/`ypub`/`zpub` en mainnet, `tpub`/`upub`/
     `vpub` en testnet) y elegí el tipo de dirección que le corresponde
     (Native SegWit/Legacy/P2SH-SegWit/Taproot). No hace falta ninguna
     clave privada ni frase semilla: esta wallet queda en modo **watch-only**
     de punta a punta — ver [Modelo de seguridad](#modelo-de-seguridad).
   - En cualquiera de los casos, en vez de copiar y pegar podés usar
     **"Cargar desde archivo (USB)"**: abre el selector nativo del sistema
     operativo y lee un `.txt` directo desde el pendrive con
     [`File.text()`](https://developer.mozilla.org/docs/Web/API/Blob/text),
     sin que el contenido pase en ningún momento por el portapapeles.
3. La app deriva la wallet y escanea contra la API pública de
   [mempool.space](https://mempool.space):
   - Con frase semilla: direcciones Native SegWit (BIP84) de recepción y
     cambio hasta el límite de huecos estándar (20 sin uso consecutivas),
     más las 3 direcciones fijas que paper-wallet-btc también deriva de la
     misma semilla (Legacy BIP44, P2SH-SegWit BIP49, Taproot BIP86).
   - Con clave privada: los 4 formatos de dirección posibles para esa
     clave (no se sabe cuál imprimió el generador original).
   - Con clave pública extendida (watch-only): recepción y cambio del tipo
     de dirección elegido, con el mismo límite de huecos estándar (20).
4. Desde el panel podés recibir (dirección + QR) o enviar fondos. En una
   wallet con clave privada, la pantalla de revisión tiene dos botones:
   **"Firmar y transmitir"** (arma, firma y transmite en un solo paso) o
   **"Firmar sin transmitir"** (firma igual, pero no llama a la red — te da
   el hex firmado en texto, QR y descarga, para que lo transmitas vos donde
   quieras, por ejemplo en un multisig donde firmás tu parte y se la pasás
   al próximo firmante). En una wallet **watch-only**, en cambio, hay un
   único botón — **"Generar PSBT sin firmar"** — que arma la transacción y
   te da un PSBT en base64 (texto, QR y descarga `.txt`) listo para llevar
   a una herramienta de firma como [PSBT Signer BTC](../psbt-signer-btc). En
   todos los casos la seed y las claves privadas (cuando existen) nunca
   salen de la pestaña.

## Modelo de seguridad

- **Derivación**: BIP32/BIP39. Cuenta propia en BIP84 (`m/84'/0'/0'`
  mainnet, `m/84'/1'/0'` testnet, SLIP-44) con escaneo HD completo
  (recepción + cambio, límite de huecos 20). Además, para compatibilidad
  con paper-wallet-btc, se revisan las 3 direcciones fijas que ese
  generador también deriva de la misma semilla en `m/44'/.../0/0`
  (Legacy), `m/49'/.../0/0` (P2SH-SegWit) y `m/86'/.../0/0` (Taproot) —
  paper-wallet-btc nunca rota direcciones, así que alcanza con revisar el
  índice 0 de cada tipo.
- **Importación por clave privada**: acepta un WIF plano o una clave
  **BIP38** cifrada (formato no-EC-multiply, el único que produce
  paper-wallet-btc). El descifrado BIP38 verifica el checksum
  `addressHash` contra la dirección Legacy derivada: una passphrase
  incorrecta falla explícitamente en vez de devolver una clave inválida en
  silencio. Como no hay forma de saber qué formato de dirección imprimió
  el generador original, se revisan los 4 tipos (Legacy/P2SH/Bech32/
  Taproot) para esa misma clave.
- **Semilla cifrada**: acepta el bloque AES-256-GCM que imprime
  paper-wallet-btc en modo avanzado ("Cifrado AES-256-GCM de la semilla").
  Es un formato propio de paper-wallet-btc (no un estándar), pero al ser
  AES-GCM autenticado, una contraseña incorrecta falla de forma explícita.
- **Passphrase BIP39**: capa opcional, nunca se persiste ni se envía a
  ningún lado; solo se usa en memoria para derivar el seed. Es
  independiente de la contraseña de descifrado de la semilla (AES) y de
  la passphrase BIP38 — son tres secretos distintos con propósitos
  distintos.
- **Carga desde archivo, sin portapapeles**: la frase semilla, el bloque
  cifrado y el WIF/BIP38 se pueden leer directo de un archivo (por ejemplo
  en un pendrive) con `<input type="file">` + `File.text()` en vez de
  copiar y pegar. El navegador entrega el contenido directamente a la
  página vía el diálogo nativo del sistema operativo — el dato nunca pasa
  por el portapapeles del sistema, así que no queda en el historial de
  clipboard ni es legible por otras apps/extensiones que lo monitoreen. El
  `<input>` se resetea (`value = ''`) apenas se lee el archivo, para
  soltar la referencia al `File`.
- **Firma 100% client-side**: la seed y las claves privadas derivadas jamás
  salen del navegador. Solo la transacción ya firmada (hex) se envía a la
  red para transmitirla (`POST /tx` en la API Esplora de mempool.space).
- **Higiene de memoria**: la seed se sobrescribe con ceros (`.fill(0)`)
  apenas se usa para firmar, y cada clave WIF/BIP38 importada al terminar de
  desencriptarla. Las claves derivadas de la cuenta HD (`node.privateKey` es
  un getter que copia, no una referencia viva) se mantienen mientras la
  wallet sigue desbloqueada — se necesitan para firmar más de un envío o
  volver a escanear sin repetir la derivación — y se cerean recién al
  bloquear la wallet (`lockWallet()`), no en cada firma individual.
- **Cero persistencia**: no se usa `localStorage`, `sessionStorage`,
  cookies ni IndexedDB. Al recargar o cerrar la pestaña, todo desaparece.
- **Auto-bloqueo por inactividad**: a los 10 minutos sin actividad la sesión
  se bloquea sola — se cerean la semilla, la cuenta y cada nodo derivado, y
  se vuelve a la pantalla de desbloqueo avisando por qué. Es la herramienta
  del grupo con más superficie (claves privadas *y* red en la misma
  pestaña), así que no depende de que te acuerdes de apretar "Bloquear".
- **Aviso de comisión anómala**: si la comisión se lleva más del 10% de lo
  que estás gastando, la pantalla de revisión lo marca. El número siempre
  estuvo a la vista; esto hace que una tarifa personalizada mal tipeada no
  se pase por alto.
- **El PSBT que exporta watch-only declara de dónde salen sus claves**: cada
  input lleva su `bip32Derivation` (o `tapBip32Derivation` en Taproot) con
  el fingerprint de la clave maestra y la ruta completa, así el firmador
  sabe exactamente qué clave derivar en vez de tener que adivinarlo. Por eso
  el modo watch-only pide esos dos datos: son opcionales si solo querés ver
  el saldo, y necesarios si vas a firmar el PSBT en otra herramienta. Sin
  ellos, un PSBT de una wallet que no sea Native SegWit no se puede firmar
  en PSBT Signer BTC — y la pantalla de revisión lo avisa antes de exportar,
  no cuando ya estás en la máquina offline.
- **CSP estricta**: `script-src` y `style-src` restringidos por hash SHA-256
  (del bloque de script y de la hoja de estilos inline), sin ninguna
  excepción `unsafe-inline`. La diferencia con un proyecto air-gapped es
  `connect-src https://mempool.space`, necesario para consultar saldos/UTXOs
  y transmitir transacciones — es la única excepción a la política "cero
  red".
- **La profundidad del xpub se valida contra la ruta declarada**: si en modo
  watch-only cargás la ruta de la cuenta, se exige que el xpub tenga esa
  misma profundidad. Derivar funciona desde cualquier nodo, así que pegar la
  clave maestra bajo una ruta de cuenta produce direcciones reales pero que
  no son las de tu wallet — saldo vacío y un PSBT que apunta a donde la
  clave nunca estuvo.
- **El UTXO se verifica contra la dirección que lo reportó**: antes de
  anotarlo como input se compara el script que su transacción de origen
  realmente paga (verificable: sus bytes hashean al txid que el proveedor
  nombró) contra el que esta wallet deriva para esa dirección. Un desajuste
  corta ahí con un mensaje claro, en vez de aparecer después como un fallo
  de firma sin explicación.
- **Direcciones completas en la revisión**: tanto el destino como la
  dirección de cambio se muestran enteras, sin truncar.
- **Selección de UTXOs y fee**: usa `@scure/btc-signer` (librería auditada)
  para seleccionar UTXOs, calcular la comisión y construir la transacción.
  Las tasas sugeridas (rápida/media/económica) se obtienen de
  `mempool.space/api/v1/fees` en el momento del envío.
- **Pantalla de revisión obligatoria**: antes de firmar, se muestra destino,
  monto, comisión y dirección de cambio, con un checkbox de confirmación
  explícito. No hay envío con un solo click.
- **Firmar sin transmitir**: alternativa a "Firmar y transmitir" en la misma
  pantalla de revisión. Firma la transacción igual, pero no llama a la red
  — el resultado (hex firmado, QR, descarga `.txt`) queda para que lo
  transmitas por otro medio. Útil para multisig (firmás tu parte y se la
  pasás al próximo firmante) o para no depender del `POST /tx` propio de
  la app.
- **Modo watch-only (solo consulta)**: se activa importando una clave
  pública extendida (xpub/ypub/zpub) en vez de una semilla o clave privada.
  `src/lib/watchonly.js` decodifica el prefijo SLIP132, valida la red
  (mainnet/testnet) y rechaza explícitamente cualquier clave que resulte
  ser privada (`xprv`/`tprv`) en vez de pública. A partir de ahí, la
  derivación de direcciones hijas es **derivación pública pura**
  (`HDKey.deriveChild()` sobre un nodo sin clave privada, válido para las
  rutas no-endurecidas `m/0/i` y `m/1/i` que usan recepción y cambio): en
  ningún momento del flujo — escaneo, cálculo de saldo, selección de UTXOs
  ni armado de la transacción — existe una clave privada en memoria. Al
  "enviar", en vez de firmar se llama a `tx.toPSBT()` y se exporta ese PSBT
  sin firmar (base64) para completarlo en otra herramienta, por ejemplo
  [PSBT Signer BTC](../psbt-signer-btc). Este round-trip completo (armar el
  PSBT en modo watch-only → firmarlo con la semilla real en PSBT Signer BTC
  → transacción finalizada con testigo válido) está probado con un script
  Node que encadena ambos proyectos de punta a punta.

## Diferencias con `paper-wallet-btc`

| | paper-wallet-btc | My Wallet BTC |
|---|---|---|
| Propósito | Generar una wallet nueva | Acceder a una wallet existente |
| Red | Ninguna (air-gapped) | Sí (consulta saldo y transmite) |
| Entrada | Entropía / dados | Seed phrase, seed cifrada (AES), WIF, clave BIP38 o clave pública extendida (watch-only) |
| Salida | PDF imprimible | Panel de saldo + envío de fondos (o PSBT sin firmar en modo watch-only) |
| Direcciones | Legacy/SegWit/Taproot, un índice cada una | Las mismas 4, + cuenta HD completa en BIP84 |

Cualquier wallet generada con paper-wallet-btc se puede abrir directamente
en My Wallet BTC: la frase semilla (cifrada o no), el WIF impreso, y la
clave BIP38 cifrada son todos formatos que esta wallet entiende de forma
nativa — se probó de punta a punta contra la salida real de
paper-wallet-btc (ver `test/bip38.test.mjs`, `test/seedcipher.test.mjs` y
`test/addresstypes.test.mjs`, que importan sus módulos directamente para
la comparación).

## Estructura del proyecto

```
src/
  lib/
    mnemonic.js     validación BIP39, derivación de seed (WebCrypto)
    seedcipher.js   descifrado AES-256-GCM de la semilla (formato paper-wallet-btc)
    bip38.js        descifrado BIP38 de un WIF (no-EC-multiply), con verificación de checksum
    hdwallet.js     derivación BIP32/BIP84 (cuenta propia), nodo para clave importada
    watchonly.js    parseo de xpub/ypub/zpub/tpub/upub/vpub (SLIP132) a un nodo público puro
    addresstypes.js direcciones Legacy/P2SH/Bech32/Taproot para cualquier pubkey o seed
    network.js      cliente Esplora (mempool.space) mainnet/testnet
    scan.js         escaneo HD + direcciones fijas + clave importada + watch-only, con límite de huecos
    txbuilder.js    selección de UTXOs, construcción y firma de transacciones
    i18n.js         diccionario ES/EN + walker data-i18n (mismo patrón que paper-wallet-btc)
  app.js            controlador de la UI (sin frameworks)
  styles.css        tema oscuro/claro, header y componentes al estilo paper-wallet-btc
index.src.html      plantilla HTML fuente (placeholders __CSS__/__SCRIPT__/__CSP__)
build.mjs           empaqueta todo en un único index.html autocontenido
test/               tests (node:test); varios importan los módulos de
                     ../paper-wallet-btc directamente para comparar salidas
```

## Tests

```bash
npm test
```

Incluye el vector de prueba **oficial** de
[BIP84](https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki)
(mnemonic "abandon...about", primera dirección de recepción y de cambio en
mainnet), validación de mnemonics BIP39, y casos de construcción/firma/
finalización de una transacción completa para P2WPKH, P2SH-SegWit y
Taproot (con verificación de que cada input queda finalizado y que monto +
comisión cierran contra el UTXO de entrada). `watchonly.test.mjs` valida el
parseo de xpub/tpub/zpub contra direcciones derivadas de una semilla real
(incluyendo mainnet y testnet), y que una clave privada (`xprv`) o un
string arbitrario se rechacen explícitamente.

Los tests de compatibilidad con paper-wallet-btc importan sus módulos
**directamente** (vía ruta relativa `../paper-wallet-btc/src/lib/...`, sin
publicar ni empaquetar nada) para comparar salidas real contra real, no
solo contra vectores fijos:

- `bip38.test.mjs` descifra los mismos vectores oficiales de BIP38 que
  `paper-wallet-btc` cifra en su propio test suite.
- `seedcipher.test.mjs` descifra un bloque generado con el
  `encryptMnemonic` real de paper-wallet-btc.
- `addresstypes.test.mjs` compara, para semillas aleatorias, que las 4
  direcciones derivadas coincidan con `deriveAllWallets` de
  paper-wallet-btc.

El escaneo de red (`scan.js`) y el broadcast (`network.js`) no tienen test
automatizado porque dependen de una API externa en vivo — se verificaron
manualmente contra `mempool.space` (testnet y mainnet), incluyendo el
flujo completo de importar una clave BIP38 generada por paper-wallet-btc y
confirmar que la dirección resultante coincide.

## Limitaciones conocidas

- Depende de la disponibilidad de `mempool.space`. Si el servicio está
  caído, no se puede consultar saldo ni transmitir. No hay fallback a otro
  proveedor ni a un nodo propio configurable desde la UI.
- El escaneo HD (BIP84) usa el límite de huecos estándar (20). Si tu
  wallet tiene fondos en un índice más allá de un hueco de 20 direcciones
  sin uso, no se va a detectar automáticamente. Las direcciones fijas
  estilo paper-wallet-btc (Legacy/P2SH/Taproot) no tienen este problema:
  siempre se revisa el índice 0 de cada una.
- Una clave privada importada (WIF/BIP38) no es una wallet HD: no hay
  "próxima dirección" para rotar, y el cambio de una operación de envío
  vuelve a esa misma clave. Se recomienda barrer todo el saldo
  ("Enviar todo") hacia una wallet HD en vez de reutilizarla.
- BIP38 solo soporta el modo no-EC-multiply (el único que produce
  paper-wallet-btc y la inmensa mayoría de generadores). Una clave BIP38
  con EC-multiply es rechazada explícitamente, no falla en silencio.
- El cifrado AES de la semilla es el formato propio de paper-wallet-btc,
  no un estándar — solo lo entienden esa herramienta y esta.
- No tiene soporte directo para hardware wallets (Ledger/Trezor/etc): en
  modo con clave privada, esa clave se deriva y usa en el mismo proceso de
  JavaScript que corre la UI. El modo watch-only cubre el caso de "ver
  saldo y armar transacciones sin exponer la clave privada", pero el PSBT
  resultante hoy se piensa para firmarlo con otra instancia de esta misma
  wallet (u otro software), no con un dispositivo físico.
- El modo watch-only hace un escaneo completo (límite de huecos 20) para
  el tipo de dirección elegido, pero [PSBT Signer BTC](../psbt-signer-btc)
  hoy solo hace fuerza bruta contra el índice 0 para Legacy/P2SH/Taproot
  (igual que paper-wallet-btc). Si el PSBT usa una dirección Legacy/P2SH/
  Taproot en un índice mayor a 0, PSBT Signer BTC no la va a poder firmar
  automáticamente todavía. Con Native SegWit (BIP84) no hay problema: ese
  tipo sí se escanea por rango completo en ambos lados.
- "Cargar desde archivo" evita el portapapeles, pero no es una garantía de
  memoria perfecta: mientras la frase/clave está en el campo de texto (o
  recién leída del archivo) vive como string de JS, y los strings son
  inmutables — no se pueden sobrescribir con ceros como sí se hace con los
  bytes de la seed ya derivada. Es la misma limitación que tiene pegar el
  texto a mano; la mejora real es no dejar rastro en el portapapeles del
  sistema operativo.
- Sin descarga/backup de la wallet: es una herramienta de acceso puntual,
  no reemplaza a Electrum/Sparrow para uso diario.

## Licencia

ISC — software "tal cual", sin garantía. Antes de confiarle fondos reales:
leé el código fuente, probá primero en testnet, y considerá auditar la
lógica de `src/lib/` vos mismo.
