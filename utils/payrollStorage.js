const PAYROLL_STORAGE_KEY = 'bbc_payroll_attendance_v1';
const PAYROLL_CYCLE_DAYS = 15;
const PAYROLL_CYCLES_PER_MONTH = 2;
const WORKING_DAYS_PER_CYCLE = 15;
const SALARY_DEDUCTION_SOURCE = 'cashier_salary_deduction';
const PAYROLL_SUBMISSION_REFERENCE_PREFIX = 'PAYROLL';

function parseDateValue(value) {
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const [, yearRaw, monthRaw, dayRaw] = match;
      // Build local calendar dates directly so YYYY-MM-DD values do not shift across months in non-UTC timezones.
      return new Date(Number(yearRaw), Number(monthRaw) - 1, Number(dayRaw));
    }
  }
  const parsed = value ? new Date(value) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function toDateOnly(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = parseDateValue(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function createId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function roundToCurrency(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function dateToTimestamp(dateIso) {
  return parseDateValue(dateIso).getTime();
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
  const start = parseDateValue(startDate);
  const year = start.getFullYear();
  const month = start.getMonth();
  const startDay = start.getDate();
  if (startDay <= 15) return new Date(year, month, 15);
  return new Date(year, month + 1, 0);
}

function normalizeCycleStartDate(cycleStart) {
  const safe = parseDateValue(cycleStart || getDefaultCycleStart());
  const startDay = safe.getDate() <= 15 ? 1 : 16;
  return new Date(safe.getFullYear(), safe.getMonth(), startDay);
}

export function getPayrollPeriodLabel(cycleStart) {
  const safeStart = normalizeCycleStartDate(cycleStart);
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
  const safeStart = normalizeCycleStartDate(cycleStart);
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
  const start = normalizeCycleStartDate(cycleStart);
  const end = deriveCycleEnd(start);
  const days = [];
  let d = new Date(start);
  while (d <= end) {
    const isoDate = toDateOnly(d);
    days.push({
      index: days.length,
      date: isoDate,
      label: d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
      dayLabel: d.toLocaleDateString('en-US', { weekday: 'short' }),
      isSunday: d.getDay() === 0,
      isToday: isoDate === toDateOnly(new Date()),
      isFuture: isFutureDate(isoDate, toDateOnly(new Date())),
    });
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  }
  return days;
}

export function computeEmployeePayrollFigures(employee = {}) {
  const grossPay = roundToCurrency((employee?.monthlyPay || 0) / PAYROLL_CYCLES_PER_MONTH);
  const absentCount = (employee?.daily || []).filter((v) => v === false).length;
  const absences = roundToCurrency((grossPay / WORKING_DAYS_PER_CYCLE) * absentCount);
  const deductions = roundToCurrency((employee?.deductions || []).reduce((sum, d) => sum + (Number(d.amount) || 0), 0));
  const netPay = roundToCurrency(grossPay - absences - deductions);
  return {
    grossPay,
    absences,
    deductions,
    netPay,
  };
}

export function computePayrollSummary(employees = []) {
  return (employees || []).reduce((summary, employee) => {
    const figures = computeEmployeePayrollFigures(employee);
    return {
      grossPay: roundToCurrency(summary.grossPay + figures.grossPay),
      absences: roundToCurrency(summary.absences + figures.absences),
      deductions: roundToCurrency(summary.deductions + figures.deductions),
      netPay: roundToCurrency(summary.netPay + figures.netPay),
    };
  }, {
    grossPay: 0,
    absences: 0,
    deductions: 0,
    netPay: 0,
  });
}

function normalizeSubmittedReport(report) {
  if (!report || typeof report !== 'object') return null;
  const cycleStart = toDateOnly(report.cycleStart || getDefaultCycleStart());
  const cycleDays = getPayrollCycleDays(cycleStart);
  const cycleEnd = toDateOnly(report.cycleEnd || cycleDays[cycleDays.length - 1]?.date || cycleStart);
  return {
    id: report.id || `${PAYROLL_SUBMISSION_REFERENCE_PREFIX}-${cycleStart}`,
    cycleStart,
    cycleEnd,
    periodLabel: String(report.periodLabel || getPayrollPeriodLabel(cycleStart)),
    submittedAt: report.submittedAt || new Date().toISOString(),
    grossPay: roundToCurrency(report.grossPay),
    absences: roundToCurrency(report.absences),
    deductions: roundToCurrency(report.deductions),
    netPay: roundToCurrency(report.netPay),
    paid: Boolean(report.paid),
    paidAt: report.paidAt || null,
    paymentReference: report.paymentReference || null,
    journalReference: report.journalReference || `${PAYROLL_SUBMISSION_REFERENCE_PREFIX}-${cycleStart}`,
  };
}

export function buildDefaultPayrollData() {
  return {
    cycleStart: getDefaultCycleStart(),
    submitted: false,
    submittedAt: null,
    submittedReports: [],
    employees: [],
  };
}

export function normalizePayrollData(rawData) {
  const base = rawData && typeof rawData === 'object' ? rawData : buildDefaultPayrollData();
  const cycleStart = toDateOnly(normalizeCycleStartDate(base.cycleStart || getDefaultCycleStart()));
  const cycleDays = getPayrollCycleDays(cycleStart);
  const employees = Array.isArray(base.employees) ? base.employees : [];

  return {
    cycleStart,
    submitted: Boolean(base.submitted),
    submittedAt: base.submittedAt || null,
    submittedReports: (Array.isArray(base.submittedReports) ? base.submittedReports : [])
      .map((report) => normalizeSubmittedReport(report))
      .filter(Boolean),
    employees: employees
      .map((employee) => {
        const name = String(employee?.name || '').trim();
        if (!name) return null;
        return {
          id: employee?.id || createId('emp'),
          name,
          monthlyPay: roundToCurrency(employee?.monthlyPay ?? 0),
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

export function upsertPayrollSubmissionReport(report) {
  const data = loadPayrollData();
  const normalizedReport = normalizeSubmittedReport(report);
  if (!normalizedReport) return { ok: false, reason: 'invalid_report' };
  const submittedReports = Array.isArray(data.submittedReports) ? data.submittedReports : [];
  const existingIndex = submittedReports.findIndex((item) => item.id === normalizedReport.id);
  const nextReports = existingIndex >= 0
    ? submittedReports.map((item, index) => (index === existingIndex ? normalizedReport : item))
    : [normalizedReport, ...submittedReports];
  const next = {
    ...data,
    submittedReports: nextReports,
  };
  savePayrollData(next);
  return { ok: true, data: next, report: normalizedReport };
}

export function getOutstandingPayrollSubmissions() {
  const data = loadPayrollData();
  return (data.submittedReports || [])
    .filter((report) => !report.paid)
    .sort((a, b) => dateToTimestamp(b.submittedAt || b.cycleEnd) - dateToTimestamp(a.submittedAt || a.cycleEnd));
}

export function markPayrollSubmissionPaid({ reportId, paymentReference, paidAt }) {
  if (!reportId) return { ok: false, reason: 'missing_report_id' };
  const data = loadPayrollData();
  const submittedReports = Array.isArray(data.submittedReports) ? data.submittedReports : [];
  const targetIndex = submittedReports.findIndex((report) => report.id === reportId);
  if (targetIndex === -1) return { ok: false, reason: 'report_not_found' };

  const target = submittedReports[targetIndex];
  const updatedReport = {
    ...target,
    paid: true,
    paidAt: paidAt || new Date().toISOString(),
    paymentReference: paymentReference || target.paymentReference || null,
  };

  const next = {
    ...data,
    submittedReports: submittedReports.map((report, index) => (index === targetIndex ? updatedReport : report)),
  };

  savePayrollData(next);
  return { ok: true, data: next, report: updatedReport };
}

export function isPayrollCyclePaid(cycleStart, submittedReports = []) {
  const normalizedCycleStart = toDateOnly(cycleStart || getDefaultCycleStart());
  return (submittedReports || []).some((report) => report.cycleStart === normalizedCycleStart && report.paid);
}

export {
  PAYROLL_STORAGE_KEY,
  PAYROLL_CYCLE_DAYS,
  PAYROLL_CYCLES_PER_MONTH,
  WORKING_DAYS_PER_CYCLE,
  SALARY_DEDUCTION_SOURCE,
  PAYROLL_SUBMISSION_REFERENCE_PREFIX,
  createId,
  roundToCurrency,
};
