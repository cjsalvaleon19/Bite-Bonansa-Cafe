import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../../utils/supabaseClient';

const S = {
  page: { minHeight: '100vh', background: '#0a0a0a', fontFamily: "'Poppins', sans-serif", color: '#fff' },
  nav: {
    background: '#1a1a1a', borderBottom: '1px solid #333', padding: '0 24px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '56px',
  },
  logo: { color: '#ffc107', fontFamily: "'Playfair Display', serif", fontSize: '20px', fontWeight: 'bold' },
  btn: (color = '#ffc107') => ({
    padding: '8px 16px', backgroundColor: color, color: color === '#ffc107' ? '#0a0a0a' : '#fff',
    border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  }),
  card: { background: '#1a1a1a', border: '1px solid #333', borderRadius: '10px', padding: '20px' },
  input: {
    padding: '10px 12px', background: '#2a2a2a', border: '1px solid #444',
    borderRadius: '6px', color: '#fff', fontSize: '13px',
    fontFamily: "'Poppins', sans-serif",
  },
  label: { display: 'block', marginBottom: '6px', color: '#ffc107', fontSize: '12px', fontWeight: '600' },
  tab: (active) => ({
    padding: '10px 24px', cursor: 'pointer', border: 'none', background: 'transparent',
    color: active ? '#ffc107' : '#999', borderBottom: active ? '2px solid #ffc107' : '2px solid transparent',
    fontSize: '14px', fontWeight: active ? '700' : '400', fontFamily: "'Poppins', sans-serif",
  }),
};

function NavBar() {
  const logout = async () => { await supabase.auth.signOut(); window.location.href = '/login'; };
  return (
    <nav style={S.nav}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span style={S.logo}>☕ Bite Bonansa</span>
        <Link href="/admin" style={{ color: '#999', fontSize: '13px', textDecoration: 'none' }}>← Admin</Link>
      </div>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={() => window.print()} style={S.btn('#333')}>🖨️ Print</button>
        <button onClick={logout} style={S.btn('#444')}>Logout</button>
      </div>
    </nav>
  );
}

const today = new Date().toISOString().split('T')[0];
const weekStart = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0];
const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

function StatCard({ label, value, color = '#fff', icon }) {
  return (
    <div style={{ ...S.card, textAlign: 'center' }}>
      <div style={{ fontSize: '28px', marginBottom: '8px' }}>{icon}</div>
      <div style={{ fontSize: '22px', fontWeight: '700', color, marginBottom: '4px' }}>{value}</div>
      <div style={{ color: '#999', fontSize: '13px' }}>{label}</div>
    </div>
  );
}

export default function FinancialReports() {
  const [activeTab, setActiveTab] = useState('income_statement');
  const [period, setPeriod] = useState('today');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) window.location.href = '/login';
    });
  }, []);

  const applyPreset = (preset) => {
    setPeriod(preset);
    if (preset === 'today') { setStartDate(today); setEndDate(today); }
    else if (preset === 'week') { setStartDate(weekStart); setEndDate(today); }
    else if (preset === 'month') { setStartDate(monthStart); setEndDate(today); }
  };

  const fetchReport = async () => {
    setLoading(true);
    const url = `/api/financial-reports?type=${activeTab}&startDate=${startDate}&endDate=${endDate}`;
    const resp = await fetch(url);
    const data = await resp.json();
    setReport(data);
    setLoading(false);
  };

  useEffect(() => { fetchReport(); }, [activeTab, startDate, endDate]);

  const fmt = (v) => `₱${parseFloat(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div style={S.page}>
      <style>{`@media print { nav, .no-print { display: none !important; } body { background: white; color: black; } }`}</style>
      <NavBar />

      <div style={{ padding: '28px', maxWidth: '1000px', margin: '0 auto' }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", color: '#ffc107', marginBottom: '8px', fontSize: '28px' }}>
          📊 Financial Reports
        </h1>

        {/* Report Type Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #333', marginBottom: '24px' }} className="no-print">
          <button style={S.tab(activeTab === 'income_statement')} onClick={() => setActiveTab('income_statement')}>Income Statement</button>
          <button style={S.tab(activeTab === 'balance_sheet')} onClick={() => setActiveTab('balance_sheet')}>Balance Sheet</button>
        </div>

        {/* Period Picker */}
        <div style={{ ...S.card, marginBottom: '24px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }} className="no-print">
          <span style={{ color: '#ffc107', fontSize: '13px', fontWeight: '600' }}>Period:</span>
          {['today', 'week', 'month', 'custom'].map(p => (
            <button key={p} onClick={() => applyPreset(p)} style={{
              padding: '6px 14px', borderRadius: '4px', border: '1px solid',
              borderColor: period === p ? '#ffc107' : '#444',
              background: period === p ? '#ffc107' : 'transparent',
              color: period === p ? '#0a0a0a' : '#999', cursor: 'pointer', fontSize: '12px', textTransform: 'capitalize',
            }}>{p === 'today' ? 'Today' : p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'Custom'}</button>
          ))}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPeriod('custom'); }}
              style={{ ...S.input, padding: '6px 10px' }} />
            <span style={{ color: '#999' }}>to</span>
            <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPeriod('custom'); }}
              style={{ ...S.input, padding: '6px 10px' }} />
            <button onClick={fetchReport} style={S.btn()}>Generate</button>
          </div>
        </div>

        {/* Report Period Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <p style={{ color: '#999', fontSize: '14px' }}>
            {startDate === endDate ? `As of ${new Date(startDate).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}`
              : `${new Date(startDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })} — ${new Date(endDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`
            }
          </p>
        </div>

        {loading && <div style={{ textAlign: 'center', color: '#999', padding: '40px' }}>Loading report...</div>}

        {!loading && report && activeTab === 'income_statement' && (
          <>
            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
              <StatCard icon="💰" label="Sales Revenue" value={fmt(report.sales)} color="#4caf50" />
              <StatCard icon="📉" label="Gross Profit" value={fmt(report.grossProfit)} color={report.grossProfit >= 0 ? '#4caf50' : '#f44336'} />
              <StatCard icon="📈" label="Net Income" value={fmt(report.netIncome)} color={report.netIncome >= 0 ? '#ffc107' : '#f44336'} />
            </div>

            {/* Income Statement Table */}
            <div style={S.card}>
              <h2 style={{ fontFamily: "'Playfair Display', serif", color: '#ffc107', marginBottom: '20px', fontSize: '20px' }}>
                Income Statement
              </h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <tbody>
                  {[
                    { label: 'Sales Revenue', value: report.sales, indent: false, bold: false },
                    { label: 'Cost of Goods Sold (COGS)', value: -report.cogs, indent: true, color: '#f44336' },
                    { label: 'Gross Profit', value: report.grossProfit, bold: true, borderTop: true },
                    { label: 'Operating Expenses', value: -report.operatingExpenses, indent: true, color: '#f44336' },
                    { label: 'Net Income', value: report.netIncome, bold: true, borderTop: true, fontSize: '16px', color: report.netIncome >= 0 ? '#4caf50' : '#f44336' },
                  ].map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #222' }}>
                      <td style={{ padding: `${row.borderTop ? '14px' : '10px'} 12px ${row.borderTop ? '14px' : '10px'} ${row.indent ? '28px' : '12px'}`, fontWeight: row.bold ? '700' : '400', borderTop: row.borderTop ? '2px solid #333' : 'none', fontSize: row.fontSize || '14px' }}>
                        {row.label}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: row.bold ? '700' : '400', color: row.color || '#fff', fontSize: row.fontSize || '14px', borderTop: row.borderTop ? '2px solid #333' : 'none' }}>
                        {fmt(Math.abs(row.value))}{row.value < 0 ? ' (expense)' : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Department Breakdown */}
              {Object.keys(report.departmentBreakdown || {}).length > 0 && (
                <div style={{ marginTop: '28px' }}>
                  <h3 style={{ color: '#ffc107', marginBottom: '14px', fontSize: '15px' }}>Department Breakdown</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #333' }}>
                        <th style={{ textAlign: 'left', padding: '8px 12px', color: '#ffc107' }}>Department</th>
                        <th style={{ textAlign: 'right', padding: '8px 12px', color: '#ffc107' }}>Revenue</th>
                        <th style={{ textAlign: 'right', padding: '8px 12px', color: '#ffc107' }}>Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(report.departmentBreakdown).map(([dept, amt]) => (
                        <tr key={dept} style={{ borderBottom: '1px solid #222' }}>
                          <td style={{ padding: '10px 12px' }}>{dept}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: '#4caf50' }}>{fmt(amt)}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: '#999' }}>
                            {report.sales > 0 ? ((amt / report.sales) * 100).toFixed(1) : 0}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {!loading && report && activeTab === 'balance_sheet' && (
          <div style={S.card}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", color: '#ffc107', marginBottom: '20px', fontSize: '20px' }}>
              Balance Sheet
            </h2>

            {/* Assets */}
            <h3 style={{ color: '#4caf50', marginBottom: '10px', fontSize: '15px' }}>ASSETS</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', marginBottom: '24px' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #222' }}>
                  <td style={{ padding: '10px 12px 10px 28px', color: '#999' }}>Cash (from sales)</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#4caf50' }}>{fmt(report.assets?.cash)}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #222' }}>
                  <td style={{ padding: '10px 12px 10px 28px', color: '#999' }}>Inventory (raw materials at cost)</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#4caf50' }}>{fmt(report.assets?.inventory)}</td>
                </tr>
                <tr style={{ borderTop: '2px solid #333' }}>
                  <td style={{ padding: '14px 12px', fontWeight: '700' }}>Total Assets</td>
                  <td style={{ padding: '14px 12px', textAlign: 'right', fontWeight: '700', color: '#4caf50', fontSize: '16px' }}>{fmt(report.assets?.total)}</td>
                </tr>
              </tbody>
            </table>

            {/* Liabilities */}
            <h3 style={{ color: '#f44336', marginBottom: '10px', fontSize: '15px' }}>LIABILITIES</h3>
            <div style={{ padding: '14px', background: '#2a2a2a', borderRadius: '6px', marginBottom: '24px', fontSize: '13px', color: '#999' }}>
              {report.liabilities?.notes} — Total: {fmt(report.liabilities?.total)}
            </div>

            {/* Equity */}
            <h3 style={{ color: '#ffc107', marginBottom: '10px', fontSize: '15px' }}>EQUITY</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <tbody>
                <tr style={{ borderTop: '2px solid #333' }}>
                  <td style={{ padding: '14px 12px', fontWeight: '700' }}>Total Equity</td>
                  <td style={{ padding: '14px 12px', textAlign: 'right', fontWeight: '700', color: '#ffc107', fontSize: '16px' }}>{fmt(report.equity?.total)}</td>
                </tr>
                <tr>
                  <td colSpan="2" style={{ padding: '8px 12px', color: '#666', fontSize: '12px' }}>{report.equity?.notes}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
