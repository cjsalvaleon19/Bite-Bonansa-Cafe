import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../../utils/supabaseClient';
import { useRoleGuard } from '../../utils/useRoleGuard';

export default function EndOfDayReport() {
  const router = useRouter();
  const { loading: authLoading } = useRoleGuard('cashier');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (!authLoading) {
      fetchOrders();
    }
  }, [authLoading, selectedDate]);

  const fetchOrders = async () => {
    if (!supabase) return;

    try {
      const startDate = new Date(selectedDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(selectedDate);
      endDate.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      setOrders(data || []);
    } catch (err) {
      console.error('[EODReport] Failed to fetch orders:', err?.message ?? err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintReceipt = (order) => {
    // Create a simple receipt print window
    const receiptWindow = window.open('', '_blank', 'width=300,height=600');
    if (!receiptWindow) return;

    receiptWindow.document.write(`
      <html>
        <head>
          <title>Receipt #${order.id.slice(0, 8)}</title>
          <style>
            body { font-family: monospace; font-size: 12px; padding: 20px; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px dashed #000; padding-bottom: 10px; }
            .items { margin: 20px 0; }
            .item { display: flex; justify-content: space-between; margin: 5px 0; }
            .footer { border-top: 2px dashed #000; padding-top: 10px; margin-top: 20px; }
            .total { font-weight: bold; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>Bite Bonansa Cafe</h2>
            <p>Receipt #${order.id.slice(0, 8)}</p>
            <p>${new Date(order.created_at).toLocaleString()}</p>
            <p>Mode: ${order.order_mode || 'N/A'}</p>
            <p>Payment: ${order.payment_method || 'N/A'}</p>
          </div>
          <div class="items">
            ${order.items?.map(item => `
              <div class="item">
                <span>${item.name} x${item.quantity}</span>
                <span>₱${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            `).join('') || ''}
          </div>
          <div class="footer">
            <div class="item"><span>Subtotal:</span><span>₱${parseFloat(order.subtotal || 0).toFixed(2)}</span></div>
            ${order.delivery_fee > 0 ? `<div class="item"><span>Delivery Fee:</span><span>₱${parseFloat(order.delivery_fee).toFixed(2)}</span></div>` : ''}
            ${order.points_used > 0 ? `<div class="item"><span>Points Used:</span><span>-₱${parseFloat(order.points_used).toFixed(2)}</span></div>` : ''}
            <div class="item total"><span>Net Amount:</span><span>₱${parseFloat(order.total_amount || 0).toFixed(2)}</span></div>
          </div>
          <div style="text-align: center; margin-top: 20px;">
            <p>Thank you for your order!</p>
          </div>
        </body>
      </html>
    `);

    receiptWindow.document.close();
    setTimeout(() => {
      receiptWindow.print();
    }, 250);
  };

  const totalSales = orders.reduce((sum, order) => sum + parseFloat(order.total_amount || 0), 0);
  const totalCash = orders.reduce((sum, order) => 
    sum + (order.payment_method === 'cash' ? parseFloat(order.cash_amount || order.total_amount || 0) : 0), 0
  );
  const totalGcash = orders.reduce((sum, order) => 
    sum + (order.payment_method === 'gcash' ? parseFloat(order.gcash_amount || 0) : 0), 0
  );
  const totalPoints = orders.reduce((sum, order) => sum + parseFloat(order.points_used || 0), 0);

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
        <title>End of Day Report - Bite Bonansa Cafe</title>
        <meta name="description" content="Daily sales report and receipts" />
      </Head>
      <div style={styles.page}>
        <header style={styles.header}>
          <h1 style={styles.logo}>☕ Bite Bonansa Cafe</h1>
          <nav style={styles.nav}>
            <Link href="/cashier/dashboard" style={styles.navLink}>Dashboard</Link>
            <Link href="/cashier/pos" style={styles.navLink}>POS</Link>
            <Link href="/cashier/orders-queue" style={styles.navLink}>Order Queue</Link>
            <Link href="/cashier/eod-report" style={styles.navLinkActive}>EOD Report</Link>
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
          <h2 style={styles.title}>📊 End of Day Report</h2>

          {/* Date Selector */}
          <div style={styles.dateSelector}>
            <label style={styles.dateLabel}>Select Date:</label>
            <input
              type="date"
              style={styles.dateInput}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>

          {/* Summary Cards */}
          <div style={styles.summaryGrid}>
            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Total Sales</div>
              <div style={styles.summaryValue}>₱{totalSales.toFixed(2)}</div>
            </div>
            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Cash Sales</div>
              <div style={styles.summaryValue}>₱{totalCash.toFixed(2)}</div>
            </div>
            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>GCash Sales</div>
              <div style={styles.summaryValue}>₱{totalGcash.toFixed(2)}</div>
            </div>
            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Points Redeemed</div>
              <div style={styles.summaryValue}>₱{totalPoints.toFixed(2)}</div>
            </div>
          </div>

          {/* Orders Table */}
          {orders.length === 0 ? (
            <div style={styles.emptyState}>
              <p style={styles.emptyIcon}>📭</p>
              <p style={styles.emptyText}>No orders for this date</p>
            </div>
          ) : (
            <div style={styles.tableContainer}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeader}>
                    <th style={styles.th}>Date & Time</th>
                    <th style={styles.th}>Customer ID</th>
                    <th style={styles.th}>Customer Name</th>
                    <th style={styles.th}>Mode of Order</th>
                    <th style={styles.th}>Payment</th>
                    <th style={styles.th}>Subtotal</th>
                    <th style={styles.th}>Delivery Fee</th>
                    <th style={styles.th}>Points Used</th>
                    <th style={styles.th}>Net Amount</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} style={styles.tableRow}>
                      <td style={styles.td}>
                        {new Date(order.created_at).toLocaleString()}
                      </td>
                      <td style={styles.td}>
                        {order.customer_id?.slice(0, 8) || 'N/A'}
                      </td>
                      <td style={styles.td}>
                        {order.customer_name || 'Walk-in'}
                      </td>
                      <td style={styles.td}>
                        {order.order_mode || 'N/A'}
                      </td>
                      <td style={styles.td}>
                        {order.payment_method || 'N/A'}
                      </td>
                      <td style={styles.td}>
                        ₱{parseFloat(order.subtotal || 0).toFixed(2)}
                      </td>
                      <td style={styles.td}>
                        ₱{parseFloat(order.delivery_fee || 0).toFixed(2)}
                      </td>
                      <td style={styles.td}>
                        ₱{parseFloat(order.points_used || 0).toFixed(2)}
                      </td>
                      <td style={styles.td}>
                        <strong>₱{parseFloat(order.total_amount || 0).toFixed(2)}</strong>
                      </td>
                      <td style={styles.td}>
                        <button
                          style={styles.printBtn}
                          onClick={() => handlePrintReceipt(order)}
                        >
                          🖨️ Print
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
  navLinkActive: {
    color: '#ffc107',
    textDecoration: 'none',
    fontSize: '14px',
    padding: '8px 12px',
    borderRadius: '6px',
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    border: '1px solid #ffc107',
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
    maxWidth: '1400px',
    margin: '0 auto',
  },
  title: {
    fontSize: '32px',
    fontFamily: "'Playfair Display', serif",
    color: '#ffc107',
    marginBottom: '32px',
    textAlign: 'center',
  },
  dateSelector: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    marginBottom: '32px',
  },
  dateLabel: {
    fontSize: '14px',
    color: '#ccc',
  },
  dateInput: {
    padding: '8px 12px',
    backgroundColor: '#2a2a2a',
    color: '#fff',
    border: '1px solid #ffc107',
    borderRadius: '6px',
    fontSize: '14px',
    outline: 'none',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '20px',
    marginBottom: '40px',
  },
  summaryCard: {
    backgroundColor: '#1a1a1a',
    border: '1px solid #ffc107',
    borderRadius: '12px',
    padding: '20px',
    textAlign: 'center',
  },
  summaryLabel: {
    fontSize: '14px',
    color: '#ccc',
    marginBottom: '8px',
  },
  summaryValue: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#ffc107',
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
  },
  emptyIcon: {
    fontSize: '64px',
    marginBottom: '16px',
  },
  emptyText: {
    fontSize: '18px',
    color: '#888',
  },
  tableContainer: {
    backgroundColor: '#1a1a1a',
    border: '1px solid #ffc107',
    borderRadius: '12px',
    padding: '20px',
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  tableHeader: {
    borderBottom: '2px solid #ffc107',
  },
  th: {
    padding: '12px',
    textAlign: 'left',
    fontSize: '12px',
    color: '#ffc107',
    fontWeight: '600',
    whiteSpace: 'nowrap',
  },
  tableRow: {
    borderBottom: '1px solid #2a2a2a',
  },
  td: {
    padding: '12px',
    fontSize: '13px',
    color: '#ccc',
    whiteSpace: 'nowrap',
  },
  printBtn: {
    padding: '6px 12px',
    backgroundColor: '#ffc107',
    color: '#0a0a0a',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: '600',
  },
};
