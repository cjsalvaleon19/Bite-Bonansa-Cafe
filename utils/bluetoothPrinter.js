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
const DEFAULT_PAPER_WIDTH  = 48;   // characters per line on 80 mm paper
const PRINTER_WIDTH_KEY    = 'bbc_printer_paper_width';

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

export function sanitizePaperWidth(value) {
  if (value === null || value === undefined) return DEFAULT_PAPER_WIDTH;
  const n = Number.parseInt(value, 10);
  return n === 32 || n === 48 ? n : DEFAULT_PAPER_WIDTH;
}

function getPaperWidth(opts = {}) {
  if (opts.paperWidth !== undefined) return sanitizePaperWidth(opts.paperWidth);
  if (typeof window !== 'undefined' && window.localStorage) {
    return sanitizePaperWidth(window.localStorage.getItem(PRINTER_WIDTH_KEY));
  }
  return DEFAULT_PAPER_WIDTH;
}

function wrapText(text, width) {
  const safeWidth = Number.isFinite(width) && width > 0
    ? Math.floor(width)
    : DEFAULT_PAPER_WIDTH;
  const src = String(text || '');
  if (!src) return [''];
  const lines = [];
  for (let i = 0; i < src.length; i += safeWidth) {
    lines.push(src.slice(i, i + safeWidth));
  }
  return lines;
}

/**
 * Two-column row: left text fills the remaining width after the right-aligned
 * value is placed at the right edge of PAPER_WIDTH.
 */
function twoCol(left, right, paperWidth = DEFAULT_PAPER_WIDTH) {
  const r = String(right);
  const leftWidth = Math.max(0, paperWidth - r.length);
  return String(left).substring(0, leftWidth).padEnd(leftWidth) + r + '\n';
}

/** Full-width divider line using the given character. */
function divider(char = '-', paperWidth = DEFAULT_PAPER_WIDTH) {
  return char.repeat(paperWidth) + '\n';
}

function getOrderSlipNumber(order = {}) {
  const orderNumber = String(order.order_number || '').trim();
  const match = orderNumber.match(/(\d{3})$/);
  if (match && match[1]) return match[1];
  const fallback = String(order.id || '').trim();
  return fallback ? fallback.slice(-3) : '---';
}

function formatItemNameWithSubvariant(item = {}) {
  const rawName = String(item.name || '').trim();
  const variants = item.variant_details || item.variantDetails;
  if (variants && typeof variants === 'object' && Object.keys(variants).length > 0) {
    const subvariant = Object.values(variants).map((v) => String(v)).join(', ');
    const baseName = rawName.replace(/\s*\([^)]*\)\s*$/, '').trim();
    return `${baseName} (${subvariant})`;
  }
  return rawName;
}

/**
 * Build ESC/POS bytes for a QR code block (model 2, size 6, error level M).
 * The QR code is stored and then printed; alignment should be set to CENTER
 * before calling this.
 *
 * @param {string} url - The URL/string to encode in the QR code
 * @returns {number[]}
 */
function qrCodeBytes(url) {
  const urlData = encodeText(url);
  const storeLen = 3 + urlData.length; // cn(0x31) + fn(0x50) + m(0x30) + data
  const pL = storeLen & 0xFF;
  const pH = (storeLen >> 8) & 0xFF;
  return [
    // Select QR model 2
    GS, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00,
    // Module size 6 dots — large enough to scan on 80mm paper, readable on 58mm
    GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x06,
    // Error correction level M
    GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x31,
    // Store URL data
    GS, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30, ...urlData,
    // Print the QR code
    GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30,
  ];
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
 * @param {string}  [opts.departmentName]        - Kitchen department/station label
 * @param {boolean} [opts.omitFooterMeta]        - Omits "Accepted by" and printed date lines
 * @returns {Uint8Array}
 */
export function buildReceiptBytes(order, receiptType = 'sales', opts = {}) {
  const isKitchen = receiptType === 'kitchen';
  const title     = isKitchen ? 'ORDER SLIP' : 'SALES INVOICE';
  const paperWidth = getPaperWidth(opts);

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

  if (isKitchen) {
    b.push(...CMD.ALIGN_CENTER, ...CMD.BOLD_ON);
    b.push(...encodeText(`${title}\n`));
    b.push(...CMD.BOLD_OFF);
    b.push(...encodeText(divider('=', paperWidth)));

    b.push(...CMD.ALIGN_LEFT);
    b.push(...encodeText(`Order Slip #: ${getOrderSlipNumber(order)}\n`));
    b.push(...encodeText(divider('-', paperWidth)));
    b.push(...CMD.BOLD_ON, ...encodeText('ITEMS\n'), ...CMD.BOLD_OFF);

    for (const item of orderItems) {
      const qty = item.quantity || 1;
      const itemLabel = `${qty} x ${formatItemNameWithSubvariant(item)}`;
      for (const line of wrapText(itemLabel, paperWidth)) {
        b.push(...encodeText(line + '\n'));
      }
    }

    b.push(...CMD.FEED_3);
    b.push(...CMD.CUT);
    return new Uint8Array(b);
  }

  // ── Header ────────────────────────────────────────────────────────────────
  b.push(...CMD.ALIGN_CENTER, ...CMD.SIZE_2X, ...CMD.BOLD_ON);
  b.push(...encodeText('Bite Bonansa Cafe\n'));
  b.push(...CMD.SIZE_NORMAL, ...CMD.BOLD_OFF);
  b.push(...encodeText("Laconon-Salacafe Rd, Brgy. Poblacion\n"));
  b.push(...encodeText("T'boli, South Cotabato\n"));
  b.push(...encodeText("Tel: 0907-200-8247\n"));
  b.push(...CMD.LF);
  b.push(...CMD.BOLD_ON, ...encodeText(title + '\n'), ...CMD.BOLD_OFF);
  b.push(...encodeText(divider('=', paperWidth)));

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
    for (const line of wrapText(addr, paperWidth)) {
      b.push(...encodeText(line + '\n'));
    }
  }
  b.push(...encodeText(divider('-', paperWidth)));

  // ── Items ─────────────────────────────────────────────────────────────────
  b.push(...CMD.BOLD_ON, ...encodeText('ITEMS ORDERED\n'), ...CMD.BOLD_OFF);

  for (const item of orderItems) {
    const rawName     = item.name || '';
    const displayName = rawName.replace(/\s*\([^)]*\)\s*$/, '').trim();
    const qty         = item.quantity || 1;
    const lineTotal   = ((item.price || 0) * qty).toFixed(2);

    // e.g. "Americano                x2       P120.00"
    const priceTag  = `P${lineTotal}`;
    const itemLabel = `${displayName} x${qty}`;
    const nameWidth = paperWidth - priceTag.length;
    // If the space left for the item label is too small, print label and price
    // on separate lines so details remain readable on narrow paper widths.
    if (nameWidth < 8) {
      for (const line of wrapText(itemLabel, paperWidth)) {
        b.push(...encodeText(line + '\n'));
      }
      b.push(...encodeText(priceTag + '\n'));
    } else {
      const itemLines = wrapText(itemLabel, nameWidth);
      const firstItemLine = itemLines.length > 0 ? itemLines[0] : '';
      b.push(...encodeText(firstItemLine.padEnd(nameWidth) + priceTag + '\n'));
      for (let i = 1; i < itemLines.length; i++) {
        b.push(...encodeText(itemLines[i] + '\n'));
      }
    }

    // Variant add-ons (supports both key shapes)
    const variants = item.variant_details || item.variantDetails;
    if (variants && typeof variants === 'object' && Object.keys(variants).length > 0) {
      const addons = Object.values(variants).join(', ');
      for (const line of wrapText(`  (${addons})`, paperWidth)) {
        b.push(...encodeText(line + '\n'));
      }
    }
  }

  b.push(...encodeText(divider('-', paperWidth)));

  // ── Totals (sales copy only) ───────────────────────────────────────────────
  if (!isKitchen) {
    b.push(...encodeText(twoCol('Subtotal:', `P${subtotal.toFixed(2)}`, paperWidth)));
    if (delivFee > 0) {
      b.push(...encodeText(twoCol('Delivery Fee:', `P${delivFee.toFixed(2)}`, paperWidth)));
    }
    b.push(...CMD.BOLD_ON);
    b.push(...encodeText(twoCol('TOTAL:', `P${total.toFixed(2)}`, paperWidth)));
    b.push(...CMD.BOLD_OFF);
    if (ptsClaimed > 0) {
      b.push(...encodeText(twoCol('Points Claimed:', `-P${ptsClaimed.toFixed(2)}`, paperWidth)));
    }
    b.push(...encodeText(twoCol('Net Amount:', `P${netAmount.toFixed(2)}`, paperWidth)));
    b.push(...encodeText(twoCol('Cash Tendered:', `P${tendered.toFixed(2)}`, paperWidth)));
    b.push(...encodeText(twoCol('Change:', `P${change.toFixed(2)}`, paperWidth)));
    b.push(...encodeText(divider('.', paperWidth)));
    b.push(...encodeText(twoCol('Payment:', payStr, paperWidth)));
  }

  // ── Special instructions ──────────────────────────────────────────────────
  let notes = order.special_request || order.special_instructions || '';
  if (notes) notes = notes.split('|')[0].trim();
  if (notes) {
    b.push(...encodeText(divider('-', paperWidth)));
    b.push(...CMD.BOLD_ON, ...encodeText('SPECIAL INSTRUCTIONS\n'), ...CMD.BOLD_OFF);
    for (const line of wrapText(notes, paperWidth)) {
      b.push(...encodeText(line + '\n'));
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
    b.push(...encodeText('Thank you for your order, Biter!\n'));
    b.push(...CMD.LF);
    b.push(...qrCodeBytes('https://bitebonansacafe.com'));
    b.push(...CMD.LF);
    b.push(...CMD.BOLD_ON, ...encodeText('Scan to Order Online\n'), ...CMD.BOLD_OFF);
    b.push(...encodeText('bitebonansacafe.com\n'));
  }
  if (!opts.omitFooterMeta) {
    b.push(...CMD.LF, ...CMD.ALIGN_LEFT);
    b.push(...encodeText(`Accepted by: ${cashier}\n`));
    b.push(...encodeText(`${new Date().toLocaleString()}\n`));
  }

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
