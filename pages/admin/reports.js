import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const bg = '#0a0a0a', card = '#1a1a1a', accent = '#ffc107', text = '#fff', muted = '#999';
const btn = (bg2='#ffc107', color='#000') => ({ background: bg2, color, border: 'none', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", fontWeight: '600', fontSize: '13px' });
const inputStyle = { background: '#111', border: '1px solid #333', color: '#fff', padding: '8px 12px', borderRadius: '6px', fontFamily: "'Poppins', sans-serif", fontSize: '13px' };

function Row({ label, value, indent = 0, bold = false, color = '#fff' }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #222', paddingLeft: indent * 16 }}>
      <span style={{ color: bold ? text : muted, fontWeight: bold ? '600' : '400', fontSize: '14px' }}>{label}</span>
      <span style={{ color: color, fontWeight: bold ? '600' : '400', fontSize: '14px' }}>₱{Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
    </div>
  );
}

function getDefaultDates() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const end = now.toISOString().slice(0, 10);
  return { start, end };
}

export default function AdminReports() {
  const [reportType, setReportType] = useState('income_statement');
  const [dates, setDates] = useState(getDefaultDates());
  const [data, setData] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    const r = await fetch(`/api/reports?type=${reportType}&start_date=${dates.start}&end_date=${dates.end}`);
    const d = await r.json();
    setData(d);
    const cr = await fetch(`/api/reports?type=daily_sales&start_date=${dates.start}&end_date=${dates.end}`);
    const cd = await cr.json();
    const grouped = {};
    (Array.isArray(cd) ? cd : []).forEach(t => {
      grouped[t.transaction_date] = (grouped[t.transaction_date] || 0) + Number(t.amount);
    });
    setChartData(Object.entries(grouped).map(([date, amount]) => ({ date: date.slice(5), amount })));
    setLoading(false);
  };

  useEffect(() => { fetchReport(); }, []);

  const setPreset = (preset) => {
    const now = new Date();
    let start;
    if (preset === 'today') start = now.toISOString().slice(0, 10);
    else if (preset === 'week') { const d = new Date(now); d.setDate(d.getDate() - 7); start = d.toISOString().slice(0, 10); }
    else if (preset === 'month') start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    else if (preset === 'year') start = `${now.getFullYear()}-01-01`;
    setDates({ start, end: now.toISOString().slice(0, 10) });
  };

  return (
    <div style={{ minHeight: '100vh', background: bg, fontFamily: "'Poppins', sans-serif", padding: '24px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={{ color: accent, fontFamily: "'Playfair Display', serif", fontSize: '28px', margin: 0 }}>📊 Financial Reports</h1>
          <Link href="/admin" style={{ color: muted, fontSize: '14px', textDecoration: 'none' }}>← Admin</Link>
        </div>

        <div style={{ background: card, border: '1px solid #333', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['income_statement', 'balance_sheet'].map(t => (
                <button key={t} onClick={() => setReportType(t)} style={btn(reportType === t ? accent : '#333', reportType === t ? '#000' : '#fff')}>
                  {t === 'income_statement' ? '📈 Income Statement' : '⚖️ Balance Sheet'}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ color: muted, fontSize: '13px' }}>From:</span>
              <input type="date" value={dates.start} onChange={e => setDates(p => ({...p, start: e.target.value}))} style={inputStyle} />
              <span style={{ color: muted, fontSize: '13px' }}>To:</span>
              <input type="date" value={dates.end} onChange={e => setDates(p => ({...p, end: e.target.value}))} style={inputStyle} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['today','week','month','year'].map(p => (
                <button key={p} onClick={() => setPreset(p)} style={{ ...btn('#222', '#fff'), padding: '6px 10px', fontSize: '12px' }}>{p}</button>
              ))}
            </div>
            <button onClick={fetchReport} disabled={loading} style={btn()}>
              {loading ? '⏳' : '🔄 Generate'}
            </button>
          </div>
        </div>

        {chartData.length > 0 && (
          <div style={{ background: card, border: '1px solid #333', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
            <h3 style={{ color: text, marginTop: 0, fontSize: '16px' }}>Daily Sales</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="date" stroke={muted} tick={{ fontSize: 11 }} />
                <YAxis stroke={muted} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #ffc107', color: '#fff' }} formatter={(v) => [`₱${Number(v).toFixed(2)}`, 'Sales']} />
                <Bar dataKey="amount" fill={accent} radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {data && (
          <div style={{ background: card, border: '1px solid #333', borderRadius: '12px', padding: '28px' }}>
            {reportType === 'income_statement' && data.period && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <h2 style={{ color: accent, margin: 0, fontFamily: "'Playfair Display', serif" }}>Income Statement</h2>
                  <span style={{ color: muted, fontSize: '13px' }}>{data.period.start_date} to {data.period.end_date}</span>
                </div>
                <Row label="Sales Revenue" value={data.sales_revenue} bold color={accent} />
                <Row label="Cost of Goods Sold (COGS)" value={data.cogs} indent={1} color="#ef4444" />
                <Row label="Gross Profit" value={data.gross_profit} bold color={data.gross_profit >= 0 ? '#4ade80' : '#ef4444'} />
                <Row label="Operating Expenses" value={data.operating_expenses} indent={1} color="#ef4444" />
                <div style={{ height: '1px', background: '#555', margin: '8px 0' }} />
                <Row label="NET INCOME" value={data.net_income} bold color={data.net_income >= 0 ? '#4ade80' : '#ef4444'} />
              </>
            )}
            {reportType === 'balance_sheet' && data.assets && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <h2 style={{ color: accent, margin: 0, fontFamily: "'Playfair Display', serif" }}>Balance Sheet</h2>
                  <span style={{ color: muted, fontSize: '13px' }}>As of {data.as_of}</span>
                </div>
                <h4 style={{ color: text, margin: '16px 0 8px' }}>ASSETS</h4>
                <Row label="Cash" value={data.assets.cash} indent={1} />
                <Row label="Inventory (at average cost)" value={data.assets.inventory} indent={1} />
                <Row label="Total Assets" value={data.assets.total_assets} bold color={accent} />
                <h4 style={{ color: text, margin: '16px 0 8px' }}>LIABILITIES</h4>
                <Row label="Accounts Payable" value={data.liabilities.accounts_payable} indent={1} />
                <h4 style={{ color: text, margin: '16px 0 8px' }}>EQUITY</h4>
                <Row label="Retained Earnings" value={data.equity.retained_earnings} indent={1} color={data.equity.retained_earnings >= 0 ? '#4ade80' : '#ef4444'} />
                <Row label="Total Equity" value={data.equity.total_equity} bold color={data.equity.total_equity >= 0 ? '#4ade80' : '#ef4444'} />
              </>
            )}
            <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
              <button onClick={() => window.print()} style={btn()}>🖨️ Print / Export PDF</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
