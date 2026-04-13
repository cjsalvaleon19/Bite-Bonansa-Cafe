import React, { useState, useEffect } from 'react';
import Link from 'next/link';

const bg = '#0a0a0a', card = '#1a1a1a', accent = '#ffc107', text = '#fff', muted = '#999';
const inputStyle = { width: '100%', background: '#111', border: '1px solid #333', color: '#fff', padding: '10px 14px', borderRadius: '6px', fontFamily: "'Poppins', sans-serif", fontSize: '14px', boxSizing: 'border-box' };
const btn = (bg2='#ffc107', color='#000') => ({ background: bg2, color, border: 'none', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", fontWeight: '600', fontSize: '13px' });

const UNITS = ['grams', 'kg', 'ml', 'liters', 'pcs', 'cups', 'tbsp', 'tsp', 'hours', 'bags', 'boxes'];

export default function AdminInventory() {
  const [materials, setMaterials] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showRestock, setShowRestock] = useState(null);
  const [form, setForm] = useState({ name: '', unit: 'grams', quantity_on_hand: 0, cost_per_unit: 0, reorder_point: 0, supplier: '' });
  const [restockForm, setRestockForm] = useState({ new_qty: 0, new_cost: 0 });
  const [msg, setMsg] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => { fetchMaterials(); }, []);

  const fetchMaterials = async (q = '') => {
    const url = q ? `/api/raw-materials?search=${q}` : '/api/raw-materials';
    const r = await fetch(url);
    const data = await r.json();
    setMaterials(Array.isArray(data) ? data : []);
  };

  const handleSearch = (q) => { setSearch(q); fetchMaterials(q); };

  const handleAdd = async () => {
    if (!form.name) { setMsg('❌ Name required'); return; }
    const r = await fetch('/api/raw-materials', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const data = await r.json();
    if (data.id) { setMsg('✅ Added!'); fetchMaterials(); setShowAdd(false); setForm({ name: '', unit: 'grams', quantity_on_hand: 0, cost_per_unit: 0, reorder_point: 0, supplier: '' }); }
    else setMsg('❌ ' + (data.error || 'Failed'));
    setTimeout(() => setMsg(''), 3000);
  };

  const handleRestock = async (id) => {
    const r = await fetch('/api/raw-materials', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, new_qty: Number(restockForm.new_qty), new_cost: Number(restockForm.new_cost) }) });
    const data = await r.json();
    if (data.id) { setMsg('✅ Restocked with average cost!'); fetchMaterials(); setShowRestock(null); }
    else setMsg('❌ ' + (data.error || 'Failed'));
    setTimeout(() => setMsg(''), 3000);
  };

  const deleteMaterial = async (id) => {
    if (!confirm('Delete this material?')) return;
    await fetch(`/api/raw-materials?id=${id}`, { method: 'DELETE' });
    fetchMaterials();
  };

  return (
    <div style={{ minHeight: '100vh', background: bg, fontFamily: "'Poppins', sans-serif", padding: '24px' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={{ color: accent, fontFamily: "'Playfair Display', serif", fontSize: '28px', margin: 0 }}>📦 Raw Materials Inventory</h1>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {msg && <span style={{ color: accent, fontSize: '13px' }}>{msg}</span>}
            <button onClick={() => setShowAdd(!showAdd)} style={btn()}>+ Add Material</button>
            <Link href="/admin" style={{ color: muted, fontSize: '14px', textDecoration: 'none' }}>← Admin</Link>
          </div>
        </div>

        <input value={search} onChange={e => handleSearch(e.target.value)} placeholder="🔍 Search materials..." style={{ ...inputStyle, marginBottom: '20px', maxWidth: '400px' }} />

        {showAdd && (
          <div style={{ background: card, border: '1px solid #ffc107', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
            <h3 style={{ color: text, marginTop: 0 }}>Add Raw Material</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div><label style={{ color: muted, fontSize: '12px' }}>Name *</label><input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} style={{ ...inputStyle, marginTop: '4px' }} /></div>
              <div><label style={{ color: muted, fontSize: '12px' }}>Unit</label>
                <select value={form.unit} onChange={e => setForm(p => ({...p, unit: e.target.value}))} style={{ ...inputStyle, marginTop: '4px' }}>
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div><label style={{ color: muted, fontSize: '12px' }}>Qty on Hand</label><input type="number" value={form.quantity_on_hand} onChange={e => setForm(p => ({...p, quantity_on_hand: e.target.value}))} style={{ ...inputStyle, marginTop: '4px' }} /></div>
              <div><label style={{ color: muted, fontSize: '12px' }}>Cost per Unit (₱)</label><input type="number" value={form.cost_per_unit} onChange={e => setForm(p => ({...p, cost_per_unit: e.target.value}))} style={{ ...inputStyle, marginTop: '4px' }} /></div>
              <div><label style={{ color: muted, fontSize: '12px' }}>Reorder Point</label><input type="number" value={form.reorder_point} onChange={e => setForm(p => ({...p, reorder_point: e.target.value}))} style={{ ...inputStyle, marginTop: '4px' }} /></div>
              <div><label style={{ color: muted, fontSize: '12px' }}>Supplier</label><input value={form.supplier} onChange={e => setForm(p => ({...p, supplier: e.target.value}))} style={{ ...inputStyle, marginTop: '4px' }} /></div>
            </div>
            <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
              <button onClick={handleAdd} style={btn()}>✅ Save</button>
              <button onClick={() => setShowAdd(false)} style={btn('#333', '#fff')}>Cancel</button>
            </div>
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #333' }}>
                {['Name', 'Unit', 'Qty on Hand', 'Cost/Unit', 'Inv. Value', 'Reorder Pt', 'Supplier', 'Actions'].map(h => (
                  <th key={h} style={{ color: muted, fontSize: '12px', padding: '10px 12px', textAlign: 'left', fontWeight: '500' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {materials.map(m => {
                const lowStock = Number(m.quantity_on_hand) <= Number(m.reorder_point);
                return (
                  <tr key={m.id} style={{ borderBottom: '1px solid #222' }}>
                    <td style={{ color: text, padding: '12px', fontSize: '14px' }}>
                      {m.name}
                      {lowStock && <span style={{ color: '#ef4444', fontSize: '11px', marginLeft: '6px' }}>⚠️ Low</span>}
                    </td>
                    <td style={{ color: muted, padding: '12px', fontSize: '13px' }}>{m.unit}</td>
                    <td style={{ color: lowStock ? '#ef4444' : text, padding: '12px', fontSize: '13px' }}>{Number(m.quantity_on_hand).toFixed(2)}</td>
                    <td style={{ color: accent, padding: '12px', fontSize: '13px' }}>₱{Number(m.cost_per_unit).toFixed(4)}</td>
                    <td style={{ color: '#4ade80', padding: '12px', fontSize: '13px' }}>₱{(Number(m.quantity_on_hand) * Number(m.cost_per_unit)).toFixed(2)}</td>
                    <td style={{ color: muted, padding: '12px', fontSize: '13px' }}>{m.reorder_point}</td>
                    <td style={{ color: muted, padding: '12px', fontSize: '13px' }}>{m.supplier || '-'}</td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => { setShowRestock(m.id); setRestockForm({ new_qty: 0, new_cost: m.cost_per_unit }); }} style={{ ...btn('#4ade80', '#000'), padding: '4px 8px', fontSize: '11px' }}>📦 Restock</button>
                        <button onClick={() => deleteMaterial(m.id)} style={{ ...btn('#ef4444', '#fff'), padding: '4px 8px', fontSize: '11px' }}>🗑️</button>
                      </div>
                      {showRestock === m.id && (
                        <div style={{ marginTop: '8px', background: '#111', border: '1px solid #333', borderRadius: '6px', padding: '10px' }}>
                          <div style={{ fontSize: '11px', color: muted, marginBottom: '6px' }}>Average Cost Restock</div>
                          <input type="number" value={restockForm.new_qty} onChange={e => setRestockForm(p => ({...p, new_qty: e.target.value}))} placeholder="New Qty" style={{ ...inputStyle, padding: '4px 8px', fontSize: '12px', marginBottom: '4px' }} />
                          <input type="number" value={restockForm.new_cost} onChange={e => setRestockForm(p => ({...p, new_cost: e.target.value}))} placeholder="New Cost/Unit" style={{ ...inputStyle, padding: '4px 8px', fontSize: '12px', marginBottom: '6px' }} />
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button onClick={() => handleRestock(m.id)} style={{ ...btn(), padding: '4px 8px', fontSize: '11px' }}>Save</button>
                            <button onClick={() => setShowRestock(null)} style={{ ...btn('#333', '#fff'), padding: '4px 8px', fontSize: '11px' }}>Cancel</button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {materials.length === 0 && <p style={{ color: muted, textAlign: 'center', marginTop: '40px' }}>No materials. Click "+ Add Material" to start.</p>}
        </div>
      </div>
    </div>
  );
}
