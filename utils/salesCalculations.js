/**
 * Sales Calculation Utilities
 * 
 * Centralized functions for calculating sales breakdowns by payment method.
 * Ensures consistency across dashboard and EOD reports.
 */

/**
 * Calculate sales breakdown by payment method from a list of orders
 * 
 * @param {Array} orders - Array of order objects
 * @returns {Object} Sales breakdown object
 */
export function calculateSalesBreakdown(orders) {
  let totalSales = 0;
  let cashSales = 0;
  let gcashSales = 0;
  let pointsSales = 0;

  orders.forEach(order => {
    totalSales += parseFloat(order.total_amount || 0);
    
    // Cash Sales = actual sales amount paid in cash, not cash tendered
    if (order.payment_method === 'cash') {
      // Pure cash payment - use total_amount (the actual sale amount)
      cashSales += parseFloat(order.total_amount || 0);
    } else if (order.payment_method === 'points+cash') {
      // Combined payment - only count the cash portion (total - points)
      cashSales += getPaymentPortion(order);
    }
    
    // GCash Sales = actual sales amount paid via GCash
    if (order.payment_method === 'gcash') {
      // Pure gcash payment
      gcashSales += parseFloat(order.total_amount || 0);
    } else if (order.payment_method === 'points+gcash') {
      // Combined payment - only count the gcash portion (total - points)
      gcashSales += getPaymentPortion(order);
    }
    
    // Points used
    if (order.points_used > 0) {
      pointsSales += parseFloat(order.points_used || 0);
    }
  });

  return {
    totalSales,
    cashSales,
    gcashSales,
    pointsSales,
  };
}

/**
 * Get the non-points portion of a combined payment (points+cash or points+gcash)
 * 
 * @param {Object} order - Order object
 * @returns {number} Payment portion amount after deducting points
 */
export function getPaymentPortion(order) {
  const totalAmount = parseFloat(order.total_amount || 0);
  const pointsUsed = parseFloat(order.points_used || 0);
  return Math.max(0, totalAmount - pointsUsed);
}
