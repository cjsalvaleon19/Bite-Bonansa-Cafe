// ─── Admin: Comprehensive Admin Interface ──────────────────────────────────
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import * as Dialog from '@radix-ui/react-dialog';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { supabase } from '../../utils/supabaseClient';
import { useRoleGuard } from '../../utils/useRoleGuard';
import {
  buildDefaultPayrollData,
  PAYROLL_CYCLES_PER_MONTH,
  WORKING_DAYS_PER_CYCLE,
  getPayrollCycleStartForPeriod,
  getPayrollCycleDays,
  getPayrollPeriodMeta,
  loadPayrollData,
  normalizePayrollData,
  PAYROLL_STORAGE_KEY,
  roundToCurrency,
  SALARY_DEDUCTION_SOURCE,
  savePayrollData,
  createId,
} from '../../utils/payrollStorage';

function shiftDateByMonthsClamped(inputDate, deltaMonths) {
  const date = new Date(inputDate);
  const originalDay = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + deltaMonths);
  const maxDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(originalDay, maxDay));
  return date;
}

function shiftDateByYearsClamped(inputDate, deltaYears) {
  const date = new Date(inputDate);
  const originalDay = date.getDate();
  date.setDate(1);
  date.setFullYear(date.getFullYear() + deltaYears);
  const maxDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(originalDay, maxDay));
  return date;
}

function formatShortMonth(dateVal) {
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
}

function formatFinancialCoverageLabel(fromDate, toDate, unit) {
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return String(toDate || '');

  const isSingleDay = fromDate === toDate;
  if (isSingleDay) {
    const day = String(to.getDate()).padStart(2, '0');
    return `${formatShortMonth(to)}${day}`;
  }

  if (unit === 'annual') return String(to.getFullYear());

  const yy = String(to.getFullYear()).slice(-2);
  return `${formatShortMonth(to)}${yy}`;
}

export default function AdminPage() {
  const router = useRouter();
  const { loading: authLoading } = useRoleGuard('admin');

  // ── Session ───────────────────────────────────────────────────────────────
  const [session, setSession] = useState(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: { session: s } }) => setSession(s));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  // ── Active tab ────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('dashboard');

  // ── Global loading/error ──────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ── Dashboard state ───────────────────────────────────────────────────────
  const [dashSubTab, setDashSubTab] = useState('overview');
  const [salesTrend, setSalesTrend] = useState([]);
  const [cashFlowData, setCashFlowData] = useState([]);
  const [cashFlowSummary, setCashFlowSummary] = useState({ inflow: 0, outflow: 0 });
  const [saleableItems, setSaleableItems] = useState([]);
  const [saleableItemsThisMonth, setSaleableItemsThisMonth] = useState([]);
  const [saleableItemsLastMonth, setSaleableItemsLastMonth] = useState([]);
  const [monthlyPnLData, setMonthlyPnLData] = useState([]);
  const [budgetForecastData, setBudgetForecastData] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [stockAlertLoading, setStockAlertLoading] = useState(false);

  // ── Inventory state ───────────────────────────────────────────────────────
  const [inventoryItems, setInventoryItems] = useState([]);
  const [invDialogOpen, setInvDialogOpen] = useState(false);
  const [invEditItem, setInvEditItem] = useState(null);
  const [invForm, setInvForm] = useState({
    name: '', department: 'DKS', code: '', uom: 'pcs', cost_per_unit: '0', current_stock: '0', min_stock: '0',
  });
  const [invDeleteConfirm, setInvDeleteConfirm] = useState(null);
  const [invStatusFilter, setInvStatusFilter] = useState('');
  const [invSearch, setInvSearch] = useState('');
  const [invCoverageMonth, setInvCoverageMonth] = useState(() => new Date().toISOString().slice(0, 7));

  // ── Price Costing state ───────────────────────────────────────────────────
  const [costingHeaders, setCostingHeaders] = useState([]);
  const [costingSearch, setCostingSearch] = useState('');
  const [costingCmStatusFilter, setCostingCmStatusFilter] = useState('');
  const [invItems, setInvItems] = useState([]);
  const [menuItemsList, setMenuItemsList] = useState([]);
  const [costingDialogOpen, setCostingDialogOpen] = useState(false);
  const [costingEditItem, setCostingEditItem] = useState(null);
  const [menuSearchOpen, setMenuSearchOpen] = useState(false);
  const [menuSearchQuery, setMenuSearchQuery] = useState('');
  const [costingForm, setCostingForm] = useState({
    id: null,
    menu_item_name: '',
    menu_category: '',
    menu_item_price: '0', // locked to cashier menu price
    labor_cost: '0',
    overhead_cost: '0',
    wastage_pct: '0',
    wastage_amount: '0',
    contingency_pct: '0',
    contingency_amount: '0',
    contribution_margin_pct: '0',
    contribution_margin_amount: '0',
    lines: [], // [{ id, inventory_item_id, uom, qty, cost_per_unit }]
  });

  // ── Receiving Report state ────────────────────────────────────────────────
  const [rrList, setRrList] = useState([]);
  const [rrDialogOpen, setRrDialogOpen] = useState(false);
  const [rrEditItem, setRrEditItem] = useState(null);
  const [rrForm, setRrForm] = useState({
    rr_number: '',
    vendor_id: '',
    vendor_name: '',
    vendor_address: '',
    vendor_contact: '',
    vendor_tin: '',
    date: new Date().toISOString().split('T')[0],
    terms: '',
    freight_in: '0',
  });
  const [rrLineItems, setRrLineItems] = useState([]);
  const [vendorSearchOpen, setVendorSearchOpen] = useState(false);
  const [vendorSearchQuery, setVendorSearchQuery] = useState('');
  const [vendorResults, setVendorResults] = useState([]);
  const [enrollingVendor, setEnrollingVendor] = useState(false);
  const [newVendorForm, setNewVendorForm] = useState({ name: '', address: '', contact: '', tin: '' });
  const [rrDeleteConfirm, setRrDeleteConfirm] = useState(null);
  const [rrSearch, setRrSearch] = useState('');
  const [rrViewItem, setRrViewItem] = useState(null);
  const [rrViewLineItems, setRrViewLineItems] = useState([]);
  const [rrSaveError, setRrSaveError] = useState('');
  const [savingRR, setSavingRR] = useState(false);

  // ── RR Payment dialog state ───────────────────────────────────────────────
  const [rrPayDialogOpen, setRrPayDialogOpen] = useState(false);
  const [rrPayItem, setRrPayItem] = useState(null);
  const [rrPayForm, setRrPayForm] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    amount: '0',
    payment_mode: 'cash_on_hand',
    reference_number: '',
    notes: '',
  });

  // ── Inventory Report state (date coverage + computed columns) ─────────────
  const [invDateFrom, setInvDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [invDateTo, setInvDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [invReport, setInvReport] = useState([]);

  // ── RR Inventory Item Picker state ────────────────────────────────────────
  const [invPickerOpen, setInvPickerOpen] = useState(null); // row index or null
  const [invPickerQuery, setInvPickerQuery] = useState('');
  const [rrNewItemReturnIdx, setRrNewItemReturnIdx] = useState(null); // row index to re-open picker after new item saved

  // ── Costing Inventory Item Picker state ───────────────────────────────────
  const [costingInvPickerIdx, setCostingInvPickerIdx] = useState(null); // line index or null
  const [costingInvPickerQuery, setCostingInvPickerQuery] = useState('');

  // ── Journal Entries state ─────────────────────────────────────────────────
  const [journalSubTab, setJournalSubTab] = useState('all');
  const [journalSubFilter, setJournalSubFilter] = useState('all');
  const journalMonthFrom = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }, []);
  const journalMonthTo = useMemo(() => {
    const d = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
    return d.toISOString().split('T')[0];
  }, []);
  const [journalDateFrom, setJournalDateFrom] = useState(journalMonthFrom);
  const [journalDateTo, setJournalDateTo] = useState(journalMonthTo);
  const [journalAccountFilter, setJournalAccountFilter] = useState('');
  const [journalAccountDropdownOpen, setJournalAccountDropdownOpen] = useState(false);
  const [journalAccountSearch, setJournalAccountSearch] = useState('');
  const [journalSearch, setJournalSearch] = useState('');
  const [journalData, setJournalData] = useState([]);
  const [journalLoading, setJournalLoading] = useState(false);
  // Derive unique account names from fetched data; includes known default accounts too
  const journalKnownAccounts = useMemo(() => {
    const defaults = [
      'Cash on Hand', 'Cash in Bank',
      'Accounts Payable', 'Accounts Payable - Rewards',
      'Revenue', 'Inventory', "Owner's Capital", 'Retained Earnings',
      'Rewards', 'Cost of Goods Sold',
      'Advances to Employees',
      // Liability accounts
      'Credit Card Payable', 'Spaylater Payable',
      // Income
      'Delivery Income',
      // Operating Expenses
      'Salaries & Wages', 'Utilities', 'Supplies',
      'Repairs & Maintenance', 'Advertising & Marketing',
      'Software Subscriptions', 'Professional Fees', 'Transportation',
      'Meals & Entertainment', 'Auto Expense', 'Rent Expense',
      "Rider's Fee", 'Kitchen Tools', 'Miscellaneous Expense',
      'Depreciation Expense', 'Interest Expense', 'Income Tax Expense',
      // Balance Sheet
      'Kitchen Equipment', 'Accumulated Depreciation',
      'Income Tax Payable', 'Loans Payable',
    ];
    const fromData = (journalData || []).flatMap((r) => [r.debit_account, r.credit_account].filter(Boolean));
    const all = Array.from(new Set([...defaults, ...fromData])).sort();
    return all;
  }, [journalData]);

  // ── Manual Entry state ────────────────────────────────────────────────────
  const [manualEntryNumber, setManualEntryNumber] = useState('');
  const [manualEntryForm, setManualEntryForm] = useState({
    date: new Date().toISOString().split('T')[0],
    name: '',
    reference_number: '',
    description: '',
  });
  const [manualEntryLines, setManualEntryLines] = useState([
    { description: '', account: '', type: 'debit', amount: '' },
  ]);
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError, setManualError] = useState('');
  const [manualSuccess, setManualSuccess] = useState('');
  // Contact picker for manual entry
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const [contactPickerQuery, setContactPickerQuery] = useState('');
  const [contactList, setContactList] = useState([]);
  // New Contact enrollment form (inside contact picker)
  const [newContactMode, setNewContactMode] = useState(false);
  const [newContactForm, setNewContactForm] = useState({ name: '', address: '', contact: '', tin: '' });
  const [newContactSaving, setNewContactSaving] = useState(false);
  const [newContactError, setNewContactError] = useState('');

  // ── Financial Reports state ───────────────────────────────────────────────
  const [finSubTab, setFinSubTab] = useState('cashflow');
  const monthStartStr = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  }, []);
  const monthEndStr = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1, 0);
    return d.toISOString().split('T')[0];
  }, []);
  const [finDateFrom, setFinDateFrom] = useState(monthStartStr);
  const [finDateTo, setFinDateTo] = useState(monthEndStr);
  const [finData, setFinData] = useState(null);
  const [finCompareMode, setFinCompareMode] = useState('previous_periods');
  const [finCompareCount, setFinCompareCount] = useState(0);
  const [finComparePeriod, setFinComparePeriod] = useState('monthly');
  const [finCompareCustomOpen, setFinCompareCustomOpen] = useState(false);
  const [finCompareData, setFinCompareData] = useState([]);
  const [finCompareFull, setFinCompareFull] = useState([]);
  const [salesSubView, setSalesSubView] = useState('general');
  const [salesData, setSalesData] = useState(null);
  const [navGroupOpen, setNavGroupOpen] = useState({
    transactions: false,
    inventory: false,
    financial: false,
    payroll: false,
  });
  // Chart of Accounts state (separate date coverage from finDateFrom/To)
  const [coaDateFrom, setCoaDateFrom] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [coaDateTo, setCoaDateTo] = useState(monthEndStr);
  const [coaData, setCoaData] = useState(null);
  const [coaLoading, setCoaLoading] = useState(false);
  // Editable budget values (persisted in localStorage, keyed by YYYY-MM month)
  const [budgetValues, setBudgetValues] = useState(() => {
    try {
      if (typeof window === 'undefined') return {};
      const currentMonth = new Date().toISOString().slice(0, 7);
      const stored = localStorage.getItem(`bbc_budget_${currentMonth}`);
      if (stored) return JSON.parse(stored);
      // Migrate from old un-keyed storage
      const legacy = localStorage.getItem('bbc_budget_values');
      return legacy ? JSON.parse(legacy) : {};
    } catch { return {}; }
  });
  // Track which budget cell is being edited (for formatted display)
  const [budgetEditKey, setBudgetEditKey] = useState(null);

  // ── Bills state ───────────────────────────────────────────────────────────
  const [billsList, setBillsList] = useState([]);
  const [billDialogOpen, setBillDialogOpen] = useState(false);
  const [billEditItem, setBillEditItem] = useState(null);
  const [billNumber, setBillNumber] = useState('');
  const [billForm, setBillForm] = useState({
    date: new Date().toISOString().split('T')[0],
    contact: '',
    description: '',
  });
  const [billLines, setBillLines] = useState([
    { description: '', account_title: '', debit_amount: '' },
  ]);
  const [billSaving, setBillSaving] = useState(false);
  const [billError, setBillError] = useState('');
  const [billSuccess, setBillSuccess] = useState('');
  const [billSearch, setBillSearch] = useState('');
  const [billDeleteConfirm, setBillDeleteConfirm] = useState(null);
  const [billContactPickerOpen, setBillContactPickerOpen] = useState(false);
  const [billContactQuery, setBillContactQuery] = useState('');
  const [billContactList, setBillContactList] = useState([]);
  const [billAcctPickerIdx, setBillAcctPickerIdx] = useState(null);
  const [billAcctQuery, setBillAcctQuery] = useState('');
  const [billViewItem, setBillViewItem] = useState(null);
  const [billViewLines, setBillViewLines] = useState([]);
  // Pay dialog
  const [billPayDialogOpen, setBillPayDialogOpen] = useState(false);
  const [billPayItem, setBillPayItem] = useState(null);
  const [billPayMethod, setBillPayMethod] = useState('cash_on_hand');
  const [billPaying, setBillPaying] = useState(false);
  const [billPayError, setBillPayError] = useState('');
  // New contact enrollment inside contact picker
  const [billNewContactMode, setBillNewContactMode] = useState(false);
  const [billNewContactForm, setBillNewContactForm] = useState({ name: '', address: '', contact: '', tin: '' });
  const [billNewContactSaving, setBillNewContactSaving] = useState(false);
  const [billNewContactError, setBillNewContactError] = useState('');

  // ── Payroll / Attendance Sheet state ───────────────────────────────────────
  const [payrollData, setPayrollData] = useState(() => normalizePayrollData(buildDefaultPayrollData()));
  const [payrollCycleDays, setPayrollCycleDays] = useState(() => getPayrollCycleDays());
  const [payrollMessage, setPayrollMessage] = useState('');
  const [newPayrollEmployeeName, setNewPayrollEmployeeName] = useState('');
  const [payrollSelectedEmployeeId, setPayrollSelectedEmployeeId] = useState('');
  const [deductionDialogEmployeeId, setDeductionDialogEmployeeId] = useState(null);
  const [deductionForm, setDeductionForm] = useState({
    id: null,
    date: new Date().toISOString().split('T')[0],
    type: 'Cash Advance',
    amount: '',
    notes: '',
  });

  // ── My Profile state ──────────────────────────────────────────────────────
  const [profileData, setProfileData] = useState(null);
  const [profileEditMode, setProfileEditMode] = useState(false);
  const [profileForm, setProfileForm] = useState({ full_name: '', phone: '', address: '' });
  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const [pwForm, setPwForm] = useState({ newPass: '', confirmPass: '' });
  const [pwError, setPwError] = useState('');

  // ── Fetch: Dashboard ──────────────────────────────────────────────────────
  const fetchDashboard = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    try {
      // ── Compute 4 Mon–Sun weeks ending with current week ──────────────────
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0=Sun … 6=Sat
      const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const thisMonday = new Date(now);
      thisMonday.setDate(now.getDate() + diffToMon);
      thisMonday.setHours(0, 0, 0, 0);

      // weekStarts[0] = oldest (3 weeks back), weekStarts[3] = current week
      const weekStarts = Array.from({ length: 12 }, (_, i) => {
        const d = new Date(thisMonday);
        d.setDate(thisMonday.getDate() - (11 - i) * 7);
        return d;
      });
      const sinceISO = weekStarts[0].toISOString();
      const sinceDateStr = weekStarts[0].toISOString().split('T')[0];

      const fmtWeekLabel = (start) => {
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        const fmt = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
        return `${fmt(start)}–${fmt(end)}`;
      };

      const getWeekIdx = (dateVal) => {
        // For date-only strings (YYYY-MM-DD) append T00:00:00 so JS parses them in local time,
        // consistent with weekStarts which are also computed in local time.
        const d = typeof dateVal === 'string' ? new Date(dateVal.includes('T') ? dateVal : dateVal + 'T00:00:00') : new Date(dateVal);
        for (let i = 11; i >= 0; i--) {
          if (d >= weekStarts[i]) return i;
        }
        return -1;
      };

      // ── Sales Trend (from orders) ─────────────────────────────────────────
      const { data: orders } = await supabase
        .from('orders')
        .select('total, created_at')
        .gte('created_at', sinceISO);

      if (orders) {
        const weeks = Array(12).fill(0);
        orders.forEach((o) => {
          const idx = getWeekIdx(o.created_at);
          if (idx >= 0) weeks[idx] += Number(o.total) || 0;
        });
        setSalesTrend(weekStarts.map((start, i) => ({ week: fmtWeekLabel(start), sales: weeks[i] })));
      }

      // ── Cash Flow (from Journal Entries – Cash on Hand + Cash in Bank) ─────
      const CASH_ACCOUNTS = ['Cash on Hand', 'Cash in Bank'];
      const { data: cashJE } = await supabase
        .from('journal_entries')
        .select('amount, debit_account, credit_account, date')
        .gte('date', sinceDateStr);

      if (cashJE) {
        const weeks = weekStarts.map((start, i) => ({ week: fmtWeekLabel(start), inflow: 0, outflow: 0 }));
        cashJE.forEach((je) => {
          const idx = getWeekIdx(je.date);
          if (idx < 0) return;
          const amt = Number(je.amount) || 0;
          const debitAcct = String(je.debit_account || '').trim();
          const creditAcct = String(je.credit_account || '').trim();
          if (CASH_ACCOUNTS.includes(debitAcct)) weeks[idx].inflow += amt;
          if (CASH_ACCOUNTS.includes(creditAcct)) weeks[idx].outflow += amt;
        });
        setCashFlowData(weeks);
        const totalIn = weeks.reduce((s, w) => s + w.inflow, 0);
        const totalOut = weeks.reduce((s, w) => s + w.outflow, 0);
        setCashFlowSummary({ inflow: totalIn, outflow: totalOut });
      }

      // ── Saleable items: ranked by quantity sold this month vs last month ──
      const now2 = new Date();
      const thisMonthStart = new Date(now2.getFullYear(), now2.getMonth(), 1).toISOString();
      const lastMonthStart = new Date(now2.getFullYear(), now2.getMonth() - 1, 1).toISOString();
      const lastMonthEnd = new Date(now2.getFullYear(), now2.getMonth(), 1).toISOString();

      const [{ data: tmItems }, { data: lmItems }] = await Promise.all([
        supabase
          .from('order_items')
          .select('name, quantity')
          .gte('created_at', thisMonthStart),
        supabase
          .from('order_items')
          .select('name, quantity')
          .gte('created_at', lastMonthStart)
          .lt('created_at', lastMonthEnd),
      ]);

      const aggregate = (rows) => {
        const map = {};
        (rows || []).forEach((r) => { map[r.name] = (map[r.name] || 0) + (Number(r.quantity) || 1); });
        return Object.entries(map)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([name, qty]) => ({ name, qty }));
      };
      setSaleableItemsThisMonth(aggregate(tmItems));
      setSaleableItemsLastMonth(aggregate(lmItems));

      // ── Monthly Profit & Loss + Budget Forecast (last 6 months) ───────────
      const OPEX_ACCOUNTS = [
        'Salaries & Wages', 'Utilities', 'Supplies', 'Repairs & Maintenance',
        'Advertising & Marketing', 'Software Subscriptions', 'Professional Fees',
        'Transportation', 'Meals & Entertainment', 'Auto Expense', 'Rent Expense',
        'Kitchen Tools', 'Miscellaneous Expense', "Rider's Fee", 'Depreciation Expense',
        'Research and Development Expense',
      ];
      const now3 = new Date();
      const monthStarts = Array.from({ length: 6 }, (_, i) => new Date(now3.getFullYear(), now3.getMonth() - (5 - i), 1));
      const firstMonthStart = monthStarts[0];
      const firstMonthDateStr = firstMonthStart.toISOString().split('T')[0];
      const firstMonthISO = firstMonthStart.toISOString();
      const monthLabel = (d) => d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
      const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      const [{ data: plJe }, { data: deliveryFees }] = await Promise.all([
        supabase
          .from('journal_entries')
          .select('amount, date, debit_account, credit_account')
          .gte('date', firstMonthDateStr),
        supabase
          .from('orders')
          .select('delivery_fee, created_at')
          .in('status', ['order_delivered', 'completed'])
          .gte('created_at', firstMonthISO)
          .gt('delivery_fee', 0),
      ]);

      const monthMap = {};
      monthStarts.forEach((d) => {
        monthMap[monthKey(d)] = { month: monthLabel(d), revenue: 0, deliveryIncome: 0, cogs: 0, opExp: 0, totalRevenue: 0, netProfit: 0 };
      });

      (plJe || []).forEach((je) => {
        const key = (je.date || '').slice(0, 7);
        if (!monthMap[key]) return;
        const amt = Number(je.amount) || 0;
        if (['Revenue', 'Sales Revenue'].includes(je.credit_account)) monthMap[key].revenue += amt;
        if (je.debit_account === 'Cost of Goods Sold') monthMap[key].cogs += amt;
        if (OPEX_ACCOUNTS.includes(je.debit_account)) monthMap[key].opExp += amt;
      });
      (deliveryFees || []).forEach((o) => {
        const key = (o.created_at || '').slice(0, 7);
        if (!monthMap[key]) return;
        monthMap[key].deliveryIncome += Number(o.delivery_fee) || 0;
      });

      const pnlRows = monthStarts.map((d) => {
        const key = monthKey(d);
        const row = monthMap[key];
        row.totalRevenue = row.revenue + row.deliveryIncome;
        row.netProfit = row.totalRevenue - row.cogs - row.opExp;
        return row;
      });
      setMonthlyPnLData(pnlRows);

      const getBudgetTotals = (raw) => {
        const obj = raw || {};
        const totalRevenue = (Number(obj['Revenue']) || 0) + (Number(obj['Delivery Income']) || 0);
        const cogs = Number(obj['Cost of Goods Sold']) || 0;
        const opExp = OPEX_ACCOUNTS.reduce((s, a) => s + (Number(obj[a]) || 0), 0);
        return { totalRevenue, cogs, opExp, netProfit: totalRevenue - cogs - opExp };
      };

      let carryBudget = {};
      if (typeof window !== 'undefined') {
        const firstKey = monthKey(monthStarts[0]);
        const [yr, mo] = firstKey.split('-').map(Number);
        const prevYear = mo === 1 ? yr - 1 : yr;
        const prevMonthNum = mo === 1 ? 12 : mo - 1;
        const prevMonth = `${prevYear}-${String(prevMonthNum).padStart(2, '0')}`;
        const prevStored = localStorage.getItem(`bbc_budget_${prevMonth}`);
        carryBudget = prevStored ? JSON.parse(prevStored) : {};
      }

      const forecastRows = monthStarts.map((d, idx) => {
        const key = monthKey(d);
        let budgetObj = carryBudget;
        if (typeof window !== 'undefined') {
          const stored = localStorage.getItem(`bbc_budget_${key}`);
          if (stored) budgetObj = JSON.parse(stored);
          carryBudget = budgetObj;
        }
        const totals = getBudgetTotals(budgetObj);
        return {
          month: monthLabel(d),
          budgetRevenue: totals.totalRevenue,
          actualRevenue: pnlRows[idx]?.totalRevenue || 0,
          budgetCogs: totals.cogs,
          actualCogs: pnlRows[idx]?.cogs || 0,
          budgetOpExp: totals.opExp,
          actualOpExp: pnlRows[idx]?.opExp || 0,
          budgetNetProfit: totals.netProfit,
          actualNetProfit: pnlRows[idx]?.netProfit || 0,
        };
      });
      setBudgetForecastData(forecastRows);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch: Inventory (with Beginning / Purchases / Sold / Ending) ────────
  const fetchInventory = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      // 1. All inventory items
      const { data: items, error: err } = await supabase
        .from('admin_inventory_items')
        .select('*')
        .eq('is_archived', false)
        .order('code');
      if (err) throw err;
      setInventoryItems(items || []);

      // 2 + 3. Line items for the selected date range — Purchases = "paid" status only
      // NOTE: .eq() on a joined table in Supabase only nullifies the join, it does NOT
      // filter parent rows.  We must first fetch paid RR IDs then filter by them.
      const { data: paidRRsInRange } = await supabase
        .from('receiving_reports')
        .select('id')
        .eq('status', 'paid')
        .gte('date', invDateFrom)
        .lte('date', invDateTo);
      const paidRRIdsInRange = (paidRRsInRange || []).map((r) => r.id);
      let rrItems = [];
      if (paidRRIdsInRange.length > 0) {
        const { data: rrItemsRaw, error: riErr } = await supabase
          .from('receiving_report_items')
          .select('inventory_item_id, inventory_name, qty, cost, total_landed_cost')
          .in('receiving_report_id', paidRRIdsInRange);
        if (riErr) throw new Error('Failed to fetch receiving report items: ' + riErr.message);
        rrItems = rrItemsRaw || [];
      }

      // 1.3: In Transit = ALL "draft" status receiving reports (no date filter)
      const { data: draftRRs } = await supabase
        .from('receiving_reports')
        .select('id')
        .eq('status', 'draft');
      const draftRRIds = (draftRRs || []).map((r) => r.id);
      let inTransitItems = [];
      if (draftRRIds.length > 0) {
        const { data: inTransitRaw } = await supabase
          .from('receiving_report_items')
          .select('inventory_item_id, inventory_name, qty')
          .in('receiving_report_id', draftRRIds);
        inTransitItems = inTransitRaw || [];
      }

      // 2b + 3b. Line items from Jan 1, 2026 → invDateTo for Average Cost
      // 1.4: Beginning Balance = "paid" status only (Jan 1, 2026 → start date − 1 day)
      const AVG_COST_START = '2026-01-01';
      const { data: allPaidRRs } = await supabase
        .from('receiving_reports')
        .select('id')
        .eq('status', 'paid')
        .gte('date', AVG_COST_START)
        .lte('date', invDateTo);
      const allPaidRRIds = (allPaidRRs || []).map((r) => r.id);
      let allPeriodItems = [];
      if (allPaidRRIds.length > 0) {
        const { data: allPeriodItemsRaw, error: ri2Err } = await supabase
          .from('receiving_report_items')
          .select('inventory_item_id, inventory_name, qty, cost, total_landed_cost')
          .in('receiving_report_id', allPaidRRIds);
        if (ri2Err) throw new Error('Failed to fetch all-period receiving report items: ' + ri2Err.message);
        allPeriodItems = allPeriodItemsRaw || [];
      }

      // 4. Price costing map (menu_item_name → inventory usage)
      const { data: costings } = await supabase
        .from('price_costing_items')
        .select('inventory_item_id, menu_item_name, qty');

      // 5. Delivered/completed orders with items in date range
      // 1.5: Sold = "order_delivered" + "completed" statuses
      const fromISO = new Date(invDateFrom + 'T00:00:00').toISOString();
      const toISO = new Date(invDateTo + 'T23:59:59.999').toISOString();
      const { data: orders } = await supabase
        .from('orders')
        .select('id, order_items(name, quantity)')
        .in('status', ['order_delivered', 'completed'])
        .gte('created_at', fromISO)
        .lte('created_at', toISO);

      // Build costing map: menu_item_name -> [{ inventory_item_id, qty }]
      const costingMap = {};
      (costings || []).forEach((c) => {
        if (!c.inventory_item_id) return;
        if (!costingMap[c.menu_item_name]) costingMap[c.menu_item_name] = [];
        costingMap[c.menu_item_name].push({ inventory_item_id: c.inventory_item_id, qty: Number(c.qty) || 0 });
      });

      // Build sold map: inventory_item_id -> total qty consumed
      const soldMap = {};
      (orders || []).forEach((order) => {
        (order.order_items || []).forEach((oi) => {
          (costingMap[oi.name] || []).forEach(({ inventory_item_id, qty }) => {
            soldMap[inventory_item_id] = (soldMap[inventory_item_id] || 0) + (Number(oi.quantity) || 0) * qty;
          });
        });
      });

      // Build name→id lookup for fallback when inventory_item_id is null
      const nameToIdMap = {};
      (items || []).forEach((inv) => {
        nameToIdMap[(inv.name || '').toLowerCase().trim()] = inv.id;
      });

      // Build purchases map (period): inventory_item_id -> { qty, totalCost, totalLandedCost }
      const purchasesMap = {};
      rrItems.forEach((ri) => {
        // Resolve the inventory item id — prefer the stored FK, fall back to name match
        const resolvedId = ri.inventory_item_id
          || nameToIdMap[(ri.inventory_name || '').toLowerCase().trim()];
        if (!resolvedId) return;
        if (!purchasesMap[resolvedId]) purchasesMap[resolvedId] = { qty: 0, totalCost: 0, totalLandedCost: 0 };
        const q = Number(ri.qty) || 0;
        const c = Number(ri.cost) || 0;
        purchasesMap[resolvedId].qty += q;
        purchasesMap[resolvedId].totalCost += q * c;
        purchasesMap[resolvedId].totalLandedCost += Number(ri.total_landed_cost) || 0;
      });

      // Build in-transit map (draft RRs in date range): inventory_item_id -> qty
      const inTransitMap = {};
      inTransitItems.forEach((ri) => {
        const resolvedId = ri.inventory_item_id
          || nameToIdMap[(ri.inventory_name || '').toLowerCase().trim()];
        if (!resolvedId) return;
        inTransitMap[resolvedId] = (inTransitMap[resolvedId] || 0) + (Number(ri.qty) || 0);
      });

      // Build all-period purchases map (Jan 1, 2026 → invDateTo): for Average Cost/Unit
      // Average Cost/Unit = Total Landed Cost / Total Purchase Qty (full period)
      const allPeriodPurchasesMap = {};
      allPeriodItems.forEach((ri) => {
        const resolvedId = ri.inventory_item_id
          || nameToIdMap[(ri.inventory_name || '').toLowerCase().trim()];
        if (!resolvedId) return;
        if (!allPeriodPurchasesMap[resolvedId]) allPeriodPurchasesMap[resolvedId] = { qty: 0, totalLandedCost: 0 };
        allPeriodPurchasesMap[resolvedId].qty += Number(ri.qty) || 0;
        // total_landed_cost = (qty * cost) + freight_allocated (DB-generated column)
        allPeriodPurchasesMap[resolvedId].totalLandedCost += Number(ri.total_landed_cost) || 0;
      });

      // Compute report rows
      // Beginning = Total Qty Purchased (Jan 1, 2026 → start date − 1 day) [paid only]
      //           = allPeriodQty (Jan 1 → end date) − purchases (start date → end date)
      // Purchases = Total Qty Purchased in the selected period [paid only]
      // In Transit= Total Qty in draft RRs in the selected period
      // Sold      = Total Qty Sold in the selected period [order_delivered + completed]
      // Ending    = Beginning + Purchases − Sold (derived)
      // avg_cost  = Total Landed Cost (Jan 1, 2026 → end date) / Total Purchase Qty (same range)
      // total_cost = Ending Qty × avg_cost
      const report = (items || []).map((item) => {
        const purchases = purchasesMap[item.id]?.qty || 0;
        const inTransit = inTransitMap[item.id] || 0;
        const sold = soldMap[item.id] || 0;
        const allPeriodQty = allPeriodPurchasesMap[item.id]?.qty || 0;
        const allPeriodAmt = allPeriodPurchasesMap[item.id]?.totalLandedCost || 0;
        const beginning = allPeriodQty - purchases;
        const ending = beginning + purchases - sold;
        const avg_cost = allPeriodQty > 0
          ? allPeriodAmt / allPeriodQty
          : (Number(item.cost_per_unit) || 0);
        return { ...item, beginning, purchases, inTransit, sold, ending, avg_cost };
      });

      setInvReport(report);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [invDateFrom, invDateTo]);

  // ── Fetch: Low & Out of Stock Items ──────────────────────────────────────
  const fetchLowStockItems = useCallback(async () => {
    if (!supabase) return;
    setStockAlertLoading(true);
    try {
      const { data: items, error: err } = await supabase
        .from('admin_inventory_items')
        .select('*')
        .eq('is_archived', false)
        .order('code');
      if (err) throw err;
      const alerts = (items || []).filter((item) => {
        const stock = Number(item.current_stock) || 0;
        const minStock = Number(item.min_stock) || 0;
        return stock <= minStock;
      });
      // For each alert item, try to find the last vendor that supplied it
      if (alerts.length > 0) {
        const itemIds = alerts.map((i) => i.id);
        // Two-step: get RR IDs that have these items, then join with vendor
        const { data: rrItemsData } = await supabase
          .from('receiving_report_items')
          .select('inventory_item_id, receiving_report_id')
          .in('inventory_item_id', itemIds);
        const rrIds = [...new Set((rrItemsData || []).map((r) => r.receiving_report_id))];
        let vendorMap = {};
        if (rrIds.length > 0) {
          const { data: rrs } = await supabase
            .from('receiving_reports')
            .select('id, vendor_id, vendor:vendors(id, name)')
            .in('id', rrIds)
            .order('date', { ascending: false });
          // Build inventory_item_id -> last vendor
          (rrItemsData || []).forEach((ri) => {
            if (vendorMap[ri.inventory_item_id]) return; // already set (most recent first)
            const rr = (rrs || []).find((r) => r.id === ri.receiving_report_id);
            if (rr?.vendor) {
              vendorMap[ri.inventory_item_id] = { id: rr.vendor_id, name: rr.vendor.name };
            }
          });
        }
        setLowStockItems(alerts.map((item) => ({
          ...item,
          lastVendor: vendorMap[item.id] || null,
          status: Number(item.current_stock) <= 0 ? 'Out of Stock' : 'Low Stock',
        })));
      } else {
        setLowStockItems([]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setStockAlertLoading(false);
    }
  }, []);

  // ── Fetch: Bills ──────────────────────────────────────────────────────────
  const fetchBills = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('bills')
        .select('*')
        .order('bill_number', { ascending: false })
        .order('created_at', { ascending: false });
      if (err) throw err;
      setBillsList(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Bills: Generate Bill Number ───────────────────────────────────────────
  const generateBillNumber = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.rpc('generate_bill_number');
      if (!error && data) {
        setBillNumber(data);
        return;
      }
      // Fallback: manual generation
      const yy = new Date().getFullYear().toString().slice(-2);
      const prefix = `Bill#-${yy}`;
      const { data: last } = await supabase
        .from('bills')
        .select('bill_number')
        .like('bill_number', `${prefix}%`)
        .order('bill_number', { ascending: false })
        .limit(1);
      let seq = 1;
      if (last && last.length > 0 && last[0].bill_number) {
        const n = parseInt(last[0].bill_number.slice(prefix.length), 10);
        if (!isNaN(n)) seq = n + 1;
      }
      setBillNumber(`${prefix}${String(seq).padStart(6, '0')}`);
    } catch {
      setBillNumber('');
    }
  }, []);

  // ── Bills: Save Bill ──────────────────────────────────────────────────────
  const saveBill = useCallback(async () => {
    if (!supabase) return;
    setBillSaving(true);
    setBillError('');
    setBillSuccess('');
    try {
      if (!billForm.date) throw new Error('Please enter a date.');
      if (!billForm.contact || !String(billForm.contact).trim()) throw new Error('Contact name is required.');
      const validLines = billLines.filter((l) => l.account_title || l.debit_amount);
      if (validLines.length === 0) throw new Error('Please add at least one line item.');
      const totalDebit = validLines.reduce((s, l) => s + (Number(l.debit_amount) || 0), 0);
      // total_credit equals total_debit — credited to Accounts Payable automatically
      const totalCredit = totalDebit;

      const payload = {
        bill_number: billNumber,
        contact: billForm.contact || null,
        date: billForm.date,
        description: billForm.description || null,
        total_debit: totalDebit,
        total_credit: totalCredit,
        status: billEditItem?.status === 'approved' || billEditItem?.status === 'paid' ? billEditItem.status : 'draft',
        updated_at: new Date().toISOString(),
      };

      let billId = billEditItem?.id;
      if (billId) {
        await supabase.from('bills').update(payload).eq('id', billId);
        await supabase.from('bill_items').delete().eq('bill_id', billId);
      } else {
        const { data: inserted, error: insErr } = await supabase
          .from('bills')
          .insert({ ...payload, created_at: new Date().toISOString() })
          .select()
          .single();
        if (insErr) throw insErr;
        billId = inserted.id;
      }

      if (validLines.length > 0) {
        const lineRows = validLines.map((l) => ({
          bill_id: billId,
          description: l.description || null,
          account_title: l.account_title || null,
          debit_amount: Number(l.debit_amount) || 0,
          credit_amount: 0,
        }));
        const { error: lineErr } = await supabase.from('bill_items').insert(lineRows);
        if (lineErr) throw lineErr;
      }

      setBillSuccess(`Bill ${billNumber} saved successfully.`);
      setBillDialogOpen(false);
      await fetchBills();
      await generateBillNumber();
    } catch (err) {
      setBillError(err.message);
    } finally {
      setBillSaving(false);
    }
  }, [supabase, billForm, billLines, billNumber, billEditItem, fetchBills, generateBillNumber]);

  // ── Bills: Open dialog ────────────────────────────────────────────────────
  const openBillDialog = async (item = null) => {
    setBillEditItem(item);
    setBillError('');
    setBillSuccess('');
    if (item) {
      setBillForm({
        date: item.date || new Date().toISOString().split('T')[0],
        contact: item.contact || '',
        description: item.description || '',
      });
      setBillNumber(item.bill_number || '');
      if (supabase) {
        try {
          const { data: lines } = await supabase
            .from('bill_items')
            .select('*')
            .eq('bill_id', item.id);
          setBillLines((lines && lines.length > 0) ? lines.map((l) => ({
            description: l.description || '',
            account_title: l.account_title || '',
            debit_amount: String(l.debit_amount || ''),
          })) : [{ description: '', account_title: '', debit_amount: '' }]);
        } catch {
          setBillLines([{ description: '', account_title: '', debit_amount: '' }]);
        }
      }
    } else {
      setBillForm({ date: new Date().toISOString().split('T')[0], contact: '', description: '' });
      setBillLines([{ description: '', account_title: '', debit_amount: '' }]);
      await generateBillNumber();
    }
    setBillDialogOpen(true);
  };

  // ── Bills: Approve bill ───────────────────────────────────────────────────
  const approveBill = async (bill) => {
    if (!supabase) return;
    if (!window.confirm(`Approve Bill ${bill.bill_number}? This will record Journal Entries.`)) return;
    try {
      // Fetch line items
      const { data: lines, error: lErr } = await supabase.from('bill_items').select('*').eq('bill_id', bill.id);
      if (lErr) throw lErr;
      const validLines = (lines || []).filter((l) => l.account_title && (Number(l.debit_amount) || 0) > 0);
      if (validLines.length === 0) throw new Error('No valid line items to approve.');
      const today = new Date().toISOString().split('T')[0];
      // Create a JE per line: Dr [account_title] / Cr Accounts Payable
      const jeRows = validLines.map((l) => ({
        date: today,
        debit_account: l.account_title,
        credit_account: 'Accounts Payable',
        amount: Number(l.debit_amount),
        description: `Bill ${bill.bill_number}${l.description ? ' – ' + l.description : ''}`,
        reference_type: 'bill',
        reference: bill.id,
      }));
      const { error: jeErr } = await supabase.from('journal_entries').insert(jeRows);
      if (jeErr) throw jeErr;
      // Update bill status
      const { error: updErr } = await supabase.from('bills').update({ status: 'approved', updated_at: new Date().toISOString() }).eq('id', bill.id);
      if (updErr) throw updErr;
      await fetchBills();
      setBillSuccess(`Bill ${bill.bill_number} approved. Journal entries recorded.`);
    } catch (err) {
      setError(err.message);
    }
  };

  // ── Bills: Pay bill ───────────────────────────────────────────────────────
  const payBill = async () => {
    if (!supabase || !billPayItem) return;
    setBillPaying(true);
    setBillPayError('');
    try {
      const creditAccount = billPayMethod === 'cash_on_hand' ? 'Cash on Hand'
        : billPayMethod === 'cash_in_bank' ? 'Cash in Bank'
        : billPayMethod === 'spaylater' ? 'Spaylater Payable'
        : 'Credit Card Payable'; // credit card
      const today = new Date().toISOString().split('T')[0];
      const jeRow = {
        date: today,
        debit_account: 'Accounts Payable',
        credit_account: creditAccount,
        amount: Number(billPayItem.total_debit) || 0,
        description: `Payment for Bill ${billPayItem.bill_number}`,
        reference_type: 'bill',
        reference: billPayItem.id,
      };
      const { error: jeErr } = await supabase.from('journal_entries').insert([jeRow]);
      if (jeErr) throw jeErr;
      const { error: updErr } = await supabase.from('bills').update({
        status: 'paid',
        payment_method: billPayMethod,
        updated_at: new Date().toISOString(),
      }).eq('id', billPayItem.id);
      if (updErr) throw updErr;
      setBillPayDialogOpen(false);
      setBillPayItem(null);
      await fetchBills();
      setBillSuccess(`Bill ${billPayItem.bill_number} marked as paid.`);
    } catch (err) {
      setBillPayError(err.message);
    } finally {
      setBillPaying(false);
    }
  };

  // ── Bills: Save new contact (vendor enrollment) ───────────────────────────
  const saveNewBillContact = async () => {
    if (!supabase) return;
    if (!billNewContactForm.name.trim()) { setBillNewContactError('Name is required.'); return; }
    setBillNewContactSaving(true);
    setBillNewContactError('');
    try {
      const { data: inserted, error: err } = await supabase.from('vendors').insert({
        name: billNewContactForm.name.trim(),
        address: billNewContactForm.address || null,
        contact_number: billNewContactForm.contact || null,
        tin: billNewContactForm.tin || null,
      }).select().single();
      if (err) throw err;
      // Auto-select the new contact
      setBillForm((p) => ({ ...p, contact: inserted.name }));
      setBillContactPickerOpen(false);
      setBillNewContactMode(false);
      setBillNewContactForm({ name: '', address: '', contact: '', tin: '' });
    } catch (err) {
      setBillNewContactError(err.message);
    } finally {
      setBillNewContactSaving(false);
    }
  };

  // ── Bills: View bill ──────────────────────────────────────────────────────
  const viewBill = async (item) => {
    setBillViewItem(item);
    if (supabase) {
      const { data: lines } = await supabase.from('bill_items').select('*').eq('bill_id', item.id);
      setBillViewLines(lines || []);
    }
  };

  // ── Bills: Fetch contacts for bills ──────────────────────────────────────
  const fetchBillContacts = useCallback(async (q) => {
    if (!supabase) return;
    try {
      const [{ data: vends }, { data: usrs }] = await Promise.all([
        supabase.from('vendors').select('id, name').ilike('name', `%${q}%`).limit(10),
        supabase.from('users').select('id, full_name, role').ilike('full_name', `%${q}%`).limit(10),
      ]);
      const combined = [
        ...(vends || []).map((v) => ({ id: v.id, name: v.name, type: 'Vendor' })),
        ...(usrs || []).map((u) => ({ id: u.id, name: u.full_name, type: u.role })),
      ];
      setBillContactList(combined);
    } catch {
      setBillContactList([]);
    }
  }, []);

  // ── Fetch: Price Costing ──────────────────────────────────────────────────
  const fetchCosting = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const [{ data: headers, error: e1 }, { data: inv, error: e2 }, { data: menus }] = await Promise.all([
        supabase
          .from('price_costing_headers')
          .select('*, lines:price_costing_items(id, inventory_item_id, uom, qty, cost, inventory_item:admin_inventory_items(id,name,code,uom,cost_per_unit))')
          .order('menu_item_name'),
        supabase.from('admin_inventory_items').select('*').order('name'),
        supabase.from('menu_items').select('id, name, category, price, base_price, has_variants, menu_item_variant_types(id, variant_type_name, is_required, options:menu_item_variant_options(id, option_name, price_modifier, available))').eq('available', true).order('name'),
      ]);
      if (e1) {
        if (e1.message && e1.message.includes('price_costing_headers')) {
          throw new Error(
            'Table "price_costing_headers" not found. Please apply migration 114 in Supabase SQL Editor. See supabase/migrations/RUN_MIGRATION_114.md for instructions.'
          );
        }
        throw e1;
      }
      if (e2) throw e2;
      setCostingHeaders(headers || []);
      setInvItems(inv || []);
      setMenuItemsList(menus || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch: Receiving Reports ──────────────────────────────────────────────
  const fetchRR = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const [{ data: rrData, error: rrErr }, { data: inv }] = await Promise.all([
        supabase
          .from('receiving_reports')
          .select('*, vendor:vendors(name)')
          .order('rr_number', { ascending: false }),
        supabase.from('admin_inventory_items').select('*').order('name'),
      ]);
      if (rrErr) throw rrErr;
      setRrList(rrData || []);
      setInvItems(inv || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const FIN_CASH_ACCOUNTS = useMemo(() => ['Cash on Hand', 'Cash in Bank'], []);
  const FIN_PPE_ACCOUNTS = useMemo(() => ['Kitchen Equipment', 'Furniture & Fixture', 'Machinery & Equipment'], []);
  const FIN_OPEX_ACCOUNTS = useMemo(() => ([
    'Salaries & Wages', 'Utilities', 'Supplies', 'Repairs & Maintenance',
    'Advertising & Marketing', 'Software Subscriptions', 'Professional Fees',
    'Transportation', 'Meals & Entertainment', 'Auto Expense', 'Rent Expense',
    'Kitchen Tools', 'Miscellaneous Expense', "Rider's Fee", 'Depreciation Expense',
    'Interest Expense', 'Research and Development Expense',
  ]), []);

  // ── Fetch: Financial Reports ──────────────────────────────────────────────
  const fetchFinancial = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const fromISO = new Date(finDateFrom).toISOString();
      const toDate = new Date(finDateTo);
      toDate.setHours(23, 59, 59, 999);
      const toISO = toDate.toISOString();
      const dateFrom = fromISO.split('T')[0];
      const dateTo = toISO.split('T')[0];
      const sumAmt = (arr) => (arr || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);

      if (finSubTab === 'cashflow') {
        const prevDate = new Date(finDateFrom);
        prevDate.setDate(prevDate.getDate() - 1);
        const openingDate = prevDate.toISOString().split('T')[0];

        const [
          { data: cashOpeningDebits }, { data: cashOpeningCredits },
          { data: revenueCashJE }, { data: deliveryIncomeData },
          { data: inventoryPurchasesJE }, { data: salariesJE }, { data: incomeTaxJE },
          { data: cashCreditJE },
          { data: salePpeJE }, { data: collectionLoanJE }, { data: purchasePpeJE }, { data: makeLoanJE },
          { data: loanProceedsJE }, { data: capitalInfusionJE }, { data: loanPaymentJE }, { data: ownerDrawingJE },
          { data: interestExpenseJE },
        ] = await Promise.all([
          supabase.from('journal_entries').select('amount').in('debit_account', FIN_CASH_ACCOUNTS).lte('date', openingDate),
          supabase.from('journal_entries').select('amount').in('credit_account', FIN_CASH_ACCOUNTS).lte('date', openingDate),
          supabase.from('journal_entries').select('amount').in('debit_account', FIN_CASH_ACCOUNTS).in('credit_account', ['Revenue', 'Sales Revenue']).gte('date', dateFrom).lte('date', dateTo),
          supabase.from('orders').select('delivery_fee').in('status', ['order_delivered', 'completed']).gte('created_at', fromISO).lte('created_at', toISO).gt('delivery_fee', 0),
          supabase.from('journal_entries').select('amount').eq('reference_type', 'rr_payment').in('credit_account', FIN_CASH_ACCOUNTS).gte('date', dateFrom).lte('date', dateTo),
          supabase.from('journal_entries').select('amount').eq('debit_account', 'Salaries & Wages').in('credit_account', FIN_CASH_ACCOUNTS).gte('date', dateFrom).lte('date', dateTo),
          supabase.from('journal_entries').select('amount').eq('debit_account', 'Income Tax Expense').in('credit_account', FIN_CASH_ACCOUNTS).gte('date', dateFrom).lte('date', dateTo),
          supabase.from('journal_entries').select('amount, debit_account').in('credit_account', FIN_CASH_ACCOUNTS).gte('date', dateFrom).lte('date', dateTo),
          supabase.from('journal_entries').select('amount').in('debit_account', FIN_CASH_ACCOUNTS).in('credit_account', FIN_PPE_ACCOUNTS).gte('date', dateFrom).lte('date', dateTo),
          supabase.from('journal_entries').select('amount').in('debit_account', FIN_CASH_ACCOUNTS).eq('credit_account', 'Loans Receivable').gte('date', dateFrom).lte('date', dateTo),
          supabase.from('journal_entries').select('amount').in('credit_account', FIN_CASH_ACCOUNTS).in('debit_account', FIN_PPE_ACCOUNTS).gte('date', dateFrom).lte('date', dateTo),
          supabase.from('journal_entries').select('amount').in('credit_account', FIN_CASH_ACCOUNTS).eq('debit_account', 'Loans Receivable').gte('date', dateFrom).lte('date', dateTo),
          supabase.from('journal_entries').select('amount').in('debit_account', FIN_CASH_ACCOUNTS).eq('credit_account', 'Loans Payable').gte('date', dateFrom).lte('date', dateTo),
          supabase.from('journal_entries').select('amount').in('debit_account', FIN_CASH_ACCOUNTS).eq('credit_account', "Owner's Capital").gte('date', dateFrom).lte('date', dateTo),
          supabase.from('journal_entries').select('amount').in('credit_account', FIN_CASH_ACCOUNTS).eq('debit_account', 'Loans Payable').gte('date', dateFrom).lte('date', dateTo),
          supabase.from('journal_entries').select('amount').in('credit_account', FIN_CASH_ACCOUNTS).eq('debit_account', "Owner's Capital").gte('date', dateFrom).lte('date', dateTo),
          supabase.from('journal_entries').select('amount').eq('debit_account', 'Interest Expense').in('credit_account', FIN_CASH_ACCOUNTS).gte('date', dateFrom).lte('date', dateTo),
        ]);

        const cashBeginningBalance = sumAmt(cashOpeningDebits) - sumAmt(cashOpeningCredits);
        const receiptsRevenue = sumAmt(revenueCashJE);
        const deliveryIncome = (deliveryIncomeData || []).reduce((s, o) => s + (Number(o.delivery_fee) || 0), 0);
        const inventoryPurchases = sumAmt(inventoryPurchasesJE);
        const salariesWages = sumAmt(salariesJE);
        const incomeTaxes = sumAmt(incomeTaxJE);
        const genOpAdminExpenses = (cashCreditJE || []).reduce((s, row) => {
          const acct = row.debit_account || '';
          if (
            acct === 'Salaries & Wages'
            || acct === 'Income Tax Expense'
            || acct === 'Loans Payable'
            || acct === "Owner's Capital"
            || acct === 'Loans Receivable'
            || acct === 'Cost of Goods Sold'
            || acct === 'Interest Expense'
            || FIN_PPE_ACCOUNTS.includes(acct)
            || FIN_CASH_ACCOUNTS.includes(acct)
          ) return s;
          return s + (Number(row.amount) || 0);
        }, 0);

        const netCashFlowOperations = receiptsRevenue + deliveryIncome - inventoryPurchases - genOpAdminExpenses - salariesWages - incomeTaxes;

        const saleOfPropertyEquipment = sumAmt(salePpeJE);
        const collectionPrincipalOnLoans = sumAmt(collectionLoanJE);
        const purchaseOfPropertyEquipment = sumAmt(purchasePpeJE);
        const makingLoansToOthers = sumAmt(makeLoanJE);
        const netCashFlowInvesting = saleOfPropertyEquipment + collectionPrincipalOnLoans - purchaseOfPropertyEquipment - makingLoansToOthers;

        const proceedsFromLoans = sumAmt(loanProceedsJE);
        const ownersCapitalInfusion = sumAmt(capitalInfusionJE);
        const repaymentOfLoans = sumAmt(loanPaymentJE);
        const ownersDrawings = sumAmt(ownerDrawingJE);
        const interestExpensePaid = sumAmt(interestExpenseJE);
        const netCashFlowFinancing = proceedsFromLoans + ownersCapitalInfusion - repaymentOfLoans - ownersDrawings - interestExpensePaid;

        const netChange = netCashFlowOperations + netCashFlowInvesting + netCashFlowFinancing;
        const cashEndingBalance = cashBeginningBalance + netChange;

        setFinData({
          type: 'cashflow',
          cashBeginningBalance,
          receiptsRevenue,
          deliveryIncome,
          inventoryPurchases,
          genOpAdminExpenses,
          salariesWages,
          incomeTaxes,
          netCashFlowOperations,
          saleOfPropertyEquipment,
          collectionPrincipalOnLoans,
          purchaseOfPropertyEquipment,
          makingLoansToOthers,
          netCashFlowInvesting,
          proceedsFromLoans,
          ownersCapitalInfusion,
          repaymentOfLoans,
          ownersDrawings,
          interestExpensePaid,
          netCashFlowFinancing,
          netChange,
          cashEndingBalance,
        });
      } else if (finSubTab === 'pl') {
        const [{ data: revenueData }, { data: deliveryIncomeData }, { data: cogsData }, { data: expAllData }] = await Promise.all([
          supabase.from('journal_entries').select('amount').in('credit_account', ['Revenue', 'Sales Revenue']).gte('date', dateFrom).lte('date', dateTo),
          supabase.from('orders').select('delivery_fee').in('status', ['order_delivered', 'completed']).gte('created_at', fromISO).lte('created_at', toISO).gt('delivery_fee', 0),
          supabase.from('journal_entries').select('amount').eq('debit_account', 'Cost of Goods Sold').gte('date', dateFrom).lte('date', dateTo),
          supabase.from('journal_entries').select('amount, debit_account').in('debit_account', [...FIN_OPEX_ACCOUNTS, 'Income Tax Expense']).gte('date', dateFrom).lte('date', dateTo),
        ]);
        const revenue = (revenueData || []).reduce((s, o) => s + (Number(o.amount) || 0), 0);
        const deliveryIncome = (deliveryIncomeData || []).reduce((s, o) => s + (Number(o.delivery_fee) || 0), 0);
        const cogs = (cogsData || []).reduce((s, c) => s + (Number(c.amount) || 0), 0);
        const expByAccount = {};
        FIN_OPEX_ACCOUNTS.forEach((a) => { expByAccount[a] = 0; });
        let incomeTaxExpense = 0;
        (expAllData || []).forEach((e) => {
          if (e.debit_account === 'Income Tax Expense') incomeTaxExpense += Number(e.amount) || 0;
          else if (expByAccount[e.debit_account] !== undefined) expByAccount[e.debit_account] += Number(e.amount) || 0;
        });
        const opExp = Object.values(expByAccount).reduce((s, v) => s + v, 0);
        const totalRevenue = revenue + deliveryIncome;
        const grossProfit = totalRevenue - cogs;
        const incomeBeforeTax = grossProfit - opExp;
        const netIncome = incomeBeforeTax - incomeTaxExpense;
        setFinData({ type: 'pl', revenue, deliveryIncome, totalRevenue, cogs, grossProfit, expByAccount, opExp, incomeBeforeTax, incomeTaxExpense, netIncome });
      } else if (finSubTab === 'sales') {
        const { data: deliveredOrderIds } = await supabase
          .from('orders')
          .select('id')
          .in('status', ['order_delivered', 'completed'])
          .gte('created_at', fromISO)
          .lte('created_at', toISO);
        const oIds = (deliveredOrderIds || []).map((o) => o.id);
        let salesItems = [];
        if (oIds.length > 0) {
          const { data: oi } = await supabase
            .from('order_items')
            .select('name, price, quantity, subtotal, menu_item_id, variant_details')
            .in('order_id', oIds);
          salesItems = oi || [];
        }
        const { data: menuItemsForCat } = await supabase
          .from('menu_items')
          .select('id, name, category');
        const menuCatMap = {};
        (menuItemsForCat || []).forEach((m) => { menuCatMap[m.id] = m.category || 'Other'; menuCatMap[m.name] = m.category || 'Other'; });
        const { data: costingHdrs } = await supabase
          .from('price_costing_headers')
          .select('menu_item_name, total_estimated_cogs, selling_price');
        const cogsMap = {};
        (costingHdrs || []).forEach((h) => { cogsMap[h.menu_item_name] = Number(h.total_estimated_cogs) || 0; });

        const itemMap = {};
        salesItems.forEach((si) => {
          const baseName = (si.name || '').split(' - ')[0].trim();
          const qty = Number(si.quantity) || 1;
          const rev = Number(si.subtotal) || (Number(si.price) || 0) * qty;
          const category = (si.menu_item_id && menuCatMap[si.menu_item_id]) || menuCatMap[baseName] || menuCatMap[si.name] || 'Other';
          const variantDetails = si.variant_details && typeof si.variant_details === 'object' ? si.variant_details : {};
          const normalizeVariantKey = (key) => String(key || '').toLowerCase().replace(/[\s-]/g, '');

          // Prefer variant-specific base costing (e.g., Americano - 16oz), then fall back to generic base name.
          let unitBaseCogs = cogsMap[si.name] || cogsMap[baseName] || 0;
          const variantCandidates = [];
          Object.entries(variantDetails).forEach(([k, v]) => {
            const normalized = normalizeVariantKey(k);
            if (normalized === 'addon' || normalized === 'addons') return;
            String(v || '').split(',').map((x) => x.trim()).filter(Boolean).forEach((variantValue) => {
              variantCandidates.push({
                name: `${baseName} - ${variantValue}`,
                priority: normalized === 'size' ? 1 : 2,
              });
            });
          });
          variantCandidates
            .sort((a, b) => (a.priority - b.priority) || (b.name.length - a.name.length))
            .some((candidate) => {
              if (cogsMap[candidate.name] !== undefined) {
                unitBaseCogs = cogsMap[candidate.name];
                return true;
              }
              return false;
            });

          // Add-on costing is generic by add-on name (e.g., "Extra Shot", "Coffee Jelly").
          const unitAddonCogs = Object.entries(variantDetails).reduce((sum, [k, v]) => {
            const normalized = normalizeVariantKey(k);
            if (normalized !== 'addon' && normalized !== 'addons') return sum;
            return sum + String(v || '')
              .split(',')
              .map((x) => x.trim())
              .filter(Boolean)
              .reduce((s, addonName) => s + (cogsMap[addonName] || 0), 0);
          }, 0);

          const unitCogs = unitBaseCogs + unitAddonCogs;
          const totalCogs = unitCogs * qty;
          const key = baseName;
          if (!itemMap[key]) {
            itemMap[key] = { name: key, category, revenue: 0, cogs: 0, quantity: 0 };
          }
          itemMap[key].revenue += rev;
          itemMap[key].cogs += totalCogs;
          itemMap[key].quantity += qty;
        });
        const salesRows = Object.values(itemMap).map((r) => {
          const cm = r.revenue - r.cogs;
          const cmPct = r.revenue > 0 ? (cm / r.revenue) * 100 : 0;
          return { ...r, cm, cmPct };
        });
        setFinData({ type: 'sales', rows: salesRows });
      } else if (finSubTab === 'balance') {
        const bsDateTo = toISO.split('T')[0];
        const [
          { data: invList },
          { data: cashOnHandDebit }, { data: cashOnHandCredit },
          { data: cashInBankDebit }, { data: cashInBankCredit },
          { data: kitEquipDebit }, { data: kitEquipCredit }, { data: accumDeprData },
          { data: ownCapCredit }, { data: ownCapDebit }, { data: retEarnCredit }, { data: retEarnDebit },
          { data: apCredit }, { data: apDebit },
          { data: incomeTaxPayableCredit }, { data: incomeTaxPayableDebit },
          { data: loansPayableCredit }, { data: loansPayableDebit },
        ] = await Promise.all([
          supabase.from('admin_inventory_items').select('current_stock, cost_per_unit'),
          supabase.from('journal_entries').select('amount').eq('debit_account', 'Cash on Hand').lte('date', bsDateTo),
          supabase.from('journal_entries').select('amount').eq('credit_account', 'Cash on Hand').lte('date', bsDateTo),
          supabase.from('journal_entries').select('amount').eq('debit_account', 'Cash in Bank').lte('date', bsDateTo),
          supabase.from('journal_entries').select('amount').eq('credit_account', 'Cash in Bank').lte('date', bsDateTo),
          supabase.from('journal_entries').select('amount').eq('debit_account', 'Kitchen Equipment').lte('date', bsDateTo),
          supabase.from('journal_entries').select('amount').eq('credit_account', 'Kitchen Equipment').lte('date', bsDateTo),
          supabase.from('journal_entries').select('amount').eq('credit_account', 'Accumulated Depreciation').lte('date', bsDateTo),
          supabase.from('journal_entries').select('amount').eq('credit_account', "Owner's Capital").lte('date', bsDateTo),
          supabase.from('journal_entries').select('amount').eq('debit_account', "Owner's Capital").lte('date', bsDateTo),
          supabase.from('journal_entries').select('amount').eq('credit_account', 'Retained Earnings').lte('date', bsDateTo),
          supabase.from('journal_entries').select('amount').eq('debit_account', 'Retained Earnings').lte('date', bsDateTo),
          supabase.from('journal_entries').select('amount').eq('credit_account', 'Accounts Payable').lte('date', bsDateTo),
          supabase.from('journal_entries').select('amount').eq('debit_account', 'Accounts Payable').lte('date', bsDateTo),
          supabase.from('journal_entries').select('amount').eq('credit_account', 'Income Tax Payable').lte('date', bsDateTo),
          supabase.from('journal_entries').select('amount').eq('debit_account', 'Income Tax Payable').lte('date', bsDateTo),
          supabase.from('journal_entries').select('amount').eq('credit_account', 'Loans Payable').lte('date', bsDateTo),
          supabase.from('journal_entries').select('amount').eq('debit_account', 'Loans Payable').lte('date', bsDateTo),
        ]);
        const cashOnHand = sumAmt(cashOnHandDebit) - sumAmt(cashOnHandCredit);
        const cashInBank = sumAmt(cashInBankDebit) - sumAmt(cashInBankCredit);
        const invValue = (invList || []).reduce((s, i) => s + (Number(i.current_stock) || 0) * (Number(i.cost_per_unit) || 0), 0);
        const ap = sumAmt(apCredit) - sumAmt(apDebit);
        const incomeTaxPayable = sumAmt(incomeTaxPayableCredit) - sumAmt(incomeTaxPayableDebit);
        const loansPayable = sumAmt(loansPayableCredit) - sumAmt(loansPayableDebit);
        const kitchenEquipment = sumAmt(kitEquipDebit) - sumAmt(kitEquipCredit);
        const accumDepreciation = sumAmt(accumDeprData);
        const ownersCapital = sumAmt(ownCapCredit) - sumAmt(ownCapDebit);
        const retainedEarnings = sumAmt(retEarnCredit) - sumAmt(retEarnDebit);
        const totalAssets = cashOnHand + cashInBank + invValue + kitchenEquipment - accumDepreciation;
        const totalLiabilities = ap + incomeTaxPayable + loansPayable;
        const totalEquity = ownersCapital + retainedEarnings;
        setFinData({
          type: 'balance',
          cashOnHand,
          cashInBank,
          invValue,
          kitchenEquipment,
          accumDepreciation,
          totalAssets,
          ap,
          incomeTaxPayable,
          loansPayable,
          totalLiabilities,
          ownersCapital,
          retainedEarnings,
          totalEquity,
          equity: totalAssets - totalLiabilities,
        });
      } else if (finSubTab === 'budget') {
        const [{ data: revenueData }, { data: deliveryIncomeData }, { data: cogsData }, { data: expAllData }] = await Promise.all([
          supabase.from('journal_entries').select('amount').in('credit_account', ['Revenue', 'Sales Revenue']).gte('date', dateFrom).lte('date', dateTo),
          supabase.from('orders').select('delivery_fee').in('status', ['order_delivered', 'completed']).gte('created_at', fromISO).lte('created_at', toISO).gt('delivery_fee', 0),
          supabase.from('journal_entries').select('amount').eq('debit_account', 'Cost of Goods Sold').gte('date', dateFrom).lte('date', dateTo),
          supabase.from('journal_entries').select('amount, debit_account').in('debit_account', [...FIN_OPEX_ACCOUNTS, 'Income Tax Expense']).gte('date', dateFrom).lte('date', dateTo),
        ]);
        const revenue = (revenueData || []).reduce((s, o) => s + (Number(o.amount) || 0), 0);
        const deliveryIncome = (deliveryIncomeData || []).reduce((s, o) => s + (Number(o.delivery_fee) || 0), 0);
        const cogs = (cogsData || []).reduce((s, c) => s + (Number(c.amount) || 0), 0);
        const expByAccount = {};
        FIN_OPEX_ACCOUNTS.forEach((a) => { expByAccount[a] = 0; });
        let incomeTaxExpense = 0;
        (expAllData || []).forEach((e) => {
          if (e.debit_account === 'Income Tax Expense') incomeTaxExpense += Number(e.amount) || 0;
          else if (expByAccount[e.debit_account] !== undefined) expByAccount[e.debit_account] += Number(e.amount) || 0;
        });
        const opExp = Object.values(expByAccount).reduce((s, v) => s + v, 0);
        const totalRevenue = revenue + deliveryIncome;
        const grossProfit = totalRevenue - cogs;
        const incomeBeforeTax = grossProfit - opExp;
        const netIncome = incomeBeforeTax - incomeTaxExpense;
        setFinData({ type: 'budget', revenue, deliveryIncome, totalRevenue, cogs, grossProfit, expByAccount, opExp, incomeBeforeTax, incomeTaxExpense, netIncome });
      } else if (finSubTab === 'tax') {
        const { data: ordersData } = await supabase
          .from('orders')
          .select('total, created_at')
          .gte('created_at', fromISO)
          .lte('created_at', toISO);
        const months = {};
        (ordersData || []).forEach((o) => {
          const key = new Date(o.created_at).toISOString().slice(0, 7);
          months[key] = (months[key] || 0) + (Number(o.total) || 0);
        });
        const rows = Object.entries(months)
          .sort()
          .map(([month, total]) => ({
            month,
            total,
            vat: (total / 1.12) * 0.12,
            netOfVat: total - (total / 1.12) * 0.12,
          }));
        setFinData({ type: 'tax', rows });
      }

      // ── Comparative Periods ────────────────────────────────────────────────
      if (['cashflow', 'pl', 'balance', 'sales'].includes(finSubTab)) {
        const periods = Math.max(0, Math.min(12, Number(finCompareCount) || 0));
        const unit = finComparePeriod;
        const shiftedRange = (index) => {
          const from = new Date(finDateFrom);
          const to = new Date(finDateTo);
          if (finCompareMode === 'same_period_last_year') {
            return {
              from: shiftDateByYearsClamped(from, -index),
              to: shiftDateByYearsClamped(to, -index),
            };
          } else if (unit === 'quarterly') {
            return {
              from: shiftDateByMonthsClamped(from, -(index * 3)),
              to: shiftDateByMonthsClamped(to, -(index * 3)),
            };
          } else if (unit === 'annual') {
            return {
              from: shiftDateByYearsClamped(from, -index),
              to: shiftDateByYearsClamped(to, -index),
            };
          } else {
            return {
              from: shiftDateByMonthsClamped(from, -index),
              to: shiftDateByMonthsClamped(to, -index),
            };
          }
        };

        const computePLPeriod = async (cFrom, cTo, cFromISO, cToISO) => {
          const [{ data: rev }, { data: del }, { data: cg }, { data: exps }] = await Promise.all([
            supabase.from('journal_entries').select('amount').in('credit_account', ['Revenue', 'Sales Revenue']).gte('date', cFrom).lte('date', cTo),
            supabase.from('orders').select('delivery_fee').in('status', ['order_delivered', 'completed']).gte('created_at', cFromISO).lte('created_at', cToISO).gt('delivery_fee', 0),
            supabase.from('journal_entries').select('amount').eq('debit_account', 'Cost of Goods Sold').gte('date', cFrom).lte('date', cTo),
            supabase.from('journal_entries').select('amount, debit_account').in('debit_account', [...FIN_OPEX_ACCOUNTS, 'Income Tax Expense']).gte('date', cFrom).lte('date', cTo),
          ]);
          const revenue = (rev || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
          const deliveryIncome = (del || []).reduce((s, o) => s + (Number(o.delivery_fee) || 0), 0);
          const cogs = (cg || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
          const expByAccount = {};
          FIN_OPEX_ACCOUNTS.forEach((a) => { expByAccount[a] = 0; });
          let incomeTaxExpense = 0;
          (exps || []).forEach((e) => {
            if (e.debit_account === 'Income Tax Expense') incomeTaxExpense += Number(e.amount) || 0;
            else if (expByAccount[e.debit_account] !== undefined) expByAccount[e.debit_account] += Number(e.amount) || 0;
          });
          const totalRevenue = revenue + deliveryIncome;
          const grossProfit = totalRevenue - cogs;
          const opExp = Object.values(expByAccount).reduce((s, v) => s + v, 0);
          const incomeBeforeTax = grossProfit - opExp;
          const netIncome = incomeBeforeTax - incomeTaxExpense;
          return { revenue, deliveryIncome, totalRevenue, cogs, grossProfit, expByAccount, opExp, incomeBeforeTax, incomeTaxExpense, netIncome };
        };

        const compareFull = [];
        if (periods > 0) for (let i = 1; i <= periods; i++) {
          const { from: f, to: t } = shiftedRange(i);
          const cFrom = f.toISOString().split('T')[0];
          const cTo = t.toISOString().split('T')[0];
          const cFromISO = `${cFrom}T00:00:00.000Z`;
          const cToISO = `${cTo}T23:59:59.999Z`;
          const label = formatFinancialCoverageLabel(cFrom, cTo, unit);
          let periodData = { label };
          if (finSubTab === 'pl' || finSubTab === 'sales' || finSubTab === 'budget') {
            const pl = await computePLPeriod(cFrom, cTo, cFromISO, cToISO);
            periodData = { ...periodData, ...pl };
          } else if (finSubTab === 'cashflow') {
            const [{ data: cd }, { data: cc }] = await Promise.all([
              supabase.from('journal_entries').select('amount').in('debit_account', FIN_CASH_ACCOUNTS).gte('date', cFrom).lte('date', cTo),
              supabase.from('journal_entries').select('amount').in('credit_account', FIN_CASH_ACCOUNTS).gte('date', cFrom).lte('date', cTo),
            ]);
            periodData.netCashChange = (cd || []).reduce((s, e) => s + (Number(e.amount) || 0), 0) - (cc || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
          } else if (finSubTab === 'balance') {
            const [{ data: aD }, { data: aC }] = await Promise.all([
              supabase.from('journal_entries').select('amount, debit_account').lte('date', cTo),
              supabase.from('journal_entries').select('amount, credit_account').lte('date', cTo),
            ]);
            const nets = {};
            (aD || []).forEach((e) => { if (e.debit_account) nets[e.debit_account] = (nets[e.debit_account] || 0) + (Number(e.amount) || 0); });
            (aC || []).forEach((e) => { if (e.credit_account) nets[e.credit_account] = (nets[e.credit_account] || 0) - (Number(e.amount) || 0); });
            const cashOnHand = nets['Cash on Hand'] || 0;
            const cashInBank = nets['Cash in Bank'] || 0;
            const invValue = nets['Inventory'] || 0;
            const kitchenEquipment = nets['Kitchen Equipment'] || 0;
            const accumDepreciation = Math.abs(nets['Accumulated Depreciation'] || 0);
            const ap = Math.abs(nets['Accounts Payable'] || 0);
            const incomeTaxPayable = Math.abs(nets['Income Tax Payable'] || 0);
            const loansPayable = Math.abs(nets['Loans Payable'] || 0);
            const ownersCapital = nets["Owner's Capital"] || 0;
            const retainedEarnings = Math.abs(nets['Retained Earnings'] || 0);
            const totalAssets = cashOnHand + cashInBank + invValue + kitchenEquipment - accumDepreciation;
            const totalLiabilities = ap + incomeTaxPayable + loansPayable;
            const totalEquity = ownersCapital + retainedEarnings;
            Object.assign(periodData, { cashOnHand, cashInBank, invValue, kitchenEquipment, accumDepreciation, ap, incomeTaxPayable, loansPayable, ownersCapital, retainedEarnings, totalAssets, totalLiabilities, totalEquity });
          }
          compareFull.push(periodData);
        }
        setFinCompareFull(compareFull);
        // Keep backward-compat scalar array
        setFinCompareData(compareFull.map((p) => ({ label: p.label, amount: p.netIncome ?? p.netCashChange ?? p.totalAssets ?? 0 })));
      } else {
        setFinCompareFull([]);
        setFinCompareData([]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [supabase, finSubTab, finDateFrom, finDateTo, finCompareMode, finCompareCount, finComparePeriod, FIN_CASH_ACCOUNTS, FIN_PPE_ACCOUNTS, FIN_OPEX_ACCOUNTS]);

  // ── Fetch: Chart of Accounts ──────────────────────────────────────────────
  const fetchCOA = useCallback(async () => {
    if (!supabase) return;
    setCoaLoading(true);
    try {
      // Compute day before coaDateFrom for opening balance
      const prevDay = new Date(coaDateFrom);
      prevDay.setDate(prevDay.getDate() - 1);
      const prevDayStr = prevDay.toISOString().split('T')[0];

      const [{ data: periodEntries }, { data: openingEntries }] = await Promise.all([
        supabase.from('journal_entries').select('debit_account, credit_account, amount').gte('date', coaDateFrom).lte('date', coaDateTo),
        supabase.from('journal_entries').select('debit_account, credit_account, amount').lte('date', prevDayStr),
      ]);

      // net[account] = totalDebits - totalCredits
      const computeNets = (entries) => {
        const nets = {};
        (entries || []).forEach((e) => {
          if (e.debit_account) nets[e.debit_account] = (nets[e.debit_account] || 0) + (Number(e.amount) || 0);
          if (e.credit_account) nets[e.credit_account] = (nets[e.credit_account] || 0) - (Number(e.amount) || 0);
        });
        return nets;
      };
      const periodNets = computeNets(periodEntries);
      const openingNets = computeNets(openingEntries);

      // Balance Sheet accounts use opening balance + period activity
      const BS_ACCOUNTS = [
        'Cash on Hand', 'Cash in Bank', 'Accounts Receivable', 'Inventory',
        'Kitchen Equipment', 'Accumulated Depreciation',
        'Accounts Payable', 'Accounts Payable - Rewards', 'Notes Payable', 'Accrued Liabilities', 'Income Tax Payable', 'Loans Payable',
        "Owner's Capital", 'Retained Earnings',
      ];
      // Income Statement accounts use period activity only
      const IS_ACCOUNTS = [
        'Revenue', 'Delivery Income', 'Other Income',
        'Cost of Goods Sold', "Rider's Fee",
        'Salaries & Wages', 'Utilities', 'Supplies', 'Repairs & Maintenance',
        'Advertising & Marketing', 'Software Subscriptions', 'Professional Fees',
        'Transportation', 'Meals & Entertainment', 'Auto Expense', 'Rent Expense',
        'Kitchen Tools', 'Miscellaneous Expense', 'Depreciation Expense', 'Interest Expense', 'Income Tax Expense',
      ];

      const amounts = {};
      BS_ACCOUNTS.forEach((acct) => {
        amounts[acct] = (openingNets[acct] || 0) + (periodNets[acct] || 0);
      });
      IS_ACCOUNTS.forEach((acct) => {
        amounts[acct] = periodNets[acct] || 0;
      });
      setCoaData(amounts);
    } catch (err) {
      setError(err.message);
    } finally {
      setCoaLoading(false);
    }
  }, [supabase, coaDateFrom, coaDateTo]);

  // ── Fetch: Profile ────────────────────────────────────────────────────────
  const fetchProfile = useCallback(async () => {
    if (!supabase || !session?.user?.id) return;
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();
      if (err) throw err;
      setProfileData(data);
      if (data) {
        setProfileForm({ full_name: data.full_name || '', phone: data.phone || '', address: data.address || '' });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  // ── Fetch: Journal Entries ────────────────────────────────────────────────
  const fetchJournal = useCallback(async () => {
    if (!supabase) return;
    setJournalLoading(true);
    try {
      let q = supabase
        .from('journal_entries')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
      if (journalDateFrom) q = q.gte('date', journalDateFrom);
      if (journalDateTo) q = q.lte('date', journalDateTo);

      // Apply main tab filter
      if (journalSubTab === 'sales') {
        q = q.eq('reference_type', 'order');
      } else if (journalSubTab === 'purchases') {
        q = q.in('reference_type', ['receiving_report', 'rr_payment', 'bill']);
      } else if (journalSubTab === 'others') {
        q = q.in('reference_type', ['cash_adjustment', 'manual_entry']);
      }

      // Apply sub-filter
      if (journalSubTab === 'sales' && journalSubFilter !== 'all') {
        if (journalSubFilter === 'cash_sales') q = q.eq('debit_account', 'Cash on Hand');
        else if (journalSubFilter === 'gcash_sales') q = q.eq('debit_account', 'Cash in Bank');
        else if (journalSubFilter === 'points_claimed') q = q.eq('debit_account', 'Accounts Payable');
      } else if (journalSubTab === 'purchases' && journalSubFilter !== 'all') {
        if (journalSubFilter === 'approved_rr') q = q.eq('reference_type', 'receiving_report');
        else if (journalSubFilter === 'rr_cash_on_hand') q = q.eq('reference_type', 'rr_payment').eq('credit_account', 'Cash on Hand');
        else if (journalSubFilter === 'rr_cash_in_bank') q = q.eq('reference_type', 'rr_payment').eq('credit_account', 'Cash in Bank');
        else if (journalSubFilter === 'rr_credit_card') q = q.eq('reference_type', 'rr_payment').eq('credit_account', 'Credit Card Payable');
        else if (journalSubFilter === 'bill_all') q = q.eq('reference_type', 'bill');
        else if (journalSubFilter === 'bill_approved') q = q.eq('reference_type', 'bill').eq('credit_account', 'Accounts Payable');
        else if (journalSubFilter === 'bill_paid') q = q.eq('reference_type', 'bill').eq('debit_account', 'Accounts Payable');
      } else if (journalSubTab === 'others' && journalSubFilter !== 'all') {
        if (journalSubFilter === 'adjustments') q = q.eq('reference_type', 'cash_adjustment');
        else if (journalSubFilter === 'manual_entry') q = q.eq('reference_type', 'manual_entry');
      }

      // Account name filter is applied client-side per-line in the display layer

      const { data, error: err } = await q;
      if (err) throw err;
      setJournalData(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setJournalLoading(false);
    }
  }, [journalSubTab, journalSubFilter, journalDateFrom, journalDateTo]);

  // ── Manual Entry: Generate Entry Number ──────────────────────────────────
  const generateManualEntryNumber = useCallback(async () => {
    if (!supabase) return;
    try {
      const yy = new Date().getFullYear().toString().slice(-2);
      const prefix = `ME-${yy}`;
      const { data } = await supabase
        .from('journal_entries')
        .select('entry_number')
        .like('entry_number', `${prefix}%`)
        .order('entry_number', { ascending: false })
        .limit(1);
      let seq = 1;
      if (data && data.length > 0 && data[0].entry_number) {
        const last = parseInt(data[0].entry_number.slice(prefix.length), 10);
        if (!isNaN(last)) seq = last + 1;
      }
      setManualEntryNumber(`${prefix}${String(seq).padStart(7, '0')}`);
    } catch {
      setManualEntryNumber('');
    }
  }, []);

  // ── Fetch: Contacts for Manual Entry ─────────────────────────────────────
  const fetchContacts = useCallback(async (q) => {
    if (!supabase) return;
    try {
      const [{ data: vends }, { data: usrs }] = await Promise.all([
        supabase.from('vendors').select('id, name').ilike('name', `%${q}%`).limit(10),
        supabase.from('users').select('id, full_name, role').ilike('full_name', `%${q}%`).limit(10),
      ]);
      const combined = [
        ...(vends || []).map((v) => ({ id: v.id, name: v.name, type: 'Vendor' })),
        ...(usrs || []).map((u) => ({ id: u.id, name: u.full_name, type: u.role })),
      ];
      setContactList(combined);
    } catch {
      setContactList([]);
    }
  }, []);

  // ── Save New Contact (vendor) from picker ──────────────────────────────────
  const saveNewContact = useCallback(async () => {
    if (!supabase) return;
    setNewContactSaving(true);
    setNewContactError('');
    try {
      if (!newContactForm.name.trim()) throw new Error('Contact name is required.');
      const { data: inserted, error: err } = await supabase
        .from('vendors')
        .insert({
          name: newContactForm.name.trim(),
          address: newContactForm.address || null,
          contact_number: newContactForm.contact || null,
          tin: newContactForm.tin || null,
        })
        .select()
        .single();
      if (err) throw err;
      setManualEntryForm((p) => ({ ...p, name: inserted.name }));
      setNewContactMode(false);
      setNewContactForm({ name: '', address: '', contact: '', tin: '' });
      setContactPickerOpen(false);
    } catch (err) {
      setNewContactError(err.message);
    } finally {
      setNewContactSaving(false);
    }
  }, [supabase, newContactForm]);

  // ── Save Manual Entry ─────────────────────────────────────────────────────
  const saveManualEntry = useCallback(async () => {
    if (!supabase) return;
    setManualSaving(true);
    setManualError('');
    setManualSuccess('');
    try {
      if (!manualEntryForm.date) throw new Error('Please enter a date.');
      const validLines = manualEntryLines.filter((l) => l.account && l.amount);
      if (validLines.length === 0) throw new Error('Please add at least one line item.');
      const totalDebit = validLines.filter((l) => l.type === 'debit').reduce((s, l) => s + (Number(l.amount) || 0), 0);
      const totalCredit = validLines.filter((l) => l.type === 'credit').reduce((s, l) => s + (Number(l.amount) || 0), 0);
      if (Math.abs(totalDebit - totalCredit) > 0.01) throw new Error(`Entry is unbalanced: Debit ₱${totalDebit.toFixed(2)} ≠ Credit ₱${totalCredit.toFixed(2)}.`);
      const rows = validLines.map((l) => ({
        date: manualEntryForm.date,
        description: l.description || manualEntryForm.description || '',
        debit_account: l.type === 'debit' ? l.account : '',
        credit_account: l.type === 'credit' ? l.account : '',
        amount: Number(l.amount) || 0,
        reference_type: 'manual_entry',
        entry_number: manualEntryNumber || null,
        name: manualEntryForm.name || null,
        reference: manualEntryForm.reference_number || null,
      }));
      const { error: insertErr } = await supabase.from('journal_entries').insert(rows);
      if (insertErr) throw insertErr;
      setManualSuccess(`Manual entry ${manualEntryNumber} saved successfully.`);
      setManualEntryLines([{ description: '', account: '', type: 'debit', amount: '' }]);
      setManualEntryForm({ date: new Date().toISOString().split('T')[0], name: '', reference_number: '', description: '' });
      await generateManualEntryNumber();
    } catch (err) {
      setManualError(err.message);
    } finally {
      setManualSaving(false);
    }
  }, [supabase, manualEntryForm, manualEntryLines, manualEntryNumber, generateManualEntryNumber]);

  // ── Trigger fetches on tab change ─────────────────────────────────────────
  useEffect(() => {
    if (activeTab === 'dashboard') fetchDashboard();
    else if (activeTab === 'inventory') fetchInventory();
    else if (activeTab === 'costing') fetchCosting();
    else if (activeTab === 'rr') fetchRR();
    else if (activeTab === 'financial') fetchFinancial();
    else if (activeTab === 'profile') fetchProfile();
    else if (activeTab === 'journal') fetchJournal();
    else if (activeTab === 'manual') { generateManualEntryNumber(); }
    else if (activeTab === 'bills') { fetchBills(); generateBillNumber(); }
  }, [activeTab, fetchDashboard, fetchInventory, fetchCosting, fetchRR, fetchFinancial, fetchProfile, fetchJournal, generateManualEntryNumber, fetchBills, generateBillNumber]);

  useEffect(() => {
    if (activeTab === 'dashboard' && dashSubTab === 'stock-alerts') fetchLowStockItems();
  }, [activeTab, dashSubTab, fetchLowStockItems]);

  useEffect(() => {
    if (activeTab === 'inventory') fetchInventory();
  }, [activeTab, invDateFrom, invDateTo, fetchInventory]);

  useEffect(() => {
    if (activeTab === 'financial') fetchFinancial();
  }, [activeTab, finSubTab, finDateFrom, finDateTo, fetchFinancial]);

  useEffect(() => {
    const [yr, mo] = (invCoverageMonth || '').split('-').map(Number);
    if (!yr || !mo) return;
    const from = `${yr}-${String(mo).padStart(2, '0')}-01`;
    const lastDay = new Date(yr, mo, 0).getDate();
    const to = `${yr}-${String(mo).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    setInvDateFrom(from);
    setInvDateTo(to);
  }, [invCoverageMonth]);

  useEffect(() => {
    if (activeTab === 'financial' && finSubTab === 'coa') fetchCOA();
  }, [activeTab, finSubTab, coaDateFrom, coaDateTo, fetchCOA]);

  // ── Reload budget values when date range changes on Budget Variance tab ───
  useEffect(() => {
    if (finSubTab !== 'budget') return;
    try {
      if (typeof window === 'undefined') return;
      const month = (finDateFrom || '').slice(0, 7);
      const stored = localStorage.getItem(`bbc_budget_${month}`);
      if (stored) {
        setBudgetValues(JSON.parse(stored));
      } else {
        // Fall back to previous month's budget as default (timezone-safe string parsing)
        const [yr, mo] = (finDateFrom || '').split('-').map(Number);
        if (!yr || !mo) { setBudgetValues({}); return; }
        const prevYear = mo === 1 ? yr - 1 : yr;
        const prevMonthNum = mo === 1 ? 12 : mo - 1;
        const prevMonth = `${prevYear}-${String(prevMonthNum).padStart(2, '0')}`;
        const prevStored = localStorage.getItem(`bbc_budget_${prevMonth}`);
        setBudgetValues(prevStored ? JSON.parse(prevStored) : {});
      }
    } catch { /* noop */ }
  }, [finDateFrom, finSubTab]);

  useEffect(() => {
    if (finSubTab !== 'budget') return;
    try {
      if (typeof window === 'undefined') return;
      const month = (finDateFrom || '').slice(0, 7);
      if (!month) return;
      localStorage.setItem(`bbc_budget_${month}`, JSON.stringify(budgetValues));
    } catch { /* noop */ }
  }, [budgetValues, finDateFrom, finSubTab]);

  useEffect(() => {
    if (activeTab === 'journal') fetchJournal();
  }, [activeTab, journalSubTab, journalSubFilter, journalDateFrom, journalDateTo, fetchJournal]);

  // ── Real-time subscription for Journal Entries ────────────────────────────
  // Keep a ref so the subscription can always call the latest fetchJournal
  // (which carries the current filter state) without needing to be recreated.
  const fetchJournalRef = useRef(fetchJournal);
  useEffect(() => { fetchJournalRef.current = fetchJournal; }, [fetchJournal]);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel('admin_journal_entries_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'journal_entries' }, () => {
        fetchJournalRef.current?.();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedDeductionEmployee = useMemo(
    () => (payrollData.employees || []).find((employee) => employee.id === deductionDialogEmployeeId) || null,
    [payrollData.employees, deductionDialogEmployeeId],
  );

  const payrollHasProcessedDeduction = useMemo(
    () => (payrollData.employees || []).some((employee) => (employee.deductions || []).some((deduction) => deduction.processed)),
    [payrollData.employees],
  );

  const payrollCanEdit = !payrollHasProcessedDeduction;
  const payrollPeriodMeta = useMemo(
    () => getPayrollPeriodMeta(payrollData.cycleStart),
    [payrollData.cycleStart],
  );

  const syncPayrollState = useCallback((nextData, message = '') => {
    const normalized = normalizePayrollData(nextData);
    setPayrollData(normalized);
    setPayrollCycleDays(getPayrollCycleDays(normalized.cycleStart));
    savePayrollData(normalized);
    if (message) setPayrollMessage(message);
  }, []);

  const loadPayrollState = useCallback(() => {
    const loaded = loadPayrollData();
    setPayrollData(loaded);
    setPayrollCycleDays(getPayrollCycleDays(loaded.cycleStart));
  }, []);

  useEffect(() => {
    loadPayrollState();
  }, [loadPayrollState]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onStorage = (event) => {
      if (event.key === PAYROLL_STORAGE_KEY) loadPayrollState();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [loadPayrollState]);

  const submitPayroll = () => {
    syncPayrollState(
      {
        ...payrollData,
        submitted: true,
        submittedAt: new Date().toISOString(),
      },
      'Attendance report submitted to cashier.',
    );
  };

  const changePayrollPeriod = (monthValue, cycleType) => {
    if (!payrollCanEdit) return;
    if (!/^\d{4}-\d{2}$/.test(String(monthValue || ''))) {
      setPayrollMessage('Select a valid payroll month.');
      return;
    }
    const nextCycleStart = getPayrollCycleStartForPeriod(monthValue, cycleType);
    syncPayrollState({ ...payrollData, cycleStart: nextCycleStart }, 'Payroll period updated (auto-saved).');
  };

  const addPayrollEmployee = () => {
    if (!payrollCanEdit) return;
    const name = newPayrollEmployeeName.trim();
    if (!name) return;
    const alreadyExists = (payrollData.employees || []).some(
      (employee) => String(employee.name || '').trim().toLowerCase() === name.toLowerCase(),
    );
    if (alreadyExists) {
      setPayrollMessage('Employee already exists in attendance sheet.');
      return;
    }
    const employee = {
      id: createId('emp'),
      name,
      monthlyPay: 0,
      daily: payrollCycleDays.map((day) => {
        if (day.isSunday) return true;
        if (day.isFuture) return null;
        return true;
      }),
      deductions: [],
    };
    syncPayrollState(
      { ...payrollData, employees: [...(payrollData.employees || []), employee] },
      'Employee added and auto-saved.',
    );
    setNewPayrollEmployeeName('');
    if (!payrollSelectedEmployeeId) setPayrollSelectedEmployeeId(employee.id);
  };

  const deletePayrollEmployee = (employeeId) => {
    if (!payrollCanEdit) return;
    syncPayrollState(
      {
        ...payrollData,
        employees: (payrollData.employees || []).filter((employee) => employee.id !== employeeId),
      },
      'Employee removed and auto-saved.',
    );
    if (payrollSelectedEmployeeId === employeeId) setPayrollSelectedEmployeeId('');
  };

  const toggleAttendance = (employeeId, dayIndex) => {
    if (!payrollCanEdit) return;
    if (payrollCycleDays[dayIndex]?.isSunday) return;
    syncPayrollState({
      ...payrollData,
      employees: (payrollData.employees || []).map((employee) => {
        if (employee.id !== employeeId) return employee;
        const nextDaily = [...(employee.daily || [])];
        nextDaily[dayIndex] = !nextDaily[dayIndex];
        return { ...employee, daily: nextDaily };
      }),
    });
  };

  const updateMonthlyPay = (employeeId, rawValue) => {
    if (!payrollCanEdit) return;
    const value = roundToCurrency(rawValue);
    syncPayrollState({
      ...payrollData,
      employees: (payrollData.employees || []).map((employee) => (
        employee.id === employeeId ? { ...employee, monthlyPay: value } : employee
      )),
    });
  };

  const openDeductionsDialog = () => {
    if (!payrollSelectedEmployeeId) {
      setPayrollMessage('Select an employee first.');
      return;
    }
    setDeductionDialogEmployeeId(payrollSelectedEmployeeId);
    setDeductionForm({
      id: null,
      date: new Date().toISOString().split('T')[0],
      type: 'Cash Advance',
      amount: '',
      notes: '',
    });
  };

  const editDeduction = (deduction) => {
    setDeductionForm({
      id: deduction.id,
      date: deduction.date || new Date().toISOString().split('T')[0],
      type: deduction.type || 'Cash Advance',
      amount: String(deduction.amount || ''),
      notes: deduction.notes || '',
    });
  };

  const saveDeductionEntry = () => {
    if (!selectedDeductionEmployee || !payrollCanEdit) return;
    const amount = roundToCurrency(deductionForm.amount);
    if (amount <= 0) {
      setPayrollMessage('Deduction amount must be greater than zero.');
      return;
    }
    const deductionPayload = {
      id: deductionForm.id || createId('ded'),
      date: deductionForm.date || new Date().toISOString().split('T')[0],
      type: deductionForm.type || 'Cash Advance',
      amount,
      notes: deductionForm.notes || '',
      source: 'manual',
      processed: false,
      orderId: null,
    };
    syncPayrollState({
      ...payrollData,
      employees: (payrollData.employees || []).map((employee) => {
        if (employee.id !== selectedDeductionEmployee.id) return employee;
        const current = [...(employee.deductions || [])];
        const hasExisting = current.some((deduction) => deduction.id === deductionPayload.id);
        const nextDeductions = hasExisting
          ? current.map((deduction) => (deduction.id === deductionPayload.id ? deductionPayload : deduction))
          : [...current, deductionPayload];
        return { ...employee, deductions: nextDeductions };
      }),
    }, 'Deduction entry saved.');
    setDeductionForm({
      id: null,
      date: new Date().toISOString().split('T')[0],
      type: 'Cash Advance',
      amount: '',
      notes: '',
    });
  };

  const deleteDeductionEntry = (deductionId) => {
    if (!selectedDeductionEmployee || !payrollCanEdit) return;
    syncPayrollState({
      ...payrollData,
      employees: (payrollData.employees || []).map((employee) => {
        if (employee.id !== selectedDeductionEmployee.id) return employee;
        return {
          ...employee,
          deductions: (employee.deductions || []).filter((deduction) => deduction.id !== deductionId),
        };
      }),
    }, 'Deduction entry deleted.');
  };

  // ── Nav items (memoised) — must be declared before any early return ──────
  const navGroups = useMemo(
    () => [
      { type: 'item', key: 'dashboard', label: '📊 Dashboard' },
      {
        type: 'group', key: 'transactions', label: '💳 Transactions',
        children: [
          { key: 'bills', label: '🧾 Bills' },
          { key: 'manual', label: '✏️ Manual Entry' },
        ],
      },
      {
        type: 'group', key: 'inventory', label: '📦 Inventory',
        children: [
          { key: 'costing', label: '💰 Price Costing' },
          { key: 'rr', label: '📋 Receiving Report' },
          { key: 'inventory', label: '📊 Inventory Report' },
        ],
      },
      {
        type: 'group', key: 'financial', label: '📈 Financial Reports',
        children: [
          { key: 'cashflow', finTab: true, label: '💵 Cash Flow' },
          { key: 'pl', finTab: true, label: '📊 Profit & Loss' },
          { key: 'balance', finTab: true, label: '⚖️ Balance Sheet' },
          { key: 'sales', finTab: true, label: '🛒 Sales Report' },
          { key: 'budget', finTab: true, label: '📋 Budget Variance' },
          { key: 'tax', finTab: true, label: '🏦 Tax Report' },
          { key: 'journal', finTab: false, label: '📒 Journal Entries' },
          { key: 'coa', finTab: true, label: '📑 Chart of Accounts' },
        ],
      },
      {
        type: 'group', key: 'payroll', label: '💼 Payroll',
        children: [
          { key: 'attendance_sheet', label: '🗂️ Attendance Sheet' },
        ],
      },
      { type: 'item', key: 'profile', label: '👤 My Profile' },
    ],
    [],
  );

  // ── Auth guard ────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: 'Poppins, sans-serif', fontSize: 18 }}>
        ⏳ Loading…
      </div>
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  const fmt = (val) => `₱${Number(val).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

  const suggestCode = (dept, items) => {
    const count = items.filter((i) => i.code && i.code.startsWith(dept)).length;
    return dept + String(count + 1).padStart(6, '0');
  };

  // ── Inventory helpers ─────────────────────────────────────────────────────
  const openInvDialog = (item = null) => {
    setInvEditItem(item);
    if (item) {
      setInvForm({
        name: item.name || '',
        department: item.department || 'DKS',
        code: item.code || '',
        uom: item.uom || 'pcs',
        cost_per_unit: String(item.cost_per_unit || 0),
        current_stock: String(item.current_stock || 0),
        min_stock: String(item.min_stock || 0),
      });
    } else {
      const dept = 'DKS';
      setInvForm({ name: '', department: dept, code: suggestCode(dept, inventoryItems), uom: 'pcs', cost_per_unit: '0', current_stock: '0', min_stock: '0' });
    }
    setInvDialogOpen(true);
  };

  const saveInvItem = async () => {
    if (!supabase) return;
    try {
      const payload = {
        name: invForm.name,
        department: invForm.department,
        code: invForm.code,
        uom: invForm.uom,
        cost_per_unit: Number(invForm.cost_per_unit),
        current_stock: Number(invForm.current_stock),
        min_stock: Number(invForm.min_stock),
      };
      if (invEditItem) {
        await supabase.from('admin_inventory_items').update(payload).eq('id', invEditItem.id);
      } else {
        await supabase.from('admin_inventory_items').insert(payload);
      }
      setInvDialogOpen(false);
      // If triggered from RR item picker, refresh invItems and re-open the picker
      if (rrNewItemReturnIdx !== null) {
        const returnIdx = rrNewItemReturnIdx;
        setRrNewItemReturnIdx(null);
        await fetchRR();
        setInvPickerQuery('');
        setInvPickerOpen(returnIdx);
      } else {
        fetchInventory();
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const archiveInvItem = async (item) => {
    if (!supabase) return;
    try {
      await supabase.from('admin_inventory_items').update({ is_archived: true }).eq('id', item.id);
      setInvDeleteConfirm(null);
      fetchInventory();
    } catch (err) {
      setError(err.message);
    }
  };

  // ── Costing helpers ───────────────────────────────────────────────────────

  // Category-level contribution margin ratio targets (2.3.3–2.3.9)
  const CM_TARGETS = {
    'Snacks & Bites': 0.40,
    'Noodles': 0.40,
    'Rice & More': 0.40,
    'Milktea Series': 0.40,
    'Hot/Iced Drinks': 0.40,
    'Frappe Series': 0.40,
    'Fruit Soda & Lemonade': 0.40,
  };

  const filteredCostingHeaders = costingHeaders.filter((item) => {
    const q = costingSearch.trim().toLowerCase();
    if (q && !(item.menu_item_name || '').toLowerCase().includes(q)) return false;
    if (!costingCmStatusFilter) return true;
    const sp = Number(item.selling_price) || 0;
    const tec = Number(item.total_estimated_cogs) || 0;
    const cmPct = sp > 0 ? ((sp - tec) / sp) * 100 : 0;
    if (costingCmStatusFilter === 'above-target') return cmPct > 50;
    if (costingCmStatusFilter === 'critical') return cmPct >= 40 && cmPct < 50;
    if (costingCmStatusFilter === 'below-target') return cmPct < 40;
    return true;
  });

  // Derive computed costing values from form fields
  const calcCostingValues = (form) => {
    const lineSubtotal = (form.lines || []).reduce(
      (s, l) => s + (Number(l.qty) || 0) * (Number(l.cost_per_unit) || 0), 0,
    );
    const baseCOGS = lineSubtotal + (Number(form.labor_cost) || 0) + (Number(form.overhead_cost) || 0);
    const wastageAmt = Number(form.wastage_amount) || 0;
    const contingencyAmt = Number(form.contingency_amount) || 0;
    const totalEstimatedCOGS = baseCOGS + wastageAmt + contingencyAmt;
    // Selling price is locked to the menu item price
    const sellingPrice = Number(form.menu_item_price) || 0;
    const cmAmt = sellingPrice - totalEstimatedCOGS;
    const cmPct = sellingPrice > 0 ? (cmAmt / sellingPrice) * 100 : 0;
    return { lineSubtotal, baseCOGS, totalEstimatedCOGS, sellingPrice, cmAmt, cmPct };
  };

  const openCostingDialog = (item = null) => {
    setCostingEditItem(item);
    if (item) {
      setCostingForm({
        id: item.id,
        menu_item_name: item.menu_item_name || '',
        menu_category: item.menu_category || '',
        menu_item_price: String(item.selling_price || 0),
        labor_cost: String(item.labor_cost || 0),
        overhead_cost: String(item.overhead_cost || 0),
        wastage_pct: String(item.wastage_pct || 0),
        wastage_amount: String(item.wastage_amount || 0),
        contingency_pct: String(item.contingency_pct || 0),
        contingency_amount: String(item.contingency_amount || 0),
        contribution_margin_pct: String(item.contribution_margin_pct || 0),
        contribution_margin_amount: String(item.contribution_margin_amount || 0),
        lines: (item.lines || []).map((l) => ({
          id: l.id,
          inventory_item_id: l.inventory_item_id || '',
          uom: l.uom || '',
          qty: String(l.qty || 0),
          cost_per_unit: String(l.cost || 0),
        })),
      });
    } else {
      setCostingForm({
        id: null,
        menu_item_name: '',
        menu_category: '',
        menu_item_price: '0',
        labor_cost: '0',
        overhead_cost: '0',
        wastage_pct: '0',
        wastage_amount: '0',
        contingency_pct: '0',
        contingency_amount: '0',
        contribution_margin_pct: '0',
        contribution_margin_amount: '0',
        lines: [],
      });
    }
    setMenuSearchOpen(false);
    setMenuSearchQuery('');
    setCostingDialogOpen(true);
  };

  const saveCostingItem = async () => {
    if (!supabase) return;
    try {
      const { totalEstimatedCOGS, sellingPrice, cmAmt, cmPct } = calcCostingValues(costingForm);
      const headerPayload = {
        menu_item_name: costingForm.menu_item_name,
        menu_category: costingForm.menu_category || null,
        labor_cost: Number(costingForm.labor_cost),
        overhead_cost: Number(costingForm.overhead_cost),
        wastage_pct: Number(costingForm.wastage_pct),
        wastage_amount: Number(costingForm.wastage_amount),
        contingency_pct: Number(costingForm.contingency_pct),
        contingency_amount: Number(costingForm.contingency_amount),
        contribution_margin_pct: cmPct,
        contribution_margin_amount: cmAmt,
        total_estimated_cogs: totalEstimatedCOGS,
        selling_price: sellingPrice,
        updated_at: new Date().toISOString(),
      };

      let headerId = costingForm.id;
      if (headerId) {
        await supabase.from('price_costing_headers').update(headerPayload).eq('id', headerId);
      } else {
        const { data: inserted, error: insErr } = await supabase
          .from('price_costing_headers')
          .insert({ ...headerPayload, created_at: new Date().toISOString() })
          .select()
          .single();
        if (insErr) throw insErr;
        headerId = inserted.id;
      }

      // Delete old line items, then re-insert
      await supabase.from('price_costing_items').delete().eq('costing_header_id', headerId);

      if (costingForm.lines.length > 0) {
        const lineRows = costingForm.lines.map((l) => ({
          costing_header_id: headerId,
          menu_item_name: costingForm.menu_item_name,
          inventory_item_id: l.inventory_item_id || null,
          uom: l.uom || '',
          qty: Number(l.qty),
          cost: Number(l.cost_per_unit),
          total_cogs: totalEstimatedCOGS,
          labor_cost: 0,
          overhead_cost: 0,
          wastage_pct: 0,
          contingency_pct: 0,
          contribution_margin_pct: 0,
          selling_price: sellingPrice,
        }));
        const { error: lineErr } = await supabase.from('price_costing_items').insert(lineRows);
        if (lineErr) throw lineErr;
      }

      setCostingDialogOpen(false);
      fetchCosting();
    } catch (err) {
      setError(err.message);
    }
  };

  // ── RR helpers ────────────────────────────────────────────────────────────
  const calcFreight = (lineItems, freightIn) => {
    const freight = Number(freightIn) || 0;
    const totalCost = lineItems.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.cost) || 0), 0);
    return lineItems.map((item) => {
      const tc = (Number(item.qty) || 0) * (Number(item.cost) || 0);
      const fa = totalCost > 0 ? freight * (tc / totalCost) : 0;
      return { ...item, total_cost: tc, freight_allocated: fa, total_landed_cost: tc + fa };
    });
  };

  const openRRDialog = async (item = null) => {
    setRrEditItem(item);
    // Reset line items immediately so stale data from a previous edit never
    // shows while the async fetch is in-flight.
    setRrLineItems([]);
    if (item) {
      // Fetch vendor details since receiving_reports doesn't store them directly
      let vendorAddress = '';
      let vendorContact = '';
      let vendorTin = '';
      if (supabase && item.vendor_id) {
        const { data: vd } = await supabase.from('vendors').select('address, contact_number, tin').eq('id', item.vendor_id).single();
        if (vd) {
          vendorAddress = vd.address || '';
          vendorContact = vd.contact_number || '';
          vendorTin = vd.tin || '';
        }
      }
      setRrForm({
        rr_number: item.rr_number || '',
        vendor_id: item.vendor_id || '',
        vendor_name: item.vendor?.name || '',
        vendor_address: vendorAddress,
        vendor_contact: vendorContact,
        vendor_tin: vendorTin,
        date: item.date || new Date().toISOString().split('T')[0],
        terms: String(item.terms || ''),
        freight_in: String(item.freight_in || 0),
      });
      if (supabase) {
        const { data: li, error: liLoadErr } = await supabase
          .from('receiving_report_items')
          .select('*, inventory_item:admin_inventory_items(id,name,code,uom)')
          .eq('receiving_report_id', item.id);
        // Surface any fetch error so the user knows items failed to load
        if (liLoadErr) setError(`Failed to load line items: ${liLoadErr.message}`);
        setRrLineItems(
          calcFreight(
            (li || []).map((l) => ({
              id: l.id,
              inventory_item_id: l.inventory_item_id || '',
              // Fall back to the stored inventory_name when the join returns nothing
              inventory_name: l.inventory_item?.name || l.inventory_name || '',
              inventory_code: l.inventory_item?.code || l.inventory_code || '',
              uom: l.uom || '',
              qty: String(l.qty || 0),
              cost: String(l.cost || 0),
              total_cost: (Number(l.qty) || 0) * (Number(l.cost) || 0),
              freight_allocated: Number(l.freight_allocated) || 0,
              total_landed_cost: Number(l.total_landed_cost) || 0,
            })),
            item.freight_in,
          ),
        );
      }
    } else {
      let rrNum = '';
      if (supabase) {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('generate_rr_number');
        if (!rpcErr && rpcData) {
          rrNum = rpcData;
        } else {
          rrNum = 'RR-' + new Date().toISOString().slice(2, 4) + String(Date.now()).slice(-7);
        }
      } else {
        rrNum = 'RR-' + new Date().toISOString().slice(2, 4) + String(Date.now()).slice(-7);
      }
      setRrForm({
        rr_number: rrNum,
        vendor_id: '',
        vendor_name: '',
        vendor_address: '',
        vendor_contact: '',
        vendor_tin: '',
        date: new Date().toISOString().split('T')[0],
        terms: '',
        freight_in: '0',
      });
      setRrLineItems([]);
    }
    setRrSaveError('');
    setRrDialogOpen(true);
  };

  const addRRLineItem = () => {
    setRrLineItems((prev) => [
      ...prev,
      {
        id: 'tmp-' + Date.now(),
        inventory_item_id: '',
        inventory_name: '',
        inventory_code: '',
        uom: '',
        qty: '1',
        cost: '0',
        total_cost: 0,
        freight_allocated: 0,
        total_landed_cost: 0,
      },
    ]);
  };

  const updateRRLineItem = (idx, field, value) => {
    setRrLineItems((prev) => {
      const updated = prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item));
      return calcFreight(updated, rrForm.freight_in);
    });
  };

  const removeRRLineItem = (idx) => {
    setRrLineItems((prev) => {
      const updated = prev.filter((_, i) => i !== idx);
      return calcFreight(updated, rrForm.freight_in);
    });
  };

  const selectRRInventoryItem = (idx, invItem) => {
    setRrLineItems((prev) => {
      const updated = prev.map((item, i) =>
        i === idx
          ? { ...item, inventory_item_id: invItem.id, inventory_name: invItem.name, inventory_code: invItem.code || '', uom: invItem.uom || '', cost: String(invItem.cost_per_unit || 0) }
          : item,
      );
      return calcFreight(updated, rrForm.freight_in);
    });
  };

  const saveRR = async () => {
    if (!supabase) return;
    setRrSaveError('');
    setSavingRR(true);
    try {
      if (!rrForm.vendor_id) { setRrSaveError('Please select a vendor (Contact) before saving.'); return; }
      const emptyName = rrLineItems.find((li) => !li.inventory_name);
      if (emptyName) { setRrSaveError('Please select an inventory item for every line before saving.'); return; }
      const totalLC = rrLineItems.reduce((s, i) => s + (i.total_landed_cost || 0), 0);
      const rrPayload = {
        rr_number: rrForm.rr_number,
        vendor_id: rrForm.vendor_id || null,
        date: rrForm.date,
        terms: rrForm.terms !== '' ? parseInt(rrForm.terms, 10) : null,
        freight_in: Number(rrForm.freight_in),
        total_landed_cost: totalLC,
        status: 'draft',
      };
      let rrId;
      if (rrEditItem) {
        const { error: updErr } = await supabase.from('receiving_reports').update(rrPayload).eq('id', rrEditItem.id);
        if (updErr) throw updErr;
        rrId = rrEditItem.id;
        await supabase.from('receiving_report_items').delete().eq('receiving_report_id', rrId);
      } else {
        const { data: inserted, error: insErr } = await supabase.from('receiving_reports').insert(rrPayload).select().single();
        if (insErr) throw insErr;
        rrId = inserted.id;
      }
      if (rrLineItems.length > 0) {
        const linePayloads = rrLineItems.map((li) => ({
          receiving_report_id: rrId,
          inventory_item_id: li.inventory_item_id || null,
          inventory_name: li.inventory_name || li.inventory_code || '(unnamed item)',
          inventory_code: li.inventory_code || null,
          uom: li.uom || 'pcs',
          qty: Number(li.qty),
          cost: Number(li.cost),
          freight_allocated: li.freight_allocated,
        }));
        // Throw so the error surfaces in the UI instead of silently losing items.
        const { error: liErr } = await supabase.from('receiving_report_items').insert(linePayloads);
        if (liErr) throw liErr;
      }
      setRrDialogOpen(false);
      fetchRR();
    } catch (err) {
      setRrSaveError(err?.message || 'Save failed. Please try again.');
    } finally {
      setSavingRR(false);
    }
  };

  const approveRR = async (rr) => {
    if (!supabase) return;
    try {
      const { data: lineItems } = await supabase
        .from('receiving_report_items')
        .select('*')
        .eq('receiving_report_id', rr.id);

      await Promise.all(
        (lineItems || []).map(async (item) => {
          // Resolve the inventory item — prefer the stored FK, fall back to name match
          let invId = item.inventory_item_id;
          if (!invId && item.inventory_name) {
            const { data: found } = await supabase
              .from('admin_inventory_items')
              .select('id')
              .ilike('name', item.inventory_name.trim())
              .limit(1)
              .maybeSingle();
            if (found?.id) {
              // Persist the backfilled FK so future operations work correctly
              await supabase
                .from('receiving_report_items')
                .update({ inventory_item_id: found.id })
                .eq('id', item.id);
              invId = found.id;
            }
          }
          if (!invId) return;

          const { data: inv } = await supabase
            .from('admin_inventory_items')
            .select('current_stock, cost_per_unit')
            .eq('id', invId)
            .single();
          const currentStock = Number(inv?.current_stock) || 0;
          const currentCost = Number(inv?.cost_per_unit) || 0;
          const newQty = Number(item.qty) || 0;
          const newCost = Number(item.cost) || 0;
          const totalNewStock = currentStock + newQty;
          // Weighted average cost method
          const avgCost = totalNewStock > 0
            ? (currentStock * currentCost + newQty * newCost) / totalNewStock
            : newCost;
          await supabase
            .from('admin_inventory_items')
            .update({
              current_stock: totalNewStock,
              cost_per_unit: Math.round(avgCost * 100) / 100,
            })
            .eq('id', invId);
        }),
      );

      const { error: approveErr } = await supabase
        .from('receiving_reports')
        .update({ status: 'approved', inventory_update_applied: true })
        .eq('id', rr.id);
      if (approveErr) throw new Error('Failed to approve receiving report: ' + approveErr.message);

      // Journal Entry: Debit Inventory / Credit Accounts Payable
      // Compute total landed cost: prefer the generated column, fall back to qty×cost+freight
      const totalLC = (lineItems || []).reduce((s, li) => {
        const tlc = Number(li.total_landed_cost) || (Number(li.qty) * Number(li.cost) + Number(li.freight_allocated));
        return s + tlc;
      }, 0);
      if (totalLC > 0) {
        const { error: jeErr } = await supabase.from('journal_entries').insert({
          date: rr.date || new Date().toISOString().split('T')[0],
          description: `RR Approval: ${rr.rr_number}`,
          debit_account: 'Inventory',
          credit_account: 'Accounts Payable',
          amount: Math.round(totalLC * 100) / 100,
          reference_id: rr.id,
          reference_type: 'receiving_report',
          name: rr.vendor?.name || '',
        });
        if (jeErr) console.error('[Admin] RR Approval journal entry failed:', jeErr.message);
      }

      fetchRR();
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteRR = async (rr) => {
    if (!supabase) return;
    try {
      await supabase.from('receiving_reports').delete().eq('id', rr.id);
      setRrDeleteConfirm(null);
      fetchRR();
    } catch (err) {
      setError(err.message);
    }
  };

  const openRRView = async (rr) => {
    setRrViewItem(rr);
    setRrViewLineItems([]);
    if (supabase) {
      const { data: li } = await supabase
        .from('receiving_report_items')
        .select('*, inventory_item:admin_inventory_items(id,name,code,uom)')
        .eq('receiving_report_id', rr.id);
      setRrViewLineItems(li || []);
    }
  };

  const openPayRRDialog = (rr) => {
    setRrPayItem(rr);
    setRrPayForm({
      payment_date: new Date().toISOString().split('T')[0],
      amount: String(rr.total_landed_cost || 0),
      payment_mode: 'cash_on_hand',
      reference_number: '',
      notes: '',
    });
    setRrPayDialogOpen(true);
  };

  const payRR = async () => {
    if (!supabase || !rrPayItem) return;
    try {
      const amt = Math.round((Number(rrPayForm.amount) || 0) * 100) / 100;
      if (amt <= 0) { setError('Payment amount must be greater than zero.'); return; }

      // Record payment
      const { error: pmtErr } = await supabase.from('rr_payments').insert({
        receiving_report_id: rrPayItem.id,
        payment_date: rrPayForm.payment_date,
        amount: amt,
        payment_mode: rrPayForm.payment_mode,
        reference_number: rrPayForm.reference_number || null,
        notes: rrPayForm.notes || null,
      });
      if (pmtErr) throw pmtErr;

      // Journal Entry based on payment mode
      // Cash on Hand: Debit Accounts Payable, Credit Cash on Hand
      // Cash in Bank: Debit Accounts Payable, Credit Cash in Bank
      // Credit Card:  Debit Accounts Payable, Credit Credit Card Payable
      // Spaylater:    Debit Accounts Payable, Credit Spaylater Payable
      const creditAccount =
        rrPayForm.payment_mode === 'cash_in_bank' ? 'Cash in Bank' :
        rrPayForm.payment_mode === 'credit_card'  ? 'Credit Card Payable' :
        rrPayForm.payment_mode === 'spaylater'    ? 'Spaylater Payable' :
        'Cash on Hand';
      const { error: jeErr } = await supabase.from('journal_entries').insert({
        date: rrPayForm.payment_date,
        description: `RR Payment: ${rrPayItem.rr_number} (${rrPayForm.payment_mode.replace(/_/g, ' ')})`,
        debit_account: 'Accounts Payable',
        credit_account: creditAccount,
        amount: amt,
        reference_id: rrPayItem.id,
        reference_type: 'rr_payment',
        name: rrPayItem.vendor?.name || '',
      });
      if (jeErr) console.error('[Admin] RR Payment journal entry failed:', jeErr.message);

      // Mark RR as paid
      await supabase.from('receiving_reports').update({ status: 'paid' }).eq('id', rrPayItem.id);

      setRrPayDialogOpen(false);
      setRrPayItem(null);
      fetchRR();
    } catch (err) {
      setError(err.message);
    }
  };

  const searchVendors = async (q) => {
    if (!supabase || !q) return;
    const { data } = await supabase.from('vendors').select('*').ilike('name', `%${q}%`).limit(10);
    setVendorResults(data || []);
  };

  const enrollVendor = async () => {
    if (!supabase) return;
    try {
      const { data, error: err } = await supabase
        .from('vendors')
        .insert({ name: newVendorForm.name, address: newVendorForm.address, contact_number: newVendorForm.contact, tin: newVendorForm.tin })
        .select()
        .single();
      if (err) throw err;
      setRrForm((prev) => ({
        ...prev,
        vendor_id: data.id,
        vendor_name: data.name,
        vendor_address: data.address || '',
        vendor_contact: data.contact_number || '',
        vendor_tin: data.tin || '',
      }));
      setVendorSearchOpen(false);
      setEnrollingVendor(false);
      setNewVendorForm({ name: '', address: '', contact: '', tin: '' });
    } catch (err) {
      setError(err.message);
    }
  };

  // ── Profile helpers ───────────────────────────────────────────────────────
  const saveProfile = async () => {
    if (!supabase || !session?.user?.id) return;
    try {
      await supabase
        .from('users')
        .update({ full_name: profileForm.full_name, phone: profileForm.phone, address: profileForm.address })
        .eq('id', session.user.id);
      setProfileEditMode(false);
      fetchProfile();
    } catch (err) {
      setError(err.message);
    }
  };

  const savePassword = async () => {
    if (!supabase) return;
    if (pwForm.newPass !== pwForm.confirmPass) {
      setPwError('Passwords do not match.');
      return;
    }
    try {
      const { error: err } = await supabase.auth.updateUser({ password: pwForm.newPass });
      if (err) throw err;
      setPwDialogOpen(false);
      setPwForm({ newPass: '', confirmPass: '' });
      setPwError('');
    } catch (err) {
      setPwError(err.message);
    }
  };

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.replace('/login');
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <Head>
        <title>Admin Interface - Bite Bonansa Cafe</title>
      </Head>

      <div style={styles.root}>
        {/* ── Sidebar ── */}
        <aside style={styles.sidebar}>
          <div style={styles.sidebarBrand}>
            <span style={styles.brandName}>Bite Bonansa</span>
            <span style={styles.brandSub}>Admin Panel</span>
          </div>

          <nav style={styles.nav}>
            {navGroups.map((item) => {
              if (item.type === 'item') {
                return (
                  <button
                    key={item.key}
                    onClick={() => setActiveTab(item.key)}
                    style={{ ...styles.navBtn, ...(activeTab === item.key ? styles.navBtnActive : styles.navBtnInactive) }}
                  >
                    {item.label}
                  </button>
                );
              }
              // group
              const isChildActive = (item.children || []).some((c) =>
                c.finTab ? (activeTab === 'financial' && finSubTab === c.key) : (activeTab === c.key),
              );
              const isOpen = navGroupOpen[item.key] || isChildActive;
              return (
                <div key={item.key}>
                  <button
                    onClick={() => setNavGroupOpen((p) => ({ ...p, [item.key]: !p[item.key] }))}
                    style={{
                      ...styles.navBtn, ...styles.navBtnInactive,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      fontWeight: isChildActive ? 600 : 400,
                      color: isChildActive ? '#ffc107' : '#ccc',
                    }}
                  >
                    <span>{item.label}</span>
                    <span style={{ fontSize: 10 }}>{isOpen ? '▾' : '▸'}</span>
                  </button>
                  {isOpen && (item.children || []).map((child) => {
                    const childActive = child.finTab
                      ? (activeTab === 'financial' && finSubTab === child.key)
                      : (activeTab === child.key);
                    return (
                      <button
                        key={child.key}
                        onClick={() => {
                          if (child.finTab) {
                            setActiveTab('financial');
                            setFinSubTab(child.key);
                          } else {
                            setActiveTab(child.key);
                          }
                        }}
                        style={{
                          ...styles.navBtn,
                          ...(childActive ? styles.navBtnActive : styles.navBtnInactive),
                          paddingLeft: 24,
                          fontSize: 12,
                        }}
                      >
                        {child.label}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          <div style={styles.sidebarFooter}>
            <span style={styles.userEmail}>{session?.user?.email}</span>
            <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
          </div>
        </aside>

        {/* ── Main ── */}
        <main style={styles.main}>
          {error && (
            <div style={styles.errorBanner}>
              ⚠ {error}
              <button onClick={() => setError(null)} style={styles.errorClose}>✕</button>
            </div>
          )}

          {/* ──────────────── DASHBOARD ──────────────── */}
          {activeTab === 'dashboard' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h1 style={styles.pageTitle}>Dashboard</h1>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[{ key: 'overview', label: '📊 Overview' }, { key: 'stock-alerts', label: '⚠️ Stock Alerts' }].map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setDashSubTab(t.key)}
                      style={{
                        padding: '7px 16px', borderRadius: 20, cursor: 'pointer', fontSize: 12,
                        fontFamily: 'Poppins, sans-serif',
                        border: `1px solid ${dashSubTab === t.key ? '#ffc107' : '#444'}`,
                        background: dashSubTab === t.key ? '#ffc107' : 'transparent',
                        color: dashSubTab === t.key ? '#000' : '#ccc',
                        fontWeight: dashSubTab === t.key ? 700 : 400,
                      }}
                    >{t.label}</button>
                  ))}
                </div>
              </div>

              {/* ── Overview sub-tab ── */}
              {dashSubTab === 'overview' && (
                <>
                  {loading && <p style={styles.loadingText}>Loading…</p>}
                  <div style={styles.dashGrid}>
                    {/* Widget 1.1 – Sales Trend (Mon–Sun weekly dates) */}
                    <div style={styles.card}>
                      <h3 style={styles.cardTitle}>Sales Trend (12 Weeks)</h3>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={salesTrend}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                          <XAxis dataKey="week" stroke="#ccc" tick={{ fill: '#ccc', fontSize: 11 }} />
                          <YAxis stroke="#ccc" tick={{ fill: '#ccc', fontSize: 11 }} />
                          <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #333', color: '#fff' }} formatter={(v) => fmt(v)} />
                          <Bar dataKey="sales" fill="#ffc107" name="Sales" />
                        </BarChart>
                      </ResponsiveContainer>
                      <p style={{ fontSize: 11, color: '#666', marginTop: 4 }}>12-week rolling window; each bar = Mon–Sun</p>
                    </div>

                    {/* Widget 1.2 – Cash Flow (from Journal Entries, Mon–Sun weekly) */}
                    <div style={styles.card}>
                      <h3 style={styles.cardTitle}>Cash Flow Report (Mon–Sun Weekly)</h3>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={cashFlowData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                          <XAxis dataKey="week" stroke="#ccc" tick={{ fill: '#ccc', fontSize: 11 }} />
                          <YAxis stroke="#ccc" tick={{ fill: '#ccc', fontSize: 11 }} />
                          <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #333', color: '#fff' }} formatter={(v) => fmt(v)} />
                          <Legend wrapperStyle={{ color: '#ccc' }} />
                          <Bar dataKey="inflow" fill="#4caf50" name="Inflow (Cash on Hand + Bank)" />
                          <Bar dataKey="outflow" fill="#f44336" name="Outflow (Cash on Hand + Bank)" />
                        </BarChart>
                      </ResponsiveContainer>
                      {(() => {
                        const total = cashFlowSummary.inflow + cashFlowSummary.outflow;
                        const inPct = total > 0 ? ((cashFlowSummary.inflow / total) * 100).toFixed(1) : 0;
                        const outPct = total > 0 ? ((cashFlowSummary.outflow / total) * 100).toFixed(1) : 0;
                        return (
                          <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 13 }}>
                            <span style={{ color: '#4caf50' }}>Inflow: {inPct}%</span>
                            <span style={{ color: '#f44336' }}>Outflow: {outPct}%</span>
                          </div>
                        );
                      })()}
                      <p style={{ fontSize: 11, color: '#666', marginTop: 4 }}>Source: Journal Entries (Cash on Hand &amp; Cash in Bank)</p>
                    </div>

                    {/* Widget 1.3 – Top Selling Items */}
                    <div style={styles.card}>
                      <h3 style={styles.cardTitle}>Top Selling Items</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <p style={{ fontSize: 12, color: '#aaa', marginBottom: 6 }}>This Month</p>
                          <table style={styles.table}>
                            <thead>
                              <tr>
                                <th style={styles.th}>#</th>
                                <th style={styles.th}>Item</th>
                                <th style={styles.th}>Qty</th>
                              </tr>
                            </thead>
                            <tbody>
                              {saleableItemsThisMonth.map((item, idx) => (
                                <tr key={idx} style={idx % 2 === 0 ? styles.trEven : styles.trOdd}>
                                  <td style={styles.td}>{idx + 1}</td>
                                  <td style={styles.td}>{item.name}</td>
                                  <td style={styles.td}>{item.qty}</td>
                                </tr>
                              ))}
                              {saleableItemsThisMonth.length === 0 && (
                                <tr><td colSpan={3} style={{ ...styles.td, textAlign: 'center', color: '#666' }}>No data</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                        <div>
                          <p style={{ fontSize: 12, color: '#aaa', marginBottom: 6 }}>Last Month</p>
                          <table style={styles.table}>
                            <thead>
                              <tr>
                                <th style={styles.th}>#</th>
                                <th style={styles.th}>Item</th>
                                <th style={styles.th}>Qty</th>
                              </tr>
                            </thead>
                            <tbody>
                              {saleableItemsLastMonth.map((item, idx) => (
                                <tr key={idx} style={idx % 2 === 0 ? styles.trEven : styles.trOdd}>
                                  <td style={styles.td}>{idx + 1}</td>
                                  <td style={styles.td}>{item.name}</td>
                                  <td style={styles.td}>{item.qty}</td>
                                </tr>
                              ))}
                              {saleableItemsLastMonth.length === 0 && (
                                <tr><td colSpan={3} style={{ ...styles.td, textAlign: 'center', color: '#666' }}>No data</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    {/* Widget 1.4 – Monthly Profit & Loss + Budget Forecast */}
                    <div style={styles.card}>
                      <h3 style={styles.cardTitle}>Monthly Profit &amp; Loss</h3>
                      {monthlyPnLData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={monthlyPnLData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                            <XAxis dataKey="month" stroke="#ccc" tick={{ fill: '#ccc', fontSize: 11 }} />
                            <YAxis stroke="#ccc" tick={{ fill: '#ccc', fontSize: 11 }} />
                            <Tooltip
                              contentStyle={{ background: '#1a1a1a', border: '1px solid #333', color: '#fff' }}
                              formatter={(val) => fmt(val)}
                            />
                            <Legend wrapperStyle={{ color: '#ccc' }} />
                            <Bar dataKey="totalRevenue" fill="#ffc107" name="Total Revenue" />
                            <Bar dataKey="cogs" fill="#ff9800" name="COGS" />
                            <Bar dataKey="opExp" fill="#f44336" name="Operating Expenses" />
                            <Bar dataKey="netProfit" fill="#4caf50" name="Net Profit" />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <p style={{ color: '#666', textAlign: 'center', marginTop: 40 }}>No P&amp;L data</p>
                      )}
                      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #333' }}>
                        <h4 style={{ margin: 0, marginBottom: 8, color: '#ccc', fontSize: 13 }}>Budget Forecast</h4>
                        {budgetForecastData.length > 0 ? (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
                            {[
                              { title: 'Total Revenue', budgetKey: 'budgetRevenue', actualKey: 'actualRevenue', color: '#ffc107' },
                              { title: 'COGS', budgetKey: 'budgetCogs', actualKey: 'actualCogs', color: '#ff9800' },
                              { title: 'Operating Expense', budgetKey: 'budgetOpExp', actualKey: 'actualOpExp', color: '#f44336' },
                              { title: 'Net Profit', budgetKey: 'budgetNetProfit', actualKey: 'actualNetProfit', color: '#4caf50' },
                            ].map(({ title, budgetKey, actualKey, color }) => (
                              <div key={title} style={{ background: '#1a1a1a', borderRadius: 6, padding: 8, border: '1px solid #333' }}>
                                <div style={{ color: '#aaa', fontSize: 11, marginBottom: 4 }}>{title}</div>
                                <ResponsiveContainer width="100%" height={140}>
                                  <BarChart data={budgetForecastData} margin={{ top: 2, right: 4, left: 0, bottom: 2 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                                    <XAxis dataKey="month" stroke="#555" tick={{ fill: '#888', fontSize: 9 }} />
                                    <YAxis stroke="#555" tick={{ fill: '#888', fontSize: 9 }} width={48} tickFormatter={(v) => `₱${Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                                    <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #333', color: '#fff', fontSize: 11 }} formatter={(val) => fmt(val)} />
                                    <Legend wrapperStyle={{ color: '#888', fontSize: 10 }} iconSize={8} />
                                    <Bar dataKey={budgetKey} fill="#2196f3" name="Budget" />
                                    <Bar dataKey={actualKey} fill={color} name="Actual" />
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p style={{ color: '#666', textAlign: 'center', marginTop: 20 }}>No budget forecast data</p>
                        )}
                  </div>
                    </div>
                  </div>
                </>
              )}

              {/* ── Stock Alerts sub-tab ── */}
              {dashSubTab === 'stock-alerts' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h2 style={{ color: '#ffc107', fontSize: 17, margin: 0, fontFamily: 'Playfair Display, serif' }}>
                      ⚠️ Low &amp; Out of Stock Items
                    </h2>
                    <button onClick={fetchLowStockItems} style={styles.primaryBtn}>🔄 Refresh</button>
                  </div>
                  {stockAlertLoading && <p style={styles.loadingText}>Loading…</p>}
                  {!stockAlertLoading && lowStockItems.length === 0 && (
                    <div style={{ ...styles.card, textAlign: 'center', color: '#4caf50', padding: 32 }}>
                      ✅ All inventory items are sufficiently stocked.
                    </div>
                  )}
                  {!stockAlertLoading && lowStockItems.length > 0 && (() => {
                    // Group by last vendor
                    const byVendor = {};
                    lowStockItems.forEach((item) => {
                      const vKey = item.lastVendor?.name || '— No Vendor —';
                      if (!byVendor[vKey]) byVendor[vKey] = { vendor: item.lastVendor, items: [] };
                      byVendor[vKey].items.push(item);
                    });
                    return Object.entries(byVendor).map(([vName, group]) => (
                      <div key={vName} style={{ ...styles.card, marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <h3 style={{ ...styles.cardTitle, marginBottom: 0 }}>
                            🏭 {vName}
                          </h3>
                          <button
                            style={{ ...styles.primaryBtn, fontSize: 12, padding: '6px 14px' }}
                            onClick={() => {
                              // Pre-fill RR and switch to RR tab
                              const rrItems = group.items.map((item) => ({
                                id: 'tmp-' + item.id,
                                inventory_item_id: item.id,
                                inventory_name: item.name,
                                inventory_code: item.code || '',
                                uom: item.uom || '',
                                qty: String(Math.max(1, (Number(item.min_stock) || 0) - (Number(item.current_stock) || 0) + 1)),
                                cost: String(item.cost_per_unit || 0),
                                total_cost: 0,
                                freight_allocated: 0,
                                total_landed_cost: 0,
                              }));
                              const yy = new Date().getFullYear().toString().slice(-2);
                              setRrForm({
                                rr_number: 'RR-' + yy + String(Date.now()).slice(-7),
                                vendor_id: group.vendor?.id || '',
                                vendor_name: vName === '— No Vendor —' ? '' : vName,
                                vendor_address: '',
                                vendor_contact: '',
                                vendor_tin: '',
                                date: new Date().toISOString().split('T')[0],
                                terms: '',
                                freight_in: '0',
                              });
                              setRrLineItems(rrItems);
                              setRrEditItem(null);
                              setRrSaveError('');
                              setRrDialogOpen(true);
                              setActiveTab('rr');
                            }}
                          >
                            📋 Convert to Receiving Report
                          </button>
                        </div>
                        <div style={styles.tableWrap}>
                          <table style={styles.table}>
                            <thead>
                              <tr>
                                {['Code', 'Item Name', 'UoM', 'Current Stock', 'Min Stock', 'Status'].map((h) => (
                                  <th key={h} style={styles.th}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {group.items.map((item, idx) => (
                                <tr key={item.id} style={idx % 2 === 0 ? styles.trEven : styles.trOdd}>
                                  <td style={styles.td}>{item.code}</td>
                                  <td style={styles.td}>{item.name}</td>
                                  <td style={styles.td}>{item.uom}</td>
                                  <td style={{ ...styles.td, color: Number(item.current_stock) <= 0 ? '#f44336' : '#ffc107', fontWeight: 600 }}>
                                    {Number(item.current_stock) || 0}
                                  </td>
                                  <td style={styles.td}>{Number(item.min_stock) || 0}</td>
                                  <td style={styles.td}>
                                    <span style={{
                                      ...styles.badge,
                                      background: item.status === 'Out of Stock' ? '#3a1a1a' : '#3a2a00',
                                      color: item.status === 'Out of Stock' ? '#f44336' : '#ffc107',
                                      border: `1px solid ${item.status === 'Out of Stock' ? '#f44336' : '#ffc107'}`,
                                    }}>{item.status}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>
          )}

          {/* ──────────────── INVENTORY ──────────────── */}
          {activeTab === 'inventory' && (
            <div>
              <div style={styles.tabHeader}>
                <h1 style={styles.pageTitle}>Inventory</h1>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    style={{ ...styles.input, width: 220 }}
                    placeholder="Search by code, name, dept…"
                    value={invSearch}
                    onChange={(e) => setInvSearch(e.target.value)}
                  />
                  <select style={{ ...styles.input, width: 160 }} value={invStatusFilter} onChange={(e) => setInvStatusFilter(e.target.value)}>
                    <option value="">All Status</option>
                    <option value="in-stock">In Stock</option>
                    <option value="low-stock">Low Stock</option>
                    <option value="out-of-stock">Out of Stock</option>
                  </select>
                  <button onClick={() => openInvDialog()} style={styles.primaryBtn}>+ New Item</button>
                </div>
              </div>

              {/* Date Coverage */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, padding: '12px 16px' }}>
                <span style={{ color: '#ffc107', fontWeight: 600, fontSize: 13 }}>📅 Date Coverage:</span>
                <label style={{ color: '#ccc', fontSize: 13 }}>Month:</label>
                <input type="month" style={{ ...styles.input, width: 160 }} value={invCoverageMonth} onChange={(e) => setInvCoverageMonth(e.target.value)} />
                <label style={{ color: '#ccc', fontSize: 13 }}>From:</label>
                <input type="date" style={{ ...styles.input, width: 160, background: '#111', color: '#aaa' }} value={invDateFrom} readOnly />
                <label style={{ color: '#ccc', fontSize: 13 }}>To:</label>
                <input type="date" style={{ ...styles.input, width: 160, background: '#111', color: '#aaa' }} value={invDateTo} readOnly />
                <button onClick={fetchInventory} style={styles.primaryBtn}>Refresh</button>
                <span style={{ color: '#666', fontSize: 11 }}>Beginning = Total Qty Purchased (Jan 1, 2026 – Start Date − 1 day, Paid RRs). Purchases = Paid RRs in range. In Transit = All Draft RRs (all dates). Sold = Delivered/Completed orders. Ending = Beginning + Purchases − Sold. Avg Cost/Unit = Total Landed Cost ÷ Total Purchase Qty. Total Cost = Ending × Avg Cost/Unit.</span>
              </div>

              {loading && <p style={styles.loadingText}>Loading…</p>}
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      {['Code', 'Name', 'Dept', 'UoM', 'Beginning', 'Purchases', 'Sold', 'Ending', 'Avg Cost/Unit (₱)', 'Total Cost (₱)', 'In Transit', 'Status', 'Actions'].map((h) => (
                        <th key={h} style={styles.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(invReport.length > 0 ? invReport : inventoryItems.map((item) => ({ ...item, beginning: 0, purchases: 0, inTransit: 0, sold: 0, ending: Number(item.current_stock) || 0 }))).filter((item) => {
                      const q = invSearch.trim().toLowerCase();
                      if (q) {
                        const code = (item.code || '').toLowerCase();
                        const name = (item.name || '').toLowerCase();
                        const dept = (item.department || '').toLowerCase();
                        const uom = (item.uom || '').toLowerCase();
                        if (!(code.includes(q) || name.includes(q) || dept.includes(q) || uom.includes(q))) return false;
                      }
                      if (!invStatusFilter) return true;
                      const stock = Number(item.current_stock ?? item.ending) || 0;
                      const minStock = Number(item.min_stock) || 0;
                      if (invStatusFilter === 'out-of-stock') return stock <= 0;
                      if (invStatusFilter === 'low-stock') return stock > 0 && stock <= minStock;
                      if (invStatusFilter === 'in-stock') return stock > minStock;
                      return true;
                    }).map((item, idx) => (
                       <tr key={item.id} style={idx % 2 === 0 ? styles.trEven : styles.trOdd}>
                        <td style={styles.td}>{item.code}</td>
                        <td style={styles.td}>{item.name}</td>
                        <td style={styles.td}>{item.department}</td>
                        <td style={styles.td}>{item.uom}</td>
                        <td style={{ ...styles.td, color: '#ccc' }}>{Math.round(Number(item.beginning) || 0)}</td>
                        <td style={{ ...styles.td, color: '#4caf50' }}>{Math.round(Number(item.purchases) || 0)}</td>
                        <td style={{ ...styles.td, color: '#f44336' }}>{Math.round(Number(item.sold) || 0)}</td>
                        <td style={{ ...styles.td, color: '#ffc107', fontWeight: 600 }}>{Math.round(Number(item.ending) || 0)}</td>
                        <td style={styles.td}>{fmt(item.avg_cost ?? item.cost_per_unit)}</td>
                        <td style={{ ...styles.td, color: '#ffc107', fontWeight: 600 }}>{fmt((Number(item.ending) || 0) * (Number(item.avg_cost ?? item.cost_per_unit) || 0))}</td>
                        <td style={{ ...styles.td, color: '#2196f3' }}>{Math.round(Number(item.inTransit) || 0)}</td>
                        <td style={styles.td}>
                          {(() => {
                            const stock = Number(item.current_stock ?? item.ending) || 0;
                            const minStock = Number(item.min_stock) || 0;
                            const isOut = stock <= 0;
                            const isLow = !isOut && minStock > 0 && stock <= minStock;
                            return (
                              <span style={{
                                ...styles.badge,
                                background: isOut ? '#3a1a1a' : isLow ? '#3a2a00' : '#1a3a1a',
                                color: isOut ? '#f44336' : isLow ? '#ffc107' : '#4caf50',
                                border: `1px solid ${isOut ? '#f44336' : isLow ? '#ffc107' : '#4caf50'}`,
                              }}>
                                {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                              </span>
                            );
                          })()}
                        </td>
                        <td style={styles.td}>
                          <button onClick={() => openInvDialog(item)} style={styles.actionBtn}>Edit</button>
                          <button onClick={() => setInvDeleteConfirm(item)} style={{ ...styles.actionBtn, color: '#ff9800', borderColor: '#ff9800' }}>Archive</button>
                        </td>
                      </tr>
                    ))}
                    {inventoryItems.length === 0 && !loading && (
                      <tr><td colSpan={13} style={{ ...styles.td, textAlign: 'center', color: '#666', padding: 32 }}>No inventory items. Add one!</td></tr>
                    )}
                  </tbody>
                  {/* 1.1 Grand Total row */}
                  {invReport.length > 0 && (() => {
                    const grandTotal = invReport.reduce(
                      (s, item) => s + (Number(item.ending) || 0) * (Number(item.avg_cost ?? item.cost_per_unit) || 0), 0,
                    );
                    return (
                      <tfoot>
                        <tr style={{ background: '#1a2a1a', borderTop: '2px solid #ffc107' }}>
                          <td colSpan={9} style={{ ...styles.td, textAlign: 'right', fontWeight: 700, color: '#ffc107' }}>Grand Total:</td>
                          <td style={{ ...styles.td, color: '#ffc107', fontWeight: 700 }}>{fmt(grandTotal)}</td>
                          <td colSpan={3} style={styles.td} />
                        </tr>
                      </tfoot>
                    );
                  })()}
                </table>
              </div>

              {/* Archive Confirm Dialog */}
              <Dialog.Root open={!!invDeleteConfirm} onOpenChange={() => setInvDeleteConfirm(null)}>
                <Dialog.Portal>
                  <Dialog.Overlay style={styles.dialogOverlay} />
                  <Dialog.Content style={{ ...styles.dialogContent, maxWidth: 400 }} aria-describedby={undefined}>
                    <Dialog.Title style={styles.dialogTitle}>Archive Item</Dialog.Title>
                    <p style={{ color: '#ccc', marginBottom: 24 }}>
                      Archive &quot;{invDeleteConfirm?.name}&quot;? It will be hidden from Inventory but its data will be preserved.
                    </p>
                    <div style={styles.dialogFooter}>
                      <Dialog.Close asChild><button style={styles.cancelBtn}>Cancel</button></Dialog.Close>
                      <button onClick={() => archiveInvItem(invDeleteConfirm)} style={{ ...styles.primaryBtn, background: '#ff9800' }}>Archive</button>
                    </div>
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>
            </div>
          )}

          {/* Inventory Enrollment Dialog – rendered globally so it works from any tab (e.g. RR picker + New Item) */}
          <Dialog.Root open={invDialogOpen} onOpenChange={setInvDialogOpen}>
            <Dialog.Portal>
              <Dialog.Overlay style={styles.dialogOverlay} />
              <Dialog.Content style={styles.dialogContent} aria-describedby={undefined}>
                <Dialog.Title style={styles.dialogTitle}>
                  {invEditItem ? 'Edit Inventory Item' : 'New Inventory Item'}
                </Dialog.Title>
                <div style={styles.formGrid}>
                  <label style={styles.label}>Inventory Name</label>
                  <input
                    style={styles.input}
                    value={invForm.name}
                    onChange={(e) => setInvForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Item name"
                  />
                  <label style={styles.label}>Department</label>
                  <select
                    style={styles.input}
                    value={invForm.department}
                    onChange={(e) => {
                      const dept = e.target.value;
                      setInvForm((p) => ({ ...p, department: dept, code: suggestCode(dept, inventoryItems) }));
                    }}
                  >
                    <option value="DKS">DKS – Drinks</option>
                    <option value="PTS">PTS – Pastries</option>
                    <option value="FRD">FRD – Fried</option>
                    <option value="OVH">OVH – Overhead</option>
                  </select>
                  <label style={styles.label}>Inventory Code</label>
                  <div>
                    <input
                      style={styles.input}
                      value={invForm.code}
                      onChange={(e) => setInvForm((p) => ({ ...p, code: e.target.value }))}
                    />
                    <span style={styles.helperText}>Format: DKS######, PTS######, FRD######, OVH######</span>
                  </div>
                  <label style={styles.label}>Unit of Measure</label>
                  <input
                    style={styles.input}
                    value={invForm.uom}
                    onChange={(e) => setInvForm((p) => ({ ...p, uom: e.target.value }))}
                    placeholder="pcs, kg, L, etc."
                  />
                  <label style={styles.label}>Cost per Unit (₱)</label>
                  <input
                    style={styles.input}
                    type="number"
                    value={invForm.cost_per_unit}
                    onChange={(e) => setInvForm((p) => ({ ...p, cost_per_unit: e.target.value }))}
                  />
                  <label style={styles.label}>Current Stock</label>
                  <input
                    style={styles.input}
                    type="number"
                    value={invForm.current_stock}
                    onChange={(e) => setInvForm((p) => ({ ...p, current_stock: e.target.value }))}
                  />
                  <label style={styles.label}>Min Stock (Low-Stock Threshold)</label>
                  <input
                    style={styles.input}
                    type="number"
                    value={invForm.min_stock}
                    onChange={(e) => setInvForm((p) => ({ ...p, min_stock: e.target.value }))}
                  />
                </div>
                <div style={styles.dialogFooter}>
                  <Dialog.Close asChild><button style={styles.cancelBtn}>Cancel</button></Dialog.Close>
                  <button onClick={saveInvItem} style={styles.primaryBtn}>Save</button>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>

          {/* ──────────────── PRICE COSTING ──────────────── */}
          {activeTab === 'costing' && (
            <div>
              <div style={styles.tabHeader}>
                <h1 style={styles.pageTitle}>Price Costing</h1>
                <button onClick={() => openCostingDialog()} style={styles.primaryBtn}>+ New Item</button>
              </div>
              {loading && <p style={styles.loadingText}>Loading…</p>}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    style={{ ...styles.input, width: 280 }}
                    placeholder="Search menu items…"
                    value={costingSearch}
                    onChange={(e) => setCostingSearch(e.target.value)}
                  />
                  <select style={{ ...styles.input, width: 220 }} value={costingCmStatusFilter} onChange={(e) => setCostingCmStatusFilter(e.target.value)}>
                    <option value="">All CM Ratio Status</option>
                    <option value="above-target">Above Target (&gt; 50%)</option>
                    <option value="critical">Critical (40% to &lt; 50%)</option>
                    <option value="below-target">Below Target (39.99% and below)</option>
                  </select>
                </div>
              </div>
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      {['Menu Item', 'Menu Category', 'Total Est. COGS (₱)', 'Selling Price (₱)', 'CM Amount (₱)', 'CM Ratio', 'Actions'].map((h) => (
                        <th key={h} style={styles.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCostingHeaders.map((item, idx) => {
                      const sp = Number(item.selling_price) || 0;
                      const tec = Number(item.total_estimated_cogs) || 0;
                      const cmRatio = sp > 0 ? (sp - tec) / sp : 0;
                      const target = CM_TARGETS[item.menu_category] || null;
                      const isBelowTarget = target !== null && cmRatio < target;
                      return (
                        <tr key={item.id} style={idx % 2 === 0 ? styles.trEven : styles.trOdd}>
                          <td style={styles.td}>
                            <div>{item.menu_item_name}</div>
                          </td>
                          <td style={styles.td}>{item.menu_category || '—'}</td>
                          <td style={styles.td}>{fmt(tec)}</td>
                          <td style={{ ...styles.td, color: '#ffc107' }}>{fmt(sp)}</td>
                          <td style={{ ...styles.td, color: sp - tec >= 0 ? '#4caf50' : '#f44336', fontWeight: 600 }}>{fmt(sp - tec)}</td>
                          <td style={{ ...styles.td, color: isBelowTarget ? '#f44336' : '#4caf50', fontWeight: 600 }}>
                            {isBelowTarget && <span title={`Below target ${(target * 100).toFixed(0)}%`}>⚠️ </span>}
                            {(cmRatio * 100).toFixed(1)}%
                            {target !== null && <div style={{ fontSize: 10, color: '#666', fontWeight: 400 }}>Target: {(target * 100).toFixed(0)}%</div>}
                          </td>
                          <td style={styles.td}>
                            <button onClick={() => openCostingDialog(item)} style={styles.actionBtn}>Edit</button>
                            <button
                              onClick={async () => {
                                if (!supabase) return;
                                await supabase.from('price_costing_items').delete().eq('costing_header_id', item.id);
                                await supabase.from('price_costing_headers').delete().eq('id', item.id);
                                fetchCosting();
                              }}
                              style={{ ...styles.actionBtn, color: '#f44336', borderColor: '#f44336' }}
                            >Delete</button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredCostingHeaders.length === 0 && !loading && (
                      <tr><td colSpan={7} style={{ ...styles.td, textAlign: 'center', color: '#666', padding: 32 }}>{costingHeaders.length === 0 ? 'No costing items yet.' : 'No costing items match current filters.'}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Costing Dialog — 75% screen width */}
              <Dialog.Root open={costingDialogOpen} onOpenChange={(open) => { if (!open) setMenuSearchOpen(false); setCostingDialogOpen(open); }}>
                <Dialog.Portal>
                  <Dialog.Overlay style={styles.dialogOverlay} />
                  <Dialog.Content
                    style={{ ...styles.dialogContent, maxWidth: '75vw', width: '75vw', maxHeight: '90vh', overflowY: 'auto' }}
                    aria-describedby={undefined}
                  >
                    <Dialog.Title style={styles.dialogTitle}>
                      {costingEditItem ? 'Edit Costing Item' : 'New Costing Item'}
                    </Dialog.Title>

                    {/* ── Menu Item + Category ── */}
                    <div style={styles.formGrid}>
                      <label style={styles.label}>Menu Item Name</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          style={{ ...styles.input, flex: 1 }}
                          value={costingForm.menu_item_name}
                          onChange={(e) => setCostingForm((p) => ({ ...p, menu_item_name: e.target.value }))}
                          placeholder="Type or search…"
                        />
                        <button
                          type="button"
                          title="Search Menu Items"
                          style={{ ...styles.actionBtn, padding: '0 12px', fontSize: 16 }}
                          onClick={() => { setMenuSearchOpen((v) => !v); setMenuSearchQuery(''); }}
                        >🔍</button>
                      </div>

                      {/* Menu Item Search Popup */}
                      {menuSearchOpen && (
                        <div style={{ gridColumn: '1 / -1', background: '#1a1a1a', border: '1px solid #444', borderRadius: 6, padding: 12, marginBottom: 8 }}>
                          <input
                            style={{ ...styles.input, marginBottom: 8 }}
                            placeholder="Search menu…"
                            value={menuSearchQuery}
                            onChange={(e) => setMenuSearchQuery(e.target.value)}
                            autoFocus
                          />
                          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                            {(() => {
                              // Build expanded list: base items + variant options
                              const expanded = [];
                              for (const m of menuItemsList) {
                                const basePrice = Number(m.price || m.base_price || 0);
                                if (!m.has_variants || !m.menu_item_variant_types || m.menu_item_variant_types.length === 0) {
                                  expanded.push({ key: `base-${m.id || m.name}`, displayName: m.name, category: m.category || '', price: basePrice });
                                } else {
                                  // Show base item entry
                                  expanded.push({ key: `base-${m.id || m.name}`, displayName: m.name, category: m.category || '', price: basePrice });
                                  // Expand each variant type option
                                  for (const vt of m.menu_item_variant_types) {
                                    const vtName = vt.variant_type_name.toLowerCase().replace(/[^a-z]/g, '');
                                    const isAddOn = vtName === 'addon' || vtName === 'addons' || vtName === 'addon' || vtName.startsWith('addon');
                                    for (const opt of (vt.options || []).filter((o) => o.available !== false)) {
                                      const variantPrice = isAddOn
                                        ? Number(opt.price_modifier || 0)
                                        : basePrice + Number(opt.price_modifier || 0);
                                      expanded.push({
                                        key: `${m.id || m.name}-${vt.id}-${opt.id}`,
                                        displayName: isAddOn ? `${opt.option_name}` : `${m.name} - ${opt.option_name}`,
                                        parentName: isAddOn ? m.name : '',
                                        category: m.category || '',
                                        price: variantPrice,
                                      });
                                    }
                                  }
                                }
                              }
                              // Deduplicate add-on entries: show each unique add-on name once
                              const seenAddons = new Set();
                              const deduped = expanded.filter((e) => {
                                if (e.parentName) {
                                  const key = e.displayName.toLowerCase();
                                  if (seenAddons.has(key)) return false;
                                  seenAddons.add(key);
                                }
                                return true;
                              });
                              const existingNames = new Set(costingHeaders.map((h) => (h.menu_item_name || '').toLowerCase()));
                              const q = menuSearchQuery.toLowerCase();
                              const filtered = deduped.filter((e) =>
                                e.displayName.toLowerCase().includes(q) &&
                                (!costingEditItem || (costingEditItem.menu_item_name || '').toLowerCase() !== e.displayName.toLowerCase()) &&
                                (costingEditItem ? true : !existingNames.has(e.displayName.toLowerCase())),
                              );
                              if (filtered.length === 0) {
                                return <div style={{ color: '#666', fontSize: 13, padding: '6px 8px' }}>No menu items found.</div>;
                              }
                              return filtered.map((entry) => (
                                <div
                                  key={entry.key}
                                  style={{ padding: '6px 8px', cursor: 'pointer', borderRadius: 4, color: '#ccc', fontSize: 13 }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = '#333'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                  onClick={() => {
                                    setCostingForm((p) => ({
                                      ...p,
                                      menu_item_name: entry.displayName,
                                      menu_category: entry.category,
                                      menu_item_price: String(entry.price),
                                    }));
                                    setMenuSearchOpen(false);
                                  }}
                                >
                                  {entry.displayName} <span style={{ color: '#888', fontSize: 11 }}>({entry.category}) — {fmt(entry.price)}{entry.parentName ? ' • Add-on (generic)' : ''}</span>
                                </div>
                              ));
                            })()}
                          </div>
                        </div>
                      )}

                      <label style={styles.label}>Menu Category</label>
                      <input
                        style={{ ...styles.input, background: '#111', color: '#aaa' }}
                        value={costingForm.menu_category}
                        onChange={(e) => setCostingForm((p) => ({ ...p, menu_category: e.target.value }))}
                        placeholder="Auto-filled from menu search"
                      />
                    </div>

                    {/* ── Inventory Lines ── */}
                    <div style={{ marginTop: 16, marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ color: '#ffc107', fontWeight: 600, fontSize: 13 }}>Inventory Items</span>
                        <button
                          type="button"
                          style={styles.primaryBtn}
                          onClick={() => setCostingForm((p) => ({
                            ...p,
                            lines: [...p.lines, { id: null, inventory_item_id: '', uom: '', qty: '0', cost_per_unit: '0' }],
                          }))}
                        >+ Add Line</button>
                      </div>
                      <div style={styles.tableWrap}>
                        <table style={{ ...styles.table, fontSize: 12 }}>
                          <thead>
                            <tr>
                              {['Inventory Item', 'UoM', 'Qty', 'Cost/Unit (₱)', 'Line Total (₱)', ''].map((h) => (
                                <th key={h} style={styles.th}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                             {costingForm.lines.map((line, li) => {
                              const lineTotal = (Number(line.qty) || 0) * (Number(line.cost_per_unit) || 0);
                              const selInv = invItems.find((i) => i.id === line.inventory_item_id);
                              return (
                                <tr key={li}>
                                  <td style={styles.td}>
                                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                      <span style={{ flex: 1, fontSize: 11, color: selInv ? '#fff' : '#666' }}>
                                        {selInv ? `${selInv.name} (${selInv.code})` : '— Select —'}
                                      </span>
                                      <button
                                        type="button"
                                        title="Search inventory item"
                                        style={{ background: '#333', border: '1px solid #555', borderRadius: 4, color: '#ffc107', cursor: 'pointer', padding: '2px 7px', fontSize: 13 }}
                                        onClick={() => { setCostingInvPickerIdx(li); setCostingInvPickerQuery(''); }}
                                      >🔍</button>
                                    </div>
                                  </td>
                                  <td style={styles.td}>
                                    <input
                                      style={{ ...styles.input, fontSize: 12, padding: '4px 6px', width: 70 }}
                                      value={line.uom}
                                      onChange={(e) => setCostingForm((p) => {
                                        const lines = [...p.lines];
                                        lines[li] = { ...lines[li], uom: e.target.value };
                                        return { ...p, lines };
                                      })}
                                    />
                                  </td>
                                  <td style={styles.td}>
                                    <input
                                      type="number"
                                      style={{ ...styles.input, fontSize: 12, padding: '4px 6px', width: 80 }}
                                      value={line.qty}
                                      onChange={(e) => setCostingForm((p) => {
                                        const lines = [...p.lines];
                                        lines[li] = { ...lines[li], qty: e.target.value };
                                        return { ...p, lines };
                                      })}
                                    />
                                  </td>
                                  <td style={styles.td}>
                                    <input
                                      type="number"
                                      style={{ ...styles.input, fontSize: 12, padding: '4px 6px', width: 100 }}
                                      value={line.cost_per_unit}
                                      onChange={(e) => setCostingForm((p) => {
                                        const lines = [...p.lines];
                                        lines[li] = { ...lines[li], cost_per_unit: e.target.value };
                                        return { ...p, lines };
                                      })}
                                    />
                                  </td>
                                  <td style={{ ...styles.td, color: '#4caf50' }}>{fmt(lineTotal)}</td>
                                  <td style={styles.td}>
                                    <button
                                      type="button"
                                      style={{ ...styles.actionBtn, color: '#f44336', borderColor: '#f44336', padding: '2px 8px' }}
                                      onClick={() => setCostingForm((p) => ({ ...p, lines: p.lines.filter((_, i) => i !== li) }))}
                                    >✕</button>
                                  </td>
                                </tr>
                              );
                            })}
                            {costingForm.lines.length === 0 && (
                              <tr><td colSpan={6} style={{ ...styles.td, textAlign: 'center', color: '#555', padding: 16, fontSize: 12 }}>No inventory lines. Click "+ Add Line".</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* ── Costing Fields ── */}
                    {(() => {
                      const lineSubtotal = costingForm.lines.reduce(
                        (s, l) => s + (Number(l.qty) || 0) * (Number(l.cost_per_unit) || 0), 0,
                      );
                      const baseCOGS = lineSubtotal
                        + (Number(costingForm.labor_cost) || 0)
                        + (Number(costingForm.overhead_cost) || 0);
                      const wastageAmt = Number(costingForm.wastage_amount) || 0;
                      const contingencyAmt = Number(costingForm.contingency_amount) || 0;
                      const totalEstCOGS = baseCOGS + wastageAmt + contingencyAmt;
                      // Selling price is locked to the menu item's actual price
                      const sellingPrice = Number(costingForm.menu_item_price) || 0;
                      const cmAmt = sellingPrice - totalEstCOGS;
                      const cmPct = sellingPrice > 0 ? (cmAmt / sellingPrice) * 100 : 0;

                      return (
                        <div style={styles.formGrid}>
                          {/* Total Raw Materials (sum of inventory line totals) */}
                          <label style={{ ...styles.label, color: '#4caf50', fontWeight: 700 }}>Total Raw Materials (₱)</label>
                          <input
                            style={{ ...styles.input, background: '#111', color: '#4caf50', fontWeight: 700 }}
                            readOnly
                            value={fmt(lineSubtotal)}
                          />

                          <label style={styles.label}>Labor Cost (₱)</label>
                          <input style={styles.input} type="number" value={costingForm.labor_cost}
                            onChange={(e) => setCostingForm((p) => ({ ...p, labor_cost: e.target.value }))} />

                          <label style={styles.label}>Overhead Cost (₱)</label>
                          <input style={styles.input} type="number" value={costingForm.overhead_cost}
                            onChange={(e) => setCostingForm((p) => ({ ...p, overhead_cost: e.target.value }))} />

                          {/* Wastage: pct + amount */}
                          <label style={styles.label}>Wastage</label>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <input
                                type="number"
                                style={{ ...styles.input, width: 90 }}
                                value={costingForm.wastage_pct}
                                onChange={(e) => {
                                  const pct = Number(e.target.value) || 0;
                                  const amt = (pct / 100) * baseCOGS;
                                  setCostingForm((p) => ({ ...p, wastage_pct: e.target.value, wastage_amount: amt.toFixed(4) }));
                                }}
                              />
                              <span style={{ color: '#888', fontSize: 12 }}>%</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ color: '#888', fontSize: 12 }}>₱</span>
                              <input
                                type="number"
                                style={{ ...styles.input, width: 110 }}
                                value={costingForm.wastage_amount}
                                onChange={(e) => {
                                  const amt = Number(e.target.value) || 0;
                                  const pct = baseCOGS > 0 ? (amt / baseCOGS) * 100 : 0;
                                  setCostingForm((p) => ({ ...p, wastage_amount: e.target.value, wastage_pct: pct.toFixed(4) }));
                                }}
                              />
                            </div>
                          </div>

                          {/* Contingency: pct + amount */}
                          <label style={styles.label}>Contingency</label>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <input
                                type="number"
                                style={{ ...styles.input, width: 90 }}
                                value={costingForm.contingency_pct}
                                onChange={(e) => {
                                  const pct = Number(e.target.value) || 0;
                                  const amt = (pct / 100) * baseCOGS;
                                  setCostingForm((p) => ({ ...p, contingency_pct: e.target.value, contingency_amount: amt.toFixed(4) }));
                                }}
                              />
                              <span style={{ color: '#888', fontSize: 12 }}>%</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ color: '#888', fontSize: 12 }}>₱</span>
                              <input
                                type="number"
                                style={{ ...styles.input, width: 110 }}
                                value={costingForm.contingency_amount}
                                onChange={(e) => {
                                  const amt = Number(e.target.value) || 0;
                                  const pct = baseCOGS > 0 ? (amt / baseCOGS) * 100 : 0;
                                  setCostingForm((p) => ({ ...p, contingency_amount: e.target.value, contingency_pct: pct.toFixed(4) }));
                                }}
                              />
                            </div>
                          </div>

                          {/* Total Estimated COGS (auto) */}
                          <label style={{ ...styles.label, color: '#ffc107', fontWeight: 700 }}>Total Estimated COGS (auto)</label>
                          <input
                            style={{ ...styles.input, background: '#111', color: '#ffc107', fontWeight: 700 }}
                            readOnly
                            value={fmt(totalEstCOGS)}
                          />

                          {/* Contribution Margin Amount (auto) */}
                          <label style={{ ...styles.label, color: '#4caf50', fontWeight: 700 }}>Contribution Margin Amount (₱)</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input
                              style={{ ...styles.input, background: '#111', color: cmAmt >= 0 ? '#4caf50' : '#f44336', fontWeight: 700 }}
                              readOnly
                              value={fmt(cmAmt)}
                            />
                            <span style={{ color: '#888', fontSize: 11 }}>Selling Price − Total COGS</span>
                          </div>

                          {/* Contribution Margin (auto — derived from menu price) */}
                          <label style={{ ...styles.label, color: '#4caf50', fontWeight: 700 }}>CM Ratio (%)</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input
                              style={{ ...styles.input, width: 100, background: '#111', color: cmAmt >= 0 ? '#4caf50' : '#f44336', fontWeight: 600 }}
                              readOnly
                              value={`${cmPct.toFixed(2)}%`}
                            />
                          </div>

                          {/* Selling Price (locked to menu) */}
                          <label style={{ ...styles.label, color: '#ffc107', fontWeight: 700 }}>Selling Price (₱) — from Menu</label>
                          <div>
                            <input
                              style={{ ...styles.input, background: '#111', color: '#ffc107', fontWeight: 700 }}
                              readOnly
                              value={fmt(sellingPrice)}
                            />
                            <span style={styles.helperText}>Auto-filled from cashier menu price. Use 🔍 search to change.</span>
                          </div>
                        </div>
                      );
                    })()}

                    <div style={styles.dialogFooter}>
                      <Dialog.Close asChild><button style={styles.cancelBtn}>Cancel</button></Dialog.Close>
                      <button onClick={saveCostingItem} style={styles.primaryBtn}>Save</button>
                    </div>
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>
              {/* ── Costing Inventory Picker Dialog ── */}
              <Dialog.Root open={costingInvPickerIdx !== null} onOpenChange={(open) => { if (!open) setCostingInvPickerIdx(null); }}>
                <Dialog.Portal>
                  <Dialog.Overlay style={styles.dialogOverlay} />
                  <Dialog.Content style={{ ...styles.dialogContent, maxWidth: 480 }} aria-describedby={undefined}>
                    <Dialog.Title style={styles.dialogTitle}>Select Inventory Item</Dialog.Title>
                    <div style={{ marginBottom: 12 }}>
                      <input
                        style={styles.input}
                        placeholder="Search by name or code…"
                        value={costingInvPickerQuery}
                        onChange={(e) => setCostingInvPickerQuery(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div style={{ maxHeight: 320, overflowY: 'auto', marginBottom: 12 }}>
                      {[...invItems]
                        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                        .filter((i) => {
                          const q = costingInvPickerQuery.toLowerCase();
                          return !q || (i.name || '').toLowerCase().includes(q) || (i.code || '').toLowerCase().includes(q);
                        })
                        .map((i) => (
                          <div
                            key={i.id}
                            onClick={() => {
                              if (costingInvPickerIdx !== null) {
                                setCostingForm((p) => {
                                  const lines = [...p.lines];
                                  lines[costingInvPickerIdx] = {
                                    ...lines[costingInvPickerIdx],
                                    inventory_item_id: i.id,
                                    uom: i.uom || lines[costingInvPickerIdx].uom,
                                    cost_per_unit: String(i.cost_per_unit || 0),
                                  };
                                  return { ...p, lines };
                                });
                                setCostingInvPickerIdx(null);
                                setCostingInvPickerQuery('');
                              }
                            }}
                            style={{ padding: '8px 12px', cursor: 'pointer', borderRadius: 4, color: '#fff', background: '#2a2a2a', marginBottom: 4, border: '1px solid #333' }}
                          >
                            <strong>{i.name}</strong>
                            <span style={{ color: '#888', fontSize: 12 }}> · {i.code} · {i.uom} · ₱{Number(i.cost_per_unit || 0).toFixed(2)}</span>
                          </div>
                        ))}
                      {[...invItems].filter((i) => {
                        const q = costingInvPickerQuery.toLowerCase();
                        return !q || (i.name || '').toLowerCase().includes(q) || (i.code || '').toLowerCase().includes(q);
                      }).length === 0 && (
                        <p style={{ color: '#666', textAlign: 'center', padding: 16 }}>No items found.</p>
                      )}
                    </div>
                    <div style={styles.dialogFooter}>
                      <Dialog.Close asChild><button style={styles.cancelBtn}>Close</button></Dialog.Close>
                    </div>
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>
            </div>
          )}

          {/* ──────────────── RECEIVING REPORT ──────────────── */}
          {activeTab === 'rr' && (
            <div>
              <div style={styles.tabHeader}>
                <h1 style={styles.pageTitle}>Receiving Report</h1>
                <button onClick={() => openRRDialog()} style={styles.primaryBtn}>+ New RR</button>
              </div>
              {loading && <p style={styles.loadingText}>Loading…</p>}
              <div style={{ marginBottom: 12 }}>
                <input
                  style={{ ...styles.input, width: 280 }}
                  placeholder="Search RR# or vendor…"
                  value={rrSearch}
                  onChange={(e) => setRrSearch(e.target.value)}
                />
              </div>
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      {['RR#', 'Vendor', 'Date', 'Terms', 'Total Landed Cost', 'Status', 'Actions'].map((h) => (
                        <th key={h} style={styles.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rrList.filter((rr) => !rrSearch || (rr.rr_number || '').toLowerCase().includes(rrSearch.toLowerCase()) || (rr.vendor?.name || '').toLowerCase().includes(rrSearch.toLowerCase())).map((rr, idx) => (
                      <tr key={rr.id} style={idx % 2 === 0 ? styles.trEven : styles.trOdd}>
                        <td style={styles.td}>{rr.rr_number}</td>
                        <td style={styles.td}>{rr.vendor?.name || '—'}</td>
                        <td style={styles.td}>{rr.date}</td>
                        <td style={styles.td}>{rr.terms || '—'}</td>
                        <td style={styles.td}>{fmt(rr.total_landed_cost)}</td>
                        <td style={styles.td}>
                          <span style={{
                            ...styles.badge,
                            background: rr.status === 'approved' ? '#1a3a1a' : rr.status === 'paid' ? '#1a1a3a' : '#2a2a1a',
                            color: rr.status === 'approved' ? '#4caf50' : rr.status === 'paid' ? '#2196f3' : '#ffc107',
                            border: `1px solid ${rr.status === 'approved' ? '#4caf50' : rr.status === 'paid' ? '#2196f3' : '#ffc107'}`,
                          }}>
                            {rr.status}
                          </span>
                        </td>
                        <td style={styles.td}>
                          {rr.status !== 'paid' && (
                            <>
                              <button onClick={() => openRRView(rr)} style={{ ...styles.actionBtn, color: '#2196f3', borderColor: '#2196f3' }}>View</button>
                              <button onClick={() => openRRDialog(rr)} style={styles.actionBtn}>Edit</button>
                              <button onClick={() => setRrDeleteConfirm(rr)} style={{ ...styles.actionBtn, color: '#f44336', borderColor: '#f44336' }}>Delete</button>
                            </>
                          )}
                          {rr.status === 'paid' && (
                            <button onClick={() => openRRView(rr)} style={{ ...styles.actionBtn, color: '#2196f3', borderColor: '#2196f3' }}>View</button>
                          )}
                          {rr.status === 'draft' && (
                            <button onClick={() => approveRR(rr)} style={{ ...styles.actionBtn, color: '#4caf50', borderColor: '#4caf50' }}>Approve</button>
                          )}
                          {rr.status === 'approved' && (
                            <button onClick={() => openPayRRDialog(rr)} style={{ ...styles.actionBtn, color: '#2196f3', borderColor: '#2196f3' }}>Pay</button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {rrList.length === 0 && !loading && (
                      <tr><td colSpan={7} style={{ ...styles.td, textAlign: 'center', color: '#666', padding: 32 }}>No receiving reports yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* RR Delete Confirm */}
              <Dialog.Root open={!!rrDeleteConfirm} onOpenChange={() => setRrDeleteConfirm(null)}>
                <Dialog.Portal>
                  <Dialog.Overlay style={styles.dialogOverlay} />
                  <Dialog.Content style={{ ...styles.dialogContent, maxWidth: 400 }} aria-describedby={undefined}>
                    <Dialog.Title style={styles.dialogTitle}>Delete Receiving Report</Dialog.Title>
                    <p style={{ color: '#ccc', marginBottom: 24 }}>Delete RR# {rrDeleteConfirm?.rr_number}?</p>
                    <div style={styles.dialogFooter}>
                      <Dialog.Close asChild><button style={styles.cancelBtn}>Cancel</button></Dialog.Close>
                      <button onClick={() => deleteRR(rrDeleteConfirm)} style={{ ...styles.primaryBtn, background: '#f44336' }}>Delete</button>
                    </div>
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>

              {/* RR View Dialog (read-only) */}
              <Dialog.Root open={!!rrViewItem} onOpenChange={(open) => { if (!open) { setRrViewItem(null); setRrViewLineItems([]); } }}>
                <Dialog.Portal>
                  <Dialog.Overlay style={styles.dialogOverlay} />
                  <Dialog.Content style={{ ...styles.dialogContent, width: '75vw', maxWidth: '75vw' }} aria-describedby={undefined}>
                    <Dialog.Title style={styles.dialogTitle}>
                      📄 Receiving Report — {rrViewItem?.rr_number}
                    </Dialog.Title>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                      <div>
                        <label style={styles.label}>RR Number</label>
                        <input style={{ ...styles.input, background: '#111', color: '#ffc107' }} readOnly value={rrViewItem?.rr_number || ''} />
                      </div>
                      <div>
                        <label style={styles.label}>Date</label>
                        <input style={{ ...styles.input, background: '#111', color: '#ccc' }} readOnly value={rrViewItem?.date || ''} />
                      </div>
                      <div>
                        <label style={styles.label}>Vendor</label>
                        <input style={{ ...styles.input, background: '#111', color: '#ccc' }} readOnly value={rrViewItem?.vendor?.name || '—'} />
                      </div>
                      <div>
                        <label style={styles.label}>Terms</label>
                        <input style={{ ...styles.input, background: '#111', color: '#ccc' }} readOnly value={rrViewItem?.terms || '—'} />
                      </div>
                      <div>
                        <label style={styles.label}>Freight In (₱)</label>
                        <input style={{ ...styles.input, background: '#111', color: '#ccc' }} readOnly value={Number(rrViewItem?.freight_in || 0).toFixed(2)} />
                      </div>
                      <div>
                        <label style={styles.label}>Status</label>
                        <input style={{ ...styles.input, background: '#111', color: rrViewItem?.status === 'approved' ? '#4caf50' : rrViewItem?.status === 'paid' ? '#2196f3' : '#ffc107' }} readOnly value={rrViewItem?.status || ''} />
                      </div>
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <span style={{ color: '#ffc107', fontWeight: 600 }}>Line Items</span>
                      <div style={{ overflowX: 'auto', marginTop: 8 }}>
                        <table style={styles.table}>
                          <thead>
                            <tr>
                              {['Inventory Item', 'Code', 'UoM', 'Qty', 'Cost (₱)', 'Total Cost (₱)', 'Freight (₱)', 'Total Landed Cost (₱)'].map((h) => (
                                <th key={h} style={{ ...styles.th, fontSize: 11 }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rrViewLineItems.map((li, idx) => {
                              const tc = (Number(li.qty) || 0) * (Number(li.cost) || 0);
                              const tlc = Number(li.total_landed_cost) || (tc + (Number(li.freight_allocated) || 0));
                              return (
                                <tr key={li.id} style={idx % 2 === 0 ? styles.trEven : styles.trOdd}>
                                  <td style={styles.td}>{li.inventory_item?.name || li.inventory_name || '—'}</td>
                                  <td style={styles.td}><span style={{ fontSize: 11 }}>{li.inventory_item?.code || li.inventory_code || '—'}</span></td>
                                  <td style={styles.td}><span style={{ fontSize: 11 }}>{li.uom || '—'}</span></td>
                                  <td style={{ ...styles.td, color: '#ccc' }}>{Math.round(Number(li.qty) || 0)}</td>
                                  <td style={{ ...styles.td, color: '#ccc' }}>{fmt(li.cost)}</td>
                                  <td style={styles.td}>{fmt(tc)}</td>
                                  <td style={styles.td}>{fmt(Number(li.freight_allocated) || 0)}</td>
                                  <td style={{ ...styles.td, color: '#ffc107', fontWeight: 600 }}>{fmt(tlc)}</td>
                                </tr>
                              );
                            })}
                            {rrViewLineItems.length === 0 && (
                              <tr><td colSpan={8} style={{ ...styles.td, textAlign: 'center', color: '#666', padding: 16 }}>No items</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      <div style={{ marginTop: 8, textAlign: 'right', color: '#ffc107', fontWeight: 600 }}>
                        Total Landed Cost: {fmt(rrViewLineItems.reduce((s, li) => {
                          const tc = (Number(li.qty) || 0) * (Number(li.cost) || 0);
                          return s + (Number(li.total_landed_cost) || (tc + (Number(li.freight_allocated) || 0)));
                        }, 0))}
                      </div>
                    </div>
                    <div style={styles.dialogFooter}>
                      <Dialog.Close asChild><button style={styles.cancelBtn}>Close</button></Dialog.Close>
                    </div>
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>

              {/* RR Form Dialog */}
              <Dialog.Root open={rrDialogOpen} onOpenChange={setRrDialogOpen}>
                <Dialog.Portal>
                  <Dialog.Overlay style={styles.dialogOverlay} />
                  <Dialog.Content style={{ ...styles.dialogContent, width: '75vw', maxWidth: '75vw' }} aria-describedby={undefined}>
                    <Dialog.Title style={styles.dialogTitle}>
                      {rrEditItem ? 'Edit Receiving Report' : 'New Receiving Report'}
                    </Dialog.Title>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                      <div>
                        <label style={styles.label}>RR Number</label>
                        <input style={{ ...styles.input, background: '#111', color: '#ffc107' }} readOnly value={rrForm.rr_number} />
                      </div>
                      <div>
                        <label style={styles.label}>Date</label>
                        <input
                          style={styles.input}
                          type="date"
                          value={rrForm.date}
                          onChange={(e) => setRrForm((p) => ({ ...p, date: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label style={styles.label}>Vendor</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input style={{ ...styles.input, flex: 1 }} readOnly value={rrForm.vendor_name || 'No vendor selected'} />
                          <button
                            onClick={() => { setVendorSearchOpen(true); setVendorSearchQuery(''); setVendorResults([]); setEnrollingVendor(false); }}
                            style={styles.actionBtn}
                          >🔍</button>
                        </div>
                      </div>
                      <div>
                        <label style={styles.label}>Terms</label>
                        <input style={styles.input} value={rrForm.terms} onChange={(e) => setRrForm((p) => ({ ...p, terms: e.target.value }))} placeholder="Net 30, COD, etc." />
                      </div>
                      {rrForm.vendor_name && (
                        <>
                          <div>
                            <label style={styles.label}>Address</label>
                            <input style={{ ...styles.input, background: '#111', color: '#888' }} readOnly value={rrForm.vendor_address} />
                          </div>
                          <div>
                            <label style={styles.label}>TIN</label>
                            <input style={{ ...styles.input, background: '#111', color: '#888' }} readOnly value={rrForm.vendor_tin} />
                          </div>
                        </>
                      )}
                      <div>
                        <label style={styles.label}>Freight In (₱)</label>
                        <input
                          style={styles.input}
                          type="number"
                          value={rrForm.freight_in}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRrForm((p) => ({ ...p, freight_in: val }));
                            setRrLineItems((prev) => calcFreight(prev, val));
                          }}
                        />
                      </div>
                    </div>

                    {/* Line Items */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ color: '#ffc107', fontWeight: 600 }}>Line Items</span>
                        <button onClick={addRRLineItem} style={styles.primaryBtn}>+ Add Item</button>
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={styles.table}>
                          <thead>
                            <tr>
                              {['Inventory Item', 'Code', 'UoM', 'Qty', 'Cost', 'Total Cost', 'Freight', 'TLC', ''].map((h) => (
                                <th key={h} style={{ ...styles.th, fontSize: 11 }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rrLineItems.map((li, idx) => (
                              <tr key={li.id}>
                                <td style={styles.td}>
                                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                    <input
                                      style={{ ...styles.input, padding: '4px 8px', fontSize: 12, minWidth: 140 }}
                                      readOnly
                                      value={li.inventory_name || '— Select —'}
                                      placeholder="— Select —"
                                    />
                                    <button
                                      onClick={() => { setInvPickerOpen(idx); setInvPickerQuery(''); }}
                                      style={{ ...styles.actionBtn, padding: '4px 8px', fontSize: 14 }}
                                      title="Search inventory item"
                                    >🔍</button>
                                  </div>
                                </td>
                                <td style={styles.td}><span style={{ fontSize: 11 }}>{li.inventory_code}</span></td>
                                <td style={styles.td}><span style={{ fontSize: 11 }}>{li.uom}</span></td>
                                <td style={styles.td}>
                                  <input
                                    style={{ ...styles.input, width: 60, padding: '4px 8px', fontSize: 12 }}
                                    type="number"
                                    value={li.qty}
                                    onChange={(e) => updateRRLineItem(idx, 'qty', e.target.value)}
                                  />
                                </td>
                                <td style={styles.td}>
                                  <input
                                    style={{ ...styles.input, width: 80, padding: '4px 8px', fontSize: 12 }}
                                    type="number"
                                    value={li.cost}
                                    onChange={(e) => updateRRLineItem(idx, 'cost', e.target.value)}
                                  />
                                </td>
                                <td style={styles.td}><span style={{ fontSize: 11 }}>{fmt(li.total_cost || 0)}</span></td>
                                <td style={styles.td}><span style={{ fontSize: 11 }}>{fmt(li.freight_allocated || 0)}</span></td>
                                <td style={styles.td}><span style={{ fontSize: 11, color: '#ffc107' }}>{fmt(li.total_landed_cost || 0)}</span></td>
                                <td style={styles.td}>
                                  <button
                                    onClick={() => removeRRLineItem(idx)}
                                    style={{ background: 'none', border: 'none', color: '#f44336', cursor: 'pointer', fontSize: 16 }}
                                  >✕</button>
                                </td>
                              </tr>
                            ))}
                            {rrLineItems.length === 0 && (
                              <tr><td colSpan={9} style={{ ...styles.td, textAlign: 'center', color: '#666' }}>No items yet</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      <div style={{ marginTop: 8, textAlign: 'right', color: '#ffc107', fontWeight: 600 }}>
                        Total Landed Cost: {fmt(rrLineItems.reduce((s, i) => s + (i.total_landed_cost || 0), 0))}
                      </div>
                    </div>

                    {rrSaveError && (
                      <p style={{ color: '#f44336', fontSize: 13, margin: '8px 0 0' }}>⚠ {rrSaveError}</p>
                    )}
                    <div style={styles.dialogFooter}>
                      <Dialog.Close asChild><button style={styles.cancelBtn}>Cancel</button></Dialog.Close>
                      <button onClick={saveRR} style={styles.primaryBtn} disabled={savingRR} aria-disabled={savingRR} aria-busy={savingRR}>
                        {savingRR ? 'Saving…' : 'Save Draft'}
                      </button>
                    </div>
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>

              {/* Vendor Search Dialog */}
              <Dialog.Root open={vendorSearchOpen} onOpenChange={setVendorSearchOpen}>
                <Dialog.Portal>
                  <Dialog.Overlay style={styles.dialogOverlay} />
                  <Dialog.Content style={{ ...styles.dialogContent, maxWidth: 500 }} aria-describedby={undefined}>
                    <Dialog.Title style={styles.dialogTitle}>Search Vendor</Dialog.Title>
                    <div style={{ marginBottom: 12 }}>
                      <input
                        style={styles.input}
                        placeholder="Search by name…"
                        value={vendorSearchQuery}
                        onChange={(e) => { setVendorSearchQuery(e.target.value); searchVendors(e.target.value); }}
                      />
                    </div>
                    <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 12 }}>
                      {vendorResults.map((v) => (
                        <div
                          key={v.id}
                          onClick={() => {
                            setRrForm((p) => ({ ...p, vendor_id: v.id, vendor_name: v.name, vendor_address: v.address || '', vendor_contact: v.contact_number || '', vendor_tin: v.tin || '' }));
                            setVendorSearchOpen(false);
                          }}
                          style={{ padding: '8px 12px', cursor: 'pointer', borderRadius: 4, color: '#fff', background: '#2a2a2a', marginBottom: 4, border: '1px solid #333' }}
                        >
                          <strong>{v.name}</strong>
                          {v.address && <span style={{ color: '#888', fontSize: 12 }}> — {v.address}</span>}
                        </div>
                      ))}
                      {vendorResults.length === 0 && vendorSearchQuery && (
                        <p style={{ color: '#666', textAlign: 'center' }}>No vendors found.</p>
                      )}
                    </div>

                    <button onClick={() => setEnrollingVendor((p) => !p)} style={{ ...styles.actionBtn, marginBottom: 12 }}>
                      {enrollingVendor ? 'Cancel' : '+ Enroll New Vendor'}
                    </button>

                    {enrollingVendor && (
                      <div style={styles.formGrid}>
                        <label style={styles.label}>Name</label>
                        <input style={styles.input} value={newVendorForm.name} onChange={(e) => setNewVendorForm((p) => ({ ...p, name: e.target.value }))} />
                        <label style={styles.label}>Address</label>
                        <input style={styles.input} value={newVendorForm.address} onChange={(e) => setNewVendorForm((p) => ({ ...p, address: e.target.value }))} />
                        <label style={styles.label}>Contact</label>
                        <input style={styles.input} value={newVendorForm.contact} onChange={(e) => setNewVendorForm((p) => ({ ...p, contact: e.target.value }))} />
                        <label style={styles.label}>TIN</label>
                        <input style={styles.input} value={newVendorForm.tin} onChange={(e) => setNewVendorForm((p) => ({ ...p, tin: e.target.value }))} />
                        <div />
                        <button onClick={enrollVendor} style={styles.primaryBtn}>Save Vendor</button>
                      </div>
                    )}

                    <div style={styles.dialogFooter}>
                      <Dialog.Close asChild><button style={styles.cancelBtn}>Close</button></Dialog.Close>
                    </div>
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>

              {/* RR Pay Dialog */}
              <Dialog.Root open={rrPayDialogOpen} onOpenChange={setRrPayDialogOpen}>
                <Dialog.Portal>
                  <Dialog.Overlay style={styles.dialogOverlay} />
                  <Dialog.Content style={{ ...styles.dialogContent, maxWidth: 520 }} aria-describedby={undefined}>
                    <Dialog.Title style={styles.dialogTitle}>
                      💳 Pay Receiving Report — {rrPayItem?.rr_number}
                    </Dialog.Title>
                    <div style={{ color: '#888', fontSize: 12, marginBottom: 16 }}>
                      Vendor: <strong style={{ color: '#ccc' }}>{rrPayItem?.vendor?.name || '—'}</strong>
                      &nbsp;·&nbsp; Total Landed Cost: <strong style={{ color: '#ffc107' }}>{rrPayItem ? `₱${Number(rrPayItem.total_landed_cost).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—'}</strong>
                    </div>
                    <div style={styles.formGrid}>
                      <label style={styles.label}>Payment Date</label>
                      <input
                        style={styles.input}
                        type="date"
                        value={rrPayForm.payment_date}
                        onChange={(e) => setRrPayForm((p) => ({ ...p, payment_date: e.target.value }))}
                      />

                      <label style={styles.label}>Amount (₱)</label>
                      <input
                        style={styles.input}
                        type="number"
                        value={rrPayForm.amount}
                        onChange={(e) => setRrPayForm((p) => ({ ...p, amount: e.target.value }))}
                      />

                      <label style={styles.label}>Mode of Payment</label>
                      <select
                        style={styles.input}
                        value={rrPayForm.payment_mode}
                        onChange={(e) => setRrPayForm((p) => ({ ...p, payment_mode: e.target.value }))}
                      >
                        <option value="cash_on_hand">Cash on Hand</option>
                        <option value="cash_in_bank">Cash in Bank</option>
                        <option value="credit_card">Credit Card</option>
                        <option value="spaylater">SPayLater</option>
                      </select>

                      <label style={styles.label}>Reference #</label>
                      <input
                        style={styles.input}
                        placeholder="Check #, transaction #, etc."
                        value={rrPayForm.reference_number}
                        onChange={(e) => setRrPayForm((p) => ({ ...p, reference_number: e.target.value }))}
                      />

                      <label style={styles.label}>Notes</label>
                      <input
                        style={styles.input}
                        placeholder="Optional notes"
                        value={rrPayForm.notes}
                        onChange={(e) => setRrPayForm((p) => ({ ...p, notes: e.target.value }))}
                      />
                    </div>

                    {/* Journal entry preview */}
                    <div style={{ marginTop: 16, padding: '10px 14px', background: '#111', borderRadius: 8, border: '1px solid #333' }}>
                      <span style={{ color: '#ffc107', fontSize: 12, fontWeight: 600 }}>📒 Journal Entry Preview</span>
                      <div style={{ marginTop: 8, fontSize: 12, color: '#ccc' }}>
                        <div>Dr &nbsp;<strong>Accounts Payable</strong> &nbsp;₱{Number(rrPayForm.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
                        <div style={{ paddingLeft: 24 }}>
                          Cr &nbsp;<strong>
                            {rrPayForm.payment_mode === 'cash_in_bank' ? 'Cash in Bank' :
                             rrPayForm.payment_mode === 'credit_card'  ? 'Credit Card Payable' :
                             rrPayForm.payment_mode === 'spaylater'    ? 'Spaylater Payable' :
                             'Cash on Hand'}
                          </strong> &nbsp;₱{Number(rrPayForm.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>

                    <div style={styles.dialogFooter}>
                      <Dialog.Close asChild><button style={styles.cancelBtn}>Cancel</button></Dialog.Close>
                      <button onClick={payRR} style={styles.primaryBtn}>Confirm Payment</button>
                    </div>
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>

              {/* Inventory Item Picker Dialog */}
              <Dialog.Root open={invPickerOpen !== null} onOpenChange={(open) => { if (!open) setInvPickerOpen(null); }}>
                <Dialog.Portal>
                  <Dialog.Overlay style={styles.dialogOverlay} />
                  <Dialog.Content style={{ ...styles.dialogContent, maxWidth: 480 }} aria-describedby={undefined}>
                    <Dialog.Title style={styles.dialogTitle}>Select Inventory Item</Dialog.Title>
                    <div style={{ marginBottom: 12 }}>
                      <input
                        style={styles.input}
                        placeholder="Search by name or code…"
                        value={invPickerQuery}
                        onChange={(e) => setInvPickerQuery(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 12 }}>
                      {[...invItems]
                        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                        .filter((i) => {
                          const q = invPickerQuery.toLowerCase();
                          return !q || (i.name || '').toLowerCase().includes(q) || (i.code || '').toLowerCase().includes(q);
                        })
                        .map((i) => (
                          <div
                            key={i.id}
                            onClick={() => {
                              if (invPickerOpen !== null) {
                                selectRRInventoryItem(invPickerOpen, i);
                                setInvPickerOpen(null);
                                setInvPickerQuery('');
                              }
                            }}
                            style={{ padding: '8px 12px', cursor: 'pointer', borderRadius: 4, color: '#fff', background: '#2a2a2a', marginBottom: 4, border: '1px solid #333' }}
                          >
                            <strong>{i.name}</strong>
                            <span style={{ color: '#888', fontSize: 12 }}> · {i.code} · {i.uom}</span>
                          </div>
                        ))}
                      {[...invItems].filter((i) => {
                        const q = invPickerQuery.toLowerCase();
                        return !q || (i.name || '').toLowerCase().includes(q) || (i.code || '').toLowerCase().includes(q);
                      }).length === 0 && (
                        <p style={{ color: '#666', textAlign: 'center', padding: 16 }}>No items found.</p>
                      )}
                    </div>
                    <div style={styles.dialogFooter}>
                      <Dialog.Close asChild><button style={styles.cancelBtn}>Close</button></Dialog.Close>
                      <button
                        style={styles.primaryBtn}
                        onClick={() => {
                          const idx = invPickerOpen;
                          setInvPickerOpen(null);
                          setInvPickerQuery('');
                          setRrNewItemReturnIdx(idx);
                          // Defer to next tick so Radix UI fully unmounts the picker's
                          // focus-trap before opening the enrollment dialog; opening both
                          // in the same event-loop tick prevents the new dialog from
                          // receiving focus and appearing to the user.
                          setTimeout(() => openInvDialog(null), 0);
                        }}
                      >+ New Item</button>
                    </div>
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>
            </div>
          )}

          {/* ──────────────── FINANCIAL REPORTS ──────────────── */}
          {activeTab === 'financial' && (
            <div>
              <h1 style={styles.pageTitle}>Financial Reports</h1>

              {/* Sub-tab label (navigation is now in sidebar) */}
              <div style={{ marginBottom: 16 }}>
                <span style={{ color: '#888', fontSize: 12 }}>
                  {({ cashflow: 'Cash Flow Statement', pl: 'Profit & Loss', balance: 'Balance Sheet', sales: 'Sales Report', budget: 'Budget Variance', tax: 'Tax Report', coa: 'Chart of Accounts' })[finSubTab] || finSubTab}
                </span>
              </div>

              {/* Date range (not shown for CoA) */}
              {finSubTab !== 'coa' && (
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
                  <label style={{ color: '#ccc', fontSize: 13 }}>From:</label>
                  <input type="date" style={{ ...styles.input, width: 160 }} value={finDateFrom} onChange={(e) => setFinDateFrom(e.target.value)} />
                  <label style={{ color: '#ccc', fontSize: 13 }}>To:</label>
                  <input type="date" style={{ ...styles.input, width: 160 }} value={finDateTo} onChange={(e) => setFinDateTo(e.target.value)} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ color: '#ccc', fontSize: 12 }}>Compare with</label>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <select
                        style={{ ...styles.input, width: 160 }}
                        value={finCompareCount === 0 ? 'none' : finCompareCustomOpen ? 'custom' : String(finCompareCount)}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === 'none') { setFinCompareCount(0); setFinCompareCustomOpen(false); }
                          else if (v === 'custom') { setFinCompareCustomOpen(true); }
                          else { setFinCompareCount(Number(v)); setFinCompareCustomOpen(false); }
                        }}
                      >
                        <option value="none">None</option>
                        <option value="1">1 month</option>
                        <option value="2">2 months</option>
                        <option value="3">3 months</option>
                        <option value="4">4 months</option>
                        <option value="custom">Enter a different number</option>
                      </select>
                      {finCompareCustomOpen && (
                        <input
                          type="number"
                          min={1}
                          max={12}
                          placeholder="# periods"
                          style={{ ...styles.input, width: 90 }}
                          value={finCompareCount || ''}
                          onChange={(e) => setFinCompareCount(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
                        />
                      )}
                    </div>
                    {finCompareCount > 0 && (
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12, color: '#ccc' }}>
                        <span>Previous</span>
                        {[{ val: 'monthly', label: 'Month' }, { val: 'quarterly', label: 'Quarter' }, { val: 'annual', label: 'Year' }].map((opt) => (
                          <label key={opt.val} style={{ display: 'flex', gap: 4, alignItems: 'center', cursor: 'pointer' }}>
                            <input type="radio" name="finComparePeriod" value={opt.val} checked={finComparePeriod === opt.val} onChange={() => setFinComparePeriod(opt.val)} />
                            {opt.label}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={fetchFinancial} style={styles.primaryBtn}>Update</button>
                </div>
              )}

              {loading && <p style={styles.loadingText}>Loading…</p>}




              {/* Cash Flow */}
              {finSubTab === 'cashflow' && finData?.type === 'cashflow' && (
                <div style={{ ...styles.card, maxWidth: 860 }}>
                  <h3 style={styles.cardTitle}>Cash Flow Statement</h3>
                  <p style={{ color: '#888', fontSize: 11, marginBottom: 8 }}>From {finDateFrom} to {finDateTo}</p>
                  <div style={styles.tableWrap}>
                    <table style={styles.table}>
                      <tbody>
                        <tr style={{ background: '#1e1e1e' }}>
                          <td style={{ ...styles.td, fontWeight: 700 }}>Cash Beginning Balance</td>
                          <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700 }}>{fmt(finData.cashBeginningBalance)}</td>
                        </tr>

                        <tr><td colSpan={2} style={{ ...styles.td, fontWeight: 700, color: '#ffc107' }}>Operations</td></tr>
                        <tr style={styles.trEven}><td style={{ ...styles.td, paddingLeft: 24 }}>Cash receipts from Revenue (Cash + GCash)</td><td style={{ ...styles.td, textAlign: 'right', color: '#4caf50' }}>{fmt(finData.receiptsRevenue)}</td></tr>
                        <tr style={styles.trOdd}><td style={{ ...styles.td, paddingLeft: 24 }}>Delivery Income</td><td style={{ ...styles.td, textAlign: 'right', color: '#4caf50' }}>{fmt(finData.deliveryIncome)}</td></tr>
                        <tr style={styles.trEven}><td style={{ ...styles.td, paddingLeft: 24 }}>Inventory purchases</td><td style={{ ...styles.td, textAlign: 'right', color: '#f44336' }}>({fmt(finData.inventoryPurchases)})</td></tr>
                        <tr style={styles.trOdd}><td style={{ ...styles.td, paddingLeft: 24 }}>General operating &amp; administrative expenses</td><td style={{ ...styles.td, textAlign: 'right', color: '#f44336' }}>({fmt(finData.genOpAdminExpenses)})</td></tr>
                        <tr style={styles.trEven}><td style={{ ...styles.td, paddingLeft: 24 }}>Salaries &amp; Wages</td><td style={{ ...styles.td, textAlign: 'right', color: '#f44336' }}>({fmt(finData.salariesWages)})</td></tr>
                        <tr style={styles.trOdd}><td style={{ ...styles.td, paddingLeft: 24 }}>Income taxes</td><td style={{ ...styles.td, textAlign: 'right', color: '#f44336' }}>({fmt(finData.incomeTaxes)})</td></tr>
                        <tr style={{ background: '#1a2a1a' }}><td style={{ ...styles.td, fontWeight: 700, color: '#4caf50' }}>Net Cash Flow from Operations</td><td style={{ ...styles.td, textAlign: 'right', fontWeight: 700, color: finData.netCashFlowOperations >= 0 ? '#4caf50' : '#f44336' }}>{fmt(finData.netCashFlowOperations)}</td></tr>

                        <tr><td colSpan={2} style={{ ...styles.td, fontWeight: 700, color: '#ffc107' }}>Investing Activities</td></tr>
                        <tr style={styles.trEven}><td style={{ ...styles.td, paddingLeft: 24 }}>Sale of property and equipment</td><td style={{ ...styles.td, textAlign: 'right', color: '#4caf50' }}>{fmt(finData.saleOfPropertyEquipment)}</td></tr>
                        <tr style={styles.trOdd}><td style={{ ...styles.td, paddingLeft: 24 }}>Collection of principal on loans</td><td style={{ ...styles.td, textAlign: 'right', color: '#4caf50' }}>{fmt(finData.collectionPrincipalOnLoans)}</td></tr>
                        <tr style={styles.trEven}><td style={{ ...styles.td, paddingLeft: 24 }}>Purchase of property and equipment</td><td style={{ ...styles.td, textAlign: 'right', color: '#f44336' }}>({fmt(finData.purchaseOfPropertyEquipment)})</td></tr>
                        <tr style={styles.trOdd}><td style={{ ...styles.td, paddingLeft: 24 }}>Making loans to other entities</td><td style={{ ...styles.td, textAlign: 'right', color: '#f44336' }}>({fmt(finData.makingLoansToOthers)})</td></tr>
                        <tr style={{ background: '#1a1a2a' }}><td style={{ ...styles.td, fontWeight: 700, color: '#2196f3' }}>Net Cash Flow from Investing Activities</td><td style={{ ...styles.td, textAlign: 'right', fontWeight: 700, color: finData.netCashFlowInvesting >= 0 ? '#4caf50' : '#f44336' }}>{fmt(finData.netCashFlowInvesting)}</td></tr>

                        <tr><td colSpan={2} style={{ ...styles.td, fontWeight: 700, color: '#ffc107' }}>Financing Activities</td></tr>
                        <tr style={styles.trEven}><td style={{ ...styles.td, paddingLeft: 24 }}>Proceeds from loans payable</td><td style={{ ...styles.td, textAlign: 'right', color: '#4caf50' }}>{fmt(finData.proceedsFromLoans)}</td></tr>
                        <tr style={styles.trOdd}><td style={{ ...styles.td, paddingLeft: 24 }}>Owner&apos;s capital infusion</td><td style={{ ...styles.td, textAlign: 'right', color: '#4caf50' }}>{fmt(finData.ownersCapitalInfusion)}</td></tr>
                        <tr style={styles.trEven}><td style={{ ...styles.td, paddingLeft: 24 }}>Repayment of loans payable</td><td style={{ ...styles.td, textAlign: 'right', color: '#f44336' }}>({fmt(finData.repaymentOfLoans)})</td></tr>
                        <tr style={styles.trOdd}><td style={{ ...styles.td, paddingLeft: 24 }}>Owner&apos;s drawings</td><td style={{ ...styles.td, textAlign: 'right', color: '#f44336' }}>({fmt(finData.ownersDrawings)})</td></tr>
                        <tr style={styles.trEven}><td style={{ ...styles.td, paddingLeft: 24 }}>Interest Expense</td><td style={{ ...styles.td, textAlign: 'right', color: '#f44336' }}>({fmt(finData.interestExpensePaid || 0)})</td></tr>
                        <tr style={{ background: '#2a1a2a' }}><td style={{ ...styles.td, fontWeight: 700, color: '#e1bee7' }}>Net Cash Flow from Financing Activities</td><td style={{ ...styles.td, textAlign: 'right', fontWeight: 700, color: finData.netCashFlowFinancing >= 0 ? '#4caf50' : '#f44336' }}>{fmt(finData.netCashFlowFinancing)}</td></tr>

                        <tr style={{ background: '#2a2a1a' }}><td style={{ ...styles.td, fontWeight: 700, color: '#ffc107' }}>Net Increase / (Decrease) in Cash</td><td style={{ ...styles.td, textAlign: 'right', fontWeight: 700, color: finData.netChange >= 0 ? '#4caf50' : '#f44336' }}>{fmt(finData.netChange)}</td></tr>
                        <tr style={{ background: '#3a2a0a' }}><td style={{ ...styles.td, fontWeight: 700, color: '#ffc107' }}>Cash Ending Balance</td><td style={{ ...styles.td, textAlign: 'right', fontWeight: 700, color: '#ffc107' }}>{fmt(finData.cashEndingBalance)}</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* P&L */}
              {finSubTab === 'pl' && finData?.type === 'pl' && (() => {
                const currentLabel = formatFinancialCoverageLabel(finDateFrom, finDateTo, finComparePeriod);
                const hasCmp = finCompareFull.length > 0;
                const colCount = 1 + finCompareFull.length;
                const cmpVal = (p, key, opexKey) => opexKey ? (p.expByAccount?.[opexKey] || 0) : (p[key] || 0);
                const amtCell = (val, color, neg = false, bold = false) => (
                  <td style={{ ...styles.td, textAlign: 'right', color: color || styles.td.color, fontWeight: bold ? 700 : 400 }}>
                    {neg && val > 0 ? `(${fmt(val)})` : fmt(val)}
                  </td>
                );
                const plRows = [
                  { key: 'revenue', label: 'Revenue', color: '#4caf50', indent: false },
                  { key: 'deliveryIncome', label: 'Delivery Income', color: '#4caf50', indent: true },
                  { key: 'totalRevenue', label: 'Total Revenue', bold: true },
                  { key: 'cogs', label: 'Cost of Goods Sold (COGS)', color: '#f44336', neg: true },
                  { key: 'grossProfit', label: 'Gross Profit', bold: true },
                  { label: 'Operating Expenses', header: true },
                  ...FIN_OPEX_ACCOUNTS.map((a) => ({ key: a, label: a, color: '#f44336', indent: true, opexKey: a, neg: true })),
                  { key: 'opExp', label: 'Total Operating Expenses', color: '#f44336', neg: true, bold: true },
                  { key: 'incomeBeforeTax', label: 'Income Before Tax', bold: true },
                  { key: 'incomeTaxExpense', label: 'Income Tax Expense', color: '#f44336', neg: true, indent: true },
                  { key: 'netIncome', label: 'Net Income', bold: true, color: '#ffc107' },
                ];
                return (
                  <div style={{ ...styles.card, overflowX: 'auto' }}>
                    <h3 style={styles.cardTitle}>Profit &amp; Loss Statement</h3>
                    <p style={{ color: '#888', fontSize: 11, marginBottom: 8 }}>For the period {finDateFrom} to {finDateTo}</p>
                    <table style={{ ...styles.table, minWidth: hasCmp ? 400 + colCount * 140 : 480 }}>
                      {hasCmp && (
                        <thead>
                          <tr>
                            <th style={styles.th}>Account</th>
                            <th style={{ ...styles.th, textAlign: 'right', color: '#ffc107' }}>{currentLabel}</th>
                            {finCompareFull.map((p) => <th key={p.label} style={{ ...styles.th, textAlign: 'right' }}>{p.label}</th>)}
                          </tr>
                        </thead>
                      )}
                      <tbody>
                        {plRows.map((row, ri) => {
                          if (row.header) {
                            return (
                              <tr key={row.label} style={styles.trEven}>
                                <td style={{ ...styles.td, fontWeight: 600 }}>{row.label}</td>
                                {hasCmp && Array.from({ length: colCount }).map((_, ci) => <td key={ci} style={styles.td}></td>)}
                              </tr>
                            );
                          }
                          const curVal = row.opexKey ? (finData.expByAccount?.[row.opexKey] || 0) : (finData[row.key] || 0);
                          const rowBg = row.bold ? (row.key === 'netIncome' ? '#3a2a0a' : row.key === 'incomeBeforeTax' ? '#1a2a1a' : row.key === 'grossProfit' ? '#2a2a1a' : row.color === '#f44336' ? '#2a1a1a' : '#2a2a1a') : (ri % 2 === 0 ? styles.trEven.background : styles.trOdd.background);
                          return (
                            <tr key={row.label} style={{ background: rowBg }}>
                              <td style={{ ...styles.td, paddingLeft: row.indent ? 28 : 12, fontWeight: row.bold ? 700 : 400, color: row.bold ? '#ffc107' : styles.td.color }}>{row.label}</td>
                              {amtCell(curVal, row.color, row.neg, row.bold)}
                              {hasCmp && finCompareFull.map((p) => amtCell(cmpVal(p, row.key, row.opexKey), row.color, row.neg, row.bold))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}

              {/* Balance Sheet */}
              {finSubTab === 'balance' && finData?.type === 'balance' && (() => {
                const hasCmp = finCompareFull.length > 0;
                const colCount = 1 + finCompareFull.length;
                const currentLabel = formatFinancialCoverageLabel(finDateFrom, finDateTo, finComparePeriod);
                const cmpGet = (p, key) => p[key] ?? 0;
                const hdrCell = (label, colSpan = 1) => (
                  <td colSpan={colSpan} style={{ ...styles.td, fontWeight: 600 }}>{label}</td>
                );
                const dataRow = (label, curVal, keyForCmp, indent = false, neg = false, bold = false, boldColor = '#ffc107') => (
                  <tr style={{ background: bold ? '#2a2a1a' : styles.trOdd.background }}>
                    <td style={{ ...styles.td, paddingLeft: indent ? 28 : 12, fontWeight: bold ? 700 : 400, color: bold ? boldColor : styles.td.color }}>{label}</td>
                    <td style={{ ...styles.td, textAlign: 'right', fontWeight: bold ? 700 : 400, color: bold ? boldColor : (neg && curVal > 0 ? '#f44336' : styles.td.color) }}>
                      {neg && curVal > 0 ? `(${fmt(curVal)})` : fmt(curVal)}
                    </td>
                    {hasCmp && finCompareFull.map((p) => {
                      const v = cmpGet(p, keyForCmp);
                      return <td key={p.label} style={{ ...styles.td, textAlign: 'right', fontWeight: bold ? 700 : 400, color: bold ? boldColor : (neg && v > 0 ? '#f44336' : styles.td.color) }}>{neg && v > 0 ? `(${fmt(v)})` : fmt(v)}</td>;
                    })}
                  </tr>
                );
                const sectionRow = (label) => (
                  <tr style={styles.trEven}>
                    {hdrCell(label)}
                    {Array.from({ length: colCount }).map((_, i) => <td key={i} style={styles.td}></td>)}
                  </tr>
                );
                return (
                  <div style={{ ...styles.card, overflowX: 'auto' }}>
                    <h3 style={styles.cardTitle}>Balance Sheet</h3>
                    <p style={{ color: '#888', fontSize: 11, marginBottom: 8 }}>Cumulative from all transactions up to the selected end date.</p>
                    <table style={{ ...styles.table, minWidth: hasCmp ? 400 + colCount * 140 : 480 }}>
                      {hasCmp && (
                        <thead>
                          <tr>
                            <th style={styles.th}>Item</th>
                            <th style={{ ...styles.th, textAlign: 'right', color: '#ffc107' }}>{currentLabel}</th>
                            {finCompareFull.map((p) => <th key={p.label} style={{ ...styles.th, textAlign: 'right' }}>{p.label}</th>)}
                          </tr>
                        </thead>
                      )}
                      <tbody>
                        {sectionRow('Assets')}
                        {dataRow('Cash on Hand', finData.cashOnHand, 'cashOnHand', true)}
                        {dataRow('Cash in Bank', finData.cashInBank, 'cashInBank', true)}
                        {dataRow('Inventory Value', finData.invValue, 'invValue', true)}
                        {dataRow('Kitchen Equipment', finData.kitchenEquipment, 'kitchenEquipment', true)}
                        {dataRow('Less: Accumulated Depreciation', finData.accumDepreciation, 'accumDepreciation', true, true)}
                        {dataRow('Total Assets', finData.totalAssets, 'totalAssets', false, false, true, '#ffc107')}
                        {sectionRow('Liabilities')}
                        {dataRow('Accounts Payable', finData.ap, 'ap', true)}
                        {dataRow('Income Tax Payable', finData.incomeTaxPayable || 0, 'incomeTaxPayable', true)}
                        {dataRow('Loans Payable', finData.loansPayable || 0, 'loansPayable', true)}
                        {dataRow('Total Liabilities', finData.totalLiabilities, 'totalLiabilities', false, false, true, '#f44336')}
                        {sectionRow('Equity')}
                        {dataRow("Owner's Capital", finData.ownersCapital, 'ownersCapital', true)}
                        {dataRow('Retained Earnings', finData.retainedEarnings, 'retainedEarnings', true)}
                        {dataRow('Total Equity', finData.totalEquity, 'totalEquity', false, false, true, '#4caf50')}
                        <tr style={{ background: '#1a1a2a' }}>
                          <td style={{ ...styles.td, fontWeight: 700, color: '#ffc107' }}>Total Liabilities &amp; Equity</td>
                          <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700, color: '#ffc107' }}>{fmt(finData.totalLiabilities + finData.totalEquity)}</td>
                          {hasCmp && finCompareFull.map((p) => (
                            <td key={p.label} style={{ ...styles.td, textAlign: 'right', fontWeight: 700, color: '#ffc107' }}>{fmt((p.totalLiabilities || 0) + (p.totalEquity || 0))}</td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              })()}

              {/* Sales Report */}
              {finSubTab === 'sales' && finData?.type === 'sales' && (
                <div style={styles.card}>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center' }}>
                    <h3 style={styles.cardTitle}>Sales Report</h3>
                    {['general', 'itemized'].map((v) => (
                      <button
                        key={v}
                        onClick={() => setSalesSubView(v)}
                        style={{
                          padding: '5px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                          fontFamily: 'Poppins, sans-serif',
                          border: `1px solid ${salesSubView === v ? '#ffc107' : '#444'}`,
                          background: salesSubView === v ? '#ffc107' : 'transparent',
                          color: salesSubView === v ? '#000' : '#ccc',
                          fontWeight: salesSubView === v ? 700 : 400,
                        }}
                      >
                        {v === 'general' ? 'General' : 'Itemized'}
                      </button>
                    ))}
                  </div>
                  {(() => {
                    const rows = finData.rows || [];
                    const fmtPct = (v) => `${Number(v).toFixed(1)}%`;

                    if (salesSubView === 'general') {
                      // Group by category
                      const catMap = {};
                      rows.forEach((r) => {
                        const cat = r.category || 'Other';
                        if (!catMap[cat]) catMap[cat] = { quantity: 0, revenue: 0, cogs: 0, cm: 0 };
                        catMap[cat].quantity += Number(r.quantity) || 0;
                        catMap[cat].revenue += r.revenue;
                        catMap[cat].cogs += r.cogs;
                        catMap[cat].cm += r.cm;
                      });
                      const cats = Object.entries(catMap);
                      const grandQty = cats.reduce((s, [, v]) => s + v.quantity, 0);
                      const grandRev = cats.reduce((s, [, v]) => s + v.revenue, 0);
                      const grandCogs = cats.reduce((s, [, v]) => s + v.cogs, 0);
                      const grandCm = cats.reduce((s, [, v]) => s + v.cm, 0);
                      const grandCmPct = grandRev > 0 ? (grandCm / grandRev) * 100 : 0;
                      return (
                        <div style={styles.tableWrap}>
                          <table style={styles.table}>
                            <thead>
                              <tr>
                                {['Category', 'Qty Sold', 'Revenue (₱)', 'COGS (₱)', 'CM Amount (₱)', 'CM %'].map((h) => (
                                  <th key={h} style={{ ...styles.th, textAlign: h !== 'Category' ? 'right' : 'left' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {cats.map(([cat, v], i) => {
                                const cmPct = v.revenue > 0 ? (v.cm / v.revenue) * 100 : 0;
                                return (
                                  <tr key={cat} style={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                                    <td style={styles.td}>{cat}</td>
                                    <td style={{ ...styles.td, textAlign: 'right' }}>{v.quantity}</td>
                                    <td style={{ ...styles.td, textAlign: 'right', color: '#4caf50' }}>{fmt(v.revenue)}</td>
                                    <td style={{ ...styles.td, textAlign: 'right', color: '#f44336' }}>({fmt(v.cogs)})</td>
                                    <td style={{ ...styles.td, textAlign: 'right', color: v.cm >= 0 ? '#4caf50' : '#f44336' }}>{fmt(v.cm)}</td>
                                    <td style={{ ...styles.td, textAlign: 'right', color: cmPct >= 50 ? '#4caf50' : '#ffc107' }}>{fmtPct(cmPct)}</td>
                                  </tr>
                                );
                              })}
                              <tr style={{ background: '#2a2a1a', fontWeight: 700 }}>
                                <td style={{ ...styles.td, fontWeight: 700, color: '#ffc107' }}>Grand Total</td>
                                <td style={{ ...styles.td, textAlign: 'right', color: '#ffc107', fontWeight: 700 }}>{grandQty}</td>
                                <td style={{ ...styles.td, textAlign: 'right', color: '#4caf50', fontWeight: 700 }}>{fmt(grandRev)}</td>
                                <td style={{ ...styles.td, textAlign: 'right', color: '#f44336', fontWeight: 700 }}>({fmt(grandCogs)})</td>
                                <td style={{ ...styles.td, textAlign: 'right', color: grandCm >= 0 ? '#4caf50' : '#f44336', fontWeight: 700 }}>{fmt(grandCm)}</td>
                                <td style={{ ...styles.td, textAlign: 'right', color: '#ffc107', fontWeight: 700 }}>{fmtPct(grandCmPct)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      );
                    }

                    // Itemized: group by category then show items
                    const catGroups = {};
                    rows.forEach((r) => {
                      const cat = r.category || 'Other';
                      if (!catGroups[cat]) catGroups[cat] = [];
                      catGroups[cat].push(r);
                    });
                    const grandQty = rows.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
                    const grandRev = rows.reduce((s, r) => s + r.revenue, 0);
                    const grandCogs = rows.reduce((s, r) => s + r.cogs, 0);
                    const grandCm = rows.reduce((s, r) => s + r.cm, 0);
                    const grandCmPct = grandRev > 0 ? (grandCm / grandRev) * 100 : 0;
                    return (
                      <div style={styles.tableWrap}>
                        <table style={styles.table}>
                          <thead>
                            <tr>
                              {['Item', 'Category', 'Qty Sold', 'Revenue (₱)', 'COGS (₱)', 'CM Amount (₱)', 'CM %'].map((h) => (
                                <th key={h} style={{ ...styles.th, textAlign: h !== 'Item' && h !== 'Category' ? 'right' : 'left' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(catGroups).map(([cat, items]) => {
                              const catQty = items.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
                              const catRev = items.reduce((s, r) => s + r.revenue, 0);
                              const catCogs = items.reduce((s, r) => s + r.cogs, 0);
                              const catCm = items.reduce((s, r) => s + r.cm, 0);
                              const catCmPct = catRev > 0 ? (catCm / catRev) * 100 : 0;
                              return (
                                <React.Fragment key={cat}>
                                  {items.map((r, i) => (
                                    <tr key={r.name} style={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                                      <td style={styles.td}>{r.name}</td>
                                      <td style={styles.td}>{r.category}</td>
                                      <td style={{ ...styles.td, textAlign: 'right' }}>{r.quantity}</td>
                                      <td style={{ ...styles.td, textAlign: 'right', color: '#4caf50' }}>{fmt(r.revenue)}</td>
                                      <td style={{ ...styles.td, textAlign: 'right', color: '#f44336' }}>({fmt(r.cogs)})</td>
                                      <td style={{ ...styles.td, textAlign: 'right', color: r.cm >= 0 ? '#4caf50' : '#f44336' }}>{fmt(r.cm)}</td>
                                      <td style={{ ...styles.td, textAlign: 'right', color: r.cmPct >= 50 ? '#4caf50' : '#ffc107' }}>{fmtPct(r.cmPct)}</td>
                                    </tr>
                                  ))}
                                  <tr style={{ background: '#222' }}>
                                    <td colSpan={2} style={{ ...styles.td, fontWeight: 700, color: '#ffc107', paddingLeft: 24 }}>Subtotal — {cat}</td>
                                    <td style={{ ...styles.td, textAlign: 'right', color: '#ffc107', fontWeight: 700 }}>{catQty}</td>
                                    <td style={{ ...styles.td, textAlign: 'right', color: '#4caf50', fontWeight: 700 }}>{fmt(catRev)}</td>
                                    <td style={{ ...styles.td, textAlign: 'right', color: '#f44336', fontWeight: 700 }}>({fmt(catCogs)})</td>
                                    <td style={{ ...styles.td, textAlign: 'right', color: catCm >= 0 ? '#4caf50' : '#f44336', fontWeight: 700 }}>{fmt(catCm)}</td>
                                    <td style={{ ...styles.td, textAlign: 'right', color: '#ffc107', fontWeight: 700 }}>{fmtPct(catCmPct)}</td>
                                  </tr>
                                </React.Fragment>
                              );
                            })}
                            <tr style={{ background: '#2a2a1a' }}>
                              <td colSpan={2} style={{ ...styles.td, fontWeight: 700, color: '#ffc107' }}>Grand Total</td>
                              <td style={{ ...styles.td, textAlign: 'right', color: '#ffc107', fontWeight: 700 }}>{grandQty}</td>
                              <td style={{ ...styles.td, textAlign: 'right', color: '#4caf50', fontWeight: 700 }}>{fmt(grandRev)}</td>
                              <td style={{ ...styles.td, textAlign: 'right', color: '#f44336', fontWeight: 700 }}>({fmt(grandCogs)})</td>
                              <td style={{ ...styles.td, textAlign: 'right', color: grandCm >= 0 ? '#4caf50' : '#f44336', fontWeight: 700 }}>{fmt(grandCm)}</td>
                              <td style={{ ...styles.td, textAlign: 'right', color: '#ffc107', fontWeight: 700 }}>{fmtPct(grandCmPct)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Budget Variance — follows P&L structure with editable budget rows */}
              {finSubTab === 'budget' && finData?.type === 'budget' && (
                <div style={{ ...styles.card, width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={styles.cardTitle}>Budget Variance Report</h3>
                    <span style={{ color: '#4caf50', fontSize: 11, border: '1px solid #2e7d32', borderRadius: 12, padding: '4px 10px' }}>Auto-saved</span>
                  </div>
                  <p style={{ color: '#888', fontSize: 11, marginBottom: 12 }}>
                    Budget column is editable and auto-saved monthly. If a month has no saved budget yet, it automatically carries over the previous month as the starting forecast.
                  </p>
                  {(() => {
                    const bv = budgetValues;
                    const setBv = (key, val) => {
                      const next = { ...bv, [key]: val };
                      setBudgetValues(next);
                    };
                    const bdgInput = (key) => {
                      const rawVal = bv[key] !== undefined ? String(bv[key]) : '';
                      const isEditing = budgetEditKey === key;
                      const numVal = parseFloat(rawVal.replace(/,/g, '')) || 0;
                      const formattedVal = rawVal !== '' ? numVal.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : '';
                      return (
                        <input
                          type="text"
                          style={{ ...styles.input, width: 110, padding: '4px 8px', fontSize: 12, textAlign: 'right' }}
                          value={isEditing ? rawVal : formattedVal}
                          placeholder="0.00"
                          onFocus={() => setBudgetEditKey(key)}
                          onBlur={(e) => {
                            setBudgetEditKey(null);
                            const parsed = parseFloat(e.target.value.replace(/,/g, ''));
                            setBv(key, !isNaN(parsed) ? String(parsed) : '');
                          }}
                          onChange={(e) => setBv(key, e.target.value)}
                        />
                      );
                    };
                    const varRow = (label, actualVal, bKey, isExpense = false, indent = false) => {
                      const budget = Number(bv[bKey]) || 0;
                      const actual = Number(actualVal) || 0;
                      const variance = isExpense ? budget - actual : actual - budget;
                      const varPct = budget !== 0 ? ((variance / Math.abs(budget)) * 100).toFixed(1) : '—';
                      const varColor = variance >= 0 ? '#4caf50' : '#f44336';
                      const budgetPct = totalRevenueBudget !== 0 ? ((budget / totalRevenueBudget) * 100).toFixed(1) : '—';
                      const actualPct = finData.totalRevenue !== 0 ? ((actual / finData.totalRevenue) * 100).toFixed(1) : '—';
                      return (
                        <tr key={bKey} style={{ background: '#161616' }}>
                          <td style={{ ...styles.td, paddingLeft: indent ? 28 : 12 }}>{label}</td>
                          <td style={{ ...styles.td, padding: '6px 8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                              <span style={{ color: '#888', fontSize: 11 }}>₱</span>
                              {bdgInput(bKey)}
                            </div>
                          </td>
                          <td style={{ ...styles.td, textAlign: 'right', color: '#aaa', fontSize: 11 }}>
                            {budgetPct !== '—' ? `${budgetPct}%` : '—'}
                          </td>
                          <td style={{ ...styles.td, textAlign: 'right', color: isExpense ? '#f44336' : '#4caf50' }}>
                            {isExpense && actual > 0 ? `(${fmt(actual)})` : fmt(actual)}
                          </td>
                          <td style={{ ...styles.td, textAlign: 'right', color: '#aaa', fontSize: 11 }}>
                            {actualPct !== '—' ? `${actualPct}%` : '—'}
                          </td>
                          <td style={{ ...styles.td, textAlign: 'right', color: varColor, fontWeight: 600 }}>
                            {variance !== 0 ? (variance > 0 ? '+' : '') + fmt(variance) : fmt(0)}
                          </td>
                          <td style={{ ...styles.td, textAlign: 'right', color: varColor }}>
                            {varPct !== '—' ? `${varPct}%` : '—'}
                          </td>
                        </tr>
                      );
                    };
                    const OPEX_ACCOUNTS = [
                      'Salaries & Wages', 'Utilities', 'Supplies', 'Repairs & Maintenance',
                      'Advertising & Marketing', 'Software Subscriptions', 'Professional Fees',
                      'Transportation', 'Meals & Entertainment', 'Auto Expense', 'Rent Expense',
                      'Kitchen Tools', 'Miscellaneous Expense', "Rider's Fee", 'Depreciation Expense', 'Interest Expense',
                      'Research and Development Expense',
                    ];
                    const headerRow = (label, bg = '#1e1e1e') => (
                      <tr key={label} style={{ background: bg }}>
                        <td colSpan={7} style={{ ...styles.td, fontWeight: 700, color: '#ffc107', fontSize: 13 }}>{label}</td>
                      </tr>
                    );
                    const totalRow = (label, actual, budget, isExpense = false, bg = '#2a2a1a') => {
                      const variance = isExpense ? Number(budget) - Number(actual) : Number(actual) - Number(budget);
                      const varPct = budget !== 0 ? ((variance / Math.abs(Number(budget))) * 100).toFixed(1) : '—';
                      const varColor = variance >= 0 ? '#4caf50' : '#f44336';
                      const budgetPct = totalRevenueBudget !== 0 ? ((Number(budget) / totalRevenueBudget) * 100).toFixed(1) : '—';
                      const actualPct = finData.totalRevenue !== 0 ? ((Number(actual) / finData.totalRevenue) * 100).toFixed(1) : '—';
                      return (
                        <tr key={label} style={{ background: bg, fontWeight: 700 }}>
                          <td style={{ ...styles.td, fontWeight: 700, color: '#ffc107' }}>{label}</td>
                          <td style={{ ...styles.td, textAlign: 'right', color: '#ffc107' }}>{fmt(Number(budget) || 0)}</td>
                          <td style={{ ...styles.td, textAlign: 'right', color: '#aaa', fontSize: 11 }}>
                            {budgetPct !== '—' ? `${budgetPct}%` : '—'}
                          </td>
                          <td style={{ ...styles.td, textAlign: 'right', color: isExpense ? '#f44336' : '#4caf50' }}>
                            {isExpense && actual > 0 ? `(${fmt(actual)})` : fmt(actual)}
                          </td>
                          <td style={{ ...styles.td, textAlign: 'right', color: '#aaa', fontSize: 11 }}>
                            {actualPct !== '—' ? `${actualPct}%` : '—'}
                          </td>
                          <td style={{ ...styles.td, textAlign: 'right', color: varColor, fontWeight: 700 }}>
                            {variance !== 0 ? (variance > 0 ? '+' : '') + fmt(variance) : fmt(0)}
                          </td>
                          <td style={{ ...styles.td, textAlign: 'right', color: varColor }}>
                            {varPct !== '—' ? `${varPct}%` : '—'}
                          </td>
                        </tr>
                      );
                    };
                    const totalRevenueBudget = (Number(bv['Revenue']) || 0) + (Number(bv['Delivery Income']) || 0);
                    const grossProfitBudget = totalRevenueBudget - (Number(bv['Cost of Goods Sold']) || 0);
                    const opExpBudget = OPEX_ACCOUNTS.reduce((s, a) => s + (Number(bv[a]) || 0), 0);
                    const incomeBeforeTaxBudget = grossProfitBudget - opExpBudget;
                    const incomeTaxBudget = Number(bv['Income Tax Expense']) || 0;
                    const netProfitBudget = incomeBeforeTaxBudget - incomeTaxBudget;
                    return (
                      <div style={styles.tableWrap}>
                        <table style={{ ...styles.table, minWidth: 1120 }}>
                          <thead>
                            <tr>
                              {['Account', 'Budget (₱)', 'Budget %', 'Actual (₱)', 'Actual %', 'Variance (₱)', 'Variance %'].map((h) => (
                                <th key={h} style={{ ...styles.th, textAlign: h !== 'Account' ? 'right' : 'left' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {headerRow('Revenue')}
                            {varRow('Revenue', finData.revenue, 'Revenue')}
                            {varRow('Delivery Income', finData.deliveryIncome, 'Delivery Income', false, true)}
                            {totalRow('Total Revenue', finData.totalRevenue, totalRevenueBudget)}
                            {headerRow('Cost of Goods Sold')}
                            {varRow('Cost of Goods Sold', finData.cogs, 'Cost of Goods Sold', true, true)}
                            {totalRow('Gross Profit', finData.grossProfit, grossProfitBudget, false, '#1a3a1a')}
                            {headerRow('Operating Expenses')}
                            {OPEX_ACCOUNTS.map((a) => varRow(a, finData.expByAccount?.[a] || 0, a, true, true))}
                            {totalRow('Total Operating Expenses', finData.opExp, opExpBudget, true, '#2a1a1a')}
                            {totalRow('Income Before Tax', finData.incomeBeforeTax, incomeBeforeTaxBudget, false, '#1a2a1a')}
                            {varRow('Income Tax Expense', finData.incomeTaxExpense || 0, 'Income Tax Expense', true, true)}
                            {totalRow('Net Income', finData.netIncome, netProfitBudget, false, '#2a2a00')}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Tax Report */}
              {finSubTab === 'tax' && finData?.type === 'tax' && (
                <div style={styles.card}>
                  <h3 style={styles.cardTitle}>Tax Report (VAT 12%)</h3>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        {['Month', 'Total Sales', 'VAT (12%)', 'Net of VAT'].map((h) => (
                          <th key={h} style={styles.th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {finData.rows.map((row, idx) => (
                        <tr key={row.month} style={idx % 2 === 0 ? styles.trEven : styles.trOdd}>
                          <td style={styles.td}>{row.month}</td>
                          <td style={styles.td}>{fmt(row.total)}</td>
                          <td style={{ ...styles.td, color: '#f44336' }}>{fmt(row.vat)}</td>
                          <td style={styles.td}>{fmt(row.netOfVat)}</td>
                        </tr>
                      ))}
                      {finData.rows.length === 0 && (
                        <tr><td colSpan={4} style={{ ...styles.td, textAlign: 'center', color: '#666' }}>No data</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Chart of Accounts */}
              {finSubTab === 'coa' && (
                <div style={{ ...styles.card, maxWidth: 680 }}>
                  <h3 style={styles.cardTitle}>Chart of Accounts</h3>
                  {/* Date coverage controls */}
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                    <label style={{ color: '#aaa', fontSize: 12 }}>Date From:</label>
                    <input
                      type="date"
                      style={{ ...styles.input, width: 140 }}
                      value={coaDateFrom}
                      onChange={(e) => setCoaDateFrom(e.target.value)}
                    />
                    <label style={{ color: '#aaa', fontSize: 12 }}>To:</label>
                    <input
                      type="date"
                      style={{ ...styles.input, width: 140 }}
                      value={coaDateTo}
                      onChange={(e) => setCoaDateTo(e.target.value)}
                    />
                    <button onClick={fetchCOA} style={styles.primaryBtn} disabled={coaLoading}>
                      {coaLoading ? 'Loading…' : 'Refresh'}
                    </button>
                  </div>
                  <p style={{ color: '#888', fontSize: 11, marginBottom: 16 }}>
                    Balance Sheet accounts: opening balance (before {coaDateFrom}) + period activity. Income Statement accounts: period activity only.
                  </p>
                  {(() => {
                    const COA_CATEGORIES = [
                      {
                        category: 'Assets',
                        color: '#4caf50',
                        type: 'bs',
                        accounts: ['Cash on Hand', 'Cash in Bank', 'Accounts Receivable', 'Inventory', 'Kitchen Equipment', 'Accumulated Depreciation'],
                      },
                      {
                        category: 'Liabilities',
                        color: '#f44336',
                        type: 'bs',
                        accounts: ['Accounts Payable', 'Accounts Payable - Rewards', 'Notes Payable', 'Accrued Liabilities', 'Income Tax Payable', 'Loans Payable'],
                      },
                      {
                        category: 'Equity',
                        color: '#2196f3',
                        type: 'bs',
                        accounts: ["Owner's Capital", 'Retained Earnings'],
                      },
                      {
                        category: 'Revenue',
                        color: '#ffc107',
                        type: 'is',
                        accounts: ['Revenue', 'Delivery Income', 'Other Income'],
                      },
                      {
                        category: 'Expenses',
                        color: '#ff9800',
                        type: 'is',
                        accounts: [
                          'Cost of Goods Sold', "Rider's Fee",
                          'Salaries & Wages', 'Utilities', 'Supplies', 'Repairs & Maintenance',
                          'Advertising & Marketing', 'Software Subscriptions', 'Professional Fees',
                          'Transportation', 'Meals & Entertainment', 'Auto Expense', 'Rent Expense',
                          'Kitchen Tools', 'Miscellaneous Expense', 'Depreciation Expense', 'Interest Expense', 'Income Tax Expense',
                        ],
                      },
                    ];
                    const allAccountsFlat = COA_CATEGORIES.flatMap((c) => c.accounts);
                    const grandTotal = coaData
                      ? allAccountsFlat.reduce((s, acct) => s + Math.abs(coaData[acct] || 0), 0)
                      : 0;
                    return (
                      <div>
                        <table style={styles.table}>
                          <thead>
                            <tr>
                              <th style={styles.th}>Account Name</th>
                              <th style={{ ...styles.th, textAlign: 'right' }}>Amount (₱)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {COA_CATEGORIES.map(({ category, color, accounts }) => (
                              <React.Fragment key={category}>
                                <tr style={{ background: '#1e1e1e' }}>
                                  <td colSpan={2} style={{ ...styles.td, fontWeight: 700, color, fontSize: 13, borderLeft: `4px solid ${color}` }}>{category}</td>
                                </tr>
                                {accounts.map((acct, i) => {
                                  const amt = coaData ? (coaData[acct] || 0) : null;
                                  return (
                                    <tr key={acct} style={{ background: i % 2 === 0 ? '#161616' : '#1a1a1a' }}>
                                      <td style={{ ...styles.td, paddingLeft: 24 }}>{acct}</td>
                                      <td style={{ ...styles.td, textAlign: 'right', color: amt !== null && amt < 0 ? '#f44336' : '#ccc' }}>
                                        {amt === null ? '—' : fmt(amt)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </React.Fragment>
                            ))}
                            <tr style={{ background: '#2a2a00' }}>
                              <td style={{ ...styles.td, fontWeight: 700, color: '#ffc107' }}>Grand Total (Absolute)</td>
                              <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700, color: '#ffc107' }}>
                                {coaData ? fmt(grandTotal) : '—'}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* ──────────────── PAYROLL / ATTENDANCE SHEET ──────────────── */}
          {activeTab === 'attendance_sheet' && (
            <div>
              <div style={styles.tabHeader}>
                <h1 style={styles.pageTitle}>Payroll - Attendance Sheet</h1>
              </div>

              <div style={{ ...styles.card, marginBottom: 16 }}>
                <div style={styles.payrollControlGrid}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label style={{ ...styles.label, paddingTop: 0 }}>Payroll Period</label>
                    <input
                      type="month"
                      value={payrollPeriodMeta.monthValue}
                      onChange={(e) => changePayrollPeriod(e.target.value, payrollPeriodMeta.cycleType)}
                      style={{ ...styles.input, maxWidth: 150 }}
                      disabled={!payrollCanEdit}
                    />
                    <select
                      value={payrollPeriodMeta.cycleType}
                      onChange={(e) => changePayrollPeriod(payrollPeriodMeta.monthValue, e.target.value)}
                      style={{ ...styles.input, maxWidth: 180 }}
                      disabled={!payrollCanEdit}
                    >
                      <option value="first">{payrollPeriodMeta.firstLabel}</option>
                      <option value="second">{payrollPeriodMeta.secondLabel}</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="text"
                      placeholder="Employee name"
                      value={newPayrollEmployeeName}
                      onChange={(e) => setNewPayrollEmployeeName(e.target.value)}
                      style={{ ...styles.input, maxWidth: 240 }}
                      disabled={!payrollCanEdit}
                    />
                    <button type="button" style={styles.primaryBtn} onClick={addPayrollEmployee} disabled={!payrollCanEdit}>
                      + Add Employee
                    </button>
                  </div>
                </div>
                <p style={{ color: '#888', margin: '8px 0 0 0', fontSize: 12 }}>
                  Auto-save is enabled. Changes are saved immediately.
                </p>
                {payrollData.submitted && (
                  <p style={{ color: '#4caf50', margin: '8px 0 0 0', fontSize: 12 }}>
                    Submitted: {new Date(payrollData.submittedAt || Date.now()).toLocaleString('en-PH')}
                  </p>
                )}
                {payrollHasProcessedDeduction && (
                  <p style={{ color: '#ff9800', margin: '8px 0 0 0', fontSize: 12 }}>
                    Cashier already processed salary deduction entries. Attendance editing is locked.
                  </p>
                )}
              </div>

              {(() => {
                const employees = payrollData.employees || [];
                const grandGross = employees.reduce((s, emp) => {
                  const grossPay = roundToCurrency((emp.monthlyPay || 0) / PAYROLL_CYCLES_PER_MONTH);
                  return s + grossPay;
                }, 0);
                const grandAbsences = employees.reduce((s, emp) => {
                  const grossPay = roundToCurrency((emp.monthlyPay || 0) / PAYROLL_CYCLES_PER_MONTH);
                  const absentCount = (emp.daily || []).filter((v) => v === false).length;
                  return s + roundToCurrency((grossPay / WORKING_DAYS_PER_CYCLE) * absentCount);
                }, 0);
                const grandDed = employees.reduce((s, emp) => s + (emp.deductions || []).reduce((ds, d) => ds + (Number(d.amount) || 0), 0), 0);
                const grandNet = grandGross - grandAbsences - grandDed;
                return (
                  <div style={styles.payrollTableWrap}>
                    <table style={{ ...styles.table, fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th style={styles.payrollTh}>Day</th>
                          <th style={styles.payrollTh}>Date</th>
                          {employees.map((emp) => (
                            <th key={emp.id} style={{ ...styles.payrollTh, textAlign: 'center', minWidth: 80 }}>
                              {emp.name}
                            </th>
                          ))}
                          <th style={{ ...styles.payrollTh, textAlign: 'right' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payrollCycleDays.map((day, dayIndex) => (
                          <tr
                            key={day.date}
                            style={
                              day.isSunday
                                ? { background: '#1e2f24' }
                                : day.isToday
                                  ? { background: '#2a2a2a' }
                                  : dayIndex % 2 === 0 ? styles.payrollTrEven : styles.payrollTrOdd
                            }
                          >
                            <td style={{ ...styles.payrollTd, color: day.isSunday ? '#7bc67b' : '#f0f0f0', fontWeight: day.isToday ? 700 : 400 }}>
                              {day.dayLabel}
                            </td>
                            <td style={{ ...styles.payrollTd, color: day.isSunday ? '#7bc67b' : '#f0f0f0', fontWeight: day.isToday ? 700 : 400 }}>
                              {day.label}
                            </td>
                            {employees.map((emp) => {
                              const attendanceValue = emp.daily?.[dayIndex];
                              const isPresent = attendanceValue === true;
                              const isAbsent = attendanceValue === false;
                              const isBlank = attendanceValue === null || typeof attendanceValue === 'undefined';
                              return (
                                <td key={emp.id} style={{ ...styles.payrollTd, textAlign: 'center' }}>
                                  <button
                                    type="button"
                                    style={{
                                      ...styles.payrollCheckBtn,
                                      color: isPresent ? '#1a7f1a' : (isAbsent ? '#c62828' : '#bbb'),
                                      borderColor: day.isSunday ? '#4caf50' : (isBlank ? '#777' : '#666'),
                                      background: day.isSunday ? '#274130' : (day.isToday ? '#3a3a3a' : '#222'),
                                    }}
                                    onClick={() => toggleAttendance(emp.id, dayIndex)}
                                    disabled={!payrollCanEdit || day.isSunday}
                                    title={day.isSunday ? 'Sunday (rest day – default present)' : 'Toggle present / absent'}
                                  >
                                    {isPresent ? '✔' : (isAbsent ? 'X' : '')}
                                  </button>
                                </td>
                              );
                            })}
                            <td style={styles.payrollTd} />
                          </tr>
                        ))}

                        {employees.length === 0 && (
                          <tr>
                            <td colSpan={3} style={{ ...styles.payrollTd, textAlign: 'center', color: '#aaa', padding: 24 }}>
                              No employees yet. Add an employee to start attendance tracking.
                            </td>
                          </tr>
                        )}

                        {employees.length > 0 && (
                          <>
                            <tr style={{ background: '#242424' }}>
                              <td colSpan={2} style={{ ...styles.payrollTd, fontWeight: 700, color: '#f3f3f3' }}>Total Present</td>
                              {employees.map((emp) => (
                                <td key={emp.id} style={{ ...styles.payrollTd, textAlign: 'center', fontWeight: 700, color: '#f3f3f3' }}>
                                  {(emp.daily || []).filter(Boolean).length}
                                </td>
                              ))}
                              <td style={styles.payrollTd} />
                            </tr>

                            <tr style={{ background: '#242424' }}>
                              <td colSpan={2} style={{ ...styles.payrollTd, fontWeight: 700, color: '#f3f3f3' }}>Monthly Pay</td>
                              {employees.map((emp) => (
                                <td key={emp.id} style={{ ...styles.payrollTd, textAlign: 'right' }}>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    disabled={!payrollCanEdit}
                                    value={emp.monthlyPay || ''}
                                    onChange={(e) => updateMonthlyPay(emp.id, e.target.value)}
                                    style={{
                                      width: '100%',
                                      background: '#1a1a1a',
                                      color: '#fff',
                                      border: '1px solid #555',
                                      borderRadius: 4,
                                      padding: '2px 4px',
                                      textAlign: 'right',
                                      fontSize: 12,
                                    }}
                                  />
                                </td>
                              ))}
                              <td style={styles.payrollTd} />
                            </tr>

                            <tr style={{ background: '#242424' }}>
                              <td colSpan={2} style={{ ...styles.payrollTd, fontWeight: 700, color: '#f3f3f3' }}>Gross Pay</td>
                              {employees.map((emp) => {
                                const grossPay = roundToCurrency((emp.monthlyPay || 0) / PAYROLL_CYCLES_PER_MONTH);
                                return (
                                  <td key={emp.id} style={{ ...styles.payrollTd, textAlign: 'right', color: '#f3f3f3' }}>
                                    {fmt(grossPay)}
                                  </td>
                                );
                              })}
                              <td style={{ ...styles.payrollTd, textAlign: 'right', fontWeight: 700, color: '#f3f3f3' }}>{fmt(grandGross)}</td>
                            </tr>

                            <tr style={{ background: '#242424' }}>
                              <td colSpan={2} style={{ ...styles.payrollTd, fontWeight: 700, color: '#f3f3f3' }}>Absences</td>
                              {employees.map((emp) => {
                                const grossPay = roundToCurrency((emp.monthlyPay || 0) / PAYROLL_CYCLES_PER_MONTH);
                                const absentCount = (emp.daily || []).filter((v) => v === false).length;
                                const absences = roundToCurrency((grossPay / WORKING_DAYS_PER_CYCLE) * absentCount);
                                return (
                                  <td key={emp.id} style={{ ...styles.payrollTd, textAlign: 'right', color: absences > 0 ? '#ef5350' : '#aaa' }}>
                                    {absences > 0 ? `- ${fmt(absences)}` : '-'}
                                  </td>
                                );
                              })}
                              <td style={{ ...styles.payrollTd, textAlign: 'right', fontWeight: 700, color: grandAbsences > 0 ? '#ef5350' : '#aaa' }}>
                                {grandAbsences > 0 ? `- ${fmt(grandAbsences)}` : '-'}
                              </td>
                            </tr>

                            <tr style={{ background: '#242424' }}>
                              <td colSpan={2} style={{ ...styles.payrollTd, fontWeight: 700, color: '#f3f3f3' }}>Deductions</td>
                              {employees.map((emp) => {
                                const ded = (emp.deductions || []).reduce((s, d) => s + (Number(d.amount) || 0), 0);
                                return (
                                  <td key={emp.id} style={{ ...styles.payrollTd, textAlign: 'right', color: ded > 0 ? '#ef5350' : '#aaa' }}>
                                    {ded > 0 ? `- ${fmt(ded)}` : '-'}
                                  </td>
                                );
                              })}
                              <td style={{ ...styles.payrollTd, textAlign: 'right', fontWeight: 700, color: grandDed > 0 ? '#ef5350' : '#aaa' }}>
                                {grandDed > 0 ? `- ${fmt(grandDed)}` : '-'}
                              </td>
                            </tr>

                            <tr style={{ background: '#242424' }}>
                              <td colSpan={2} style={{ ...styles.payrollTd, fontWeight: 700, color: '#f3f3f3' }}>Net Pay</td>
                              {employees.map((emp) => {
                                const grossPay = roundToCurrency((emp.monthlyPay || 0) / PAYROLL_CYCLES_PER_MONTH);
                                const absentCount = (emp.daily || []).filter((v) => v === false).length;
                                const absences = roundToCurrency((grossPay / WORKING_DAYS_PER_CYCLE) * absentCount);
                                const ded = (emp.deductions || []).reduce((s, d) => s + (Number(d.amount) || 0), 0);
                                return (
                                  <td key={emp.id} style={{ ...styles.payrollTd, textAlign: 'right', fontWeight: 700, color: '#f3f3f3' }}>
                                    {fmt(grossPay - absences - ded)}
                                  </td>
                                );
                              })}
                              <td style={{ ...styles.payrollTd, textAlign: 'right', fontWeight: 700, color: '#f3f3f3' }}>{fmt(grandNet)}</td>
                            </tr>

                            <tr style={{ background: '#303030' }}>
                              <td colSpan={employees.length + 2} style={{ ...styles.payrollTd, fontWeight: 700, color: '#fff' }}>
                                Billable to Cashier
                              </td>
                              <td style={{ ...styles.payrollTd, textAlign: 'right', fontWeight: 700, color: '#fff' }}>{fmt(grandNet)}</td>
                            </tr>
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>
                );
              })()}

              <div style={{ ...styles.card, marginTop: 16 }}>
                <div style={styles.payrollControlGrid}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label style={{ ...styles.label, paddingTop: 0 }}>Employee</label>
                    <select
                      style={{ ...styles.input, width: 240 }}
                      value={payrollSelectedEmployeeId}
                      onChange={(e) => setPayrollSelectedEmployeeId(e.target.value)}
                    >
                      <option value="">Select employee</option>
                      {(payrollData.employees || []).map((employee) => (
                        <option key={employee.id} value={employee.id}>{employee.name}</option>
                      ))}
                    </select>
                    <button type="button" style={styles.primaryBtn} onClick={openDeductionsDialog}>
                      Deductions
                    </button>
                    <button
                      type="button"
                      style={{ ...styles.actionBtn, color: '#f44336', borderColor: '#f44336' }}
                      onClick={() => payrollSelectedEmployeeId && deletePayrollEmployee(payrollSelectedEmployeeId)}
                      disabled={!payrollCanEdit || !payrollSelectedEmployeeId}
                    >
                      Delete Employee
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" style={{ ...styles.primaryBtn, background: '#2e7d32', color: '#fff' }} onClick={submitPayroll}>Submit</button>
                  </div>
                </div>
                {payrollMessage && (
                  <p style={{ marginTop: 10, fontSize: 12, color: '#666' }}>{payrollMessage}</p>
                )}
              </div>

              <Dialog.Root open={!!deductionDialogEmployeeId} onOpenChange={(open) => { if (!open) setDeductionDialogEmployeeId(null); }}>
                <Dialog.Portal>
                  <Dialog.Overlay style={styles.dialogOverlay} />
                  <Dialog.Content style={{ ...styles.dialogContent, maxWidth: 640 }} aria-describedby={undefined}>
                    <Dialog.Title style={styles.dialogTitle}>Deductions</Dialog.Title>

                    <div style={styles.formGrid}>
                      <label style={styles.label}>Employee Name</label>
                      <input style={{ ...styles.input, background: '#111', color: '#fff' }} readOnly value={selectedDeductionEmployee?.name || ''} />
                      <label style={styles.label}>Date</label>
                      <input
                        type="date"
                        style={styles.input}
                        value={deductionForm.date}
                        onChange={(e) => setDeductionForm((prev) => ({ ...prev, date: e.target.value }))}
                        disabled={!payrollCanEdit}
                      />
                      <label style={styles.label}>Transaction Type</label>
                      <select
                        style={styles.input}
                        value={deductionForm.type}
                        onChange={(e) => setDeductionForm((prev) => ({ ...prev, type: e.target.value }))}
                        disabled={!payrollCanEdit}
                      >
                        <option value="Cash Advance">Cash Advance</option>
                        <option value="Others">Others</option>
                      </select>
                      <label style={styles.label}>Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        style={styles.input}
                        value={deductionForm.amount}
                        onChange={(e) => setDeductionForm((prev) => ({ ...prev, amount: e.target.value }))}
                        disabled={!payrollCanEdit}
                      />
                      <label style={styles.label}>Notes</label>
                      <input
                        type="text"
                        style={styles.input}
                        value={deductionForm.notes}
                        onChange={(e) => setDeductionForm((prev) => ({ ...prev, notes: e.target.value }))}
                        placeholder="Optional notes"
                        disabled={!payrollCanEdit}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                      <button type="button" style={styles.actionBtn} onClick={() => setDeductionForm((prev) => ({ ...prev, id: null, amount: '', notes: '' }))}>
                        Clear
                      </button>
                      <button type="button" style={styles.primaryBtn} onClick={saveDeductionEntry} disabled={!payrollCanEdit}>
                        Save
                      </button>
                    </div>

                    <div style={{ ...styles.tableWrap, marginTop: 16 }}>
                      <table style={{ ...styles.table, fontSize: 12 }}>
                        <thead>
                          <tr>
                            {['Date', 'Type', 'Amount', 'Source', 'Action'].map((h) => <th key={h} style={styles.th}>{h}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {(selectedDeductionEmployee?.deductions || []).map((deduction, idx) => (
                            <tr key={deduction.id} style={idx % 2 === 0 ? styles.trEven : styles.trOdd}>
                              <td style={styles.td}>{deduction.date}</td>
                              <td style={styles.td}>{deduction.type}</td>
                              <td style={{ ...styles.td, textAlign: 'right', color: '#f44336' }}>{fmt(deduction.amount || 0)}</td>
                              <td style={styles.td}>{deduction.source === SALARY_DEDUCTION_SOURCE ? 'Cashier' : 'Manual'}</td>
                              <td style={styles.td}>
                                <button type="button" style={styles.actionBtn} onClick={() => editDeduction(deduction)} disabled={!payrollCanEdit}>Edit</button>
                                <button
                                  type="button"
                                  style={{ ...styles.actionBtn, color: '#f44336', borderColor: '#f44336' }}
                                  onClick={() => deleteDeductionEntry(deduction.id)}
                                  disabled={!payrollCanEdit || deduction.source === SALARY_DEDUCTION_SOURCE}
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                          {(selectedDeductionEmployee?.deductions || []).length === 0 && (
                            <tr>
                              <td colSpan={5} style={{ ...styles.td, color: '#666', textAlign: 'center' }}>
                                No deductions yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div style={styles.dialogFooter}>
                      <Dialog.Close asChild><button style={styles.cancelBtn}>Close</button></Dialog.Close>
                    </div>
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>
            </div>
          )}

          {/* ──────────────── MY PROFILE ──────────────── */}
          {activeTab === 'profile' && (
            <div>
              <h1 style={styles.pageTitle}>My Profile</h1>
              {loading && <p style={styles.loadingText}>Loading…</p>}

              {profileData && (
                <div style={{ ...styles.card, maxWidth: 560 }}>
                  {!profileEditMode ? (
                    <div>
                      {[
                        ['Full Name', profileData.full_name || '—'],
                        ['Email', profileData.email || session?.user?.email || '—'],
                        ['Role', profileData.role || '—'],
                        ['Phone', profileData.phone || '—'],
                        ['Address', profileData.address || '—'],
                        ['Member Since', profileData.created_at ? new Date(profileData.created_at).toLocaleDateString('en-PH') : '—'],
                      ].map(([label, value]) => (
                        <div key={label} style={{ display: 'flex', padding: '12px 0', borderBottom: '1px solid #333' }}>
                          <span style={{ color: '#888', fontSize: 13, width: 140, flexShrink: 0 }}>{label}</span>
                          <span style={{ color: '#fff', fontSize: 14 }}>{value}</span>
                        </div>
                      ))}
                      <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                        <button onClick={() => setProfileEditMode(true)} style={styles.primaryBtn}>Edit Profile</button>
                        <button onClick={() => { setPwDialogOpen(true); setPwError(''); setPwForm({ newPass: '', confirmPass: '' }); }} style={styles.actionBtn}>Change Password</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={styles.formGrid}>
                        <label style={styles.label}>Full Name</label>
                        <input style={styles.input} value={profileForm.full_name} onChange={(e) => setProfileForm((p) => ({ ...p, full_name: e.target.value }))} />
                        <label style={styles.label}>Phone</label>
                        <input style={styles.input} value={profileForm.phone} onChange={(e) => setProfileForm((p) => ({ ...p, phone: e.target.value }))} />
                        <label style={styles.label}>Address</label>
                        <input style={styles.input} value={profileForm.address} onChange={(e) => setProfileForm((p) => ({ ...p, address: e.target.value }))} />
                      </div>
                      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                        <button onClick={() => setProfileEditMode(false)} style={styles.cancelBtn}>Cancel</button>
                        <button onClick={saveProfile} style={styles.primaryBtn}>Save Changes</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!profileData && !loading && (
                <p style={{ color: '#666' }}>No profile data found.</p>
              )}

              {/* Change Password Dialog */}
              <Dialog.Root open={pwDialogOpen} onOpenChange={setPwDialogOpen}>
                <Dialog.Portal>
                  <Dialog.Overlay style={styles.dialogOverlay} />
                  <Dialog.Content style={{ ...styles.dialogContent, maxWidth: 400 }} aria-describedby={undefined}>
                    <Dialog.Title style={styles.dialogTitle}>Change Password</Dialog.Title>
                    <div style={styles.formGrid}>
                      <label style={styles.label}>New Password</label>
                      <input style={styles.input} type="password" value={pwForm.newPass} onChange={(e) => setPwForm((p) => ({ ...p, newPass: e.target.value }))} />
                      <label style={styles.label}>Confirm Password</label>
                      <input style={styles.input} type="password" value={pwForm.confirmPass} onChange={(e) => setPwForm((p) => ({ ...p, confirmPass: e.target.value }))} />
                    </div>
                    {pwError && <p style={{ color: '#f44336', fontSize: 13, marginTop: 8 }}>{pwError}</p>}
                    <div style={styles.dialogFooter}>
                      <Dialog.Close asChild><button style={styles.cancelBtn}>Cancel</button></Dialog.Close>
                      <button onClick={savePassword} style={styles.primaryBtn}>Save</button>
                    </div>
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>
            </div>
          )}
          {/* ──────────────── JOURNAL ENTRIES ──────────────── */}
          {activeTab === 'journal' && (
            <div>
              <h1 style={styles.pageTitle}>Journal Entries</h1>

              {/* Row 1: Report Type dropdown + sub-filters */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <label style={{ color: '#ccc', fontSize: 13, whiteSpace: 'nowrap' }}>Report Type:</label>
                <select
                  value={journalSubTab}
                  onChange={(e) => { setJournalSubTab(e.target.value); setJournalSubFilter('all'); }}
                  style={{ ...styles.input, width: 180, paddingRight: 8 }}
                >
                  <option value="all">General</option>
                  <option value="sales">Sales</option>
                  <option value="purchases">Purchases</option>
                  <option value="others">Adjusting Entries</option>
                </select>

                {/* Sub-filters rendered inline */}
                {journalSubTab === 'sales' && [
                  { key: 'all', label: 'All Sales' },
                  { key: 'cash_sales', label: 'Cash Sales' },
                  { key: 'gcash_sales', label: 'GCash Sales' },
                  { key: 'points_claimed', label: 'Points Claimed' },
                ].map((sf) => (
                  <button key={sf.key} onClick={() => setJournalSubFilter(sf.key)}
                    style={{ padding: '5px 14px', borderRadius: 14, cursor: 'pointer', fontFamily: 'Poppins, sans-serif', fontSize: 12,
                      border: `1px solid ${journalSubFilter === sf.key ? '#4caf50' : '#444'}`,
                      background: journalSubFilter === sf.key ? '#4caf50' : 'transparent',
                      color: journalSubFilter === sf.key ? '#000' : '#aaa',
                      fontWeight: journalSubFilter === sf.key ? 700 : 400 }}>
                    {sf.label}
                  </button>
                ))}
                {journalSubTab === 'purchases' && [
                  { key: 'all', label: 'All Purchases' },
                  { key: 'approved_rr', label: 'Approved RR' },
                  { key: 'rr_cash_on_hand', label: 'Paid: Cash on Hand' },
                  { key: 'rr_cash_in_bank', label: 'Paid: Cash in Bank' },
                  { key: 'rr_credit_card', label: 'Paid: Credit Card' },
                  { key: 'bill_all', label: 'All Bills' },
                  { key: 'bill_approved', label: 'Bill Approved' },
                  { key: 'bill_paid', label: 'Bill Paid' },
                ].map((sf) => (
                  <button key={sf.key} onClick={() => setJournalSubFilter(sf.key)}
                    style={{ padding: '5px 14px', borderRadius: 14, cursor: 'pointer', fontFamily: 'Poppins, sans-serif', fontSize: 12,
                      border: `1px solid ${journalSubFilter === sf.key ? '#4caf50' : '#444'}`,
                      background: journalSubFilter === sf.key ? '#4caf50' : 'transparent',
                      color: journalSubFilter === sf.key ? '#000' : '#aaa',
                      fontWeight: journalSubFilter === sf.key ? 700 : 400 }}>
                    {sf.label}
                  </button>
                ))}
                {journalSubTab === 'others' && [
                  { key: 'all', label: 'All Adjusting Entries' },
                  { key: 'adjustments', label: 'Adjustments' },
                  { key: 'manual_entry', label: 'Manual Entry' },
                ].map((sf) => (
                  <button key={sf.key} onClick={() => setJournalSubFilter(sf.key)}
                    style={{ padding: '5px 14px', borderRadius: 14, cursor: 'pointer', fontFamily: 'Poppins, sans-serif', fontSize: 12,
                      border: `1px solid ${journalSubFilter === sf.key ? '#4caf50' : '#444'}`,
                      background: journalSubFilter === sf.key ? '#4caf50' : 'transparent',
                      color: journalSubFilter === sf.key ? '#000' : '#aaa',
                      fontWeight: journalSubFilter === sf.key ? 700 : 400 }}>
                    {sf.label}
                  </button>
                ))}
              </div>

              {/* Row 2: Date range + Account Name filter + Reload */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
                <label style={{ color: '#ccc', fontSize: 13 }}>From:</label>
                <input type="date" style={{ ...styles.input, width: 160 }} value={journalDateFrom} onChange={(e) => setJournalDateFrom(e.target.value)} />
                <label style={{ color: '#ccc', fontSize: 13 }}>To:</label>
                <input type="date" style={{ ...styles.input, width: 160 }} value={journalDateTo} onChange={(e) => setJournalDateTo(e.target.value)} />
                <label style={{ color: '#ccc', fontSize: 13 }}>Account Name:</label>
                {/* Searchable dropdown for account filter */}
                <div style={{ position: 'relative' }}>
                  <div
                    onClick={() => { setJournalAccountDropdownOpen((v) => !v); setJournalAccountSearch(''); }}
                    style={{ ...styles.input, width: 200, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none' }}
                  >
                    <span style={{ color: journalAccountFilter ? '#fff' : '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {journalAccountFilter || 'All Accounts'}
                    </span>
                    {journalAccountFilter
                      ? <span onClick={(e) => { e.stopPropagation(); setJournalAccountFilter(''); setJournalAccountDropdownOpen(false); }} style={{ color: '#888', cursor: 'pointer', marginLeft: 4 }}>✕</span>
                      : <span style={{ color: '#888', marginLeft: 4 }}>▾</span>
                    }
                  </div>
                  {journalAccountDropdownOpen && (
                    <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 200, background: '#1e1e1e', border: '1px solid #555', borderRadius: 6, width: 240, maxHeight: 220, display: 'flex', flexDirection: 'column', boxShadow: '0 4px 16px rgba(0,0,0,0.5)' }}>
                      <input
                        autoFocus
                        type="text"
                        placeholder="Search accounts…"
                        value={journalAccountSearch}
                        onChange={(e) => setJournalAccountSearch(e.target.value)}
                        style={{ ...styles.input, margin: 6, width: 'calc(100% - 12px)', boxSizing: 'border-box' }}
                      />
                      <div style={{ overflowY: 'auto', flex: 1 }}>
                        <div
                          onClick={() => { setJournalAccountFilter(''); setJournalAccountDropdownOpen(false); }}
                          style={{ padding: '6px 10px', cursor: 'pointer', color: '#aaa', fontSize: 12, background: !journalAccountFilter ? '#2a2a2a' : 'transparent' }}
                        >All Accounts</div>
                        {journalKnownAccounts
                          .filter((a) => !journalAccountSearch || a.toLowerCase().includes(journalAccountSearch.toLowerCase()))
                          .map((acct) => (
                            <div
                              key={acct}
                              onClick={() => { setJournalAccountFilter(acct); setJournalAccountDropdownOpen(false); }}
                              style={{ padding: '6px 10px', cursor: 'pointer', fontSize: 12, background: journalAccountFilter === acct ? '#ffc107' : 'transparent', color: journalAccountFilter === acct ? '#000' : '#ccc' }}
                            >{acct}</div>
                          ))
                        }
                      </div>
                    </div>
                  )}
                </div>
                <button onClick={fetchJournal} style={styles.primaryBtn}>Reload</button>
              </div>

              {/* Row 3: Search */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                <label style={{ color: '#ccc', fontSize: 13 }}>Search:</label>
                <input
                  type="text"
                  placeholder="Filter by name, ref no., description, account, amount…"
                  style={{ ...styles.input, width: 340 }}
                  value={journalSearch}
                  onChange={(e) => setJournalSearch(e.target.value)}
                />
                {journalSearch && (
                  <button
                    onClick={() => setJournalSearch('')}
                    style={{ background: 'transparent', border: '1px solid #555', color: '#aaa', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 12, fontFamily: 'Poppins, sans-serif' }}
                  >✕ Clear</button>
                )}
              </div>

              {journalLoading && <p style={styles.loadingText}>Loading…</p>}

              {/* Transaction report */}
              {!journalLoading && (() => {
                // Group by entry_number (manual), or reference+type (to keep RR approval vs payment separate), fallback to id
                const groupKey = (row) =>
                  row.entry_number ||
                  (row.reference ? `${row.reference_type}__${row.reference}` : null) ||
                  (row.reference_id ? `${row.reference_type}__${String(row.reference_id)}` : row.id);
                const groups = {};
                (journalData || []).forEach((row) => {
                  const k = groupKey(row);
                  if (!groups[k]) groups[k] = [];
                  groups[k].push(row);
                });
                // Apply client-side search across all fields
                const srch = journalSearch.trim().toLowerCase();
                // Apply account filter per individual line
                const acctF = journalAccountFilter.trim().toLowerCase();
                const allGroupEntries = Object.entries(groups);
                const groupEntries = srch
                  ? allGroupEntries.filter(([key, rows]) => {
                      const refDisplay = rows[0].entry_number || rows[0].reference || rows[0].reference_type || key.slice(0, 8);
                      const nameDisplay = (rows[0].name || '').toLowerCase();
                      if (refDisplay.toLowerCase().includes(srch)) return true;
                      if (nameDisplay.includes(srch)) return true;
                      return rows.some((r) =>
                        (r.description || '').toLowerCase().includes(srch) ||
                        (r.debit_account || '').toLowerCase().includes(srch) ||
                        (r.credit_account || '').toLowerCase().includes(srch) ||
                        String(r.amount || '').includes(srch) ||
                        (r.date || '').includes(srch)
                      );
                    })
                  : allGroupEntries;
                if (groupEntries.length === 0) {
                  return <p style={{ color: '#666', textAlign: 'center', padding: 24 }}>No journal entries found for the selected period and filter.</p>;
                }
                let grandTotal = 0;
                let grandTotalCredit = 0;
                return (
                  <div style={styles.tableWrap}>
                    <table style={{ ...styles.table, fontSize: 12 }}>
                      <thead>
                        <tr>
                          {['Date', 'Reference No.', 'Contact', 'Particular', 'Account Title', 'Debit (₱)', 'Credit (₱)'].map((h) => (
                            <th key={h} style={styles.th}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {groupEntries.map(([key, rows]) => {
                          const refDisplay =
                            rows[0].entry_number ||
                            rows[0].reference ||
                            rows[0].reference_type ||
                            key.slice(0, 8);
                          const nameDisplay = rows[0].name || '—';
                          const groupTotal = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
                          grandTotal += groupTotal;
                          grandTotalCredit += groupTotal;
                          // Each data row expands to a debit line + a credit line
                          // When account filter is active, only show lines where the account matches
                          const displayRows = rows.flatMap((row) => {
                            const lines = [];
                            const drMatch = !acctF || (row.debit_account || '').toLowerCase() === acctF;
                            const crMatch = !acctF || (row.credit_account || '').toLowerCase() === acctF;
                            if (drMatch) lines.push({ row, isDebit: true });
                            if (crMatch) lines.push({ row, isDebit: false });
                            return lines;
                          });
                          if (displayRows.length === 0) return null;
                          return (
                            <React.Fragment key={key}>
                              {displayRows.map(({ row, isDebit }, di) => (
                                <tr key={`${row.id}-${isDebit ? 'dr' : 'cr'}`} style={di % 2 === 0 ? styles.trEven : styles.trOdd}>
                                  {/* Date: shown on every line */}
                                  <td style={styles.td}>{row.date}</td>
                                  {/* Reference: shown on every line */}
                                  <td style={styles.td}>{refDisplay}</td>
                                  {/* Name: shown on every line */}
                                  <td style={styles.td}>{nameDisplay}</td>
                                  {/* Particular: shown on every line */}
                                  <td style={styles.td}>{row.description}</td>
                                  {/* Account Title: Dr. flush-left, Cr. indented */}
                                  {isDebit
                                    ? <td style={{ ...styles.td, color: '#4caf50' }}>Dr. {row.debit_account}</td>
                                    : <td style={{ ...styles.td, color: '#f44336', paddingLeft: 24 }}>Cr. {row.credit_account}</td>
                                  }
                                  {/* Debit (₱): amount only on debit line */}
                                  <td style={{ ...styles.td, color: '#4caf50', textAlign: 'right' }}>
                                    {isDebit ? fmt(Number(row.amount) || 0) : '—'}
                                  </td>
                                  {/* Credit (₱): amount only on credit line */}
                                  <td style={{ ...styles.td, color: '#f44336', textAlign: 'right' }}>
                                    {isDebit ? '—' : fmt(Number(row.amount) || 0)}
                                  </td>
                                </tr>
                              ))}
                              {/* Group subtotal */}
                              <tr style={{ background: '#1e1e1e', borderTop: '1px solid #333' }}>
                                <td colSpan={5} style={{ ...styles.td, textAlign: 'right', color: '#aaa', fontWeight: 600, fontSize: 11 }}>Subtotal ({refDisplay}):</td>
                                <td style={{ ...styles.td, textAlign: 'right', color: '#4caf50', fontWeight: 700 }}>{fmt(groupTotal)}</td>
                                <td style={{ ...styles.td, textAlign: 'right', color: '#f44336', fontWeight: 700 }}>{fmt(groupTotal)}</td>
                              </tr>
                            </React.Fragment>
                          );
                        })}
                        {/* Grand total */}
                        <tr style={{ background: '#2a2a1a', fontWeight: 700 }}>
                          <td colSpan={5} style={{ ...styles.td, textAlign: 'right', color: '#ffc107', fontWeight: 700 }}>GRAND TOTAL:</td>
                          <td style={{ ...styles.td, textAlign: 'right', color: '#4caf50', fontWeight: 700 }}>{fmt(grandTotal)}</td>
                          <td style={{ ...styles.td, textAlign: 'right', color: '#f44336', fontWeight: 700 }}>{fmt(grandTotalCredit)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ──────────────── MANUAL ENTRY ──────────────── */}
          {activeTab === 'manual' && (
            <div>
              <h1 style={styles.pageTitle}>Manual Journal Entry</h1>

              {manualError && <p style={{ color: '#f44336', marginBottom: 12 }}>{manualError}</p>}
              {manualSuccess && <p style={{ color: '#4caf50', marginBottom: 12 }}>{manualSuccess}</p>}

              {/* Header fields */}
              <div style={{ ...styles.card, marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '110px minmax(180px, 1fr) 120px minmax(220px, 1fr)', gap: 12, alignItems: 'center' }}>
                  <label style={styles.label}>Date</label>
                  <input
                    type="date"
                    style={styles.input}
                    value={manualEntryForm.date}
                    onChange={(e) => setManualEntryForm((p) => ({ ...p, date: e.target.value }))}
                  />

                  <label style={styles.label}>Reference Number</label>
                  <input
                    style={styles.input}
                    placeholder="Optional reference…"
                    value={manualEntryForm.reference_number}
                    onChange={(e) => setManualEntryForm((p) => ({ ...p, reference_number: e.target.value }))}
                  />

                  <label style={styles.label}>Contact</label>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      style={{ ...styles.input, flex: 1 }}
                      readOnly
                      placeholder="Click 🔍 to search contacts…"
                      value={manualEntryForm.name}
                    />
                    <button
                      type="button"
                      title="Search contacts"
                      style={{ background: '#333', border: '1px solid #555', borderRadius: 4, color: '#ffc107', cursor: 'pointer', padding: '6px 10px', fontSize: 13 }}
                      onClick={() => { setContactPickerOpen(true); setContactPickerQuery(''); setNewContactMode(false); setNewContactError(''); fetchContacts(''); }}
                    >🔍</button>
                    {manualEntryForm.name && (
                      <button
                        type="button"
                        style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: 14 }}
                        onClick={() => setManualEntryForm((p) => ({ ...p, name: '' }))}
                      >✕</button>
                    )}
                  </div>

                  <label style={styles.label}>Entry Number</label>
                  <input style={{ ...styles.input, background: '#111', color: '#ffc107', fontWeight: 700 }} readOnly value={manualEntryNumber} />

                  <label style={styles.label}>Description / Memo</label>
                  <div style={{ gridColumn: '2 / -1' }}>
                    <input
                      style={styles.input}
                      placeholder="Brief description of this entry…"
                      maxLength={180}
                      value={manualEntryForm.description}
                      onChange={(e) => setManualEntryForm((p) => ({ ...p, description: e.target.value }))}
                    />
                    <span style={styles.helperText}>{manualEntryForm.description.length}/180</span>
                  </div>
                </div>
              </div>

              {/* Line items */}
              <div style={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={styles.cardTitle}>Line Items</h3>
                  <button
                    type="button"
                    style={styles.primaryBtn}
                    onClick={() => setManualEntryLines((p) => [...p, { description: '', account: '', type: 'debit', amount: '' }])}
                  >+ Add Line</button>
                </div>
                <div style={styles.tableWrap}>
                  <table style={{ ...styles.table, fontSize: 12 }}>
                    <thead>
                      <tr>
                        {['Description', 'Account', 'Dr / Cr', 'Amount (₱)', ''].map((h) => (
                          <th key={h} style={styles.th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {manualEntryLines.map((line, li) => (
                        <tr key={li}>
                          <td style={styles.td}>
                            <input
                              style={{ ...styles.input, fontSize: 12, padding: '4px 6px', width: 180 }}
                              placeholder="Line description…"
                              value={line.description}
                              onChange={(e) => setManualEntryLines((p) => p.map((l, i) => i === li ? { ...l, description: e.target.value } : l))}
                            />
                          </td>
                          <td style={styles.td}>
                            <input
                              style={{ ...styles.input, fontSize: 12, padding: '4px 6px', width: 180 }}
                              placeholder="e.g. Cash on Hand"
                              list="journal-accounts-list"
                              value={line.account}
                              onChange={(e) => setManualEntryLines((p) => p.map((l, i) => i === li ? { ...l, account: e.target.value } : l))}
                            />
                          </td>
                          <td style={styles.td}>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button
                                type="button"
                                onClick={() => setManualEntryLines((p) => p.map((l, i) => i === li ? { ...l, type: 'debit' } : l))}
                                style={{ padding: '4px 10px', borderRadius: 4, fontSize: 12, cursor: 'pointer', border: '1px solid #555', background: line.type === 'debit' ? '#1a3a1a' : '#222', color: line.type === 'debit' ? '#4caf50' : '#aaa', fontWeight: line.type === 'debit' ? 700 : 400 }}
                              >Dr</button>
                              <button
                                type="button"
                                onClick={() => setManualEntryLines((p) => p.map((l, i) => i === li ? { ...l, type: 'credit' } : l))}
                                style={{ padding: '4px 10px', borderRadius: 4, fontSize: 12, cursor: 'pointer', border: '1px solid #555', background: line.type === 'credit' ? '#3a1a1a' : '#222', color: line.type === 'credit' ? '#f44336' : '#aaa', fontWeight: line.type === 'credit' ? 700 : 400 }}
                              >Cr</button>
                            </div>
                          </td>
                          <td style={styles.td}>
                            <input
                              type="number"
                              style={{ ...styles.input, fontSize: 12, padding: '4px 6px', width: 110, color: line.type === 'debit' ? '#4caf50' : '#f44336' }}
                              value={line.amount}
                              onChange={(e) => setManualEntryLines((p) => p.map((l, i) => i === li ? { ...l, amount: e.target.value } : l))}
                            />
                          </td>
                          <td style={styles.td}>
                            <button
                              type="button"
                              style={{ ...styles.actionBtn, color: '#f44336', borderColor: '#f44336', padding: '2px 8px' }}
                              onClick={() => setManualEntryLines((p) => p.filter((_, i) => i !== li))}
                            >✕</button>
                          </td>
                        </tr>
                      ))}
                      {/* Total row */}
                      {manualEntryLines.length > 0 && (() => {
                        const totalDebit = manualEntryLines.filter((l) => l.type === 'debit').reduce((s, l) => s + (Number(l.amount) || 0), 0);
                        const totalCredit = manualEntryLines.filter((l) => l.type === 'credit').reduce((s, l) => s + (Number(l.amount) || 0), 0);
                        const balanced = Math.abs(totalDebit - totalCredit) < 0.01;
                        return (
                          <tr style={{ background: '#2a2a1a', fontWeight: 700 }}>
                            <td colSpan={2} style={{ ...styles.td, textAlign: 'right', color: '#ffc107' }}>TOTAL:</td>
                            <td style={{ ...styles.td, color: '#4caf50', textAlign: 'right' }}>Dr: {fmt(totalDebit)}</td>
                            <td style={{ ...styles.td, color: '#f44336', textAlign: 'right' }}>Cr: {fmt(totalCredit)}</td>
                            <td style={{ ...styles.td, textAlign: 'center' }}>
                              {balanced ? <span style={{ color: '#4caf50' }}>✓ Balanced</span> : <span style={{ color: '#f44336' }}>⚠ Unbalanced</span>}
                            </td>
                          </tr>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
                <datalist id="journal-accounts-list">
                  {journalKnownAccounts.map((a) => <option key={a} value={a} />)}
                </datalist>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                  <button onClick={saveManualEntry} style={styles.primaryBtn} disabled={manualSaving}>
                    {manualSaving ? 'Saving…' : 'Save Entry'}
                  </button>
                </div>
              </div>

              {/* Contact Picker Dialog */}
              <Dialog.Root open={contactPickerOpen} onOpenChange={(open) => { if (!open) { setContactPickerOpen(false); setNewContactMode(false); setNewContactError(''); } }}>
                <Dialog.Portal>
                  <Dialog.Overlay style={styles.dialogOverlay} />
                  <Dialog.Content style={{ ...styles.dialogContent, maxWidth: 480 }} aria-describedby={undefined}>
                    <Dialog.Title style={styles.dialogTitle}>Select Contact</Dialog.Title>
                    {!newContactMode ? (
                      <>
                        <div style={{ marginBottom: 12 }}>
                          <input
                            style={styles.input}
                            placeholder="Search vendors or customers…"
                            value={contactPickerQuery}
                            onChange={(e) => { setContactPickerQuery(e.target.value); fetchContacts(e.target.value); }}
                            autoFocus
                          />
                        </div>
                        <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 12 }}>
                          {contactList.map((c) => (
                            <div
                              key={c.id}
                              onClick={() => {
                                setManualEntryForm((p) => ({ ...p, name: c.name }));
                                setContactPickerOpen(false);
                              }}
                              style={{ padding: '8px 12px', cursor: 'pointer', borderRadius: 4, color: '#fff', background: '#2a2a2a', marginBottom: 4, border: '1px solid #333' }}
                            >
                              <strong>{c.name}</strong>
                              <span style={{ color: '#888', fontSize: 12 }}> · {c.type}</span>
                            </div>
                          ))}
                          {contactList.length === 0 && (
                            <p style={{ color: '#666', textAlign: 'center', padding: 16 }}>No contacts found.</p>
                          )}
                        </div>
                        <div style={{ ...styles.dialogFooter, justifyContent: 'space-between' }}>
                          <button
                            style={{ ...styles.primaryBtn, fontSize: 12, padding: '7px 14px' }}
                            onClick={() => { setNewContactMode(true); setNewContactForm({ name: '', address: '', contact: '', tin: '' }); setNewContactError(''); }}
                          >+ New Contact</button>
                          <Dialog.Close asChild><button style={styles.cancelBtn}>Close</button></Dialog.Close>
                        </div>
                      </>
                    ) : (
                      <>
                        <p style={{ color: '#aaa', fontSize: 13, marginBottom: 12 }}>Enroll a new vendor / contact:</p>
                        <div style={styles.formGrid}>
                          <label style={styles.label}>Name *</label>
                          <input style={styles.input} value={newContactForm.name} onChange={(e) => setNewContactForm((p) => ({ ...p, name: e.target.value }))} placeholder="Contact name" autoFocus />
                          <label style={styles.label}>Address</label>
                          <input style={styles.input} value={newContactForm.address} onChange={(e) => setNewContactForm((p) => ({ ...p, address: e.target.value }))} placeholder="Address" />
                          <label style={styles.label}>Contact #</label>
                          <input style={styles.input} value={newContactForm.contact} onChange={(e) => setNewContactForm((p) => ({ ...p, contact: e.target.value }))} placeholder="Phone / mobile" />
                          <label style={styles.label}>TIN</label>
                          <input style={styles.input} value={newContactForm.tin} onChange={(e) => setNewContactForm((p) => ({ ...p, tin: e.target.value }))} placeholder="TIN (optional)" />
                        </div>
                        {newContactError && <p style={{ color: '#f44336', fontSize: 12, marginTop: 8 }}>{newContactError}</p>}
                        <div style={styles.dialogFooter}>
                          <button style={styles.cancelBtn} onClick={() => setNewContactMode(false)}>← Back</button>
                          <button style={styles.primaryBtn} onClick={saveNewContact} disabled={newContactSaving}>
                            {newContactSaving ? 'Saving…' : 'Save Contact'}
                          </button>
                        </div>
                      </>
                    )}
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>
            </div>
          )}

          {/* ──────────────── BILLS ──────────────── */}
          {activeTab === 'bills' && (
            <div>
              <div style={styles.tabHeader}>
                <h1 style={styles.pageTitle}>Bills</h1>
                <button onClick={() => openBillDialog()} style={styles.primaryBtn}>+ New Bill</button>
              </div>

              {billSuccess && <p style={{ color: '#4caf50', marginBottom: 12 }}>{billSuccess}</p>}

              {/* Search */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
                <label style={{ color: '#ccc', fontSize: 13 }}>Search:</label>
                <input
                  type="text"
                  placeholder="Filter by bill number, contact, description…"
                  style={{ ...styles.input, width: 300 }}
                  value={billSearch}
                  onChange={(e) => setBillSearch(e.target.value)}
                />
                {billSearch && (
                  <button onClick={() => setBillSearch('')} style={{ background: 'transparent', border: '1px solid #555', color: '#aaa', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 12, fontFamily: 'Poppins, sans-serif' }}>✕ Clear</button>
                )}
              </div>

              {loading && <p style={styles.loadingText}>Loading…</p>}

              {/* Bills list */}
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      {['Bill #', 'Date', 'Contact', 'Description', 'Total Amount (₱)', 'Status', 'Actions'].map((h) => (
                        <th key={h} style={styles.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(billsList || []).filter((b) => {
                      if (!billSearch) return true;
                      const q = billSearch.toLowerCase();
                      return (b.bill_number || '').toLowerCase().includes(q) ||
                        (b.contact || '').toLowerCase().includes(q) ||
                        (b.description || '').toLowerCase().includes(q);
                    }).map((bill, idx) => {
                      const statusColor = bill.status === 'paid' ? '#4caf50' : bill.status === 'approved' ? '#2196f3' : '#ffc107';
                      const statusBg = bill.status === 'paid' ? '#1a3a1a' : bill.status === 'approved' ? '#0a1a2a' : '#2a2a00';
                      return (
                        <tr key={bill.id} style={idx % 2 === 0 ? styles.trEven : styles.trOdd}>
                          <td style={{ ...styles.td, color: '#ffc107', fontWeight: 600 }}>{bill.bill_number}</td>
                          <td style={styles.td}>{bill.date}</td>
                          <td style={styles.td}>{bill.contact || '—'}</td>
                          <td style={styles.td}>{bill.description || '—'}</td>
                          <td style={{ ...styles.td, color: '#4caf50', textAlign: 'right' }}>{fmt(bill.total_debit || 0)}</td>
                          <td style={styles.td}>
                            <span style={{ ...styles.badge, background: statusBg, color: statusColor, border: `1px solid ${statusColor}` }}>
                              {bill.status || 'draft'}
                            </span>
                          </td>
                          <td style={styles.td}>
                            <button onClick={() => viewBill(bill)} style={styles.actionBtn}>View</button>
                            {bill.status !== 'paid' && (
                              <button onClick={() => openBillDialog(bill)} style={styles.actionBtn}>Edit</button>
                            )}
                            {bill.status === 'draft' && (
                              <>
                                <button
                                  onClick={() => approveBill(bill)}
                                  style={{ ...styles.actionBtn, color: '#2196f3', borderColor: '#2196f3' }}
                                >Approve</button>
                              </>
                            )}
                            {bill.status === 'approved' && (
                              <button
                                onClick={() => { setBillPayItem(bill); setBillPayMethod('cash_on_hand'); setBillPayError(''); setBillPayDialogOpen(true); }}
                                style={{ ...styles.actionBtn, color: '#4caf50', borderColor: '#4caf50' }}
                              >Pay</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {billsList.length === 0 && !loading && (
                      <tr><td colSpan={7} style={{ ...styles.td, textAlign: 'center', color: '#666', padding: 32 }}>No bills yet. Create a new bill!</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Bill Create/Edit Dialog */}
              <Dialog.Root open={billDialogOpen} onOpenChange={(open) => { if (!open) setBillDialogOpen(false); }}>
                <Dialog.Portal>
                  <Dialog.Overlay style={styles.dialogOverlay} />
                  <Dialog.Content style={{ ...styles.dialogContent, maxWidth: 720 }} aria-describedby={undefined}>
                    <Dialog.Title style={styles.dialogTitle}>
                      {billEditItem ? `Edit Bill – ${billNumber}` : 'New Bill'}
                    </Dialog.Title>
                    {billError && <p style={{ color: '#f44336', fontSize: 13, marginBottom: 10 }}>{billError}</p>}

                    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 120px 1fr', gap: 10, marginBottom: 16 }}>
                      <label style={styles.label}>Bill #</label>
                      <input style={{ ...styles.input, background: '#111', color: '#ffc107', fontWeight: 700 }} readOnly value={billNumber} />
                      <label style={styles.label}>Date</label>
                      <input type="date" style={styles.input} value={billForm.date} onChange={(e) => setBillForm((p) => ({ ...p, date: e.target.value }))} />

                      <label style={styles.label}>Contact</label>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input style={{ ...styles.input, flex: 1 }} readOnly placeholder="Click 🔍 to search…" value={billForm.contact} />
                        <button
                          type="button"
                          style={{ background: '#333', border: '1px solid #555', borderRadius: 4, color: '#ffc107', cursor: 'pointer', padding: '6px 10px', fontSize: 13 }}
                          onClick={() => { setBillContactPickerOpen(true); setBillContactQuery(''); fetchBillContacts(''); }}
                        >🔍</button>
                        {billForm.contact && (
                          <button type="button" style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: 14 }} onClick={() => setBillForm((p) => ({ ...p, contact: '' }))}>✕</button>
                        )}
                      </div>

                      <label style={styles.label}>Description</label>
                      <textarea
                        style={{ ...styles.input, minHeight: 56, resize: 'vertical', gridColumn: '2 / 5', width: '100%', boxSizing: 'border-box' }}
                        placeholder="Brief description or memo…"
                        value={billForm.description}
                        onChange={(e) => setBillForm((p) => ({ ...p, description: e.target.value }))}
                      />
                    </div>

                    {/* Line Items */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <h4 style={{ color: '#ffc107', margin: 0, fontSize: 14 }}>Line Items</h4>
                      <button
                        type="button"
                        style={{ ...styles.actionBtn, fontSize: 12 }}
                        onClick={() => setBillLines((p) => [...p, { description: '', account_title: '', debit_amount: '' }])}
                      >+ Add Line</button>
                    </div>
                    <p style={{ color: '#888', fontSize: 11, marginBottom: 8 }}>
                      Credit side is automatically <strong style={{ color: '#aaa' }}>Accounts Payable</strong> for the total debit amount.
                    </p>
                    <div style={styles.tableWrap}>
                      <table style={{ ...styles.table, fontSize: 12 }}>
                        <thead>
                          <tr>
                            {['Description', 'Account Title (Debit)', 'Amount (₱)', ''].map((h) => (
                              <th key={h} style={styles.th}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {billLines.map((line, li) => (
                            <tr key={li}>
                              <td style={styles.td}>
                                <input
                                  style={{ ...styles.input, fontSize: 12, padding: '4px 6px', width: 160 }}
                                  placeholder="Line description…"
                                  value={line.description}
                                  onChange={(e) => setBillLines((p) => p.map((l, i) => i === li ? { ...l, description: e.target.value } : l))}
                                />
                              </td>
                              <td style={styles.td}>
                                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                  <input
                                    style={{ ...styles.input, fontSize: 12, padding: '4px 6px', width: 150 }}
                                    placeholder="e.g. Utilities"
                                    list="bill-accounts-list"
                                    value={line.account_title}
                                    onChange={(e) => setBillLines((p) => p.map((l, i) => i === li ? { ...l, account_title: e.target.value } : l))}
                                  />
                                  <button
                                    type="button"
                                    style={{ background: '#333', border: '1px solid #555', borderRadius: 4, color: '#ffc107', cursor: 'pointer', padding: '3px 7px', fontSize: 11 }}
                                    onClick={() => { setBillAcctPickerIdx(li); setBillAcctQuery(''); }}
                                    title="Search account"
                                  >🔍</button>
                                </div>
                              </td>
                              <td style={styles.td}>
                                <input
                                  type="number"
                                  style={{ ...styles.input, fontSize: 12, padding: '4px 6px', width: 100, color: '#4caf50' }}
                                  value={line.debit_amount}
                                  onChange={(e) => setBillLines((p) => p.map((l, i) => i === li ? { ...l, debit_amount: e.target.value } : l))}
                                />
                              </td>
                              <td style={styles.td}>
                                <button
                                  type="button"
                                  style={{ ...styles.actionBtn, color: '#f44336', borderColor: '#f44336', padding: '2px 8px' }}
                                  onClick={() => setBillLines((p) => p.filter((_, i) => i !== li))}
                                >✕</button>
                              </td>
                            </tr>
                          ))}
                          {billLines.length > 0 && (() => {
                            const totalDebit = billLines.reduce((s, l) => s + (Number(l.debit_amount) || 0), 0);
                            return (
                              <tr style={{ background: '#2a2a1a', fontWeight: 700 }}>
                                <td colSpan={2} style={{ ...styles.td, textAlign: 'right', color: '#ffc107' }}>TOTAL (Dr):</td>
                                <td style={{ ...styles.td, color: '#4caf50', textAlign: 'right' }}>{fmt(totalDebit)}</td>
                                <td style={styles.td} />
                              </tr>
                            );
                          })()}
                          <tr style={{ background: '#1a1a2a' }}>
                            <td colSpan={2} style={{ ...styles.td, textAlign: 'right', color: '#aaa', fontSize: 11 }}>Credit — Accounts Payable:</td>
                            <td style={{ ...styles.td, color: '#f44336', textAlign: 'right', fontSize: 11 }}>
                              {fmt(billLines.reduce((s, l) => s + (Number(l.debit_amount) || 0), 0))}
                            </td>
                            <td style={styles.td} />
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <datalist id="bill-accounts-list">
                      {journalKnownAccounts.map((a) => <option key={a} value={a} />)}
                    </datalist>

                    <div style={styles.dialogFooter}>
                      <Dialog.Close asChild><button style={styles.cancelBtn}>Cancel</button></Dialog.Close>
                      <button onClick={saveBill} style={styles.primaryBtn} disabled={billSaving}>
                        {billSaving ? 'Saving…' : 'Save Bill'}
                      </button>
                    </div>
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>

              {/* Bill View Dialog */}
              <Dialog.Root open={!!billViewItem} onOpenChange={(open) => { if (!open) setBillViewItem(null); }}>
                <Dialog.Portal>
                  <Dialog.Overlay style={styles.dialogOverlay} />
                  <Dialog.Content style={{ ...styles.dialogContent, maxWidth: 620 }} aria-describedby={undefined}>
                    <Dialog.Title style={styles.dialogTitle}>{billViewItem?.bill_number}</Dialog.Title>
                    {billViewItem && (
                      <div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                          {[
                            ['Date', billViewItem.date],
                            ['Contact', billViewItem.contact || '—'],
                            ['Status', billViewItem.status || 'draft'],
                            ['Description', billViewItem.description || '—'],
                          ].map(([label, value]) => (
                            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <span style={{ color: '#888', fontSize: 11 }}>{label}</span>
                              <span style={{ color: '#fff', fontSize: 13 }}>{value}</span>
                            </div>
                          ))}
                        </div>
                        <div style={styles.tableWrap}>
                          <table style={{ ...styles.table, fontSize: 12 }}>
                            <thead>
                              <tr>
                                {['Description', 'Account Title (Debit)', 'Amount (₱)'].map((h) => (
                                  <th key={h} style={styles.th}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {(billViewLines || []).map((l, idx) => (
                                <tr key={l.id} style={idx % 2 === 0 ? styles.trEven : styles.trOdd}>
                                  <td style={styles.td}>{l.description || '—'}</td>
                                  <td style={styles.td}>{l.account_title || '—'}</td>
                                  <td style={{ ...styles.td, color: '#4caf50', textAlign: 'right' }}>{l.debit_amount > 0 ? fmt(l.debit_amount) : '—'}</td>
                                </tr>
                              ))}
                              {billViewLines.length === 0 && (
                                <tr><td colSpan={3} style={{ ...styles.td, textAlign: 'center', color: '#666' }}>No line items</td></tr>
                              )}
                              {billViewLines.length > 0 && (
                                <tr style={{ background: '#1a1a2a' }}>
                                  <td colSpan={2} style={{ ...styles.td, textAlign: 'right', color: '#aaa', fontSize: 11 }}>Credit — Accounts Payable:</td>
                                  <td style={{ ...styles.td, color: '#f44336', textAlign: 'right', fontSize: 11 }}>
                                    {fmt(billViewLines.reduce((s, l) => s + (Number(l.debit_amount) || 0), 0))}
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    <div style={styles.dialogFooter}>
                      {billViewItem?.status === 'draft' && (
                        <button
                          style={styles.actionBtn}
                          onClick={() => {
                            const item = billViewItem;
                            setBillViewItem(null);
                            openBillDialog(item);
                          }}
                        >
                          Edit
                        </button>
                      )}
                      <Dialog.Close asChild><button style={styles.cancelBtn}>Close</button></Dialog.Close>
                    </div>
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>

              {/* Bill Contact Picker */}
              <Dialog.Root open={billContactPickerOpen} onOpenChange={(open) => { if (!open) { setBillContactPickerOpen(false); setBillNewContactMode(false); setBillNewContactError(''); } }}>
                <Dialog.Portal>
                  <Dialog.Overlay style={styles.dialogOverlay} />
                  <Dialog.Content style={{ ...styles.dialogContent, maxWidth: 440 }} aria-describedby={undefined}>
                    <Dialog.Title style={styles.dialogTitle}>Select Contact</Dialog.Title>
                    {!billNewContactMode ? (
                      <>
                        <input
                          style={{ ...styles.input, marginBottom: 12 }}
                          placeholder="Search contacts…"
                          value={billContactQuery}
                          onChange={(e) => { setBillContactQuery(e.target.value); fetchBillContacts(e.target.value); }}
                          autoFocus
                        />
                        <div style={{ maxHeight: 260, overflowY: 'auto', marginBottom: 12 }}>
                          {(billContactList || []).map((c) => (
                            <div
                              key={c.id}
                              onClick={() => { setBillForm((p) => ({ ...p, contact: c.name })); setBillContactPickerOpen(false); }}
                              style={{ padding: '8px 12px', cursor: 'pointer', borderRadius: 4, color: '#fff', background: '#2a2a2a', marginBottom: 4, border: '1px solid #333' }}
                            >
                              <strong>{c.name}</strong>
                              <span style={{ color: '#888', fontSize: 12 }}> · {c.type}</span>
                            </div>
                          ))}
                          {billContactList.length === 0 && <p style={{ color: '#666', textAlign: 'center', padding: 16 }}>No contacts found.</p>}
                        </div>
                        <div style={{ borderTop: '1px solid #333', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <button
                            type="button"
                            style={{ ...styles.primaryBtn, fontSize: 12 }}
                            onClick={() => { setBillNewContactMode(true); setBillNewContactForm({ name: '', address: '', contact: '', tin: '' }); setBillNewContactError(''); }}
                          >+ New Contact</button>
                          <Dialog.Close asChild><button style={styles.cancelBtn}>Close</button></Dialog.Close>
                        </div>
                      </>
                    ) : (
                      <>
                        <h4 style={{ color: '#ffc107', fontSize: 13, marginBottom: 12 }}>Enroll New Contact</h4>
                        {billNewContactError && <p style={{ color: '#f44336', fontSize: 12, marginBottom: 8 }}>{billNewContactError}</p>}
                        <div style={styles.formGrid}>
                          <label style={styles.label}>Name *</label>
                          <input style={styles.input} value={billNewContactForm.name} onChange={(e) => setBillNewContactForm((p) => ({ ...p, name: e.target.value }))} autoFocus />
                          <label style={styles.label}>Address</label>
                          <input style={styles.input} value={billNewContactForm.address} onChange={(e) => setBillNewContactForm((p) => ({ ...p, address: e.target.value }))} />
                          <label style={styles.label}>Contact #</label>
                          <input style={styles.input} value={billNewContactForm.contact} onChange={(e) => setBillNewContactForm((p) => ({ ...p, contact: e.target.value }))} />
                          <label style={styles.label}>TIN</label>
                          <input style={styles.input} value={billNewContactForm.tin} onChange={(e) => setBillNewContactForm((p) => ({ ...p, tin: e.target.value }))} />
                        </div>
                        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                          <button type="button" style={styles.cancelBtn} onClick={() => setBillNewContactMode(false)}>← Back</button>
                          <button type="button" style={styles.primaryBtn} onClick={saveNewBillContact} disabled={billNewContactSaving}>
                            {billNewContactSaving ? 'Saving…' : 'Save Contact'}
                          </button>
                        </div>
                      </>
                    )}
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>

              {/* Bill Account Title Picker */}
              <Dialog.Root open={billAcctPickerIdx !== null} onOpenChange={(open) => { if (!open) setBillAcctPickerIdx(null); }}>
                <Dialog.Portal>
                  <Dialog.Overlay style={styles.dialogOverlay} />
                  <Dialog.Content style={{ ...styles.dialogContent, maxWidth: 380 }} aria-describedby={undefined}>
                    <Dialog.Title style={styles.dialogTitle}>Select Account Title</Dialog.Title>
                    <input
                      style={{ ...styles.input, marginBottom: 10 }}
                      placeholder="Search accounts…"
                      value={billAcctQuery}
                      onChange={(e) => setBillAcctQuery(e.target.value)}
                      autoFocus
                    />
                    <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 12 }}>
                      {journalKnownAccounts.filter((a) => !billAcctQuery || a.toLowerCase().includes(billAcctQuery.toLowerCase())).map((a) => (
                        <div
                          key={a}
                          onClick={() => {
                            if (billAcctPickerIdx !== null) {
                              setBillLines((p) => p.map((l, i) => i === billAcctPickerIdx ? { ...l, account_title: a } : l));
                              setBillAcctPickerIdx(null);
                              setBillAcctQuery('');
                            }
                          }}
                          style={{ padding: '7px 12px', cursor: 'pointer', borderRadius: 4, color: '#ccc', background: '#2a2a2a', marginBottom: 3, fontSize: 13 }}
                        >{a}</div>
                      ))}
                    </div>
                    <div style={styles.dialogFooter}>
                      <Dialog.Close asChild><button style={styles.cancelBtn}>Close</button></Dialog.Close>
                    </div>
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>

              {/* Bill Pay Dialog */}
              <Dialog.Root open={billPayDialogOpen} onOpenChange={(open) => { if (!open) { setBillPayDialogOpen(false); setBillPayItem(null); } }}>
                <Dialog.Portal>
                  <Dialog.Overlay style={styles.dialogOverlay} />
                  <Dialog.Content style={{ ...styles.dialogContent, maxWidth: 420 }} aria-describedby={undefined}>
                    <Dialog.Title style={styles.dialogTitle}>Pay Bill — {billPayItem?.bill_number}</Dialog.Title>
                    {billPayError && <p style={{ color: '#f44336', fontSize: 13, marginBottom: 10 }}>{billPayError}</p>}
                    {billPayItem && (
                      <div>
                        <p style={{ color: '#aaa', fontSize: 13, marginBottom: 16 }}>
                          Total Amount: <strong style={{ color: '#4caf50' }}>{fmt(billPayItem.total_debit || 0)}</strong>
                        </p>
                        <div style={styles.formGrid}>
                          <label style={styles.label}>Payment Method</label>
                          <select
                            style={{ ...styles.input }}
                            value={billPayMethod}
                            onChange={(e) => setBillPayMethod(e.target.value)}
                          >
                            <option value="cash_on_hand">Cash on Hand</option>
                            <option value="cash_in_bank">Cash in Bank</option>
                            <option value="credit_card">Credit Card</option>
                            <option value="spaylater">SPayLater</option>
                          </select>
                        </div>
                        <div style={{ background: '#1e1e1e', border: '1px solid #333', borderRadius: 6, padding: '10px 14px', marginTop: 16, fontSize: 12, color: '#aaa' }}>
                          <p style={{ margin: '0 0 6px' }}><strong style={{ color: '#ffc107' }}>Journal Entry:</strong></p>
                          <p style={{ margin: '2px 0' }}>Dr Accounts Payable: {fmt(billPayItem.total_debit || 0)}</p>
                          <p style={{ margin: '2px 0' }}>Cr {billPayMethod === 'cash_on_hand' ? 'Cash on Hand' : billPayMethod === 'cash_in_bank' ? 'Cash in Bank' : billPayMethod === 'spaylater' ? 'Spaylater Payable' : 'Credit Card Payable'}: {fmt(billPayItem.total_debit || 0)}</p>
                        </div>
                      </div>
                    )}
                    <div style={styles.dialogFooter}>
                      <Dialog.Close asChild><button style={styles.cancelBtn}>Cancel</button></Dialog.Close>
                      <button style={{ ...styles.primaryBtn, background: '#1a3a1a', color: '#4caf50', border: '1px solid #4caf50' }} onClick={payBill} disabled={billPaying}>
                        {billPaying ? 'Processing…' : '✓ Confirm Payment'}
                      </button>
                    </div>
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  root: {
    display: 'flex',
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
    fontFamily: 'Poppins, sans-serif',
    color: '#fff',
  },
  sidebar: {
    position: 'fixed',
    left: 0,
    top: 0,
    width: 220,
    height: '100vh',
    background: '#111',
    borderRight: '1px solid #333',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 100,
  },
  sidebarBrand: {
    padding: '24px 20px 16px',
    borderBottom: '1px solid #333',
  },
  brandName: {
    display: 'block',
    fontFamily: 'Playfair Display, serif',
    color: '#ffc107',
    fontWeight: 700,
    fontSize: 17,
  },
  brandSub: {
    display: 'block',
    color: '#888',
    fontSize: 11,
    marginTop: 2,
  },
  nav: {
    flex: 1,
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    overflowY: 'auto',
  },
  navBtn: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    fontSize: 13,
    fontFamily: 'Poppins, sans-serif',
  },
  navBtnActive: {
    background: '#ffc107',
    color: '#000',
    fontWeight: 600,
  },
  navBtnInactive: {
    background: 'transparent',
    color: '#ccc',
  },
  sidebarFooter: {
    padding: '16px',
    borderTop: '1px solid #333',
  },
  userEmail: {
    display: 'block',
    color: '#888',
    fontSize: 11,
    marginBottom: 8,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  logoutBtn: {
    width: '100%',
    padding: '8px 14px',
    borderRadius: 6,
    border: '1px solid #555',
    background: 'transparent',
    color: '#ccc',
    cursor: 'pointer',
    fontSize: 13,
    fontFamily: 'Poppins, sans-serif',
  },
  main: {
    marginLeft: 220,
    padding: '32px',
    flex: 1,
    minHeight: '100vh',
  },
  pageTitle: {
    fontFamily: 'Playfair Display, serif',
    color: '#ffc107',
    fontSize: 26,
    marginBottom: 24,
    marginTop: 0,
  },
  tabHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  card: {
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: 12,
    padding: 20,
  },
  cardTitle: {
    color: '#ffc107',
    fontSize: 15,
    fontWeight: 600,
    marginTop: 0,
    marginBottom: 16,
    fontFamily: 'Playfair Display, serif',
  },
  dashGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 24,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },
  th: {
    padding: '10px 12px',
    textAlign: 'left',
    color: '#ffc107',
    borderBottom: '1px solid #333',
    fontWeight: 600,
    background: '#111',
    fontSize: 12,
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '9px 12px',
    color: '#ccc',
    borderBottom: '1px solid #222',
    fontSize: 13,
  },
  trEven: { background: '#1a1a1a' },
  trOdd: { background: '#161616' },
  tableWrap: {
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: 10,
    overflowX: 'auto',
  },
  payrollControlGrid: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  payrollCheckBtn: {
    width: 24,
    height: 24,
    borderRadius: 4,
    border: '1px solid #555',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 700,
    fontFamily: 'Poppins, sans-serif',
  },
  payrollTableWrap: {
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: 6,
    overflowX: 'auto',
  },
  payrollTh: {
    padding: '8px 10px',
    textAlign: 'left',
    color: '#ffc107',
    borderBottom: '1px solid #333',
    borderRight: '1px solid #2f2f2f',
    fontWeight: 600,
    background: '#111',
    fontSize: 12,
    whiteSpace: 'nowrap',
  },
  payrollTd: {
    padding: '7px 10px',
    color: '#e0e0e0',
    borderBottom: '1px solid #2b2b2b',
    borderRight: '1px solid #2f2f2f',
    fontSize: 13,
    background: '#1a1a1a',
  },
  payrollTrEven: { background: '#1a1a1a' },
  payrollTrOdd: { background: '#161616' },
  badge: {
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
  },
  primaryBtn: {
    padding: '9px 20px',
    borderRadius: 8,
    border: 'none',
    background: '#ffc107',
    color: '#000',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 13,
    fontFamily: 'Poppins, sans-serif',
  },
  actionBtn: {
    padding: '5px 12px',
    borderRadius: 6,
    border: '1px solid #555',
    background: 'transparent',
    color: '#ccc',
    cursor: 'pointer',
    fontSize: 12,
    marginRight: 6,
    fontFamily: 'Poppins, sans-serif',
  },
  cancelBtn: {
    padding: '9px 20px',
    borderRadius: 8,
    border: '1px solid #555',
    background: 'transparent',
    color: '#ccc',
    cursor: 'pointer',
    fontSize: 13,
    fontFamily: 'Poppins, sans-serif',
  },
  errorBanner: {
    background: '#3a1a1a',
    border: '1px solid #f44336',
    color: '#f44336',
    borderRadius: 8,
    padding: '12px 16px',
    marginBottom: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: 13,
  },
  errorClose: {
    background: 'none',
    border: 'none',
    color: '#f44336',
    cursor: 'pointer',
    fontSize: 16,
  },
  loadingText: {
    color: '#888',
    fontSize: 14,
    marginBottom: 16,
  },
  dialogOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.75)',
    zIndex: 200,
  },
  dialogContent: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: 12,
    padding: '28px 32px',
    zIndex: 201,
    maxWidth: 500,
    width: '90vw',
    maxHeight: '90vh',
    overflowY: 'auto',
    color: '#fff',
    fontFamily: 'Poppins, sans-serif',
  },
  dialogTitle: {
    fontFamily: 'Playfair Display, serif',
    color: '#ffc107',
    fontSize: 20,
    marginTop: 0,
    marginBottom: 20,
  },
  dialogFooter: {
    display: 'flex',
    gap: 12,
    justifyContent: 'flex-end',
    marginTop: 24,
    paddingTop: 16,
    borderTop: '1px solid #333',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '140px 1fr',
    gap: 12,
    alignItems: 'start',
  },
  label: {
    color: '#888',
    fontSize: 13,
    paddingTop: 8,
    fontFamily: 'Poppins, sans-serif',
  },
  input: {
    background: '#2a2a2a',
    border: '1px solid #444',
    borderRadius: 6,
    padding: '8px 12px',
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Poppins, sans-serif',
    width: '100%',
    boxSizing: 'border-box',
  },
  helperText: {
    display: 'block',
    color: '#666',
    fontSize: 11,
    marginTop: 4,
  },
};
