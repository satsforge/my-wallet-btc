# Mi Wallet BTC

Wallet de Bitcoin 100% del lado del cliente. A diferencia de un generador de
carteras de papel, esta herramienta **importa** una wallet existente (frase
semilla BIP39 + passphrase opcional) y permite **consultar el saldo real y
enviar fondos**, firmando siempre en el navegador. El entregable es un único
archivo `index.html` autocontenido, igual en espíritu a
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

## Modo Básico / Avanzado, idioma y tema

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

## Cómo usarlo

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
   - En cualquiera de los dos casos, en vez de copiar y pegar podés usar
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
4. Desde el panel podés recibir (dirección + QR) o enviar fondos: la
   transacción se construye, firma y transmite enteramente en tu navegador;
   la seed y las claves privadas nunca salen de la pestaña.

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
- **Higiene de memoria**: la seed y cada clave privada derivada se
  sobrescriben con ceros (`.fill(0)`) inmediatamente después de usarse para
  derivar o firmar.
- **Cero persistencia**: no se usa `localStorage`, `sessionStorage`,
  cookies ni IndexedDB. Al recargar o cerrar la pestaña, todo desaparece.
- **CSP estricta**: `script-src` restringido a un hash SHA-256 del único
  bloque de script inline (igual que paper-wallet-btc). La diferencia con
  un proyecto air-gapped es `connect-src https://mempool.space`, necesario
  para consultar saldos/UTXOs y transmitir transacciones — es la única
  excepción a la política "cero red".
- **Selección de UTXOs y fee**: usa `@scure/btc-signer` (librería auditada)
  para seleccionar UTXOs, calcular la comisión y construir la transacción.
  Las tasas sugeridas (rápida/media/económica) se obtienen de
  `mempool.space/api/v1/fees` en el momento del envío.
- **Pantalla de revisión obligatoria**: antes de firmar y transmitir, se
  muestra destino, monto, comisión y dirección de cambio, con un checkbox
  de confirmación explícito. No hay envío con un solo click.

## Diferencias con `paper-wallet-btc`

| | paper-wallet-btc | Mi Wallet BTC |
|---|---|---|
| Propósito | Generar una wallet nueva | Acceder a una wallet existente |
| Red | Ninguna (air-gapped) | Sí (consulta saldo y transmite) |
| Entrada | Entropía / dados | Seed phrase, seed cifrada (AES), WIF o clave BIP38 |
| Salida | PDF imprimible | Panel de saldo + envío de fondos |
| Direcciones | Legacy/SegWit/Taproot, un índice cada una | Las mismas 4, + cuenta HD completa en BIP84 |

Cualquier wallet generada con paper-wallet-btc se puede abrir directamente
en Mi Wallet BTC: la frase semilla (cifrada o no), el WIF impreso, y la
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
    addresstypes.js direcciones Legacy/P2SH/Bech32/Taproot para cualquier pubkey o seed
    network.js      cliente Esplora (mempool.space) mainnet/testnet
    scan.js         escaneo HD + direcciones fijas + clave importada, con límite de huecos
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
comisión cierran contra el UTXO de entrada).

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
- No implementa PSBT para firma multi-dispositivo ni hardware wallets: la
  clave privada se deriva y usa en el mismo proceso de JavaScript que
  corre la UI.
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
