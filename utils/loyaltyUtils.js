/**
 * Loyalty Points Utilities
 * Earning: 0.2% for ₱0-499.99, 0.5% for ₱500+
 * 1 point = ₱1 redemption value
 */

export function calcPointsEarned(amount) {
  if (amount >= 500) {
    return Math.floor(amount * 0.005);
  }
  return Math.floor(amount * 0.002);
}

export function generateCustomerId() {
  const num = Math.floor(Math.random() * 99999) + 1;
  return `BBC-${String(num).padStart(5, '0')}`;
}

export function formatPoints(points) {
  return Number(points || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function calcPointsValue(points) {
  return Number(points || 0);
}
