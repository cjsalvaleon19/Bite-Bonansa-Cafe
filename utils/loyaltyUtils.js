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
 * 
 * This function is used internally for calculations.
 * Use getPointsDisplayText() for customer-facing display.
 */
export function calcPointsEarned(amount) {
  if (amount >= 500) {
    return Math.floor(amount * 0.005);
  }
  return Math.floor(amount * 0.002);
}

/**
 * Get customer-facing display text for points earned.
 * Returns only the points amount without showing percentage.
 * @param {number} amount - Purchase amount
 * @returns {string} Display text showing points earned
 */
export function getPointsDisplayText(amount) {
  const points = calcPointsEarned(amount);
  return `₱${points}`;
}

/**
 * Get points earned message for display (admin/internal use only).
 * Shows percentage and calculation details.
 * @param {number} amount - Purchase amount
 * @returns {string} Detailed message with percentage
 */
export function getPointsEarnedMessage(amount) {
  const percentage = amount >= 500 ? '0.5%' : '0.2%';
  const points = calcPointsEarned(amount);
  return `You earned ₱${points.toFixed(2)} (${percentage} of ₱${amount.toFixed(2)})`;
}
