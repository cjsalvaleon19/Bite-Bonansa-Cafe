import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { supabase } from '../../utils/supabaseClient';

// ─── Admin: Reports Page ──────────────────────────────────────────────────────
// Shows a sales summary and a bar chart of daily revenue for the last 30 days.
// Auth-guarded: redirects to /login if no active session.

export default function ReportsPage() {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({ totalOrders: 0, totalRevenue: 0, avgOrder: 0 });
  const [chartData, setChartData] = useState([]);

  // ── Auth guard ──────────────────────────────────────────────────────────────
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
        setAuthLoading(false);
      } catch {
        if (mounted) { setAuthLoading(false); router.replace('/login'); }
      }
    }
    checkSession();
    return () => { mounted = false; };
  }, [router]);

  // ── Fetch order data ────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      // Retrieve orders for today plus the previous 29 days (inclusive 30-day window).
      const since = new Date();
      since.setDate(since.getDate() - 29);
      const { data, error } = await supabase
        .from('orders')
        .select('total, created_at')
        .gte('created_at', since.toISOString())
        .order('created_at');

      if (error || !data) return;

      // Compute summary
      const totalRevenue = data.reduce((s, o) => s + (Number(o.total) || 0), 0);
      setSummary({
        totalOrders: data.length,
        totalRevenue,
        avgOrder: data.length > 0 ? totalRevenue / data.length : 0,
      });

      // Aggregate by date (YYYY-MM-DD). Use Date parsing to safely handle both
      // ISO string and native Date object responses from Supabase.
      const byDate = {};
      data.forEach((o) => {
        const day = new Date(o.created_at).toISOString().slice(0, 10);
        byDate[day] = (byDate[day] || 0) + (Number(o.total) || 0);
      });
      setChartData(
        Object.entries(byDate)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, revenue]) => ({
            date: date.slice(5), // MM-DD for display
            revenue: Math.round(revenue * 100) / 100,
          })),
      );
    } catch { /* non-fatal */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) fetchData();
  }, [authLoading, fetchData]);

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
        <h1 style={styles.logo}>📊 Sales Reports</h1>
        <button style={styles.backBtn} onClick={() => router.push('/dashboard').catch(console.error)}>← Dashboard</button>
      </header>

      <main style={styles.main}>
        {!supabase && (
          <p style={styles.notice}>
            ⚠️ Supabase is not configured. Connect your database to view sales reports.
          </p>
        )}

        {loading && <p style={{ color: '#aaa', fontSize: '14px' }}>Loading reports…</p>}

        {/* ── Summary cards ──────────────────────────────────────────────── */}
        <div style={styles.cards}>
          <SummaryCard label="Total Orders (30d)" value={summary.totalOrders} />
          <SummaryCard label="Total Revenue (30d)" value={`₱${summary.totalRevenue.toFixed(2)}`} />
          <SummaryCard label="Average Order Value" value={`₱${summary.avgOrder.toFixed(2)}`} />
        </div>

        {/* ── Bar chart ──────────────────────────────────────────────────── */}
        <div style={styles.chartBox}>
          <h2 style={styles.chartTitle}>Daily Revenue — Last 30 Days</h2>
          {chartData.length === 0 && !loading ? (
            <p style={{ color: '#aaa', fontSize: '14px' }}>
              {supabase ? 'No order data available for the last 30 days.' : ''}
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#888', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#333' }}
                />
                <YAxis
                  tick={{ fill: '#888', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#333' }}
                  tickFormatter={(v) => `₱${v}`}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #ffc107', borderRadius: '6px' }}
                  labelStyle={{ color: '#ffc107', fontSize: '12px' }}
                  itemStyle={{ color: '#fff', fontSize: '12px' }}
                  formatter={(v) => [`₱${v.toFixed(2)}`, 'Revenue']}
                />
                <Bar dataKey="revenue" fill="#ffc107" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </main>
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div style={styles.card}>
      <span style={styles.cardLabel}>{label}</span>
      <span style={styles.cardValue}>{value}</span>
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
    maxWidth: '1000px',
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
  cards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '20px',
    marginBottom: '32px',
  },
  card: {
    backgroundColor: '#1a1a1a',
    border: '1px solid #ffc107',
    borderRadius: '12px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  cardLabel: {
    fontSize: '12px',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  cardValue: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#ffc107',
    fontFamily: "'Playfair Display', serif",
  },
  chartBox: {
    backgroundColor: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '12px',
    padding: '24px',
  },
  chartTitle: {
    fontSize: '16px',
    color: '#ccc',
    marginTop: 0,
    marginBottom: '20px',
    fontFamily: "'Poppins', sans-serif",
    fontWeight: '600',
  },
};
