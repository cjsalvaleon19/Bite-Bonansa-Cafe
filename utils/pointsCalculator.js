/**
 * Loyalty Points Calculator for Bite Bonansa Cafe
 *
 * Earning scheme:
 *   ₱0 – ₱499.99  →  0.2% of purchase amount
 *   ₱500+          →  0.5% of purchase amount
 *
 * Points are stored as numeric values where 1 point = ₱1.
 */

/**
 * Calculate points earned for a given purchase amount.
 * @param {number} amount - The total purchase amount in pesos.
 * @returns {number} Points earned (rounded to 4 decimal places).
 */
export function calculatePointsEarned(amount) {
  if (typeof amount !== 'number' || isNaN(amount) || amount < 0) return 0;
  const rate = amount >= 500 ? 0.005 : 0.002;
  return parseFloat((amount * rate).toFixed(4));
}

/**
 * Calculate the remaining balance after applying points as payment.
 * @param {number} totalAmount - Total order amount in pesos.
 * @param {number} pointsToRedeem - Points the customer wants to use.
 * @param {number} pointsBalance - Customer's current points balance.
 * @returns {{ pointsApplied: number, remainingBalance: number, pointsBalance: number }}
 */
export function calculateRedemption(totalAmount, pointsToRedeem, pointsBalance) {
  const availablePoints = Math.min(pointsToRedeem, pointsBalance);
  const pointsValue = availablePoints; // 1 point = ₱1
  const pointsApplied = Math.min(pointsValue, totalAmount);
  const remainingBalance = Math.max(0, totalAmount - pointsApplied);
  return {
    pointsApplied: parseFloat(pointsApplied.toFixed(4)),
    remainingBalance: parseFloat(remainingBalance.toFixed(2)),
    pointsBalance: parseFloat(pointsBalance.toFixed(4)),
  };
}

/**
 * Generate a unique customer ID string.
 * Format: BBC-XXXXXX where X is a zero-padded sequential number.
 * @param {number} sequence - The sequential number.
 * @returns {string} Formatted customer ID.
 */
export function generateCustomerId(sequence) {
  return `BBC-${String(sequence).padStart(6, '0')}`;
}
