/**
 * Costing & Pricing Calculator Utilities
 */

export function calcTotalMaterialsCost(ingredients) {
  return ingredients.reduce((sum, ing) => sum + (Number(ing.quantity) * Number(ing.cost_per_unit)), 0);
}

export function calcTotalLaborCost(laborItems) {
  return laborItems.reduce((sum, l) => sum + (Number(l.hours) * Number(l.hourly_rate)), 0);
}

export function calcTotalOverheadCost(overheadItems, variableCost) {
  return overheadItems.reduce((sum, o) => {
    if (o.overhead_type === 'percentage') {
      return sum + (variableCost * Number(o.amount) / 100);
    }
    return sum + Number(o.amount);
  }, 0);
}

export function calcTotalVariableCost(ingredients, laborItems) {
  return calcTotalMaterialsCost(ingredients) + calcTotalLaborCost(laborItems);
}

export function calcTotalCost(ingredients, laborItems, overheadItems) {
  const variable = calcTotalVariableCost(ingredients, laborItems);
  const overhead = calcTotalOverheadCost(overheadItems, variable);
  return variable + overhead;
}

export function calcContributionMargin(sellingPrice, ingredients, laborItems) {
  const variable = calcTotalVariableCost(ingredients, laborItems);
  return Number(sellingPrice) - variable;
}

export function calcMarkupPercent(sellingPrice, ingredients, laborItems, overheadItems) {
  const totalCost = calcTotalCost(ingredients, laborItems, overheadItems);
  if (totalCost === 0) return 0;
  return ((Number(sellingPrice) - totalCost) / totalCost) * 100;
}

export function suggestSellingPrice(ingredients, laborItems, overheadItems, targetMarginPercent = 30) {
  const totalCost = calcTotalCost(ingredients, laborItems, overheadItems);
  // Price = Cost / (1 - margin%)
  if (targetMarginPercent >= 100) return totalCost * 2;
  return totalCost / (1 - targetMarginPercent / 100);
}

export function calcAverageCost(existingQty, existingCost, newQty, newCost) {
  const totalQty = Number(existingQty) + Number(newQty);
  if (totalQty === 0) return 0;
  return ((Number(existingQty) * Number(existingCost)) + (Number(newQty) * Number(newCost))) / totalQty;
}
