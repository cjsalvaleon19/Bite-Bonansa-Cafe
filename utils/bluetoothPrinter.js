/**
 * bluetoothPrinter.js
 *
 * Goojprt Z80C Bluetooth thermal printer integration.
 * Uses the Web Bluetooth API with the standard SPP-over-BLE GATT profile.
 *
 * Requirements:
 *   - Browser: Chrome 56+ or Edge 79+ (Web Bluetooth is not supported in Firefox/Safari)
 *   - Page must be served over HTTPS (or localhost)
 *   - Bluetooth must be enabled on the host device
 *
 * Goojprt Z80C GATT profile (same as PT-210 and most Goojprt BLE printers):
 *   Service UUID    : 000018f0-0000-1000-8000-00805f9b34fb
 *   Characteristic  : 00002af1-0000-1000-8000-00805f9b34fb
 *   Paper width     : 80 mm → 48 characters per line (normal font, 8 dots/char)
 */

// ─── Constants ───────────────────────────────────────────────────────────────

const PRINTER_SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb';
const PRINTER_CHAR_UUID    = '00002af1-0000-1000-8000-00805f9b34fb';
const CHUNK_SIZE           = 512;  // max bytes per writeValue call
const PAPER_WIDTH          = 48;   // characters per line on 80 mm paper

// ESC/POS command sequences
const ESC = 0x1B;
const GS  = 0x1D;
const CMD = {
  INIT:         [ESC, 0x40],             // initialize / reset printer
  ALIGN_LEFT:   [ESC, 0x61, 0x00],       // left-align text
  ALIGN_CENTER: [ESC, 0x61, 0x01],       // center-align text
  BOLD_ON:      [ESC, 0x45, 0x01],       // bold on
  BOLD_OFF:     [ESC, 0x45, 0x00],       // bold off
  SIZE_2X:      [GS,  0x21, 0x11],       // double height + double width
  SIZE_NORMAL:  [GS,  0x21, 0x00],       // normal character size
  FEED_3:       [ESC, 0x64, 0x03],       // feed 3 lines before cut
  CUT:          [GS,  0x56, 0x42, 0x00], // full paper cut
  LF:           [0x0A],                  // line feed (newline)
};

// ─── Connection state (module-level; reused within a browser session) ────────

let _characteristic = null;

// ─── Public: connect / disconnect / status ───────────────────────────────────

/**
 * Prompt the user to select the Goojprt Z80C via the browser Bluetooth dialog.
 * Caches the characteristic for reuse. Safe to call multiple times — reuses
 * an existing connection when still active.
 *
 * @returns {Promise<BluetoothRemoteGATTCharacteristic>}
 * @throws {Error} if Web Bluetooth is unsupported or the connection fails
 */
export async function connectPrinter() {
  if (_characteristic) return _characteristic;

  if (typeof navigator === 'undefined' || !navigator.bluetooth) {
    throw new Error(
      'Web Bluetooth is not supported in this browser.\n' +
      'Please use Google Chrome or Microsoft Edge.'
    );
  }

  const device = await navigator.bluetooth.requestDevice({
    filters: [{ services: [PRINTER_SERVICE_UUID] }],
    optionalServices: [PRINTER_SERVICE_UUID],
  });

  // Clear cached characteristic when the device disconnects
  device.addEventListener('gattserverdisconnected', () => {
    _characteristic = null;
  });

  const server  = await device.gatt.connect();
  const service = await server.getPrimaryService(PRINTER_SERVICE_UUID);
  _characteristic = await service.getCharacteristic(PRINTER_CHAR_UUID);

  return _characteristic;
}

/** Forget the cached connection (does not physically disconnect the device). */
export function disconnectPrinter() {
  _characteristic = null;
}

/** Returns true if a printer characteristic is currently cached. */
export function isPrinterConnected() {
  return _characteristic !== null;
}

// ─── Private: ESC/POS encoding helpers ───────────────────────────────────────

/**
 * Encode a string to a byte array.
 * Uses Latin-1; replaces any character above 0xFF with '?'.
 */
function encodeText(str) {
  const out = [];
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    out.push(c < 256 ? c : 0x3F);
  }
  return out;
}

/**
 * Flatten mixed sources (number[], string, number, Uint8Array) into a single
 * number array suitable for a Uint8Array constructor.
 */
function bytes(...parts) {
  const out = [];
  for (const p of parts) {
    if (Array.isArray(p))             out.push(...p);
    else if (typeof p === 'string')   out.push(...encodeText(p));
    else if (p instanceof Uint8Array) out.push(...p);
    else if (typeof p === 'number')   out.push(p);
  }
  return out;
}

/**
 * Two-column row: left text fills the remaining width after the right-aligned
 * value is placed at the right edge of PAPER_WIDTH.
 */
function twoCol(left, right) {
  const r = String(right);
  const leftWidth = Math.max(0, PAPER_WIDTH - r.length);
  return String(left).substring(0, leftWidth).padEnd(leftWidth) + r + '\n';
}

/** Full-width divider line using the given character. */
function divider(char = '-') {
  return char.repeat(PAPER_WIDTH) + '\n';
}

// ─── Public: build ESC/POS receipt bytes ─────────────────────────────────────

/**
 * Build a Uint8Array of ESC/POS commands representing a complete receipt.
 *
 * @param {object} order  - The order object (supports both `order_items` and `items` shapes)
 * @param {'sales'|'kitchen'} [receiptType='sales']
 * @param {object} [opts]
 * @param {string}  [opts.cashierName]           - Displayed in footer (default: 'Cashier')
 * @param {string}  [opts.customerLoyaltyId]     - BBC-XXXXX loyalty card number
 * @param {number}  [opts.cashTendered]          - Overrides order.cash_amount
 * @param {string}  [opts.displayPaymentMethod]  - Overrides order.payment_method display
 * @returns {Uint8Array}
 */
export function buildReceiptBytes(order, receiptType = 'sales', opts = {}) {
  const isKitchen = receiptType === 'kitchen';
  const title     = isKitchen ? 'KITCHEN ORDER SLIP' : 'SALES INVOICE';

  // Support both order_items (DB joined) and items (JSONB / cart) shapes
  const orderItems = (order.order_items && order.order_items.length > 0)
    ? order.order_items
    : (order.items || []);

  // Financial values
  const subtotal   = order.subtotal || 0;
  const delivFee   = order.delivery_fee || 0;
  const total      = subtotal + delivFee;
  const ptsClaimed = order.points_used || 0;
  const netAmount  = total - ptsClaimed;
  const tendered   = opts.cashTendered !== undefined
    ? parseFloat(opts.cashTendered) || 0
    : (order.cash_amount || 0);
  const change     = Math.max(0, tendered - netAmount);

  // Customer / meta
  const custId  = opts.customerLoyaltyId
    || (order.users && order.users.customer_id)
    || null;
  const phone   = (order.users && order.users.phone)
    || order.customer_phone
    || order.contact_number
    || null;
  const cashier = opts.cashierName || 'Cashier';
  const payStr  = opts.displayPaymentMethod || order.payment_method || 'N/A';

  const b = [];

  // ── Init ──────────────────────────────────────────────────────────────────
  b.push(...CMD.INIT);

  // ── Header ────────────────────────────────────────────────────────────────
  b.push(...CMD.ALIGN_CENTER, ...CMD.SIZE_2X, ...CMD.BOLD_ON);
  b.push(...encodeText('Bite Bonansa Cafe\n'));
  b.push(...CMD.SIZE_NORMAL, ...CMD.BOLD_OFF);
  b.push(...encodeText("Laconon-Salacafe Rd, Brgy. Poblacion\n"));
  b.push(...encodeText("T'boli, South Cotabato\n"));
  b.push(...encodeText("Tel: 0907-200-8247\n"));
  b.push(...CMD.LF);
  b.push(...CMD.BOLD_ON, ...encodeText(title + '\n'), ...CMD.BOLD_OFF);
  b.push(...encodeText(divider('=')));

  // ── Order info ────────────────────────────────────────────────────────────
  b.push(...CMD.ALIGN_LEFT);
  b.push(...encodeText(`Order#: ${order.order_number || String(order.id || '').slice(0, 8)}\n`));
  b.push(...encodeText(`Date  : ${new Date(order.created_at || Date.now()).toLocaleString()}\n`));
  b.push(...encodeText(`Type  : ${order.order_mode || 'N/A'}\n`));
  if (order.customer_name) {
    b.push(...encodeText(`Name  : ${order.customer_name}\n`));
  }
  if (phone) {
    b.push(...encodeText(`Phone : ${phone}\n`));
  }
  if (custId) {
    b.push(...encodeText(`CustID: ${custId}\n`));
  }
  if (order.order_mode === 'delivery' && order.delivery_address) {
    const addr = `Addr  : ${order.delivery_address}`;
    for (let i = 0; i < addr.length; i += PAPER_WIDTH) {
      b.push(...encodeText(addr.slice(i, i + PAPER_WIDTH) + '\n'));
    }
  }
  b.push(...encodeText(divider()));

  // ── Items ─────────────────────────────────────────────────────────────────
  b.push(...CMD.BOLD_ON, ...encodeText('ITEMS ORDERED\n'), ...CMD.BOLD_OFF);

  for (const item of orderItems) {
    const rawName     = item.name || '';
    const displayName = rawName.replace(/\s*\([^)]*\)\s*$/, '').trim();
    const qty         = item.quantity || 1;
    const lineTotal   = ((item.price || 0) * qty).toFixed(2);

    // e.g. "Americano                x2       P120.00"
    const priceTag  = `P${lineTotal}`;
    const nameWidth = PAPER_WIDTH - priceTag.length;
    const namePart  = `${displayName} x${qty}`.substring(0, nameWidth).padEnd(nameWidth);
    b.push(...encodeText(namePart + priceTag + '\n'));

    // Variant add-ons (supports both key shapes)
    const variants = item.variant_details || item.variantDetails;
    if (variants && typeof variants === 'object' && Object.keys(variants).length > 0) {
      const addons = Object.values(variants).join(', ');
      b.push(...encodeText(`  (${addons})\n`));
    }
  }

  b.push(...encodeText(divider()));

  // ── Totals (sales copy only) ───────────────────────────────────────────────
  if (!isKitchen) {
    b.push(...encodeText(twoCol('Subtotal:', `P${subtotal.toFixed(2)}`)));
    if (delivFee > 0) {
      b.push(...encodeText(twoCol('Delivery Fee:', `P${delivFee.toFixed(2)}`)));
    }
    b.push(...CMD.BOLD_ON);
    b.push(...encodeText(twoCol('TOTAL:', `P${total.toFixed(2)}`)));
    b.push(...CMD.BOLD_OFF);
    if (ptsClaimed > 0) {
      b.push(...encodeText(twoCol('Points Claimed:', `-P${ptsClaimed.toFixed(2)}`)));
    }
    b.push(...encodeText(twoCol('Net Amount:', `P${netAmount.toFixed(2)}`)));
    b.push(...encodeText(twoCol('Cash Tendered:', `P${tendered.toFixed(2)}`)));
    b.push(...encodeText(twoCol('Change:', `P${change.toFixed(2)}`)));
    b.push(...encodeText(divider('.')));
    b.push(...encodeText(twoCol('Payment:', payStr)));
  }

  // ── Special instructions ──────────────────────────────────────────────────
  let notes = order.special_request || order.special_instructions || '';
  if (notes) notes = notes.split('|')[0].trim();
  if (notes) {
    b.push(...encodeText(divider()));
    b.push(...CMD.BOLD_ON, ...encodeText('SPECIAL INSTRUCTIONS\n'), ...CMD.BOLD_OFF);
    for (let i = 0; i < notes.length; i += PAPER_WIDTH) {
      b.push(...encodeText(notes.slice(i, i + PAPER_WIDTH) + '\n'));
    }
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  b.push(...CMD.LF, ...CMD.ALIGN_CENTER);
  if (isKitchen) {
    b.push(...CMD.BOLD_ON);
    b.push(...encodeText('** KITCHEN COPY **\n'));
    b.push(...encodeText('DO NOT GIVE TO CUSTOMER\n'));
    b.push(...CMD.BOLD_OFF);
  } else {
    b.push(...encodeText('Thank you, Biter!\n'));
    b.push(...encodeText('bitebonansacafe.com\n'));
  }
  b.push(...CMD.LF, ...CMD.ALIGN_LEFT);
  b.push(...encodeText(`Accepted by: ${cashier}\n`));
  b.push(...encodeText(`${new Date().toLocaleString()}\n`));

  // ── Feed + cut ────────────────────────────────────────────────────────────
  b.push(...CMD.FEED_3);
  b.push(...CMD.CUT);

  return new Uint8Array(b);
}

// ─── Public: connect and print ───────────────────────────────────────────────

/**
 * Connect to the Goojprt Z80C (prompts once, then reuses the connection) and
 * print a receipt.
 *
 * @param {object} order           - The order object
 * @param {'sales'|'kitchen'} [receiptType='sales']
 * @param {object} [opts]          - Same options as buildReceiptBytes
 * @returns {Promise<void>}
 * @throws {Error} on connection or write failure
 */
export async function printToBluetoothPrinter(order, receiptType = 'sales', opts = {}) {
  const characteristic = await connectPrinter();
  const data = buildReceiptBytes(order, receiptType, opts);

  // Send in CHUNK_SIZE slices to stay within the printer's BLE buffer limit
  for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
    await characteristic.writeValue(data.slice(offset, offset + CHUNK_SIZE));
  }
}
