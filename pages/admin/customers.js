import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../utils/supabaseClient';
import { getUserRole, ROLES, canAccessPage } from '../../utils/roleGuard';

// ─── Admin: Customer Management ───────────────────────────────────────────────
// Lists registered customers with their loyalty points and order history summary.
// Auth-guarded: redirects to /login if no active session.
// Role-guarded: only admins can access this page.

export default function CustomersPage() {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // ── Auth & Role guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    async function checkSession() {
      if (!supabase) {
        if (mounted) { setAuthLoading(false); router.replace('/login'); }
        return;
      }
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        if (!session) { router.replace('/login'); return; }
        
        // Check user role
        const roleData = await getUserRole();
        if (!roleData || !canAccessPage(roleData.role, '/admin/customers')) {
          // User doesn't have permission, redirect to their default page
          if (roleData?.role === ROLES.CUSTOMER) {
            router.replace('/customer/menu');
          } else if (roleData?.role === ROLES.CASHIER) {
            router.replace('/cashier');
          } else if (roleData?.role === ROLES.RIDER) {
            router.replace('/rider/deliveries');
          } else {
            router.replace('/dashboard');
          }
          return;
        }
        
        setAuthLoading(false);
      } catch {
        if (mounted) { setAuthLoading(false); router.replace('/login'); }
      }
    }
    checkSession();
    return () => { mounted = false; };
  }, [router]);

  // ── Fetch customers ─────────────────────────────────────────────────────────
  const fetchCustomers = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, customer_id, full_name, email, phone, loyalty_points, created_at')
        .order('full_name');
      if (!error && data) setCustomers(data);
    } catch { /* non-fatal */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) fetchCustomers();
  }, [authLoading, fetchCustomers]);

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    return (
      !q ||
      (c.full_name ?? '').toLowerCase().includes(q) ||
      (c.customer_id ?? '').toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q)
    );
  });

  if (authLoading) {
    return (
      <div style={styles.center}>
        <p style={{ color: '#ffc107', fontFamily: "'Poppins', sans-serif" }}>⏳ Loading…</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header style={styles.header}>
        <h1 style={styles.logo}>👥 Customer Management</h1>
        <button style={styles.backBtn} onClick={() => router.push('/dashboard').catch(console.error)}>← Dashboard</button>
      </header>

      <main style={styles.main}>
        {!supabase && (
          <p style={styles.notice}>
            ⚠️ Supabase is not configured. Connect your database to view customer records.
          </p>
        )}

        {/* ── Search ─────────────────────────────────────────────────────── */}
        <input
          style={styles.searchInput}
          type="text"
          placeholder="Search by name, customer ID, or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {loading && <p style={{ color: '#aaa', fontSize: '14px' }}>Loading customers…</p>}

        {!loading && customers.length === 0 && supabase && (
          <p style={{ color: '#aaa', fontSize: '14px' }}>
            No customer records found.
          </p>
        )}

        {filtered.length > 0 && (
          <table style={styles.table}>
            <thead>
              <tr>
                {['Customer ID', 'Name', 'Email', 'Phone', 'Loyalty Points', 'Joined'].map((h) => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} style={styles.tr}>
                  <td style={styles.td}>
                    <code style={{ color: '#ffc107', fontSize: '12px' }}>{c.customer_id ?? '—'}</code>
                  </td>
                  <td style={styles.td}>{c.full_name ?? '—'}</td>
                  <td style={styles.td}>{c.email ?? '—'}</td>
                  <td style={styles.td}>{c.phone ?? '—'}</td>
                  <td style={styles.td}>
                    <span style={{ color: '#4caf50', fontWeight: '600' }}>
                      {c.loyalty_points ?? 0} pts
                    </span>
                  </td>
                  <td style={styles.td}>
                    {c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!loading && search && filtered.length === 0 && (
          <p style={{ color: '#aaa', fontSize: '14px', marginTop: '16px' }}>
            No customers match &ldquo;{search}&rdquo;.
          </p>
        )}
      </main>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
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
  },
  logo: {
    fontSize: '22px',
    fontFamily: "'Playfair Display', serif",
    color: '#ffc107',
    margin: 0,
  },
  backBtn: {
    padding: '8px 18px',
    backgroundColor: 'transparent',
    color: '#ffc107',
    border: '1px solid #ffc107',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
  main: {
    padding: '32px',
    maxWidth: '1100px',
    margin: '0 auto',
  },
  notice: {
    color: '#ffb300',
    fontSize: '13px',
    marginBottom: '24px',
    backgroundColor: 'rgba(255,193,7,0.1)',
    padding: '10px 14px',
    borderRadius: '6px',
    border: '1px solid rgba(255,193,7,0.3)',
  },
  searchInput: {
    width: '100%',
    padding: '10px 14px',
    border: '1px solid #444',
    borderRadius: '6px',
    backgroundColor: '#1a1a1a',
    color: '#fff',
    fontSize: '14px',
    marginBottom: '24px',
    boxSizing: 'border-box',
    outline: 'none',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '12px 16px',
    borderBottom: '2px solid #ffc107',
    color: '#ffc107',
    fontSize: '13px',
    fontWeight: '600',
    whiteSpace: 'nowrap',
  },
  tr: {
    borderBottom: '1px solid #2a2a2a',
  },
  td: {
    padding: '12px 16px',
    fontSize: '14px',
    color: '#ccc',
    verticalAlign: 'middle',
  },
};
