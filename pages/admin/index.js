// ─── Admin: Comprehensive Admin Interface ──────────────────────────────────
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import * as Dialog from '@radix-ui/react-dialog';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import { supabase } from '../../utils/supabaseClient';
import { useRoleGuard } from '../../utils/useRoleGuard';

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
  const [salesTrend, setSalesTrend] = useState([]);
  const [cashFlowData, setCashFlowData] = useState([]);
  const [cashFlowSummary, setCashFlowSummary] = useState({ inflow: 0, outflow: 0 });
  const [saleableItems, setSaleableItems] = useState([]);
  const [saleableItemsThisMonth, setSaleableItemsThisMonth] = useState([]);
  const [saleableItemsLastMonth, setSaleableItemsLastMonth] = useState([]);
  const [expensesBreakdown, setExpensesBreakdown] = useState([]);

  // ── Inventory state ───────────────────────────────────────────────────────
  const [inventoryItems, setInventoryItems] = useState([]);
  const [invDialogOpen, setInvDialogOpen] = useState(false);
  const [invEditItem, setInvEditItem] = useState(null);
  const [invForm, setInvForm] = useState({
    name: '', department: 'DKS', code: '', uom: 'pcs', cost_per_unit: '0', current_stock: '0', min_stock: '0',
  });
  const [invDeleteConfirm, setInvDeleteConfirm] = useState(null);
  const [invStatusFilter, setInvStatusFilter] = useState('');

  // ── Price Costing state ───────────────────────────────────────────────────
  const [costingHeaders, setCostingHeaders] = useState([]);
  const [costingSearch, setCostingSearch] = useState('');
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
    const defaults = ['Cash on Hand', 'Cash in Bank', 'Accounts Payable', 'Accounts Payable - Rewards', 'Revenue', 'Inventory', "Owner's Draw", 'Rewards', 'Cost of Goods Sold'];
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
  const [manualSpecialNote, setManualSpecialNote] = useState('');
  // Contact picker for manual entry
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const [contactPickerQuery, setContactPickerQuery] = useState('');
  const [contactList, setContactList] = useState([]);

  // ── Financial Reports state ───────────────────────────────────────────────
  const [finSubTab, setFinSubTab] = useState('cashflow');
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const thirtyAgoStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  }, []);
  const [finDateFrom, setFinDateFrom] = useState(thirtyAgoStr);
  const [finDateTo, setFinDateTo] = useState(todayStr);
  const [finData, setFinData] = useState(null);

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
      const since = new Date();
      since.setDate(since.getDate() - 28);
      const sinceMs = since.getTime();

      const { data: orders } = await supabase
        .from('orders')
        .select('total, created_at')
        .gte('created_at', since.toISOString());

      if (orders) {
        const weeks = [0, 0, 0, 0];
        orders.forEach((o) => {
          const diffDays = Math.floor((new Date(o.created_at).getTime() - sinceMs) / 86400000);
          const weekIdx = Math.min(Math.floor(diffDays / 7), 3);
          weeks[weekIdx] += Number(o.total) || 0;
        });
        const fmtRange = (idx) => {
          const start = new Date(sinceMs + idx * 7 * 86400000);
          const end = new Date(sinceMs + (idx + 1) * 7 * 86400000 - 86400000);
          const fmt = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
          return `${fmt(start)}–${fmt(end)}`;
        };
        setSalesTrend([
          { week: fmtRange(0), sales: weeks[0] },
          { week: fmtRange(1), sales: weeks[1] },
          { week: fmtRange(2), sales: weeks[2] },
          { week: fmtRange(3), sales: weeks[3] },
        ]);
      }

      const { data: cashTx } = await supabase
        .from('cash_drawer_transactions')
        .select('amount, transaction_type, created_at')
        .gte('created_at', since.toISOString());

      if (cashTx) {
        const weeks = [
          { week: 'Week 1', inflow: 0, outflow: 0 },
          { week: 'Week 2', inflow: 0, outflow: 0 },
          { week: 'Week 3', inflow: 0, outflow: 0 },
          { week: 'Week 4', inflow: 0, outflow: 0 },
        ];
        let totalIn = 0;
        let totalOut = 0;
        cashTx.forEach((tx) => {
          const diffDays = Math.floor((new Date(tx.created_at).getTime() - sinceMs) / 86400000);
          const weekIdx = Math.min(Math.floor(diffDays / 7), 3);
          const amt = Number(tx.amount) || 0;
          if (tx.transaction_type === 'cash-in') {
            weeks[weekIdx].inflow += amt;
            totalIn += amt;
          } else if (['cash-out', 'pay-bill', 'pay-expense'].includes(tx.transaction_type)) {
            weeks[weekIdx].outflow += amt;
            totalOut += amt;
          }
        });
        setCashFlowData(weeks);
        setCashFlowSummary({ inflow: totalIn, outflow: totalOut });
      }

      // Saleable items: ranked by quantity sold this month vs last month
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

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

      const since30 = new Date();
      since30.setDate(since30.getDate() - 30);
      const { data: expenses } = await supabase
        .from('cash_drawer_transactions')
        .select('amount, transaction_type, bill_type, category, description')
        .in('transaction_type', ['pay-expense', 'pay-bill'])
        .gte('created_at', since30.toISOString());

      if (expenses) {
        const cats = { Payroll: 0, Utilities: 0, Rent: 0, Cost: 0, Others: 0 };
        expenses.forEach((e) => {
          const amt = Number(e.amount) || 0;
          if (e.bill_type === 'payroll' || e.category === '5100') cats.Payroll += amt;
          else if (e.bill_type === 'utilities' || e.category === '5200') cats.Utilities += amt;
          else if (e.category === 'rent' || (e.description || '').toLowerCase().includes('rent')) cats.Rent += amt;
          else if (e.category === '5900') cats.Cost += amt;
          else cats.Others += amt;
        });
        const total = Object.values(cats).reduce((s, v) => s + v, 0);
        setExpensesBreakdown(
          Object.entries(cats)
            .filter(([, v]) => v > 0)
            .map(([name, value]) => ({
              name,
              value,
              pct: total > 0 ? ((value / total) * 100).toFixed(1) : '0',
            })),
        );
      }
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

      // 2 + 3. Line items for the selected date range — single join query (avoids large .in() URL)
      // Use !receiving_report_id hint to disambiguate when multiple FK relationships exist
      // 1.2: Purchases = "paid" status only
      const { data: rrItemsRaw, error: riErr } = await supabase
        .from('receiving_report_items')
        .select('inventory_item_id, inventory_name, qty, cost, total_landed_cost, receiving_reports!receiving_report_id(status, date)')
        .eq('receiving_reports.status', 'paid')
        .gte('receiving_reports.date', invDateFrom)
        .lte('receiving_reports.date', invDateTo);
      if (riErr) throw new Error('Failed to fetch receiving report items: ' + riErr.message);
      const rrItems = rrItemsRaw || [];

      // 1.3: In Transit = ALL "draft" status receiving reports (no date filter)
      const { data: inTransitRaw } = await supabase
        .from('receiving_report_items')
        .select('inventory_item_id, inventory_name, qty, receiving_reports!receiving_report_id(status)')
        .eq('receiving_reports.status', 'draft');
      const inTransitItems = inTransitRaw || [];

      // 2b + 3b. Line items from Jan 1, 2026 → invDateTo — single join query for Average Cost
      // 1.4: Beginning Balance = "paid" status only (Jan 1, 2026 → start date − 1 day)
      const AVG_COST_START = '2026-01-01';
      const { data: allPeriodItemsRaw, error: ri2Err } = await supabase
        .from('receiving_report_items')
        .select('inventory_item_id, inventory_name, qty, cost, total_landed_cost, receiving_reports!receiving_report_id(status, date)')
        .eq('receiving_reports.status', 'paid')
        .gte('receiving_reports.date', AVG_COST_START)
        .lte('receiving_reports.date', invDateTo);
      if (ri2Err) throw new Error('Failed to fetch all-period receiving report items: ' + ri2Err.message);
      const allPeriodItems = allPeriodItemsRaw || [];

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
        nameToIdMap[inv.name?.toLowerCase().trim()] = inv.id;
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

  // ── Fetch: Financial Reports ──────────────────────────────────────────────
  const fetchFinancial = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const fromISO = new Date(finDateFrom).toISOString();
      const toDate = new Date(finDateTo);
      toDate.setHours(23, 59, 59, 999);
      const toISO = toDate.toISOString();

      if (finSubTab === 'cashflow') {
        const { data, error: err } = await supabase
          .from('cash_drawer_transactions')
          .select('*')
          .gte('created_at', fromISO)
          .lte('created_at', toISO)
          .order('created_at');
        if (err) throw err;
        let running = 0;
        const rows = (data || []).map((tx) => {
          const amt = Number(tx.amount) || 0;
          const isIn = tx.transaction_type === 'cash-in';
          running += isIn ? amt : -amt;
          return { ...tx, inflow: isIn ? amt : 0, outflow: isIn ? 0 : amt, running };
        });
        setFinData({ type: 'cashflow', rows });
      } else if (finSubTab === 'pl') {
        const dateFrom = fromISO.split('T')[0];
        const dateTo = toISO.split('T')[0];
        const [{ data: revenueData }, { data: cogsData }, { data: expData }] = await Promise.all([
          supabase.from('journal_entries').select('amount').in('credit_account', ['Revenue', 'Sales Revenue']).gte('date', dateFrom).lte('date', dateTo),
          supabase.from('journal_entries').select('amount').eq('debit_account', 'Cost of Goods Sold').gte('date', dateFrom).lte('date', dateTo),
          supabase.from('cash_drawer_transactions').select('amount').in('transaction_type', ['pay-expense', 'pay-bill']).gte('created_at', fromISO).lte('created_at', toISO),
        ]);
        const revenue = (revenueData || []).reduce((s, o) => s + (Number(o.amount) || 0), 0);
        const cogs = (cogsData || []).reduce((s, c) => s + (Number(c.amount) || 0), 0);
        const opExp = (expData || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
        setFinData({ type: 'pl', revenue, cogs, opExp, grossProfit: revenue - cogs, netProfit: revenue - cogs - opExp });
      } else if (finSubTab === 'balance') {
        const [{ data: allCash }, { data: invList }, { data: rrApproved }] = await Promise.all([
          supabase.from('cash_drawer_transactions').select('amount, transaction_type'),
          supabase.from('admin_inventory_items').select('current_stock, cost_per_unit'),
          supabase.from('receiving_reports').select('total_landed_cost').eq('status', 'approved'),
        ]);
        let cashOnHand = 0;
        (allCash || []).forEach((tx) => {
          const amt = Number(tx.amount) || 0;
          if (tx.transaction_type === 'cash-in') cashOnHand += amt;
          else cashOnHand -= amt;
        });
        const invValue = (invList || []).reduce((s, i) => s + (Number(i.current_stock) || 0) * (Number(i.cost_per_unit) || 0), 0);
        const ap = (rrApproved || []).reduce((s, r) => s + (Number(r.total_landed_cost) || 0), 0);
        setFinData({
          type: 'balance',
          cashOnHand,
          invValue,
          totalAssets: cashOnHand + invValue,
          ap,
          totalLiabilities: ap,
          equity: cashOnHand + invValue - ap,
        });
      } else if (finSubTab === 'budget') {
        const { data: expData } = await supabase
          .from('cash_drawer_transactions')
          .select('amount, bill_type, category, description')
          .in('transaction_type', ['pay-expense', 'pay-bill'])
          .gte('created_at', fromISO)
          .lte('created_at', toISO);
        const cats = { Payroll: 0, Utilities: 0, Rent: 0, Cost: 0, Others: 0 };
        (expData || []).forEach((e) => {
          const amt = Number(e.amount) || 0;
          if (e.bill_type === 'payroll' || e.category === '5100') cats.Payroll += amt;
          else if (e.bill_type === 'utilities' || e.category === '5200') cats.Utilities += amt;
          else if (e.category === 'rent' || (e.description || '').toLowerCase().includes('rent')) cats.Rent += amt;
          else if (e.category === '5900') cats.Cost += amt;
          else cats.Others += amt;
        });
        setFinData({ type: 'budget', cats });
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
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [finSubTab, finDateFrom, finDateTo]);

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
        q = q.in('reference_type', ['receiving_report', 'rr_payment']);
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
        else if (journalSubFilter === 'rr_credit_card') q = q.eq('reference_type', 'rr_payment').eq('credit_account', "Owner's Draw");
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
      setManualSpecialNote('');
      await generateManualEntryNumber();
    } catch (err) {
      setManualError(err.message);
    } finally {
      setManualSaving(false);
    }
  }, [supabase, manualEntryForm, manualEntryLines, manualEntryNumber, manualSpecialNote, generateManualEntryNumber]);

  // ── Trigger fetches on tab change ─────────────────────────────────────────
  useEffect(() => {
    if (activeTab === 'dashboard') fetchDashboard();
    else if (activeTab === 'inventory') fetchInventory();
    else if (activeTab === 'costing') fetchCosting();
    else if (activeTab === 'rr') fetchRR();
    else if (activeTab === 'financial') fetchFinancial();
    else if (activeTab === 'profile') fetchProfile();
    else if (activeTab === 'journal') fetchJournal();
    else if (activeTab === 'manual') { setManualSpecialNote(''); generateManualEntryNumber(); }
  }, [activeTab, fetchDashboard, fetchInventory, fetchCosting, fetchRR, fetchFinancial, fetchProfile, fetchJournal, generateManualEntryNumber]);

  useEffect(() => {
    if (activeTab === 'financial') fetchFinancial();
  }, [activeTab, finSubTab, finDateFrom, finDateTo, fetchFinancial]);

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

  // ── Nav items (memoised) — must be declared before any early return ──────
  const navItems = useMemo(
    () => [
      { key: 'dashboard', label: '📊 Dashboard' },
      { key: 'inventory', label: '📦 Inventory' },
      { key: 'costing', label: '💰 Price Costing' },
      { key: 'rr', label: '📋 Receiving Report' },
      { key: 'financial', label: '📈 Financial Reports' },
      { key: 'journal', label: '📒 Journal Entries' },
      { key: 'manual', label: '✏️ Manual Entry' },
      { key: 'profile', label: '👤 My Profile' },
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

  const PIE_COLORS = { Cost: '#ffc107', Payroll: '#4caf50', Utilities: '#2196f3', Rent: '#9c27b0', Others: '#ff5722' };

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
    'Snacks & Bites': 0.50,
    'Noodles': 0.60,
    'Rice & More': 0.50,
    'Milktea Series': 0.60,
    'Hot/Iced Drinks': 0.60,
    'Frappe Series': 0.60,
    'Fruit Soda & Lemonade': 0.60,
  };

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
      // Credit Card:  Debit Accounts Payable, Credit Owner's Draw
      const creditAccount =
        rrPayForm.payment_mode === 'cash_in_bank' ? 'Cash in Bank' :
        rrPayForm.payment_mode === 'credit_card'  ? "Owner's Draw" :
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
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key)}
                style={{
                  ...styles.navBtn,
                  ...(activeTab === item.key ? styles.navBtnActive : styles.navBtnInactive),
                }}
              >
                {item.label}
              </button>
            ))}
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
              <h1 style={styles.pageTitle}>Dashboard</h1>
              {loading && <p style={styles.loadingText}>Loading…</p>}
              <div style={styles.dashGrid}>
                {/* Widget 1.1 – Sales Trend */}
                <div style={styles.card}>
                  <h3 style={styles.cardTitle}>Monthly Sales Trend (4 Weeks)</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={salesTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="week" stroke="#ccc" tick={{ fill: '#ccc', fontSize: 12 }} />
                      <YAxis stroke="#ccc" tick={{ fill: '#ccc', fontSize: 12 }} />
                      <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #333', color: '#fff' }} />
                      <Bar dataKey="sales" fill="#ffc107" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Widget 1.2 – Cash Flow */}
                <div style={styles.card}>
                  <h3 style={styles.cardTitle}>Cash Flow Report (Weekly)</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={cashFlowData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="week" stroke="#ccc" tick={{ fill: '#ccc', fontSize: 12 }} />
                      <YAxis stroke="#ccc" tick={{ fill: '#ccc', fontSize: 12 }} />
                      <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #333', color: '#fff' }} />
                      <Legend wrapperStyle={{ color: '#ccc' }} />
                      <Bar dataKey="inflow" fill="#4caf50" name="Inflow" />
                      <Bar dataKey="outflow" fill="#f44336" name="Outflow" />
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

                {/* Widget 1.4 – Expenses Breakdown */}
                <div style={styles.card}>
                  <h3 style={styles.cardTitle}>Monthly Expenses Breakdown</h3>
                  {expensesBreakdown.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={expensesBreakdown}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({ name, pct }) => `${name} ${pct}%`}
                          labelLine={{ stroke: '#555' }}
                        >
                          {expensesBreakdown.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[entry.name] || '#999'} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: '#1a1a1a', border: '1px solid #333', color: '#fff' }}
                          formatter={(val) => fmt(val)}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p style={{ color: '#666', textAlign: 'center', marginTop: 40 }}>No expense data</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ──────────────── INVENTORY ──────────────── */}
          {activeTab === 'inventory' && (
            <div>
              <div style={styles.tabHeader}>
                <h1 style={styles.pageTitle}>Inventory</h1>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
                <label style={{ color: '#ccc', fontSize: 13 }}>From:</label>
                <input type="date" style={{ ...styles.input, width: 160 }} value={invDateFrom} onChange={(e) => setInvDateFrom(e.target.value)} />
                <label style={{ color: '#ccc', fontSize: 13 }}>To:</label>
                <input type="date" style={{ ...styles.input, width: 160 }} value={invDateTo} onChange={(e) => setInvDateTo(e.target.value)} />
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
                        <td style={{ ...styles.td, color: '#ccc' }}>{Number(item.beginning).toFixed(3)}</td>
                        <td style={{ ...styles.td, color: '#4caf50' }}>{Number(item.purchases).toFixed(3)}</td>
                        <td style={{ ...styles.td, color: '#f44336' }}>{Number(item.sold).toFixed(3)}</td>
                        <td style={{ ...styles.td, color: '#ffc107', fontWeight: 600 }}>{Number(item.ending).toFixed(3)}</td>
                        <td style={styles.td}>{fmt(item.avg_cost ?? item.cost_per_unit)}</td>
                        <td style={{ ...styles.td, color: '#ffc107', fontWeight: 600 }}>{fmt((Number(item.ending) || 0) * (Number(item.avg_cost ?? item.cost_per_unit) || 0))}</td>
                        <td style={{ ...styles.td, color: '#2196f3' }}>{Number(item.inTransit || 0).toFixed(3)}</td>
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

              {/* Inventory Dialog */}
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

          {/* ──────────────── PRICE COSTING ──────────────── */}
          {activeTab === 'costing' && (
            <div>
              <div style={styles.tabHeader}>
                <h1 style={styles.pageTitle}>Price Costing</h1>
                <button onClick={() => openCostingDialog()} style={styles.primaryBtn}>+ New Item</button>
              </div>
              {loading && <p style={styles.loadingText}>Loading…</p>}
              <div style={{ marginBottom: 12 }}>
                <input
                  style={{ ...styles.input, width: 280 }}
                  placeholder="Search menu items…"
                  value={costingSearch}
                  onChange={(e) => setCostingSearch(e.target.value)}
                />
              </div>
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      {['Menu Item', 'Menu Category', 'Total Est. COGS (₱)', 'Selling Price (₱)', 'CM Ratio', 'Actions'].map((h) => (
                        <th key={h} style={styles.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {costingHeaders.filter((item) => !costingSearch || (item.menu_item_name || '').toLowerCase().includes(costingSearch.toLowerCase())).map((item, idx) => {
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
                    {costingHeaders.length === 0 && !loading && (
                      <tr><td colSpan={6} style={{ ...styles.td, textAlign: 'center', color: '#666', padding: 32 }}>No costing items yet.</td></tr>
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
                                        displayName: `${m.name} - ${opt.option_name}${isAddOn ? ' (Add On)' : ''}`,
                                        category: m.category || '',
                                        price: variantPrice,
                                      });
                                    }
                                  }
                                }
                              }
                              const q = menuSearchQuery.toLowerCase();
                              const filtered = expanded.filter((e) => e.displayName.toLowerCase().includes(q));
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
                                  {entry.displayName} <span style={{ color: '#888', fontSize: 11 }}>({entry.category}) — {fmt(entry.price)}</span>
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
                                  <td style={{ ...styles.td, color: '#ccc' }}>{Number(li.qty).toFixed(3)}</td>
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
                             rrPayForm.payment_mode === 'credit_card'  ? "Owner's Draw" :
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
                          openInvDialog(null);
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

              {/* Sub-tab pills */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                {[
                  { key: 'cashflow', label: 'Cash Flow' },
                  { key: 'pl', label: 'P&L' },
                  { key: 'balance', label: 'Balance Sheet' },
                  { key: 'budget', label: 'Budget Variance' },
                  { key: 'tax', label: 'Tax Report' },
                ].map((st) => (
                  <button
                    key={st.key}
                    onClick={() => setFinSubTab(st.key)}
                    style={{
                      padding: '8px 18px',
                      borderRadius: 20,
                      border: `1px solid ${finSubTab === st.key ? '#ffc107' : '#333'}`,
                      background: finSubTab === st.key ? '#ffc107' : 'transparent',
                      color: finSubTab === st.key ? '#000' : '#ccc',
                      cursor: 'pointer',
                      fontFamily: 'Poppins, sans-serif',
                      fontWeight: finSubTab === st.key ? 700 : 400,
                      fontSize: 13,
                    }}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {/* Date range */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
                <label style={{ color: '#ccc', fontSize: 13 }}>From:</label>
                <input type="date" style={{ ...styles.input, width: 160 }} value={finDateFrom} onChange={(e) => setFinDateFrom(e.target.value)} />
                <label style={{ color: '#ccc', fontSize: 13 }}>To:</label>
                <input type="date" style={{ ...styles.input, width: 160 }} value={finDateTo} onChange={(e) => setFinDateTo(e.target.value)} />
                <button onClick={fetchFinancial} style={styles.primaryBtn}>Refresh</button>
              </div>

              {loading && <p style={styles.loadingText}>Loading…</p>}

              {/* Cash Flow */}
              {finSubTab === 'cashflow' && finData?.type === 'cashflow' && (
                <div style={styles.card}>
                  <h3 style={styles.cardTitle}>Cash Flow Statement</h3>
                  <div style={styles.tableWrap}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          {['Date', 'Description', 'Type', 'Inflow (₱)', 'Outflow (₱)', 'Running Balance'].map((h) => (
                            <th key={h} style={styles.th}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {finData.rows.map((row, idx) => (
                          <tr key={row.id || idx} style={idx % 2 === 0 ? styles.trEven : styles.trOdd}>
                            <td style={styles.td}>{new Date(row.created_at).toLocaleDateString('en-PH')}</td>
                            <td style={styles.td}>{row.description || row.transaction_type}</td>
                            <td style={styles.td}>{row.transaction_type}</td>
                            <td style={{ ...styles.td, color: '#4caf50' }}>{row.inflow > 0 ? fmt(row.inflow) : '—'}</td>
                            <td style={{ ...styles.td, color: '#f44336' }}>{row.outflow > 0 ? fmt(row.outflow) : '—'}</td>
                            <td style={{ ...styles.td, color: row.running >= 0 ? '#4caf50' : '#f44336' }}>{fmt(row.running)}</td>
                          </tr>
                        ))}
                        {finData.rows.length > 0 && (() => {
                          const totalIn = finData.rows.reduce((s, r) => s + r.inflow, 0);
                          const totalOut = finData.rows.reduce((s, r) => s + r.outflow, 0);
                          return (
                            <tr style={{ background: '#2a2a1a', fontWeight: 700 }}>
                              <td colSpan={3} style={{ ...styles.td, color: '#ffc107' }}>TOTAL</td>
                              <td style={{ ...styles.td, color: '#4caf50' }}>{fmt(totalIn)}</td>
                              <td style={{ ...styles.td, color: '#f44336' }}>{fmt(totalOut)}</td>
                              <td style={{ ...styles.td, color: '#ffc107' }}>{fmt(totalIn - totalOut)}</td>
                            </tr>
                          );
                        })()}
                        {finData.rows.length === 0 && (
                          <tr><td colSpan={6} style={{ ...styles.td, textAlign: 'center', color: '#666' }}>No transactions in range</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* P&L */}
              {finSubTab === 'pl' && finData?.type === 'pl' && (
                <div style={{ ...styles.card, maxWidth: 560 }}>
                  <h3 style={styles.cardTitle}>Profit &amp; Loss Statement</h3>
                  <table style={styles.table}>
                    <tbody>
                      <tr style={styles.trEven}>
                        <td style={styles.td}>Revenue</td>
                        <td style={{ ...styles.td, textAlign: 'right', color: '#4caf50' }}>{fmt(finData.revenue)}</td>
                      </tr>
                      <tr style={styles.trOdd}>
                        <td style={styles.td}>Cost of Goods Sold (COGS)</td>
                        <td style={{ ...styles.td, textAlign: 'right', color: '#f44336' }}>({fmt(finData.cogs)})</td>
                      </tr>
                      <tr style={{ background: '#2a2a1a' }}>
                        <td style={{ ...styles.td, fontWeight: 700, color: '#ffc107' }}>Gross Profit</td>
                        <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700, color: finData.grossProfit >= 0 ? '#4caf50' : '#f44336' }}>{fmt(finData.grossProfit)}</td>
                      </tr>
                      <tr style={styles.trOdd}>
                        <td style={styles.td}>Operating Expenses</td>
                        <td style={{ ...styles.td, textAlign: 'right', color: '#f44336' }}>({fmt(finData.opExp)})</td>
                      </tr>
                      <tr style={{ background: '#3a2a0a' }}>
                        <td style={{ ...styles.td, fontWeight: 700, color: '#ffc107' }}>Net Profit</td>
                        <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700, color: finData.netProfit >= 0 ? '#4caf50' : '#f44336' }}>{fmt(finData.netProfit)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* Balance Sheet */}
              {finSubTab === 'balance' && finData?.type === 'balance' && (
                <div style={{ ...styles.card, maxWidth: 560 }}>
                  <h3 style={styles.cardTitle}>Balance Sheet</h3>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Item</th>
                        <th style={{ ...styles.th, textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={styles.trEven}>
                        <td style={{ ...styles.td, paddingLeft: 24 }}>Cash on Hand</td>
                        <td style={{ ...styles.td, textAlign: 'right' }}>{fmt(finData.cashOnHand)}</td>
                      </tr>
                      <tr style={styles.trOdd}>
                        <td style={{ ...styles.td, paddingLeft: 24 }}>Inventory Value</td>
                        <td style={{ ...styles.td, textAlign: 'right' }}>{fmt(finData.invValue)}</td>
                      </tr>
                      <tr style={{ background: '#2a2a1a' }}>
                        <td style={{ ...styles.td, fontWeight: 700, color: '#ffc107' }}>Total Assets</td>
                        <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700, color: '#ffc107' }}>{fmt(finData.totalAssets)}</td>
                      </tr>
                      <tr style={styles.trEven}>
                        <td style={{ ...styles.td, paddingLeft: 24 }}>Accounts Payable</td>
                        <td style={{ ...styles.td, textAlign: 'right' }}>{fmt(finData.ap)}</td>
                      </tr>
                      <tr style={{ background: '#2a1a1a' }}>
                        <td style={{ ...styles.td, fontWeight: 700, color: '#f44336' }}>Total Liabilities</td>
                        <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700, color: '#f44336' }}>{fmt(finData.totalLiabilities)}</td>
                      </tr>
                      <tr style={{ background: '#1a2a1a' }}>
                        <td style={{ ...styles.td, fontWeight: 700, color: '#4caf50' }}>Equity</td>
                        <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700, color: '#4caf50' }}>{fmt(finData.equity)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* Budget Variance */}
              {finSubTab === 'budget' && finData?.type === 'budget' && (
                <div style={styles.card}>
                  <h3 style={styles.cardTitle}>Budget Variance</h3>
                  <p style={{ color: '#888', fontSize: 12, marginBottom: 12 }}>
                    Note: Budget values are not yet configurable. Set budgets in a future update.
                  </p>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        {['Category', 'Budget (₱)', 'Actual (₱)', 'Variance (₱)', 'Variance %'].map((h) => (
                          <th key={h} style={styles.th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(finData.cats).map(([cat, actual], idx) => {
                        const budget = 0;
                        const variance = actual - budget;
                        const variancePct = budget > 0 ? ((variance / budget) * 100).toFixed(1) : '—';
                        return (
                          <tr key={cat} style={idx % 2 === 0 ? styles.trEven : styles.trOdd}>
                            <td style={styles.td}>{cat}</td>
                            <td style={styles.td}>{fmt(budget)}</td>
                            <td style={styles.td}>{fmt(actual)}</td>
                            <td style={{ ...styles.td, color: variance > 0 ? '#f44336' : '#4caf50' }}>{fmt(variance)}</td>
                            <td style={{ ...styles.td, color: variance > 0 ? '#f44336' : '#4caf50' }}>
                              {variancePct}{variancePct !== '—' ? '%' : ''}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
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
                          {['Date', 'Reference No.', 'Name', 'Particular', 'Account Title', 'Debit (₱)', 'Credit (₱)'].map((h) => (
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
                <div style={styles.formGrid}>
                  <label style={styles.label}>Date</label>
                  <input
                    type="date"
                    style={styles.input}
                    value={manualEntryForm.date}
                    onChange={(e) => setManualEntryForm((p) => ({ ...p, date: e.target.value }))}
                  />

                  <label style={styles.label}>Description / Memo</label>
                  <textarea
                    style={{ ...styles.input, minHeight: 72, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
                    placeholder="Brief description of this entry…"
                    value={manualEntryForm.description}
                    onChange={(e) => setManualEntryForm((p) => ({ ...p, description: e.target.value }))}
                  />

                  <label style={styles.label}>Contact (Vendor / Customer)</label>
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
                      onClick={() => { setContactPickerOpen(true); setContactPickerQuery(''); fetchContacts(''); }}
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

                  <label style={styles.label}>Reference Number</label>
                  <input
                    style={styles.input}
                    placeholder="Optional reference…"
                    value={manualEntryForm.reference_number}
                    onChange={(e) => setManualEntryForm((p) => ({ ...p, reference_number: e.target.value }))}
                  />

                  <label style={styles.label}>Special Note</label>
                  <textarea
                    style={{ ...styles.input, minHeight: 64, resize: 'vertical' }}
                    placeholder="Optional note or explanation…"
                    value={manualSpecialNote}
                    onChange={(e) => setManualSpecialNote(e.target.value)}
                  />
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
              <Dialog.Root open={contactPickerOpen} onOpenChange={(open) => { if (!open) setContactPickerOpen(false); }}>
                <Dialog.Portal>
                  <Dialog.Overlay style={styles.dialogOverlay} />
                  <Dialog.Content style={{ ...styles.dialogContent, maxWidth: 480 }} aria-describedby={undefined}>
                    <Dialog.Title style={styles.dialogTitle}>Select Contact</Dialog.Title>
                    <div style={{ marginBottom: 12 }}>
                      <input
                        style={styles.input}
                        placeholder="Search vendors or customers…"
                        value={contactPickerQuery}
                        onChange={(e) => { setContactPickerQuery(e.target.value); fetchContacts(e.target.value); }}
                        autoFocus
                      />
                    </div>
                    <div style={{ maxHeight: 320, overflowY: 'auto', marginBottom: 12 }}>
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
                    <div style={styles.dialogFooter}>
                      <Dialog.Close asChild><button style={styles.cancelBtn}>Close</button></Dialog.Close>
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
