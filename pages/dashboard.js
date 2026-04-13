import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../utils/supabaseClient';

const cardStyle = {
  backgroundColor: '#1e1e1e',
  borderRadius: '12px',
  padding: '24px',
  border: '1px solid #333',
  marginBottom: '20px',
};

export default function Dashboard() {
  const [customer, setCustomer] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadCustomerData();
  }, []);

  const loadCustomerData = async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        window.location.href = '/login';
        return;
      }

      const userId = sessionData.session.user.id;

      // Fetch customer profile
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('customer_id, name, email, phone, points_balance, created_at')
        .eq('id', userId)
        .single();

      if (customerError || !customerData) {
        setError('Customer profile not found. Please contact support.');
        setLoading(false);
        return;
      }

      setCustomer(customerData);

      // Fetch transactions
      const { data: txData } = await supabase
        .from('points_transactions')
        .select('*')
        .eq('customer_id', customerData.customer_id)
        .order('created_at', { ascending: false })
        .limit(20);

      setTransactions(txData || []);
    } catch (err) {
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', color: '#ffc107', fontFamily: "'Poppins', sans-serif" }}>
        <p>⏳ Loading your dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', color: '#ff6b6b', fontFamily: "'Poppins', sans-serif" }}>
        <div style={{ textAlign: 'center' }}>
          <p>⚠️ {error}</p>
          <Link href="/login" style={{ color: '#ffc107' }}>Go to Login</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0a0a0a 0%, #111 100%)', fontFamily: "'Poppins', sans-serif", color: '#fff', padding: '20px' }}>
      {/* Header */}
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <h1 style={{ color: '#ffc107', fontSize: '28px', fontWeight: 'bold', fontFamily: "'Playfair Display', serif" }}>
            ☕ Bite Bonansa
          </h1>
          <button
            onClick={handleLogout}
            style={{ padding: '8px 20px', backgroundColor: 'transparent', color: '#ffc107', border: '1px solid #ffc107', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}
          >
            Logout
          </button>
        </div>

        <h2 style={{ fontSize: '22px', marginBottom: '24px', color: '#ddd' }}>
          👋 Welcome, {customer?.name}!
        </h2>

        {/* Customer ID Card */}
        <div style={{ ...cardStyle, background: 'linear-gradient(135deg, #1a1a00 0%, #2a2000 100%)', border: '1px solid #ffc107' }}>
          <p style={{ color: '#999', fontSize: '13px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '1px' }}>Your Customer ID</p>
          <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#ffc107', letterSpacing: '2px', margin: 0 }}>
            {customer?.customer_id}
          </p>
          <p style={{ color: '#999', fontSize: '12px', marginTop: '8px' }}>
            📌 Use this ID at the cashier to earn points on every order
          </p>
        </div>

        {/* Points Balance Card */}
        <div style={{ ...cardStyle, background: 'linear-gradient(135deg, #001a0a 0%, #002a10 100%)', border: '1px solid #4caf50' }}>
          <p style={{ color: '#999', fontSize: '13px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '1px' }}>Points Balance</p>
          <p style={{ fontSize: '40px', fontWeight: 'bold', color: '#4caf50', margin: 0 }}>
            {parseFloat(customer?.points_balance || 0).toFixed(2)}
            <span style={{ fontSize: '16px', color: '#999', marginLeft: '8px' }}>pts</span>
          </p>
          <p style={{ color: '#999', fontSize: '12px', marginTop: '8px' }}>
            💡 1 point = ₱1.00 | Earn 0.2% on purchases below ₱500, 0.5% on ₱500+
          </p>
          <Link href="/payment" style={{
            display: 'inline-block',
            marginTop: '14px',
            padding: '10px 24px',
            backgroundColor: '#4caf50',
            color: '#fff',
            borderRadius: '6px',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: '600',
          }}>
            🛍️ Redeem Points
          </Link>
        </div>

        {/* Points History */}
        <div style={cardStyle}>
          <h3 style={{ color: '#ffc107', fontSize: '18px', marginBottom: '16px' }}>📋 Points History</h3>
          {transactions.length === 0 ? (
            <p style={{ color: '#666', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>
              No transactions yet. Start ordering to earn points!
            </p>
          ) : (
            <div>
              {transactions.map((tx) => (
                <div key={tx.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 0',
                  borderBottom: '1px solid #2a2a2a',
                }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '14px', color: '#ddd' }}>{tx.description}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#666', marginTop: '2px' }}>
                      {new Date(tx.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span style={{
                    fontWeight: 'bold',
                    fontSize: '16px',
                    color: tx.type === 'earn' ? '#4caf50' : '#ff6b6b',
                  }}>
                    {tx.type === 'earn' ? '+' : '-'}{parseFloat(tx.points).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Account Info */}
        <div style={cardStyle}>
          <h3 style={{ color: '#ffc107', fontSize: '18px', marginBottom: '16px' }}>👤 Account Info</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <p style={{ color: '#666', fontSize: '12px', margin: 0 }}>Name</p>
              <p style={{ color: '#ddd', fontSize: '14px', margin: '4px 0 0' }}>{customer?.name}</p>
            </div>
            <div>
              <p style={{ color: '#666', fontSize: '12px', margin: 0 }}>Email</p>
              <p style={{ color: '#ddd', fontSize: '14px', margin: '4px 0 0' }}>{customer?.email}</p>
            </div>
            <div>
              <p style={{ color: '#666', fontSize: '12px', margin: 0 }}>Phone</p>
              <p style={{ color: '#ddd', fontSize: '14px', margin: '4px 0 0' }}>{customer?.phone || '—'}</p>
            </div>
            <div>
              <p style={{ color: '#666', fontSize: '12px', margin: 0 }}>Member Since</p>
              <p style={{ color: '#ddd', fontSize: '14px', margin: '4px 0 0' }}>
                {customer?.created_at ? new Date(customer.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long' }) : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
