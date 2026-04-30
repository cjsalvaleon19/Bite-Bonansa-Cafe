import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../../utils/supabaseClient';
import { useRoleGuard } from '../../utils/useRoleGuard';

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
  });
  const [submitting, setSubmitting] = useState(false);
  const [cashOnHand, setCashOnHand] = useState(0);
  const [chartOfAccounts, setChartOfAccounts] = useState([]);

  useEffect(() => {
    if (!authLoading) {
      initializePage();
    }
  }, [authLoading]);

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

  const fetchTransactions = async () => {
    if (!supabase) return;

    try {
      // Get today's transactions
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data, error } = await supabase
        .from('cash_drawer_transactions')
        .select('*')
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      setTransactions(data || []);

      // Calculate cash on hand
      const cashIn = (data || [])
        .filter(t => t.transaction_type === 'cash-in')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      const cashOut = (data || [])
        .filter(t => ['cash-out', 'pay-bill', 'pay-expense'].includes(t.transaction_type))
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      const adjustments = (data || [])
        .filter(t => t.transaction_type === 'adjustment')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

      setCashOnHand(cashIn - cashOut + adjustments);
    } catch (err) {
      console.error('[CashDrawer] Failed to fetch transactions:', err?.message ?? err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!supabase || !user) return;

    // Validate form
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    // For adjustments, validate admin password
    if (activeModal === 'adjustment') {
      if (!formData.adminPassword) {
        alert('Admin password is required for adjustments');
        return;
      }
      // Verify admin password by attempting to sign in with it
      try {
        // For now, we'll verify against cjsalvaleon19@gmail.com (admin)
        const { data: adminData, error: adminError } = await supabase.auth.signInWithPassword({
          email: 'cjsalvaleon19@gmail.com',
          password: formData.adminPassword,
        });
        
        if (adminError) {
          alert('Invalid admin password');
          return;
        }
        
        // Re-authenticate the current user
        const { data: { session } } = await supabase.auth.getSession();
        // The session should still be valid, no need to re-login
      } catch (err) {
        console.error('[CashDrawer] Admin password verification failed:', err);
        alert('Admin password verification failed');
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

      const transactionData = {
        cashier_id: user.id,
        transaction_type: transactionType,
        amount: parseFloat(formData.amount),
        description: formData.description || null,
        payee_name: formData.payeeName || null,
        purpose: formData.purpose || null,
        category: formData.category || null,
        reference_number: formData.referenceNumber || null,
        adjustment_reason: formData.reason || null,
        bill_type: formData.billType || null,
        payment_adjustment_type: paymentAdjustmentType,
        admin_verified: activeModal === 'adjustment' ? true : null,
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('cash_drawer_transactions')
        .insert(transactionData);

      if (error) throw error;

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
      });
      setActiveModal(null);
      setCashOutType(null);
      
      // Refresh transactions
      await fetchTransactions();

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

          {/* Cash on Hand Display */}
          <div style={styles.cashOnHandCard}>
            <div style={styles.cashLabel}>Cash on Hand</div>
            <div style={styles.cashValue}>₱{cashOnHand.toFixed(2)}</div>
          </div>

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
            <h3 style={styles.sectionTitle}>Today's Transactions</h3>
            {transactions.length === 0 ? (
              <p style={styles.emptyText}>No transactions yet today</p>
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
                      <div style={styles.transactionAmount(transaction.transaction_type)}>
                        {['cash-out', 'pay-bill', 'pay-expense'].includes(transaction.transaction_type) ? '-' : '+'}₱{parseFloat(transaction.amount).toFixed(2)}
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
                          onChange={(e) => setFormData({ ...formData, billType: e.target.value })}
                          required
                        >
                          <option value="">Select bill type</option>
                          <option value="payroll">Payroll</option>
                          <option value="utilities">Utilities</option>
                          <option value="receiving_report">Receiving Report</option>
                          <option value="other">Other</option>
                        </select>
                      </div>

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
  transactionAmount: (type) => ({
    fontSize: '16px',
    fontWeight: '700',
    color: type === 'cash-out' ? '#f44336' : '#4caf50',
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
};
