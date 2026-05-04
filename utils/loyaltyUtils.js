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
 * 0.2% for purchases ₱1–₱500
 * 0.35% for purchases ₱501+
 * Points calculated from percentage (most purchases will earn > 0)
 */
export function calcPointsEarned(amount) {
  if (amount <= 0) return 0;
  
  let points;
  if (amount <= 500) {
    points = amount * 0.002; // 0.2%
  } else {
    points = amount * 0.0035; // 0.35%
  }
  
  // Round to 2 decimal places
  points = Math.round(points * 100) / 100;
  
  return points;
}
