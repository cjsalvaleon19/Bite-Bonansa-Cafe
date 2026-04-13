/**
 * Calculate loyalty points earned from an order total.
 * ₱0–499.99: 0.2% | ₱500+: 0.5%
 */
export function calcPointsEarned(total) {
  const t = parseFloat(total) || 0;
  if (t >= 500) return parseFloat((t * 0.005).toFixed(2));
  if (t > 0) return parseFloat((t * 0.002).toFixed(2));
  return 0;
}

/**
 * Generate a unique BBC-XXXXX style customer ID using a cryptographically
 * secure random source when available.
 */
export function generateCustomerId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'BBC-';
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint8Array(5);
    crypto.getRandomValues(buf);
    for (let i = 0; i < 5; i++) result += chars[buf[i] % chars.length];
  } else {
    for (let i = 0; i < 5; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
