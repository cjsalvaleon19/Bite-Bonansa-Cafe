import React, { useState, useEffect } from 'react';
import Link from 'next/link';

const bg = '#0a0a0a', card = '#1a1a1a', accent = '#ffc107', text = '#fff', muted = '#999';
const inputStyle = { width: '100%', background: '#111', border: '1px solid #333', color: '#fff', padding: '10px 14px', borderRadius: '6px', fontFamily: "'Poppins', sans-serif", fontSize: '14px', boxSizing: 'border-box' };
const btn = (bg2='#ffc107', color='#000') => ({ background: bg2, color, border: 'none', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", fontWeight: '600', fontSize: '13px' });

export default function AdminDepartments() {
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState({ name: '', printer_id: '' });
  const [msg, setMsg] = useState('');

  useEffect(() => { fetchDepts(); }, []);
  const fetchDepts = async () => {
    const r = await fetch('/api/departments');
    const data = await r.json();
    setDepartments(Array.isArray(data) ? data : []);
  };

  const handleAdd = async () => {
    if (!form.name) return;
    const r = await fetch('/api/departments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const data = await r.json();
    if (data.id) { setMsg('✅ Department added!'); fetchDepts(); setForm({ name: '', printer_id: '' }); }
    else setMsg('❌ ' + (data.error || 'Failed'));
    setTimeout(() => setMsg(''), 3000);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this department?')) return;
    await fetch(`/api/departments?id=${id}`, { method: 'DELETE' });
    fetchDepts();
  };

  return (
    <div style={{ minHeight: '100vh', background: bg, fontFamily: "'Poppins', sans-serif", padding: '24px' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={{ color: accent, fontFamily: "'Playfair Display', serif", fontSize: '28px', margin: 0 }}>🏪 Kitchen Departments</h1>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {msg && <span style={{ color: accent, fontSize: '13px' }}>{msg}</span>}
            <Link href="/admin" style={{ color: muted, fontSize: '14px', textDecoration: 'none' }}>← Admin</Link>
          </div>
        </div>
        <div style={{ background: card, border: '1px solid #ffc107', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
          <h3 style={{ color: text, marginTop: 0 }}>Add Department</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div><label style={{ color: muted, fontSize: '12px' }}>Name *</label><input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} placeholder="e.g. Fryer 3" style={{ ...inputStyle, marginTop: '4px' }} /></div>
            <div><label style={{ color: muted, fontSize: '12px' }}>Printer ID (optional)</label><input value={form.printer_id} onChange={e => setForm(p => ({...p, printer_id: e.target.value}))} placeholder="e.g. printer-01" style={{ ...inputStyle, marginTop: '4px' }} /></div>
          </div>
          <button onClick={handleAdd} style={btn()}>+ Add Department</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
          {departments.map(d => (
            <div key={d.id} style={{ background: card, border: '1px solid #333', borderRadius: '10px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: text, fontWeight: '600', fontSize: '15px' }}>{d.name}</div>
                {d.printer_id && <div style={{ color: muted, fontSize: '12px', marginTop: '4px' }}>🖨️ {d.printer_id}</div>}
              </div>
              <button onClick={() => handleDelete(d.id)} style={{ ...btn('#ef4444', '#fff'), padding: '4px 8px' }}>🗑️</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
