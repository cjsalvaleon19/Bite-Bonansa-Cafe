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

function dateToTimestamp(dateIso) {
  const parsed = new Date(`${dateIso}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function isFutureDate(dateIso, baselineIso) {
  return dateToTimestamp(dateIso) > dateToTimestamp(baselineIso);
}

function getDefaultCycleStart() {
  const now = new Date();
  const day = now.getDate();
  const startDay = day <= 15 ? 1 : 16;
  const start = new Date(now.getFullYear(), now.getMonth(), startDay);
  return toDateOnly(start);
}

function deriveCycleEnd(startDate) {
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return new Date();
  const year = start.getFullYear();
  const month = start.getMonth();
  const startDay = start.getDate();
  if (startDay <= 15) return new Date(year, month, 15);
  return new Date(year, month + 1, 0);
}

export function getPayrollPeriodLabel(cycleStart) {
  const start = new Date(cycleStart || getDefaultCycleStart());
  const safeStart = Number.isNaN(start.getTime()) ? new Date(getDefaultCycleStart()) : start;
  const end = deriveCycleEnd(safeStart);
  const monthLabel = safeStart.toLocaleDateString('en-US', { month: 'short' });
  const endDay = end.getDate();
  return `${monthLabel} ${safeStart.getDate()}-${endDay}`;
}

export function getPayrollCycleStartForPeriod(monthValue, cycleType) {
  const now = new Date();
  const fallbackMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthStr = monthValue || fallbackMonth;
  const [yearRaw, monthRaw] = monthStr.split('-');
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;
  if (!year || Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) return getDefaultCycleStart();
  const startDay = cycleType === 'second' ? 16 : 1;
  return toDateOnly(new Date(year, monthIndex, startDay));
}

export function getPayrollPeriodMeta(cycleStart) {
  const start = new Date(cycleStart || getDefaultCycleStart());
  const safeStart = Number.isNaN(start.getTime()) ? new Date(getDefaultCycleStart()) : start;
  const cycleType = safeStart.getDate() <= 15 ? 'first' : 'second';
  const monthValue = `${safeStart.getFullYear()}-${String(safeStart.getMonth() + 1).padStart(2, '0')}`;
  const secondCycleEnd = new Date(safeStart.getFullYear(), safeStart.getMonth() + 1, 0).getDate();
  return {
    monthValue,
    cycleType,
    firstLabel: `${safeStart.toLocaleDateString('en-US', { month: 'short' })} 1-15`,
    secondLabel: `${safeStart.toLocaleDateString('en-US', { month: 'short' })} 16-${secondCycleEnd}`,
  };
}

function ensureDailyArray(daily = [], cycleDays = []) {
  const today = toDateOnly(new Date());
  return cycleDays.map((d, idx) => {
    if (d.isSunday) return true;
    if (d.date === today) return true;
    const raw = daily[idx];
    if (raw === true || raw === false || raw === null) return raw;
    if (isFutureDate(d.date, today)) return null;
    return true;
  });
}

export function getPayrollCycleDays(cycleStart) {
  const proposedStart = new Date(cycleStart || getDefaultCycleStart());
  const start = Number.isNaN(proposedStart.getTime())
    ? new Date(getDefaultCycleStart())
    : proposedStart;
  const end = deriveCycleEnd(start);
  const count = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
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
      isToday: isoDate === toDateOnly(new Date()),
      isFuture: isFutureDate(isoDate, toDateOnly(new Date())),
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
