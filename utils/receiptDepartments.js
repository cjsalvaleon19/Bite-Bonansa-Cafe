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
    code: (code || '').trim() || null,
    name: (name || category || FALLBACK_KITCHEN_DEPARTMENT).trim(),
  };
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
