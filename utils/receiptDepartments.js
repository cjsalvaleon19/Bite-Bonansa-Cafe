export const FALLBACK_KITCHEN_DEPARTMENT = 'General Kitchen';

export function getOrderItems(order) {
  if (Array.isArray(order?.order_items) && order.order_items.length > 0) {
    return order.order_items;
  }

  if (Array.isArray(order?.items)) {
    return order.items;
  }

  if (typeof order?.items === 'string') {
    try {
      const parsed = JSON.parse(order.items);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

export function getOrderSlipNumber(order = {}) {
  const orderNumber = String(order.order_number || '').trim();
  const match = orderNumber.match(/(\d{3})$/);
  if (match && match[1]) return match[1];
  const fallback = String(order.id || '').trim();
  return fallback ? fallback.slice(-3) : '---';
}

export function formatItemNameWithSubvariant(item = {}) {
  const { mainLine, subvariantLines } = formatOrderSlipItemDetails(item);
  if (subvariantLines.length === 0) return mainLine;
  return `${mainLine} (${subvariantLines.join(', ')})`;
}

function normalizeItemVariants(item = {}) {
  const rawVariants = item.variant_details ?? item.variantDetails;
  if (!rawVariants) return null;
  if (typeof rawVariants === 'object' && !Array.isArray(rawVariants)) return rawVariants;
  if (typeof rawVariants === 'string') {
    try {
      const parsed = JSON.parse(rawVariants);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function formatOrderSlipItemDetails(item = {}) {
  const rawName = String(item.name || '').trim();
  const baseName = rawName.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const variants = normalizeItemVariants(item);
  if (!variants || Object.keys(variants).length === 0) {
    return { mainLine: baseName, subvariantLines: [] };
  }

  const entries = Object.entries(variants)
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '');
  if (entries.length === 0) {
    return { mainLine: baseName, subvariantLines: [] };
  }

  const sizeEntry = entries.find(([type]) => String(type || '').toLowerCase().includes('size'));
  const sizeValue = sizeEntry ? String(sizeEntry[1]).trim() : '';
  const subvariantLines = entries
    .filter(([type]) => !String(type || '').toLowerCase().includes('size'))
    .map(([, value]) => String(value).trim());

  return {
    mainLine: sizeValue ? `${baseName} (${sizeValue})` : baseName,
    subvariantLines,
  };
}

function normalizeDepartment(item = {}) {
  const department =
    item.kitchen_department ||
    item.kitchenDepartment ||
    item.kitchen_departments ||
    item.kitchenDepartments ||
    item.menu_items?.kitchen_departments ||
    item.menuItem?.kitchenDepartment ||
    null;

  const name = typeof department === 'string'
    ? department
    : department?.department_name || department?.departmentName || department?.name || null;
  const code = typeof department === 'object'
    ? department?.department_code || department?.departmentCode || null
    : null;
  const category = item.category || item.menu_items?.category || item.menuItem?.category || null;

  return {
    code: code ? String(code).trim() || null : null,
    name: String(name || category || FALLBACK_KITCHEN_DEPARTMENT).trim(),
  };
}

/**
 * Return a human-friendly label for the order mode value used on order slips.
 * Matches the canonical modes stored in the database.
 */
export function formatOrderModeLabel(mode) {
  const m = String(mode || '').toLowerCase();
  if (m === 'dine-in')  return 'Dine-in';
  if (m === 'take-out') return 'Take-out';
  if (m === 'pick-up')  return 'Pick-up';
  if (m === 'delivery') return 'Delivery';
  return mode || 'N/A';
}

export function buildKitchenDepartmentOrders(order) {
  const grouped = new Map();

  for (const item of getOrderItems(order)) {
    const department = normalizeDepartment(item);
    const key = department.code || department.name;
    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        code: department.code,
        name: department.name,
        items: [],
      });
    }
    grouped.get(key).items.push(item);
  }

  return Array.from(grouped.values()).map((group) => ({
    ...group,
    order: {
      ...order,
      order_items: group.items,
      items: group.items,
    },
  }));
}
