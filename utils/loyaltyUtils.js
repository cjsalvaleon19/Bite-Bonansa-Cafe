/**
 * Generate a unique customer loyalty ID in the format BBC-XXXXX
 * where XXXXX is a zero-padded 5-digit random number.
 */
export function generateCustomerId() {
  const num = Math.floor(Math.random() * 90000) + 10000;
  return `BBC-${num}`;
}

/**
 * Calculate loyalty points earned for a given purchase amount.
 * 0.2% for purchases ₱0–₱499.99
 * 0.5% for purchases ₱500+
 */
export function calcPointsEarned(amount) {
  if (amount >= 500) {
    return Math.floor(amount * 0.005);
  }
  return Math.floor(amount * 0.002);
}
