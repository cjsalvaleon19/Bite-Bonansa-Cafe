/**
 * Receipt Utilities
 */

export function generateReceiptNumber() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.getTime().toString().slice(-6);
  return `RCP-${dateStr}-${timeStr}`;
}

export function generateOrderNumber() {
  const now = new Date();
  const seq = Math.floor(Math.random() * 9999) + 1;
  return `ORD-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${String(seq).padStart(4,'0')}`;
}

export function formatCurrency(amount) {
  return `₱${Number(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(date) {
  return new Date(date).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function formatTime(date) {
  return new Date(date).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
}

export function buildQRCodeData(receiptId) {
  return `https://bitebonansacafe.com/review?receipt=${receiptId}`;
}
