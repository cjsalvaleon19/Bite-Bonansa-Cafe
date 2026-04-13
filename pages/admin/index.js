import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../../utils/supabaseClient';

const cardStyle = {
  backgroundColor: '#1e1e1e',
  borderRadius: '12px',
  padding: '24px',
  border: '1px solid #333',
  marginBottom: '20px',
};

const thStyle = {
  padding: '12px 16px',
  textAlign: 'left',
  color: '#ffc107',
  fontSize: '13px',
  fontWeight: '600',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  borderBottom: '1px solid #333',
};

const tdStyle = {
  padding: '12px 16px',
  fontSize: '14px',
  color: '#ddd',
  borderBottom: '1px solid #1a1a1a',
};

export default function AdminDashboard() {
  const [customers, setCustomers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [tab, setTab] = useState('customers');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [custRes, txRes, ordRes] = await Promise.all([
        supabase.from('customers').select('*').order('created_at', { ascending: false }),
        supabase.from('points_transactions').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(100),
      ]);

      if (custRes.error) throw custRes.error;
      setCustomers(custRes.data || []);
      setTransactions(txRes.data || []);
      setOrders(ordRes.data || []);
    } catch (err) {
      setError('Failed to load data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const totalPoints = customers.reduce((s, c) => s + parseFloat(c.points_balance || 0), 0);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', color: '#ffc107', fontFamily: "'Poppins', sans-serif" }}>
        <p>⏳ Loading admin data...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0a0a0a 0%, #111 100%)', fontFamily: "'Poppins', sans-serif", color: '#fff', padding: '24px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <h1 style={{ color: '#ffc107', fontSize: '30px', fontWeight: 'bold', fontFamily: "'Playfair Display', serif" }}>
            ☕ Admin — Bite Bonansa
          </h1>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Link href="/cashier" style={{ color: '#ffc107', fontSize: '14px', padding: '8px 16px', border: '1px solid #ffc107', borderRadius: '6px', textDecoration: 'none' }}>
              Cashier View
            </Link>
            <Link href="/dashboard" style={{ color: '#999', fontSize: '14px' }}>← Dashboard</Link>
          </div>
        </div>

        {error && (
          <div style={{ backgroundColor: '#3a1a1a', color: '#ff6b6b', padding: '12px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #ff6b6b' }}>
            ⚠️ {error}
          </div>
        )}

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '28px' }}>
          <div style={{ ...cardStyle, marginBottom: 0, textAlign: 'center' }}>
            <p style={{ color: '#999', fontSize: '13px', margin: '0 0 8px', textTransform: 'uppercase' }}>Total Customers</p>
            <p style={{ color: '#ffc107', fontSize: '36px', fontWeight: 'bold', margin: 0 }}>{customers.length}</p>
          </div>
          <div style={{ ...cardStyle, marginBottom: 0, textAlign: 'center' }}>
            <p style={{ color: '#999', fontSize: '13px', margin: '0 0 8px', textTransform: 'uppercase' }}>Total Points Issued</p>
            <p style={{ color: '#4caf50', fontSize: '36px', fontWeight: 'bold', margin: 0 }}>{totalPoints.toFixed(2)}</p>
          </div>
          <div style={{ ...cardStyle, marginBottom: 0, textAlign: 'center' }}>
            <p style={{ color: '#999', fontSize: '13px', margin: '0 0 8px', textTransform: 'uppercase' }}>Total Orders</p>
            <p style={{ color: '#2196f3', fontSize: '36px', fontWeight: 'bold', margin: 0 }}>{orders.length}</p>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '0' }}>
          {[
            { key: 'customers', label: '👥 Customers' },
            { key: 'transactions', label: '📋 Points Transactions' },
            { key: 'orders', label: '🧾 Orders' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                padding: '10px 20px',
                backgroundColor: 'transparent',
                color: tab === key ? '#ffc107' : '#666',
                border: 'none',
                borderBottom: tab === key ? '2px solid #ffc107' : '2px solid transparent',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: tab === key ? '600' : '400',
                fontFamily: "'Poppins', sans-serif",
                marginBottom: '-1px',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Customers Tab */}
        {tab === 'customers' && (
          <div style={cardStyle}>
            <h3 style={{ color: '#ffc107', fontSize: '18px', marginBottom: '16px' }}>All Customers</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Customer ID</th>
                    <th style={thStyle}>Name</th>
                    <th style={thStyle}>Email</th>
                    <th style={thStyle}>Phone</th>
                    <th style={thStyle}>Points Balance</th>
                    <th style={thStyle}>Member Since</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.length === 0 ? (
                    <tr><td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: '#666', padding: '30px' }}>No customers yet</td></tr>
                  ) : (
                    customers.map((c) => (
                      <tr key={c.customer_id} style={{ transition: 'background 0.2s' }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2a2a2a'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <td style={{ ...tdStyle, color: '#ffc107', fontWeight: '600', fontFamily: 'monospace' }}>{c.customer_id}</td>
                        <td style={tdStyle}>{c.name}</td>
                        <td style={{ ...tdStyle, color: '#999' }}>{c.email}</td>
                        <td style={{ ...tdStyle, color: '#999' }}>{c.phone || '—'}</td>
                        <td style={{ ...tdStyle, color: '#4caf50', fontWeight: '600' }}>{parseFloat(c.points_balance || 0).toFixed(2)} pts</td>
                        <td style={{ ...tdStyle, color: '#999' }}>
                          {c.created_at ? new Date(c.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Transactions Tab */}
        {tab === 'transactions' && (
          <div style={cardStyle}>
            <h3 style={{ color: '#ffc107', fontSize: '18px', marginBottom: '16px' }}>Points Transactions (Latest 100)</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Customer ID</th>
                    <th style={thStyle}>Type</th>
                    <th style={thStyle}>Points</th>
                    <th style={thStyle}>Order Amount</th>
                    <th style={thStyle}>Payment Method</th>
                    <th style={thStyle}>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr><td colSpan={7} style={{ ...tdStyle, textAlign: 'center', color: '#666', padding: '30px' }}>No transactions yet</td></tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr key={tx.id}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2a2a2a'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <td style={{ ...tdStyle, color: '#999', fontSize: '12px' }}>
                          {new Date(tx.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ ...tdStyle, color: '#ffc107', fontFamily: 'monospace' }}>{tx.customer_id}</td>
                        <td style={tdStyle}>
                          <span style={{
                            padding: '3px 10px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: '600',
                            backgroundColor: tx.type === 'earn' ? '#1a3a1a' : '#3a1a1a',
                            color: tx.type === 'earn' ? '#4caf50' : '#ff6b6b',
                          }}>
                            {tx.type === 'earn' ? '⬆ Earned' : '⬇ Redeemed'}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, color: tx.type === 'earn' ? '#4caf50' : '#ff6b6b', fontWeight: '600' }}>
                          {tx.type === 'earn' ? '+' : '-'}{parseFloat(tx.points).toFixed(2)}
                        </td>
                        <td style={{ ...tdStyle, color: '#ffc107' }}>
                          {tx.order_amount != null ? `₱${parseFloat(tx.order_amount).toFixed(2)}` : '—'}
                        </td>
                        <td style={{ ...tdStyle, color: '#999' }}>{tx.payment_method || '—'}</td>
                        <td style={{ ...tdStyle, color: '#999', fontSize: '13px' }}>{tx.description || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Orders Tab */}
        {tab === 'orders' && (
          <div style={cardStyle}>
            <h3 style={{ color: '#ffc107', fontSize: '18px', marginBottom: '16px' }}>Orders (Latest 100)</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Customer ID</th>
                    <th style={thStyle}>Total</th>
                    <th style={thStyle}>Points Used</th>
                    <th style={thStyle}>Points Earned</th>
                    <th style={thStyle}>Payment</th>
                    <th style={thStyle}>Type</th>
                    <th style={thStyle}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 ? (
                    <tr><td colSpan={8} style={{ ...tdStyle, textAlign: 'center', color: '#666', padding: '30px' }}>No orders yet</td></tr>
                  ) : (
                    orders.map((o) => (
                      <tr key={o.id}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2a2a2a'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <td style={{ ...tdStyle, color: '#999', fontSize: '12px' }}>
                          {new Date(o.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ ...tdStyle, color: '#ffc107', fontFamily: 'monospace' }}>{o.customer_id || '—'}</td>
                        <td style={{ ...tdStyle, color: '#ffc107', fontWeight: '600' }}>₱{parseFloat(o.total_amount).toFixed(2)}</td>
                        <td style={{ ...tdStyle, color: '#ff6b6b' }}>
                          {parseFloat(o.points_used || 0) > 0 ? `-${parseFloat(o.points_used).toFixed(2)} pts` : '—'}
                        </td>
                        <td style={{ ...tdStyle, color: '#4caf50' }}>
                          {parseFloat(o.points_earned || 0) > 0 ? `+${parseFloat(o.points_earned).toFixed(2)} pts` : '—'}
                        </td>
                        <td style={{ ...tdStyle, color: '#999' }}>{o.payment_method}</td>
                        <td style={tdStyle}>
                          <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '12px', backgroundColor: o.order_type === 'cashier' ? '#1a1a3a' : '#1a2a1a', color: o.order_type === 'cashier' ? '#7986cb' : '#81c784' }}>
                            {o.order_type}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            backgroundColor:
                              o.order_status === 'Completed' ? '#1a3a1a' :
                              o.order_status === 'Cancelled' ? '#3a1a1a' : '#1a2a3a',
                            color:
                              o.order_status === 'Completed' ? '#4caf50' :
                              o.order_status === 'Cancelled' ? '#ff6b6b' : '#29b6f6',
                          }}>
                            {o.order_status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
