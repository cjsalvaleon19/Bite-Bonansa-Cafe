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
  let cashSales = 0;
  let gcashSales = 0;
  let pointsSales = 0;

  orders.forEach(order => {
    // Cash Sales = subtotal (pre-VAT, pre-delivery) for cash orders
    if (order.payment_method === 'cash') {
      // Pure cash payment - use subtotal (matches "Subtotal" line on printed receipt)
      cashSales += parseFloat(order.subtotal || 0);
    } else if (order.payment_method === 'points+cash') {
      // Combined payment - cash portion of the subtotal after points deduction
      cashSales += getPaymentPortion(order);
    }
    
    // GCash Sales = subtotal (pre-VAT, pre-delivery) for gcash orders
    if (order.payment_method === 'gcash') {
      // Pure gcash payment
      gcashSales += parseFloat(order.subtotal || 0);
    } else if (order.payment_method === 'points+gcash') {
      // Combined payment - gcash portion of the subtotal after points deduction
      gcashSales += getPaymentPortion(order);
    }
    
    // Points used
    if (order.points_used > 0) {
      pointsSales += parseFloat(order.points_used || 0);
    }
  });

  // Total Sales = Cash Sales + GCash Sales (adjustments applied separately)
  const totalSales = cashSales + gcashSales;

  return {
    totalSales,
    cashSales,
    gcashSales,
    pointsSales,
  };
}

/**
 * Calculate the total deduction from Canceled Order and Double Posting adjustments.
 * These adjustments reduce Total Sales.
 *
 * @param {Array} adjustments - Array of cash_drawer_transactions rows with adjustment_reason and amount
 * @returns {number} Total deduction (positive number to subtract from Total Sales)
 */
export function calculateAdjustmentDeductions(adjustments) {
  return (adjustments || [])
    .filter(adj =>
      adj.adjustment_reason === 'canceled_order' ||
      adj.adjustment_reason === 'double_posting' ||
      adj.payment_adjustment_type === 'cash-to-gcash'
    )
    .reduce((sum, adj) => sum + Math.abs(parseFloat(adj.amount || 0)), 0);
}

/**
 * Get the non-points portion of a combined payment (points+cash or points+gcash)
 * 
 * @param {Object} order - Order object
 * @returns {number} Payment portion amount after deducting points
 */
export function getPaymentPortion(order) {
  const subtotal = parseFloat(order.subtotal || 0);
  const pointsUsed = parseFloat(order.points_used || 0);
  return Math.max(0, subtotal - pointsUsed);
}

/**
 * Calculate GCash amount for an order
 * Handles both pure GCash and points+gcash payments
 * 
 * @param {Object} order - Order object
 * @returns {number} GCash amount paid
 */
export function getGCashAmount(order) {
  if (order.payment_method === 'gcash') {
    return parseFloat(order.subtotal || 0);
  } else if (order.payment_method === 'points+gcash') {
    return getPaymentPortion(order);
  }
  return 0;
}
