const PAYROLL_STORAGE_KEY = 'bbc_payroll_attendance_v1';
const PAYROLL_CYCLE_DAYS = 15;
const DAILY_PAYROLL_RATE = 266.67;
const SALARY_DEDUCTION_SOURCE = 'cashier_salary_deduction';

function toDateOnly(value) {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
  return d.toISOString().split('T')[0];
}

function createId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function roundToCurrency(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function getDefaultCycleStart() {
  const now = new Date();
  const day = now.getDate();
  const startDay = day <= 15 ? 1 : 16;
  const start = new Date(now.getFullYear(), now.getMonth(), startDay);
  return toDateOnly(start);
}

function ensureDailyArray(daily = [], cycleDays = []) {
  return cycleDays.map((d, idx) => {
    if (d.isSunday) return true;
    const raw = daily[idx];
    return typeof raw === 'boolean' ? raw : true;
  });
}

export function getPayrollCycleDays(cycleStart, count = PAYROLL_CYCLE_DAYS) {
  const proposedStart = new Date(cycleStart || getDefaultCycleStart());
  const start = Number.isNaN(proposedStart.getTime())
    ? new Date(getDefaultCycleStart())
    : proposedStart;
  return Array.from({ length: count }, (_, idx) => {
    const d = new Date(start);
    d.setDate(start.getDate() + idx);
    const isoDate = toDateOnly(d);
    return {
      index: idx,
      date: isoDate,
      label: d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
      dayLabel: d.toLocaleDateString('en-US', { weekday: 'short' }),
      isSunday: d.getDay() === 0,
    };
  });
}

export function buildDefaultPayrollData() {
  return {
    cycleStart: getDefaultCycleStart(),
    submitted: false,
    submittedAt: null,
    employees: [],
  };
}

export function normalizePayrollData(rawData) {
  const base = rawData && typeof rawData === 'object' ? rawData : buildDefaultPayrollData();
  const cycleStart = toDateOnly(base.cycleStart || getDefaultCycleStart());
  const cycleDays = getPayrollCycleDays(cycleStart);
  const employees = Array.isArray(base.employees) ? base.employees : [];

  return {
    cycleStart,
    submitted: Boolean(base.submitted),
    submittedAt: base.submittedAt || null,
    employees: employees
      .map((employee) => {
        const name = String(employee?.name || '').trim();
        if (!name) return null;
        return {
          id: employee?.id || createId('emp'),
          name,
          daily: ensureDailyArray(employee?.daily || [], cycleDays),
          deductions: Array.isArray(employee?.deductions)
            ? employee.deductions.map((d) => ({
                id: d?.id || createId('ded'),
                date: toDateOnly(d?.date || new Date()),
                type: d?.type || 'Cash Advance',
                amount: roundToCurrency(d?.amount),
                notes: d?.notes || '',
                source: d?.source || 'manual',
                processed: Boolean(d?.processed),
                orderId: d?.orderId || null,
              }))
            : [],
        };
      })
      .filter(Boolean),
  };
}

export function loadPayrollData() {
  if (typeof window === 'undefined') return buildDefaultPayrollData();
  try {
    const raw = window.localStorage.getItem(PAYROLL_STORAGE_KEY);
    if (!raw) return buildDefaultPayrollData();
    return normalizePayrollData(JSON.parse(raw));
  } catch {
    return buildDefaultPayrollData();
  }
}

export function savePayrollData(data) {
  if (typeof window === 'undefined') return;
  const normalized = normalizePayrollData(data);
  window.localStorage.setItem(PAYROLL_STORAGE_KEY, JSON.stringify(normalized));
}

export function getPayrollEmployees() {
  const data = loadPayrollData();
  return (data.employees || []).map((employee) => ({ id: employee.id, name: employee.name }));
}

export function addSalaryDeductionToPayroll({ employeeId, amount, date, orderId, notes }) {
  const data = loadPayrollData();
  const targetIndex = data.employees.findIndex((employee) => employee.id === employeeId);
  if (targetIndex === -1) return { ok: false, reason: 'employee_not_found' };

  const employee = data.employees[targetIndex];
  const deduction = {
    id: createId('ded'),
    date: toDateOnly(date || new Date()),
    type: 'Cash Advance',
    amount: roundToCurrency(amount),
    notes: notes || 'Salary deduction from cashier checkout',
    source: SALARY_DEDUCTION_SOURCE,
    processed: true,
    orderId: orderId || null,
  };

  const next = {
    ...data,
    employees: data.employees.map((item, idx) => (
      idx === targetIndex
        ? { ...item, deductions: [...(item.deductions || []), deduction] }
        : item
    )),
  };

  savePayrollData(next);
  return { ok: true, data: next, deduction };
}

export {
  PAYROLL_STORAGE_KEY,
  PAYROLL_CYCLE_DAYS,
  DAILY_PAYROLL_RATE,
  SALARY_DEDUCTION_SOURCE,
  createId,
  roundToCurrency,
};
