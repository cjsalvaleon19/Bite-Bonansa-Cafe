import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../../utils/supabaseClient';
import { useRoleGuard } from '../../utils/useRoleGuard';
import { calculateSalesBreakdown, UNACCEPTED_ORDER_STATUSES } from '../../utils/salesCalculations';
import {
  addSalaryDeductionToPayroll,
  getOutstandingPayrollSubmissions,
  markPayrollSubmissionPaid,
  getPayrollEmployees,
  PAYROLL_STORAGE_KEY,
  toDateOnly,
} from '../../utils/payrollStorage';

const getCurrentDateOnly = () => new Date().toISOString().split('T')[0];

export default function CashDrawer() {
  const router = useRouter();
  const { loading: authLoading } = useRoleGuard('cashier');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [activeModal, setActiveModal] = useState(null); // 'cash-in', 'cash-out', 'adjustment', null
  const [cashOutType, setCashOutType] = useState(null); // 'general', 'pay-bill', 'pay-expense', null
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    payeeName: '',
    purpose: '',
    category: '',
    referenceNumber: '',
    reason: '',
    adminPassword: '',
    billType: '',
    billNumber: '',
    billReportId: '',
    payrollSubmissionId: '',
    attendanceEmployeeId: '',
    receivingReportId: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [cashOnHand, setCashOnHand] = useState(0);
  const [cashInTotal, setCashInTotal] = useState(0);
  const [cashOutTotal, setCashOutTotal] = useState(0);
  const [adjustmentTotal, setAdjustmentTotal] = useState(0);
  const [cashSalesTotal, setCashSalesTotal] = useState(0);
  const [chartOfAccounts, setChartOfAccounts] = useState([]);
  const [riders, setRiders] = useState([]);
  const [deliveryReports, setDeliveryReports] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);
  const [payrollReports, setPayrollReports] = useState([]);
  const [filteredPayrollReports, setFilteredPayrollReports] = useState([]);
  const [payrollPeriodSearch, setPayrollPeriodSearch] = useState('');
  const [attendanceEmployees, setAttendanceEmployees] = useState([]);
  const [unpaidReceivingReports, setUnpaidReceivingReports] = useState([]);
  const [filteredReceivingReports, setFilteredReceivingReports] = useState([]);
  const [rrSearchQuery, setRrSearchQuery] = useState('');
  const [unpaidBills, setUnpaidBills] = useState([]);
  const [filteredBills, setFilteredBills] = useState([]);
  const [billsSearchQuery, setBillsSearchQuery] = useState('');
  const [transactionsDateFrom, setTransactionsDateFrom] = useState(getCurrentDateOnly());
  const [transactionsDateTo, setTransactionsDateTo] = useState(getCurrentDateOnly());

  // Cash Audit tab state
  const [activeTab, setActiveTab] = useState('transactions');
  const [auditDate, setAuditDate] = useState(getCurrentDateOnly());
  const [denominations, setDenominations] = useState({
    d1000: '', d500: '', d200: '', d100: '', d50: '', d20: '',
    d10: '', d5: '', d1: '', d050: '', d025: '',
  });
  const [cashAudit, setCashAudit] = useState(null);
  const [auditCashIn, setAuditCashIn] = useState(0);
  const [auditCashSales, setAuditCashSales] = useState(0);
  const [auditCashOut, setAuditCashOut] = useState(0);
  const [auditAdjustment, setAuditAdjustment] = useState(0);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditSubmitting, setAuditSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      initializePage();
    }
  }, [authLoading]);

  useEffect(() => {
    const refreshPayrollReports = () => {
      const reports = getOutstandingPayrollSubmissions();
      setPayrollReports(reports);
      setFilteredPayrollReports(reports);
      setAttendanceEmployees(getPayrollEmployees());
    };
    refreshPayrollReports();
    if (typeof window === 'undefined') return undefined;
    const onStorage = (event) => {
      if (event.key === PAYROLL_STORAGE_KEY) refreshPayrollReports();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const initializePage = async () => {
    if (!supabase) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }

      setUser(session.user);
      await fetchTransactions();
      await fetchChartOfAccounts();
      await fetchRiders();
      await fetchDeliveryReports();
      await fetchUnpaidReceivingReports();
      await fetchUnpaidBills();
    } catch (err) {
      console.error('[CashDrawer] Failed to initialize:', err?.message ?? err);
    } finally {
      setLoading(false);
    }
  };

  const fetchChartOfAccounts = async () => {
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('*')
        .eq('is_active', true)
        .eq('account_type', 'expense')
        .order('account_code');

      if (error) throw error;

      setChartOfAccounts(data || []);
    } catch (err) {
      console.error('[CashDrawer] Failed to fetch chart of accounts:', err?.message ?? err);
    }
  };

  const fetchRiders = async () => {
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email')
        .eq('role', 'rider')
        .order('full_name');

      if (error) throw error;

      setRiders(data || []);
    } catch (err) {
      console.error('[CashDrawer] Failed to fetch riders:', err?.message ?? err);
    }
  };

  const fetchDeliveryReports = async () => {
    if (!supabase) return;

    try {
      // Fetch only submitted (unpaid) delivery reports
      const { data, error } = await supabase
        .from('delivery_reports')
        .select('id, rider_id, bill_number, report_date, rider_earnings, total_deliveries, status, submitted_at, users!delivery_reports_rider_id_fkey(full_name)')
        .in('status', ['submitted', 'pending'])
        .order('submitted_at', { ascending: false });

      if (error) throw error;

      setDeliveryReports(data || []);
      setFilteredReports(data || []);
    } catch (err) {
      console.error('[CashDrawer] Failed to fetch delivery reports:', err?.message ?? err);
    }
  };

  const fetchUnpaidReceivingReports = async () => {
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from('receiving_reports')
        .select('id, rr_number, total_landed_cost, vendor:vendors(name)')
        .eq('status', 'approved')
        .order('date', { ascending: false });

      if (error) throw error;

      setUnpaidReceivingReports(data || []);
      setFilteredReceivingReports(data || []);
    } catch (err) {
      console.error('[CashDrawer] Failed to fetch unpaid receiving reports:', err?.message ?? err);
    }
  };

  const fetchUnpaidBills = async () => {
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from('bills')
        .select('id, bill_number, contact, date, total_debit')
        .eq('status', 'approved')
        .order('date', { ascending: false });

      if (error) throw error;

      setUnpaidBills(data || []);
      setFilteredBills(data || []);
    } catch (err) {
      console.error('[CashDrawer] Failed to fetch unpaid bills:', err?.message ?? err);
    }
  };

  const fetchTransactions = async (dateFrom = transactionsDateFrom, dateTo = transactionsDateTo) => {
    if (!supabase) return;

    try {
      const fallbackDate = getCurrentDateOnly();
      const startDateValue = dateFrom || fallbackDate;
      const endDateValue = dateTo || startDateValue;
      const startDate = new Date(`${startDateValue}T00:00:00`);
      const endDate = new Date(`${endDateValue}T00:00:00`);
      endDate.setDate(endDate.getDate() + 1);

      const { data, error } = await supabase
        .from('cash_drawer_transactions')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lt('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      setTransactions(data || []);

      // Calculate cash on hand components from drawer transactions
      const cashIn = (data || [])
        .filter(t => t.transaction_type === 'cash-in')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      const cashOut = (data || [])
        .filter(t => ['cash-out', 'pay-bill', 'pay-expense'].includes(t.transaction_type))
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      const adjustments = (data || [])
        .filter(t => t.transaction_type === 'adjustment')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

      // Also include cash sales from orders (same as Audit tab formula)
      const { data: ordersData } = await supabase
        .from('orders')
        .select('subtotal, total_amount, payment_method, points_used')
        .gte('created_at', startDate.toISOString())
        .lt('created_at', endDate.toISOString())
        .not('status', 'in', `(${UNACCEPTED_ORDER_STATUSES.join(',')})`);

      const { cashSales } = calculateSalesBreakdown(ordersData || []);

      setCashInTotal(cashIn);
      setCashOutTotal(cashOut);
      setAdjustmentTotal(adjustments);
      setCashSalesTotal(cashSales);
      setCashOnHand(cashIn + cashSales - cashOut + adjustments);
    } catch (err) {
      console.error('[CashDrawer] Failed to fetch transactions:', err?.message ?? err);
    }
  };

  const hasIncompleteTransactionDateRange = !transactionsDateFrom || !transactionsDateTo;
  const hasInvalidTransactionDateRange = transactionsDateFrom && transactionsDateTo && transactionsDateFrom > transactionsDateTo;
  const canApplyTransactionCoverage = !hasIncompleteTransactionDateRange && !hasInvalidTransactionDateRange;
  const formatCoverageDate = (dateValue) => {
    if (!dateValue) return '';
    return new Date(`${dateValue}T00:00:00`).toLocaleDateString();
  };
  const transactionCoverageLabel = () => {
    if (hasIncompleteTransactionDateRange) return 'No date coverage selected';
    const fromLabel = formatCoverageDate(transactionsDateFrom);
    const toLabel = formatCoverageDate(transactionsDateTo);
    return transactionsDateFrom === transactionsDateTo
      ? fromLabel
      : `${fromLabel} to ${toLabel}`;
  };

  // ── Cash Audit helpers ──────────────────────────────────────────────────────

  const computeDenominationTotal = () => {
    return (
      (parseInt(denominations.d1000) || 0) * 1000 +
      (parseInt(denominations.d500)  || 0) * 500  +
      (parseInt(denominations.d200)  || 0) * 200  +
      (parseInt(denominations.d100)  || 0) * 100  +
      (parseInt(denominations.d50)   || 0) * 50   +
      (parseInt(denominations.d20)   || 0) * 20   +
      (parseInt(denominations.d10)   || 0) * 10   +
      (parseInt(denominations.d5)    || 0) * 5    +
      (parseInt(denominations.d1)    || 0) * 1    +
      (parseInt(denominations.d050)  || 0) * 0.50 +
      (parseInt(denominations.d025)  || 0) * 0.25
    );
  };

  const fetchAuditData = async (date) => {
    if (!supabase || !user) return;
    setAuditLoading(true);
    try {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);

      // Fetch existing audit record for this cashier+date
      const { data: existingAudit, error: auditError } = await supabase
        .from('cash_audits')
        .select('*')
        .eq('audit_date', date)
        .eq('cashier_id', user.id)
        .maybeSingle();

      if (auditError) console.error('[CashDrawer] Audit fetch error:', auditError.message);

      setCashAudit(existingAudit || null);

      if (existingAudit) {
        setDenominations({
          d1000: existingAudit.denom_1000 > 0 ? existingAudit.denom_1000.toString() : '',
          d500:  existingAudit.denom_500  > 0 ? existingAudit.denom_500.toString()  : '',
          d200:  existingAudit.denom_200  > 0 ? existingAudit.denom_200.toString()  : '',
          d100:  existingAudit.denom_100  > 0 ? existingAudit.denom_100.toString()  : '',
          d50:   existingAudit.denom_50   > 0 ? existingAudit.denom_50.toString()   : '',
          d20:   existingAudit.denom_20   > 0 ? existingAudit.denom_20.toString()   : '',
          d10:   existingAudit.denom_10   > 0 ? existingAudit.denom_10.toString()   : '',
          d5:    existingAudit.denom_5    > 0 ? existingAudit.denom_5.toString()    : '',
          d1:    existingAudit.denom_1    > 0 ? existingAudit.denom_1.toString()    : '',
          d050:  existingAudit.denom_050  > 0 ? existingAudit.denom_050.toString()  : '',
          d025:  existingAudit.denom_025  > 0 ? existingAudit.denom_025.toString()  : '',
        });
      } else {
        setDenominations({ d1000: '', d500: '', d200: '', d100: '', d50: '', d20: '', d10: '', d5: '', d1: '', d050: '', d025: '' });
      }

      // Fetch drawer transactions breakdown for the date
      const { data: txData, error: txError } = await supabase
        .from('cash_drawer_transactions')
        .select('transaction_type, amount')
        .eq('cashier_id', user.id)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (txError) console.error('[CashDrawer] Tx fetch error:', txError.message);

      const cashIn = (txData || [])
        .filter(t => t.transaction_type === 'cash-in')
        .reduce((s, t) => s + parseFloat(t.amount), 0);
      const cashOut = (txData || [])
        .filter(t => ['cash-out', 'pay-bill', 'pay-expense'].includes(t.transaction_type))
        .reduce((s, t) => s + parseFloat(t.amount), 0);
      const adjustment = (txData || [])
        .filter(t => t.transaction_type === 'adjustment')
        .reduce((s, t) => s + parseFloat(t.amount), 0);

      setAuditCashIn(cashIn);
      setAuditCashOut(cashOut);
      setAuditAdjustment(adjustment);

      // Fetch cash sales from orders for the date
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('subtotal, total_amount, payment_method, points_used')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .not('status', 'in', `(${UNACCEPTED_ORDER_STATUSES.join(',')})`);

      if (ordersError) console.error('[CashDrawer] Orders fetch error:', ordersError.message);

      const { cashSales } = calculateSalesBreakdown(ordersData || []);
      setAuditCashSales(cashSales);
    } catch (err) {
      console.error('[CashDrawer] Failed to fetch audit data:', err?.message ?? err);
    } finally {
      setAuditLoading(false);
    }
  };

  const handleAuditTabClick = () => {
    setActiveTab('audit');
    fetchAuditData(auditDate);
  };

  const handleAuditDateChange = (newDate) => {
    setAuditDate(newDate);
    fetchAuditData(newDate);
  };

  const handleSubmitAudit = async () => {
    if (!supabase || !user) return;

    const denomTotal = computeDenominationTotal();
    const expectedCOH = auditCashIn + auditCashSales - auditCashOut + auditAdjustment;
    const overageShortage = denomTotal - expectedCOH;

    if (!window.confirm('Are you sure you want to submit this audit? It cannot be edited after submission.')) return;

    setAuditSubmitting(true);
    try {
      const auditData = {
        audit_date: auditDate,
        cashier_id: user.id,
        denom_1000: parseInt(denominations.d1000) || 0,
        denom_500:  parseInt(denominations.d500)  || 0,
        denom_200:  parseInt(denominations.d200)  || 0,
        denom_100:  parseInt(denominations.d100)  || 0,
        denom_50:   parseInt(denominations.d50)   || 0,
        denom_20:   parseInt(denominations.d20)   || 0,
        denom_10:   parseInt(denominations.d10)   || 0,
        denom_5:    parseInt(denominations.d5)    || 0,
        denom_1:    parseInt(denominations.d1)    || 0,
        denom_050:  parseInt(denominations.d050)  || 0,
        denom_025:  parseInt(denominations.d025)  || 0,
        denomination_total: denomTotal,
        cash_in_total:    auditCashIn,
        cash_sales_total: auditCashSales,
        cash_out_total:   auditCashOut,
        adjustment_total: auditAdjustment,
        cash_on_hand:     expectedCOH,
        overage_shortage: overageShortage,
        is_submitted: true,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      let error;
      if (cashAudit) {
        ({ error } = await supabase
          .from('cash_audits')
          .update(auditData)
          .eq('id', cashAudit.id)
          .eq('cashier_id', user.id)
          .eq('is_submitted', false));
      } else {
        ({ error } = await supabase
          .from('cash_audits')
          .insert(auditData));
      }

      if (error) throw error;

      alert('Cash audit submitted successfully!');
      await fetchAuditData(auditDate);
    } catch (err) {
      console.error('[CashDrawer] Failed to submit audit:', err?.message ?? err);
      alert('Failed to submit audit. Please try again.');
    } finally {
      setAuditSubmitting(false);
    }
  };

  const handlePayeeChange = (riderId) => {
    setFormData({ ...formData, payeeName: riderId });
    
    // Filter reports by selected rider
    if (riderId) {
      const filtered = deliveryReports.filter(report => report.rider_id === riderId);
      setFilteredReports(filtered);
    } else {
      setFilteredReports(deliveryReports);
    }
  };

  const handleBillNumberChange = (reportId) => {
    const selectedReport = deliveryReports.find(r => r.id === reportId);
    
    if (selectedReport) {
      setFormData({
        ...formData,
        billNumber: reportId,
        billReportId: reportId,
        amount: selectedReport.rider_earnings?.toString() || '',
        purpose: `Payment for ${selectedReport.total_deliveries} deliveries on ${new Date(selectedReport.report_date).toLocaleDateString()}. Bill: ${selectedReport.bill_number}`,
      });
    } else {
      setFormData({
        ...formData,
        billNumber: '',
        billReportId: '',
        amount: '',
        purpose: '',
      });
    }
  };

  const handlePayrollPeriodSearch = (query) => {
    setPayrollPeriodSearch(query);
    const normalized = String(query || '').trim().toLowerCase();
    if (!normalized) {
      setFilteredPayrollReports(payrollReports);
      return;
    }
    setFilteredPayrollReports(
      payrollReports.filter((report) => (
        String(report.periodLabel || '').toLowerCase().includes(normalized)
        || String(report.cycleStart || '').toLowerCase().includes(normalized)
        || String(report.cycleEnd || '').toLowerCase().includes(normalized)
      )),
    );
  };

  const handlePayrollPeriodChange = (reportId) => {
    const selected = payrollReports.find((report) => report.id === reportId);
    if (!selected) {
      setFormData({
        ...formData,
        payrollSubmissionId: '',
        billNumber: '',
        amount: '',
        purpose: '',
      });
      return;
    }
    setFormData({
      ...formData,
      payrollSubmissionId: selected.id,
      billNumber: selected.id,
      amount: selected.netPay?.toString() || '',
      payeeName: 'Payroll',
      purpose: `Payroll period ${selected.periodLabel} (${selected.cycleStart} to ${selected.cycleEnd})`,
    });
  };

  const handleRrSearch = (query) => {
    setRrSearchQuery(query);
    const normalized = String(query || '').trim().toLowerCase();
    if (!normalized) {
      setFilteredReceivingReports(unpaidReceivingReports);
      return;
    }
    setFilteredReceivingReports(
      unpaidReceivingReports.filter((rr) => (
        String(rr.vendor?.name || '').toLowerCase().includes(normalized)
        || String(rr.rr_number || '').toLowerCase().includes(normalized)
      )),
    );
  };

  const handleRrChange = (rrId) => {
    const selected = unpaidReceivingReports.find((rr) => rr.id === rrId);
    if (!selected) {
      setFormData({
        ...formData,
        receivingReportId: '',
        billReportId: '',
        payeeName: '',
        amount: '',
        purpose: '',
      });
      return;
    }
    setFormData({
      ...formData,
      receivingReportId: selected.id,
      billReportId: selected.id,
      payeeName: selected.vendor?.name || '',
      amount: selected.total_landed_cost?.toString() || '',
      purpose: `Payment for Receiving Report ${selected.rr_number}${selected.vendor?.name ? ` — ${selected.vendor.name}` : ''}`,
    });
  };

  const handleBillsSearch = (query) => {
    setBillsSearchQuery(query);
    const normalized = String(query || '').trim().toLowerCase();
    if (!normalized) {
      setFilteredBills(unpaidBills);
      return;
    }
    setFilteredBills(
      unpaidBills.filter((bill) => (
        String(bill.contact || '').toLowerCase().includes(normalized)
        || String(bill.bill_number || '').toLowerCase().includes(normalized)
      )),
    );
  };

  const handleBillChange = (billId) => {
    const selected = unpaidBills.find((bill) => bill.id === billId);
    if (!selected) {
      setFormData({
        ...formData,
        payeeName: '',
        billNumber: '',
        billReportId: '',
        referenceNumber: '',
        amount: '',
        purpose: '',
      });
      return;
    }
    setFormData({
      ...formData,
      payeeName: selected.contact || '',
      billNumber: selected.bill_number || '',
      billReportId: selected.id,
      referenceNumber: selected.bill_number || '',
      amount: selected.total_debit?.toString() || '',
      purpose: `Payment for Bill ${selected.bill_number}${selected.contact ? ` — ${selected.contact}` : ''}`,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!supabase || !user) return;

    // Validate form
    if (!formData.amount || parseFloat(formData.amount) === 0 || isNaN(parseFloat(formData.amount))) {
      alert('Please enter a valid amount');
      return;
    }
    if (activeModal === 'cash-out' && cashOutType === 'pay-bill' && formData.billType === 'payroll' && !formData.payrollSubmissionId) {
      alert('Please select a payroll period');
      return;
    }
    if (activeModal === 'cash-out' && cashOutType === 'pay-bill' && formData.billType === 'cash_advance' && !formData.attendanceEmployeeId) {
      alert('Please select an employee from Attendance Sheet');
      return;
    }
    if (activeModal === 'cash-out' && cashOutType === 'pay-bill' && formData.billType === 'receiving_report' && !formData.receivingReportId) {
      alert('Please select a receiving report');
      return;
    }
    if (activeModal === 'cash-out' && cashOutType === 'pay-bill' && formData.billType === 'bills' && !formData.billReportId) {
      alert('Please select a bill');
      return;
    }

    // For adjustments, validate admin password
    if (activeModal === 'adjustment') {
      if (!formData.adminPassword) {
        alert('Admin password is required for adjustments');
        return;
      }
      if (formData.adminPassword !== '911992') {
        alert('Invalid admin password');
        return;
      }
    }

    setSubmitting(true);

    try {
      // Determine the actual transaction type to save
      let transactionType = activeModal;
      if (activeModal === 'cash-out' && cashOutType) {
        transactionType = cashOutType; // 'general', 'pay-bill', or 'pay-expense'
        // Map 'general' to 'cash-out' for database
        if (transactionType === 'general') {
          transactionType = 'cash-out';
        }
      }

      // Determine payment adjustment type
      let paymentAdjustmentType = null;
      if (activeModal === 'adjustment' && formData.reason === 'payment_correction') {
        paymentAdjustmentType = 'cash-to-gcash';
      }

      // Adjustments are always deductions (negative amounts reduce Cash on Hand)
      const rawAmount = parseFloat(formData.amount);
      const savedAmount = activeModal === 'adjustment' ? -Math.abs(rawAmount) : rawAmount;

      const transactionData = {
        cashier_id: user.id,
        transaction_type: transactionType,
        amount: savedAmount,
        description: formData.description || null,
        payee_name: formData.payeeName || null,
        purpose: formData.purpose || null,
        category: formData.category || null,
        reference_number: (
          formData.billType === 'payroll' && formData.payrollSubmissionId
            ? formData.payrollSubmissionId
            : (formData.billType === 'cash_advance' && formData.attendanceEmployeeId
              ? formData.attendanceEmployeeId
              : (formData.referenceNumber || null))
        ),
        adjustment_reason: formData.reason || null,
        bill_type: formData.billType || null,
        payment_adjustment_type: paymentAdjustmentType,
        admin_verified: activeModal === 'adjustment' ? true : null,
        bill_report_id: formData.billReportId || null,
        created_at: new Date().toISOString(),
      };

      const { data: insertedTransaction, error } = await supabase
        .from('cash_drawer_transactions')
        .insert(transactionData)
        .select('id')
        .single();

      if (error) throw error;

      if (formData.billType === 'cash_advance' && formData.attendanceEmployeeId) {
        if (!insertedTransaction?.id) {
          console.error('[CashDrawer] Cash advance transaction ID missing; skipping local deduction sync.');
        } else {
          const deductionResult = addSalaryDeductionToPayroll({
            employeeId: formData.attendanceEmployeeId,
            amount: Math.abs(rawAmount),
            date: toDateOnly(transactionData.created_at),
            orderId: `cash_advance:${insertedTransaction.id}`,
            notes: formData.purpose || 'Cash advance from Cash Drawer / Pay Bills',
          });
          if (!deductionResult.ok) {
            console.error('[CashDrawer] Failed to store cash advance deduction in attendance sheet local data.');
          }
        }
      }

      // If this is a Driver's Fee payment, mark the delivery report as paid
      if (formData.billType === 'drivers_fee' && formData.billReportId) {
        const { error: updateError } = await supabase
          .from('delivery_reports')
          .update({
            status: 'paid',
            paid_at: new Date().toISOString(),
            paid_by: user.id,
          })
          .eq('id', formData.billReportId);

        if (updateError) {
          console.error('[CashDrawer] Failed to update delivery report:', updateError.message);
          alert('Payment recorded but failed to update report status. Please contact admin.');
        }

        // Refresh delivery reports list to remove the paid one
        await fetchDeliveryReports();
      }

      if (formData.billType === 'payroll' && formData.payrollSubmissionId) {
        markPayrollSubmissionPaid({
          reportId: formData.payrollSubmissionId,
          paymentReference: formData.payrollSubmissionId,
          paidAt: new Date().toISOString(),
        });
        const refreshedReports = getOutstandingPayrollSubmissions();
        setPayrollReports(refreshedReports);
        setFilteredPayrollReports(refreshedReports);
      }

      if (formData.billType === 'bills' && formData.billReportId) {
        const { error: updateBillError } = await supabase
          .from('bills')
          .update({
            status: 'paid',
            updated_at: new Date().toISOString(),
          })
          .eq('id', formData.billReportId);

        if (updateBillError) {
          console.error('[CashDrawer] Failed to update bill status:', updateBillError.message);
          alert('Payment recorded but failed to update bill status. Please contact admin.');
        }
      }

      // Reset form and close modal
      setFormData({
        amount: '',
        description: '',
        payeeName: '',
        purpose: '',
        category: '',
        referenceNumber: '',
        reason: '',
        adminPassword: '',
        billType: '',
        billNumber: '',
        billReportId: '',
        payrollSubmissionId: '',
        attendanceEmployeeId: '',
        receivingReportId: '',
      });
      setActiveModal(null);
      setCashOutType(null);
      setFilteredReports(deliveryReports);
      setPayrollPeriodSearch('');
      setRrSearchQuery('');
      setBillsSearchQuery('');

      // Refresh transactions
      await fetchTransactions();
      await fetchUnpaidReceivingReports();
      await fetchUnpaidBills();

      alert('Transaction recorded successfully!');
    } catch (err) {
      console.error('[CashDrawer] Failed to submit transaction:', err?.message ?? err);
      alert('Failed to record transaction. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div style={styles.center}>
        <p style={{ color: '#ffc107', fontFamily: "'Poppins', sans-serif" }}>
          ⏳ Loading…
        </p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Cash Drawer - Bite Bonansa Cafe</title>
        <meta name="description" content="Cash drawer management" />
      </Head>
      <div style={styles.page}>
        <header style={styles.header}>
          <h1 style={styles.logo}>☕ Bite Bonansa Cafe</h1>
          <nav style={styles.nav}>
            <Link href="/cashier/dashboard" style={styles.navLink}>Dashboard</Link>
            <Link href="/cashier/pos" style={styles.navLink}>POS</Link>
            <Link href="/cashier/orders-queue" style={styles.navLink}>Order Queue</Link>
            <Link href="/cashier/eod-report" style={styles.navLink}>EOD Report</Link>
            <Link href="/cashier/settings" style={styles.navLink}>Settings</Link>
            <Link href="/cashier/profile" style={styles.navLink}>Profile</Link>
          </nav>
          <button style={styles.logoutBtn} onClick={async () => {
            if (supabase) await supabase.auth.signOut();
            router.replace('/login');
          }}>
            Logout
          </button>
        </header>

        <main style={styles.main}>
          <h2 style={styles.title}>💸 Cash Drawer Management</h2>

          {/* Tab Navigation */}
          <div style={styles.tabContainer}>
            <button
              style={activeTab === 'transactions' ? styles.tabActive : styles.tab}
              onClick={() => setActiveTab('transactions')}
            >
              💵 Cash Transactions
            </button>
            <button
              style={activeTab === 'audit' ? styles.tabActive : styles.tab}
              onClick={handleAuditTabClick}
            >
              📋 Cash Audit
            </button>
          </div>

          {/* ── Transactions Tab ── */}
          {activeTab === 'transactions' && (
            <>
          {/* Cash on Hand Breakdown */}
          <div style={styles.cashOnHandCard}>
            <div style={{ ...styles.cashLabel, fontSize: '20px', color: '#ffc107', marginBottom: '20px', fontWeight: '700' }}>
              📊 Cash on Hand Breakdown
            </div>
            <div style={styles.auditBreakdownRow}>
              <span>Cash In</span>
              <span style={{ color: '#4caf50' }}>+ ₱{cashInTotal.toFixed(2)}</span>
            </div>
            <div style={styles.auditBreakdownRow}>
              <span>Cash Sales</span>
              <span style={{ color: '#4caf50' }}>+ ₱{cashSalesTotal.toFixed(2)}</span>
            </div>
            <div style={styles.auditBreakdownRow}>
              <span>Cash Out</span>
              <span style={{ color: '#f44336' }}>− ₱{cashOutTotal.toFixed(2)}</span>
            </div>
            <div style={styles.auditBreakdownRow}>
              <span>Adjustment</span>
              <span style={{ color: adjustmentTotal >= 0 ? '#4caf50' : '#f44336' }}>
                {adjustmentTotal >= 0 ? '+' : '−'} ₱{Math.abs(adjustmentTotal).toFixed(2)}
              </span>
            </div>
            <div style={styles.auditBreakdownDivider} />
            <div style={{ ...styles.auditBreakdownRow, fontWeight: '700', fontSize: '18px' }}>
              <span>= Cash on Hand</span>
              <span style={styles.cashValue}>₱{cashOnHand.toFixed(2)}</span>
            </div>
          </div>

          <div style={styles.coverageControls}>
            <div style={{ ...styles.formGroup, flex: 1, marginBottom: 0 }}>
              <label style={styles.label}>Date From</label>
              <input
                style={styles.input}
                type="date"
                value={transactionsDateFrom}
                onChange={(e) => setTransactionsDateFrom(e.target.value)}
              />
            </div>
            <div style={{ ...styles.formGroup, flex: 1, marginBottom: 0 }}>
              <label style={styles.label}>Date To</label>
              <input
                style={styles.input}
                type="date"
                value={transactionsDateTo}
                onChange={(e) => setTransactionsDateTo(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                type="button"
                style={styles.primaryBtn}
                onClick={() => fetchTransactions(transactionsDateFrom, transactionsDateTo)}
                disabled={!canApplyTransactionCoverage}
              >
                Apply Coverage
              </button>
            </div>
          </div>
          {hasIncompleteTransactionDateRange && (
            <p style={{ margin: '8px 0 0', fontSize: 12, color: '#f44336' }}>
              Both Date From and Date To are required.
            </p>
          )}
          {hasInvalidTransactionDateRange && (
            <p style={{ margin: '8px 0 0', fontSize: 12, color: '#f44336' }}>
              Date coverage is invalid. "Date From" must be on or before "Date To".
            </p>
          )}

          {/* Action Buttons */}
          <div style={styles.actionsGrid}>
            <button
              style={styles.actionBtn}
              onClick={() => setActiveModal('cash-in')}
            >
              <div style={styles.actionIcon}>💰</div>
              <div style={styles.actionTitle}>Cash In</div>
              <div style={styles.actionDesc}>Add cash to drawer</div>
            </button>

            <button
              style={styles.actionBtn}
              onClick={() => {
                setActiveModal('cash-out');
                setCashOutType(null); // Will show submenu
              }}
            >
              <div style={styles.actionIcon}>💵</div>
              <div style={styles.actionTitle}>Cash Out</div>
              <div style={styles.actionDesc}>Remove cash / Pay bills / Pay expenses</div>
            </button>

            <button
              style={styles.actionBtn}
              onClick={() => setActiveModal('adjustment')}
            >
              <div style={styles.actionIcon}>⚖️</div>
              <div style={styles.actionTitle}>Adjustment</div>
              <div style={styles.actionDesc}>Correct entries (requires admin)</div>
            </button>
          </div>

          {/* Transactions List */}
          <div style={styles.transactionsSection}>
            <h3 style={styles.sectionTitle}>Cash Transactions ({transactionCoverageLabel()})</h3>
            {transactions.length === 0 ? (
              <p style={styles.emptyText}>No transactions found for selected date coverage</p>
            ) : (
              <div style={styles.transactionsList}>
                {transactions.map((transaction) => (
                  <div key={transaction.id} style={styles.transactionCard}>
                    <div style={styles.transactionHeader}>
                      <div style={styles.transactionType}>
                        {transaction.transaction_type === 'cash-in' && '💰 Cash In'}
                        {transaction.transaction_type === 'cash-out' && '💵 Cash Out'}
                        {transaction.transaction_type === 'pay-bill' && '🧾 Pay Bill'}
                        {transaction.transaction_type === 'pay-expense' && '💳 Pay Expense'}
                        {transaction.transaction_type === 'adjustment' && '⚖️ Adjustment'}
                      </div>
                      <div style={styles.transactionAmount(transaction.transaction_type, transaction.amount)}>
                        {['cash-out', 'pay-bill', 'pay-expense'].includes(transaction.transaction_type)
                          ? `-₱${parseFloat(transaction.amount).toFixed(2)}`
                          : transaction.transaction_type === 'adjustment'
                            ? `${parseFloat(transaction.amount) >= 0 ? '+' : '−'}₱${Math.abs(parseFloat(transaction.amount)).toFixed(2)}`
                            : `+₱${parseFloat(transaction.amount).toFixed(2)}`
                        }
                      </div>
                    </div>
                    <div style={styles.transactionDetails}>
                      <div style={styles.transactionTime}>
                        {new Date(transaction.created_at).toLocaleTimeString()}
                      </div>
                      {transaction.description && (
                        <div style={styles.transactionDesc}>{transaction.description}</div>
                      )}
                      {transaction.payee_name && (
                        <div style={styles.transactionDesc}>Payee: {transaction.payee_name}</div>
                      )}
                      {transaction.purpose && (
                        <div style={styles.transactionDesc}>Purpose: {transaction.purpose}</div>
                      )}
                      {transaction.adjustment_reason && (
                        <div style={styles.transactionDesc}>Reason: {transaction.adjustment_reason}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Modal for Cash In/Out/Adjustment */}
          {activeModal && (
            <div style={styles.modal} onClick={() => { setActiveModal(null); setCashOutType(null); }}>
              <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                {/* Cash Out Submenu */}
                {activeModal === 'cash-out' && !cashOutType && (
                  <>
                    <h3 style={styles.modalTitle}>💵 Cash Out Options</h3>
                    <p style={styles.modalSubtext}>Select the type of cash out transaction:</p>
                    <div style={styles.submenuGrid}>
                      <button
                        type="button"
                        style={styles.submenuBtn}
                        onClick={() => setCashOutType('general')}
                      >
                        <div style={styles.actionIcon}>💵</div>
                        <div>General Cash Out</div>
                        <div style={styles.submenuDesc}>Remove cash from drawer</div>
                      </button>
                      <button
                        type="button"
                        style={styles.submenuBtn}
                        onClick={() => setCashOutType('pay-bill')}
                      >
                        <div style={styles.actionIcon}>🧾</div>
                        <div>Pay Bills</div>
                        <div style={styles.submenuDesc}>Pay outstanding bills</div>
                      </button>
                      <button
                        type="button"
                        style={styles.submenuBtn}
                        onClick={() => setCashOutType('pay-expense')}
                      >
                        <div style={styles.actionIcon}>💳</div>
                        <div>Pay Expenses</div>
                        <div style={styles.submenuDesc}>Record ad-hoc expenses</div>
                      </button>
                    </div>
                    <button
                      type="button"
                      style={styles.modalCancelBtn}
                      onClick={() => { setActiveModal(null); setCashOutType(null); }}
                    >
                      Cancel
                    </button>
                  </>
                )}

                {/* Main Transaction Forms */}
                {(activeModal !== 'cash-out' || cashOutType) && (
                  <>
                    <h3 style={styles.modalTitle}>
                      {activeModal === 'cash-in' && '💰 Cash In'}
                      {activeModal === 'cash-out' && cashOutType === 'general' && '💵 Cash Out'}
                      {activeModal === 'cash-out' && cashOutType === 'pay-bill' && '🧾 Pay Bills'}
                      {activeModal === 'cash-out' && cashOutType === 'pay-expense' && '💳 Pay Expenses'}
                      {activeModal === 'adjustment' && '⚖️ Adjustment'}
                    </h3>

                <form onSubmit={handleSubmit}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Amount *</label>
                    <input
                      style={styles.input}
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      readOnly={
                        (formData.billType === 'drivers_fee' && formData.billNumber)
                        || (formData.billType === 'payroll' && formData.payrollSubmissionId)
                        || (formData.billType === 'bills' && formData.billReportId)
                        || (formData.billType === 'receiving_report' && formData.receivingReportId)
                      }
                      required
                    />
                  </div>

                  {activeModal === 'cash-in' && (
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Description</label>
                      <input
                        style={styles.input}
                        type="text"
                        placeholder="Opening balance, additional funds, etc."
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      />
                    </div>
                  )}

                  {(activeModal === 'cash-out' && cashOutType === 'general') && (
                    <>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Description</label>
                        <input
                          style={styles.input}
                          type="text"
                          placeholder="Reason for removing cash"
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                      </div>
                    </>
                  )}

                  {(activeModal === 'cash-out' && cashOutType === 'pay-bill') && (
                    <>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Bill Type *</label>
                        <select
                          style={styles.input}
                          value={formData.billType}
                          onChange={(e) => {
                            const reports = getOutstandingPayrollSubmissions();
                            setPayrollReports(reports);
                            setFilteredPayrollReports(reports);
                            setPayrollPeriodSearch('');
                            setAttendanceEmployees(getPayrollEmployees());
                            setRrSearchQuery('');
                            setFilteredReceivingReports(unpaidReceivingReports);
                            setBillsSearchQuery('');
                            setFilteredBills(unpaidBills);
                            setFormData({
                              ...formData,
                              billType: e.target.value,
                              payeeName: '',
                              billNumber: '',
                              amount: '',
                              purpose: '',
                              referenceNumber: '',
                              billReportId: '',
                              payrollSubmissionId: '',
                              attendanceEmployeeId: '',
                              receivingReportId: '',
                            });
                          }}
                          required
                        >
                          <option value="">Select bill type</option>
                          <option value="drivers_fee">Driver's Fee</option>
                          <option value="payroll">Payroll</option>
                          <option value="cash_advance">Cash Advance</option>
                          <option value="utilities">Utilities</option>
                          <option value="bills">Bills</option>
                          <option value="receiving_report">Receiving Report</option>
                          <option value="other">Other</option>
                        </select>
                      </div>

                      {formData.billType === 'drivers_fee' ? (
                        <>
                          <div style={styles.formGroup}>
                            <label style={styles.label}>Rider (Payee Name) *</label>
                            <select
                              style={styles.input}
                              value={formData.payeeName}
                              onChange={(e) => handlePayeeChange(e.target.value)}
                              required
                            >
                              <option value="">Select rider</option>
                              {riders.map((rider) => (
                                <option key={rider.id} value={rider.id}>
                                  {rider.full_name || rider.email}
                                </option>
                              ))}
                            </select>
                          </div>

                          {formData.payeeName && (
                            <div style={styles.formGroup}>
                              <label style={styles.label}>Bill Number *</label>
                              <select
                                style={styles.input}
                                value={formData.billNumber}
                                onChange={(e) => handleBillNumberChange(e.target.value)}
                                required
                              >
                                <option value="">Select bill number</option>
                                {filteredReports.map((report) => (
                                  <option key={report.id} value={report.id}>
                                    {report.bill_number} - ₱{report.rider_earnings?.toFixed(2)} ({new Date(report.submitted_at).toLocaleDateString()})
                                  </option>
                                ))}
                              </select>
                              {filteredReports.length === 0 && (
                                <p style={{fontSize: '11px', color: '#ffc107', marginTop: '4px'}}>
                                  No outstanding bills for this rider
                                </p>
                              )}
                            </div>
                          )}

                          <div style={styles.formGroup}>
                            <label style={styles.label}>Purpose/Description</label>
                            <textarea
                              style={{...styles.input, minHeight: '80px', fontFamily: "'Poppins', sans-serif"}}
                              placeholder="Payment details"
                              value={formData.purpose}
                              onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                              readOnly={formData.billNumber ? true : false}
                            />
                          </div>
                        </>
                      ) : formData.billType === 'payroll' ? (
                        <>
                          <div style={styles.formGroup}>
                            <label style={styles.label}>Payroll Period Search</label>
                            <input
                              style={styles.input}
                              type="text"
                              placeholder="Search period (e.g. May 1-15)"
                              value={payrollPeriodSearch}
                              onChange={(e) => handlePayrollPeriodSearch(e.target.value)}
                            />
                          </div>

                          <div style={styles.formGroup}>
                            <label style={styles.label}>Payroll Period *</label>
                            <select
                              style={styles.input}
                              value={formData.payrollSubmissionId}
                              onChange={(e) => handlePayrollPeriodChange(e.target.value)}
                              required
                            >
                              <option value="">Select payroll period</option>
                              {filteredPayrollReports.map((report) => (
                                <option key={report.id} value={report.id}>
                                  {report.periodLabel} - ₱{Number(report.netPay || 0).toFixed(2)}
                                </option>
                              ))}
                            </select>
                            {filteredPayrollReports.length === 0 && (
                              <p style={{ fontSize: '11px', color: '#ffc107', marginTop: '4px' }}>
                                No outstanding submitted attendance sheets found
                              </p>
                            )}
                          </div>

                          <div style={styles.formGroup}>
                            <label style={styles.label}>Payee Name *</label>
                            <input
                              style={styles.input}
                              type="text"
                              value={formData.payeeName || 'Payroll'}
                              readOnly
                              required
                            />
                          </div>

                          <div style={styles.formGroup}>
                            <label style={styles.label}>Purpose/Description</label>
                            <textarea
                              style={{ ...styles.input, minHeight: '80px', fontFamily: "'Poppins', sans-serif" }}
                              placeholder="Payroll payment details"
                              value={formData.purpose}
                              onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                            />
                          </div>
                        </>
                      ) : formData.billType === 'cash_advance' ? (
                        <>
                          <div style={styles.formGroup}>
                            <label style={styles.label}>Payee Name *</label>
                            <select
                              style={styles.input}
                              value={formData.attendanceEmployeeId}
                              onChange={(e) => {
                                const selected = attendanceEmployees.find((emp) => emp.id === e.target.value);
                                setFormData({
                                  ...formData,
                                  attendanceEmployeeId: e.target.value,
                                  payeeName: selected?.name || '',
                                });
                              }}
                              required
                            >
                              <option value="">Select employee</option>
                              {attendanceEmployees.map((emp) => (
                                <option key={emp.id} value={emp.id}>
                                  {emp.name}
                                </option>
                              ))}
                            </select>
                            {attendanceEmployees.length === 0 && (
                              <p style={{ fontSize: '11px', color: '#ffc107', marginTop: '4px' }}>
                                No employees found in Attendance Sheet
                              </p>
                            )}
                          </div>

                          <div style={styles.formGroup}>
                            <label style={styles.label}>Purpose/Description</label>
                            <textarea
                              style={{ ...styles.input, minHeight: '80px', fontFamily: "'Poppins', sans-serif" }}
                              placeholder="Cash advance details"
                              value={formData.purpose}
                              onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                            />
                          </div>
                        </>
                      ) : formData.billType === 'bills' ? (
                        <>
                          <div style={styles.formGroup}>
                            <label style={styles.label}>Payee Name (Bills) *</label>
                            <input
                              style={styles.input}
                              type="text"
                              placeholder="Search by payee name or bill number…"
                              value={billsSearchQuery}
                              onChange={(e) => handleBillsSearch(e.target.value)}
                            />
                          </div>

                          <div style={styles.formGroup}>
                            <select
                              style={styles.input}
                              value={formData.billReportId}
                              onChange={(e) => handleBillChange(e.target.value)}
                              required
                            >
                              <option value="">Select bill</option>
                              {filteredBills.map((bill) => (
                                <option key={bill.id} value={bill.id}>
                                  {bill.contact || '(No Payee)'} — {bill.bill_number || 'No Bill #'} — ₱{Number(bill.total_debit || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </option>
                              ))}
                            </select>
                            {filteredBills.length === 0 && (
                              <p style={{ fontSize: '11px', color: '#ffc107', marginTop: '4px' }}>
                                No unpaid bills found
                              </p>
                            )}
                          </div>

                          {formData.billReportId && (
                            <div style={styles.formGroup}>
                              <label style={styles.label}>Payee Name</label>
                              <input
                                style={styles.input}
                                type="text"
                                value={formData.payeeName}
                                readOnly
                              />
                            </div>
                          )}

                          <div style={styles.formGroup}>
                            <label style={styles.label}>Purpose/Description</label>
                            <textarea
                              style={{ ...styles.input, minHeight: '80px', fontFamily: "'Poppins', sans-serif" }}
                              placeholder="Payment details"
                              value={formData.purpose}
                              onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                            />
                          </div>
                        </>
                      ) : formData.billType === 'receiving_report' ? (
                        <>
                          <div style={styles.formGroup}>
                            <label style={styles.label}>Payee Name (Receiving Report) *</label>
                            <input
                              style={styles.input}
                              type="text"
                              placeholder="Search by vendor name or RR number…"
                              value={rrSearchQuery}
                              onChange={(e) => handleRrSearch(e.target.value)}
                            />
                          </div>

                          <div style={styles.formGroup}>
                            <select
                              style={styles.input}
                              value={formData.receivingReportId}
                              onChange={(e) => handleRrChange(e.target.value)}
                              required
                            >
                              <option value="">Select receiving report</option>
                              {filteredReceivingReports.map((rr) => (
                                <option key={rr.id} value={rr.id}>
                                  {rr.vendor?.name || '(No Vendor)'} — ₱{Number(rr.total_landed_cost || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </option>
                              ))}
                            </select>
                            {filteredReceivingReports.length === 0 && (
                              <p style={{ fontSize: '11px', color: '#ffc107', marginTop: '4px' }}>
                                No unpaid receiving reports found
                              </p>
                            )}
                          </div>

                          {formData.receivingReportId && (
                            <div style={styles.formGroup}>
                              <label style={styles.label}>Vendor (Payee)</label>
                              <input
                                style={styles.input}
                                type="text"
                                value={formData.payeeName}
                                readOnly
                              />
                            </div>
                          )}

                          <div style={styles.formGroup}>
                            <label style={styles.label}>Purpose/Description</label>
                            <textarea
                              style={{ ...styles.input, minHeight: '80px', fontFamily: "'Poppins', sans-serif" }}
                              placeholder="Payment details"
                              value={formData.purpose}
                              onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={styles.formGroup}>
                            <label style={styles.label}>Payee Name *</label>
                            <input
                              style={styles.input}
                              type="text"
                              placeholder="Who is receiving the payment?"
                              value={formData.payeeName}
                              onChange={(e) => setFormData({ ...formData, payeeName: e.target.value })}
                              required
                            />
                          </div>

                          <div style={styles.formGroup}>
                            <label style={styles.label}>Purpose/Description</label>
                            <textarea
                              style={{...styles.input, minHeight: '80px', fontFamily: "'Poppins', sans-serif"}}
                              placeholder="Payment details"
                              value={formData.purpose}
                              onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                            />
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {(activeModal === 'cash-out' && cashOutType === 'pay-expense') && (
                    <>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Payee Name *</label>
                        <input
                          style={styles.input}
                          type="text"
                          placeholder="Who is receiving the payment?"
                          value={formData.payeeName}
                          onChange={(e) => setFormData({ ...formData, payeeName: e.target.value })}
                          required
                        />
                      </div>

                      <div style={styles.formGroup}>
                        <label style={styles.label}>Purpose *</label>
                        <input
                          style={styles.input}
                          type="text"
                          placeholder="What is this expense for?"
                          value={formData.purpose}
                          onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                          required
                        />
                      </div>

                      <div style={styles.formGroup}>
                        <label style={styles.label}>Category (Chart of Accounts) *</label>
                        <select
                          style={styles.input}
                          value={formData.category}
                          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                          required
                        >
                          <option value="">Select category</option>
                          {chartOfAccounts.map((account) => (
                            <option key={account.id} value={account.account_code}>
                              {account.account_code} - {account.account_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  {activeModal === 'adjustment' && (
                    <>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Reference Number</label>
                        <input
                          style={styles.input}
                          type="text"
                          placeholder="Order or receipt number"
                          value={formData.referenceNumber}
                          onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
                        />
                      </div>

                      <div style={styles.formGroup}>
                        <label style={styles.label}>Reason *</label>
                        <select
                          style={styles.input}
                          value={formData.reason}
                          onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                          required
                        >
                          <option value="">Select reason</option>
                          <option value="canceled_order">Canceled Order</option>
                          <option value="double_posting">Double Posting of Receipt</option>
                          <option value="payment_correction">From Cash to GCash Payment</option>
                          <option value="other">Other</option>
                        </select>
                      </div>

                      <div style={styles.formGroup}>
                        <label style={styles.label}>Admin Password *</label>
                        <input
                          style={styles.input}
                          type="password"
                          placeholder="Enter admin password to proceed"
                          value={formData.adminPassword}
                          onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                          required
                        />
                        <p style={{fontSize: '11px', color: '#888', marginTop: '4px'}}>
                          Admin verification required for adjustments
                        </p>
                      </div>
                    </>
                  )}

                  <div style={styles.modalActions}>
                    <button
                      type="button"
                      style={styles.cancelBtn}
                      onClick={() => { setActiveModal(null); setCashOutType(null); }}
                      disabled={submitting}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      style={styles.submitBtn}
                      disabled={submitting}
                    >
                      {submitting ? '⏳ Processing...' : 'Submit'}
                    </button>
                  </div>
                </form>
                </>
                )}
              </div>
            </div>
          )}
            </>
          )}

          {/* ── Cash Audit Tab ── */}
          {activeTab === 'audit' && (
            <div>
              {/* Date Selector */}
              <div style={styles.auditDateRow}>
                <label style={styles.auditDateLabel}>📅 Audit Date:</label>
                <input
                  type="date"
                  style={styles.auditDateInput}
                  value={auditDate}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => handleAuditDateChange(e.target.value)}
                />
              </div>

              {auditLoading ? (
                <p style={{ color: '#ffc107', textAlign: 'center', padding: '40px' }}>⏳ Loading audit data…</p>
              ) : (
                <>
                  {/* Cash on Hand Breakdown */}
                  <div style={styles.auditCard}>
                    <h3 style={styles.auditCardTitle}>📊 Cash on Hand Breakdown</h3>
                    <div style={styles.auditBreakdownRow}>
                      <span>Cash In</span>
                      <span style={{ color: '#4caf50' }}>+ ₱{auditCashIn.toFixed(2)}</span>
                    </div>
                    <div style={styles.auditBreakdownRow}>
                      <span>Cash Sales</span>
                      <span style={{ color: '#4caf50' }}>+ ₱{auditCashSales.toFixed(2)}</span>
                    </div>
                    <div style={styles.auditBreakdownRow}>
                      <span>Cash Out</span>
                      <span style={{ color: '#f44336' }}>− ₱{auditCashOut.toFixed(2)}</span>
                    </div>
                    <div style={styles.auditBreakdownRow}>
                      <span>Adjustment</span>
                      <span style={{ color: auditAdjustment >= 0 ? '#4caf50' : '#f44336' }}>
                        {auditAdjustment >= 0 ? '+' : '−'} ₱{Math.abs(auditAdjustment).toFixed(2)}
                      </span>
                    </div>
                    <div style={styles.auditBreakdownDivider} />
                    <div style={{ ...styles.auditBreakdownRow, fontWeight: '700', fontSize: '18px' }}>
                      <span>= Cash on Hand</span>
                      <span style={{ color: '#ffc107' }}>
                        ₱{(auditCashIn + auditCashSales - auditCashOut + auditAdjustment).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Denomination Inputs */}
                  <div style={styles.auditCard}>
                    <h3 style={styles.auditCardTitle}>💵 Physical Cash Count</h3>

                    <div style={styles.denomSectionTitle}>BILLS</div>
                    {[
                      { key: 'd1000', label: '₱1,000', value: 1000 },
                      { key: 'd500',  label: '₱500',   value: 500  },
                      { key: 'd200',  label: '₱200',   value: 200  },
                      { key: 'd100',  label: '₱100',   value: 100  },
                      { key: 'd50',   label: '₱50',    value: 50   },
                      { key: 'd20',   label: '₱20',    value: 20   },
                    ].map(({ key, label, value }) => (
                      <div key={key} style={styles.denomRow}>
                        <span style={styles.denomLabel}>{label}</span>
                        <span style={styles.denomX}>×</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          style={styles.denomInput}
                          value={denominations[key]}
                          onChange={(e) => setDenominations({ ...denominations, [key]: e.target.value })}
                          disabled={cashAudit?.is_submitted}
                          placeholder="0"
                        />
                        <span style={styles.denomEquals}>=</span>
                        <span style={styles.denomTotal}>
                          ₱{((parseInt(denominations[key]) || 0) * value).toFixed(2)}
                        </span>
                      </div>
                    ))}

                    <div style={{ ...styles.denomSectionTitle, marginTop: '20px' }}>COINS</div>
                    {[
                      { key: 'd10',  label: '₱10',   value: 10   },
                      { key: 'd5',   label: '₱5',    value: 5    },
                      { key: 'd1',   label: '₱1',    value: 1    },
                      { key: 'd050', label: '₱0.50', value: 0.50 },
                      { key: 'd025', label: '₱0.25', value: 0.25 },
                    ].map(({ key, label, value }) => (
                      <div key={key} style={styles.denomRow}>
                        <span style={styles.denomLabel}>{label}</span>
                        <span style={styles.denomX}>×</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          style={styles.denomInput}
                          value={denominations[key]}
                          onChange={(e) => setDenominations({ ...denominations, [key]: e.target.value })}
                          disabled={cashAudit?.is_submitted}
                          placeholder="0"
                        />
                        <span style={styles.denomEquals}>=</span>
                        <span style={styles.denomTotal}>
                          ₱{((parseInt(denominations[key]) || 0) * value).toFixed(2)}
                        </span>
                      </div>
                    ))}

                    <div style={styles.denomTotalRow}>
                      <span style={styles.denomTotalLabel}>Total Physical Count:</span>
                      <span style={styles.denomTotalValue}>₱{computeDenominationTotal().toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Overage / Shortage Result */}
                  {(() => {
                    const expectedCOH = auditCashIn + auditCashSales - auditCashOut + auditAdjustment;
                    const denomTotal = computeDenominationTotal();
                    const diff = denomTotal - expectedCOH;
                    return (
                      <div style={{
                        ...styles.auditCard,
                        borderColor: diff === 0 ? '#4caf50' : diff > 0 ? '#ffc107' : '#f44336',
                      }}>
                        <h3 style={styles.auditCardTitle}>📋 Audit Result</h3>
                        <div style={styles.auditBreakdownRow}>
                          <span>Expected Cash on Hand</span>
                          <span>₱{expectedCOH.toFixed(2)}</span>
                        </div>
                        <div style={styles.auditBreakdownRow}>
                          <span>Physical Count</span>
                          <span>₱{denomTotal.toFixed(2)}</span>
                        </div>
                        <div style={styles.auditBreakdownDivider} />
                        <div style={{ textAlign: 'center', padding: '16px 0' }}>
                          {diff === 0 ? (
                            <span style={{ fontSize: '24px', color: '#4caf50', fontWeight: '700' }}>✅ BALANCED</span>
                          ) : diff > 0 ? (
                            <div>
                              <div style={{ fontSize: '13px', color: '#888', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>Cash Overage</div>
                              <span style={{ fontSize: '28px', color: '#ffc107', fontWeight: '700' }}>+ ₱{diff.toFixed(2)}</span>
                            </div>
                          ) : (
                            <div>
                              <div style={{ fontSize: '13px', color: '#888', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>Cash Shortage</div>
                              <span style={{ fontSize: '28px', color: '#f44336', fontWeight: '700' }}>− ₱{Math.abs(diff).toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Submit / Submitted Banner */}
                  {cashAudit?.is_submitted ? (
                    <div style={styles.auditSubmittedBanner}>
                      ✅ Audit submitted on {new Date(cashAudit.submitted_at).toLocaleString()}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', marginTop: '32px', marginBottom: '32px' }}>
                      <button
                        style={{ ...styles.submitBtn, padding: '14px 48px', fontSize: '16px' }}
                        onClick={handleSubmitAudit}
                        disabled={auditSubmitting}
                      >
                        {auditSubmitting ? '⏳ Submitting…' : '📋 Submit Cash Audit'}
                      </button>
                      <p style={{ color: '#888', fontSize: '12px', marginTop: '8px' }}>
                        Once submitted, this audit cannot be edited.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </main>
      </div>
    </>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
    fontFamily: "'Poppins', sans-serif",
    color: '#fff',
  },
  center: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 32px',
    backgroundColor: '#1a1a1a',
    borderBottom: '1px solid #ffc107',
    gap: '24px',
  },
  logo: {
    fontSize: '22px',
    fontFamily: "'Playfair Display', serif",
    color: '#ffc107',
    margin: 0,
    whiteSpace: 'nowrap',
  },
  nav: {
    display: 'flex',
    gap: '16px',
    flex: 1,
    justifyContent: 'center',
  },
  navLink: {
    color: '#ccc',
    textDecoration: 'none',
    fontSize: '14px',
    padding: '8px 12px',
    borderRadius: '6px',
    transition: 'all 0.2s',
  },
  logoutBtn: {
    padding: '8px 18px',
    backgroundColor: 'transparent',
    color: '#ffc107',
    border: '1px solid #ffc107',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
    whiteSpace: 'nowrap',
  },
  main: {
    padding: '40px 32px',
    maxWidth: '1000px',
    margin: '0 auto',
  },
  title: {
    fontSize: '32px',
    fontFamily: "'Playfair Display', serif",
    color: '#ffc107',
    marginBottom: '32px',
    textAlign: 'center',
  },
  cashOnHandCard: {
    backgroundColor: '#1a1a1a',
    border: '2px solid #ffc107',
    borderRadius: '12px',
    padding: '32px',
    textAlign: 'center',
    marginBottom: '40px',
  },
  cashLabel: {
    fontSize: '18px',
    color: '#ccc',
    marginBottom: '12px',
  },
  cashValue: {
    fontSize: '48px',
    fontWeight: '700',
    color: '#ffc107',
  },
  coverageControls: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr)) auto',
    gap: '12px',
    alignItems: 'end',
    marginBottom: '20px',
  },
  actionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '20px',
    marginBottom: '48px',
  },
  actionBtn: {
    backgroundColor: '#1a1a1a',
    border: '1px solid #ffc107',
    borderRadius: '12px',
    padding: '24px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
    color: '#fff',
    fontFamily: "'Poppins', sans-serif",
  },
  actionIcon: {
    fontSize: '36px',
    marginBottom: '12px',
  },
  actionTitle: {
    fontSize: '16px',
    color: '#ffc107',
    marginBottom: '8px',
    fontWeight: '600',
  },
  actionDesc: {
    fontSize: '12px',
    color: '#888',
  },
  transactionsSection: {
    backgroundColor: '#1a1a1a',
    border: '1px solid #ffc107',
    borderRadius: '12px',
    padding: '24px',
  },
  sectionTitle: {
    fontSize: '20px',
    color: '#ffc107',
    marginTop: 0,
    marginBottom: '20px',
  },
  emptyText: {
    color: '#888',
    textAlign: 'center',
    padding: '20px',
  },
  transactionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  transactionCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: '8px',
    padding: '16px',
  },
  transactionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  transactionType: {
    fontSize: '14px',
    color: '#fff',
    fontWeight: '600',
  },
  transactionAmount: (type, amount) => ({
    fontSize: '16px',
    fontWeight: '700',
    color: ['cash-out', 'pay-bill', 'pay-expense'].includes(type)
      ? '#f44336'
      : type === 'adjustment'
        ? (parseFloat(amount) < 0 ? '#f44336' : '#4caf50')
        : '#4caf50',
  }),
  transactionDetails: {
    fontSize: '12px',
    color: '#888',
  },
  transactionTime: {
    marginBottom: '4px',
  },
  transactionDesc: {
    marginTop: '4px',
  },
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    border: '2px solid #ffc107',
    borderRadius: '12px',
    padding: '32px',
    maxWidth: '500px',
    width: '90%',
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  modalTitle: {
    fontSize: '24px',
    color: '#ffc107',
    marginTop: 0,
    marginBottom: '24px',
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    color: '#ccc',
    marginBottom: '8px',
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    border: '1px solid #444',
    borderRadius: '6px',
    backgroundColor: '#2a2a2a',
    color: '#fff',
    fontSize: '14px',
    boxSizing: 'border-box',
    outline: 'none',
  },
  modalActions: {
    display: 'flex',
    gap: '12px',
    marginTop: '24px',
  },
  cancelBtn: {
    flex: 1,
    padding: '12px',
    backgroundColor: 'transparent',
    color: '#ccc',
    border: '1px solid #555',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer',
  },
  submitBtn: {
    flex: 1,
    padding: '12px',
    backgroundColor: '#ffc107',
    color: '#0a0a0a',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  modalSubtext: {
    fontSize: '14px',
    color: '#888',
    textAlign: 'center',
    marginBottom: '24px',
  },
  submenuGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  submenuBtn: {
    backgroundColor: '#2a2a2a',
    border: '1px solid #ffc107',
    borderRadius: '12px',
    padding: '20px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
    color: '#fff',
    fontFamily: "'Poppins', sans-serif",
    fontSize: '14px',
    fontWeight: '600',
  },
  submenuDesc: {
    fontSize: '11px',
    color: '#888',
    marginTop: '8px',
    fontWeight: 'normal',
  },

  // ── Tab navigation ──────────────────────────────────────────────────────────
  tabContainer: {
    display: 'flex',
    gap: '12px',
    marginBottom: '32px',
    justifyContent: 'center',
  },
  tab: {
    padding: '12px 24px',
    backgroundColor: '#1a1a1a',
    color: '#ccc',
    border: '1px solid #444',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
    transition: 'all 0.2s',
  },
  tabActive: {
    padding: '12px 24px',
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    color: '#ffc107',
    border: '1px solid #ffc107',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },

  // ── Cash Audit ──────────────────────────────────────────────────────────────
  auditDateRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '24px',
    justifyContent: 'center',
  },
  auditDateLabel: {
    color: '#ccc',
    fontSize: '16px',
  },
  auditDateInput: {
    padding: '10px 14px',
    border: '1px solid #ffc107',
    borderRadius: '6px',
    backgroundColor: '#2a2a2a',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
    fontFamily: "'Poppins', sans-serif",
  },
  auditCard: {
    backgroundColor: '#1a1a1a',
    border: '1px solid #ffc107',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '20px',
  },
  auditCardTitle: {
    fontSize: '18px',
    color: '#ffc107',
    marginTop: 0,
    marginBottom: '20px',
  },
  auditBreakdownRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    fontSize: '15px',
    color: '#ccc',
  },
  auditBreakdownDivider: {
    borderTop: '1px solid #444',
    margin: '12px 0',
  },
  denomSectionTitle: {
    color: '#888',
    fontSize: '12px',
    fontWeight: '600',
    letterSpacing: '1px',
    marginBottom: '12px',
    textTransform: 'uppercase',
  },
  denomRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '10px',
  },
  denomLabel: {
    color: '#fff',
    fontSize: '14px',
    width: '64px',
    fontWeight: '600',
  },
  denomX: {
    color: '#888',
    fontSize: '14px',
  },
  denomInput: {
    width: '80px',
    padding: '8px 10px',
    border: '1px solid #444',
    borderRadius: '6px',
    backgroundColor: '#2a2a2a',
    color: '#fff',
    fontSize: '14px',
    textAlign: 'center',
    outline: 'none',
    fontFamily: "'Poppins', sans-serif",
  },
  denomEquals: {
    color: '#888',
    fontSize: '14px',
  },
  denomTotal: {
    color: '#ffc107',
    fontSize: '14px',
    minWidth: '100px',
    textAlign: 'right',
    fontWeight: '600',
  },
  denomTotalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTop: '2px solid #ffc107',
    paddingTop: '16px',
    marginTop: '8px',
  },
  denomTotalLabel: {
    color: '#ffc107',
    fontSize: '16px',
    fontWeight: '600',
  },
  denomTotalValue: {
    color: '#ffc107',
    fontSize: '24px',
    fontWeight: '700',
  },
  auditSubmittedBanner: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    border: '1px solid #4caf50',
    borderRadius: '8px',
    padding: '16px',
    textAlign: 'center',
    color: '#4caf50',
    fontSize: '16px',
    marginTop: '24px',
    marginBottom: '32px',
  },
};
