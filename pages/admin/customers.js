import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatPoints } from '../../utils/loyaltyUtils';

const bg = '#0a0a0a', card = '#1a1a1a', accent = '#ffc107', text = '#fff', muted = '#999';
const inputStyle = { background: '#111', border: '1px solid #333', color: '#fff', padding: '10px 14px', borderRadius: '6px', fontFamily: "'Poppins', sans-serif", fontSize: '14px', boxSizing: 'border-box' };
const btn = (bg2='#ffc107', color='#000') => ({ background: bg2, color, border: 'none', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", fontWeight: '600', fontSize: '13px' });

export default function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', phone: '' });
  const [msg, setMsg] = useState('');

  useEffect(() => { fetchCustomers(); }, []);

  const fetchCustomers = async (q = '') => {
    const url = q ? `/api/customers?search=${q}` : '/api/customers';
    const r = await fetch(url);
    const data = await r.json();
    setCustomers(Array.isArray(data) ? data : []);
  };

  const handleSearch = (q) => { setSearch(q); fetchCustomers(q); };

  const handleAdd = async () => {
    if (!form.full_name) { setMsg('❌ Name required'); return; }
    const r = await fetch('/api/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const data = await r.json();
    if (data.id) { setMsg(`✅ Customer created: ${data.customer_id}`); fetchCustomers(); setShowAdd(false); setForm({ full_name: '', email: '', phone: '' }); }
    else setMsg('❌ ' + (data.error || 'Failed'));
    setTimeout(() => setMsg(''), 4000);
  };

  return (
    <div style={{ minHeight: '100vh', background: bg, fontFamily: "'Poppins', sans-serif", padding: '24px' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={{ color: accent, fontFamily: "'Playfair Display', serif", fontSize: '28px', margin: 0 }}>👥 Customer Management</h1>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {msg && <span style={{ color: accent, fontSize: '13px' }}>{msg}</span>}
            <button onClick={() => setShowAdd(!showAdd)} style={btn()}>+ Add Customer</button>
            <Link href="/admin" style={{ color: muted, fontSize: '14px', textDecoration: 'none' }}>← Admin</Link>
          </div>
        </div>

        <input value={search} onChange={e => handleSearch(e.target.value)} placeholder="🔍 Search by name..." style={{ ...inputStyle, marginBottom: '20px', maxWidth: '400px', width: '100%' }} />

        {showAdd && (
          <div style={{ background: card, border: '1px solid #ffc107', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
            <h3 style={{ color: text, marginTop: 0 }}>Add New Customer</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div><label style={{ color: muted, fontSize: '12px' }}>Full Name *</label><input value={form.full_name} onChange={e => setForm(p => ({...p, full_name: e.target.value}))} style={{ ...inputStyle, marginTop: '4px', width: '100%' }} /></div>
              <div><label style={{ color: muted, fontSize: '12px' }}>Email</label><input type="email" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} style={{ ...inputStyle, marginTop: '4px', width: '100%' }} /></div>
              <div><label style={{ color: muted, fontSize: '12px' }}>Phone</label><input value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))} style={{ ...inputStyle, marginTop: '4px', width: '100%' }} /></div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={handleAdd} style={btn()}>✅ Create</button>
              <button onClick={() => setShowAdd(false)} style={btn('#333', '#fff')}>Cancel</button>
            </div>
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #333' }}>
                {['Customer ID', 'Name', 'Email', 'Phone', 'Points Balance', 'Total Spent', 'Since'].map(h => (
                  <th key={h} style={{ color: muted, fontSize: '12px', padding: '10px 12px', textAlign: 'left', fontWeight: '500' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid #222' }}>
                  <td style={{ color: accent, padding: '12px', fontSize: '13px', fontFamily: 'monospace' }}>{c.customer_id}</td>
                  <td style={{ color: text, padding: '12px', fontSize: '14px' }}>{c.full_name}</td>
                  <td style={{ color: muted, padding: '12px', fontSize: '13px' }}>{c.email || '-'}</td>
                  <td style={{ color: muted, padding: '12px', fontSize: '13px' }}>{c.phone || '-'}</td>
                  <td style={{ color: '#4ade80', padding: '12px', fontSize: '13px', fontWeight: '600' }}>{formatPoints(c.points_balance)} pts</td>
                  <td style={{ color: accent, padding: '12px', fontSize: '13px' }}>₱{Number(c.total_spent || 0).toLocaleString('en-PH')}</td>
                  <td style={{ color: muted, padding: '12px', fontSize: '12px' }}>{new Date(c.created_at).toLocaleDateString('en-PH')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {customers.length === 0 && <p style={{ color: muted, textAlign: 'center', marginTop: '40px' }}>No customers yet.</p>}
        </div>
      </div>
    </div>
  );
}
