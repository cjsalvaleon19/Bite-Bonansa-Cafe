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
  outlineBtn: (color = '#ffc107') => ({
    padding: '6px 12px', background: 'transparent', color: color,
    border: `1px solid ${color}`, borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
  }),
  card: { background: '#1a1a1a', border: '1px solid #333', borderRadius: '10px', padding: '20px' },
  input: {
    width: '100%', padding: '10px 12px', background: '#2a2a2a', border: '1px solid #444',
    borderRadius: '6px', color: '#fff', fontSize: '13px', boxSizing: 'border-box',
    fontFamily: "'Poppins', sans-serif",
  },
  label: { display: 'block', marginBottom: '6px', color: '#ffc107', fontSize: '12px', fontWeight: '600' },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000,
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '20px',
  },
  modal: {
    background: '#1a1a1a', border: '1px solid #333', borderRadius: '12px',
    padding: '28px', width: '100%', maxWidth: '600px', marginTop: '20px',
  },
};

const emptyForm = { name: '', unit: '', quantity_on_hand: '', cost_per_unit: '', reorder_point: '', supplier: '' };

function NavBar() {
  const logout = async () => { await supabase.auth.signOut(); window.location.href = '/login'; };
  return (
    <nav style={S.nav}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span style={S.logo}>☕ Bite Bonansa</span>
        <Link href="/admin" style={{ color: '#999', fontSize: '13px', textDecoration: 'none' }}>← Admin</Link>
      </div>
      <button onClick={logout} style={S.btn('#333')}>Logout</button>
    </nav>
  );
}

export default function RawMaterialsPage() {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [historyItem, setHistoryItem] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchMaterials = () => {
    setLoading(true);
    fetch('/api/raw-materials')
      .then(r => r.json())
      .then(d => { setMaterials(d.data || []); setLoading(false); });
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) window.location.href = '/login';
    });
    fetchMaterials();
  }, []);

  const openAdd = () => { setEditItem(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (item) => {
    setEditItem(item);
    setForm({ name: item.name, unit: item.unit || '', quantity_on_hand: item.quantity_on_hand, cost_per_unit: item.cost_per_unit, reorder_point: item.reorder_point || 0, supplier: item.supplier || '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name) { setMsg({ text: 'Name is required', type: 'error' }); return; }
    setSaving(true);
    const method = editItem ? 'PUT' : 'POST';
    const payload = { ...form };
    if (editItem) payload.id = editItem.id;
    const resp = await fetch('/api/raw-materials', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await resp.json();
    setSaving(false);
    if (resp.ok) {
      setMsg({ text: editItem ? 'Updated!' : 'Created!', type: 'success' });
      setShowModal(false);
      fetchMaterials();
    } else {
      setMsg({ text: result.error || 'Save failed', type: 'error' });
    }
    setTimeout(() => setMsg({ text: '', type: '' }), 3000);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this raw material?')) return;
    const resp = await fetch(`/api/raw-materials?id=${id}`, { method: 'DELETE' });
    if (resp.ok) { setMsg({ text: 'Deleted!', type: 'success' }); fetchMaterials(); }
    else setMsg({ text: 'Delete failed', type: 'error' });
    setTimeout(() => setMsg({ text: '', type: '' }), 3000);
  };

  const showHistory = async (item) => {
    setHistoryItem(item);
    setHistoryLoading(true);
    const { data } = await supabase
      .from('raw_material_cost_history')
      .select('*')
      .eq('raw_material_id', item.id)
      .order('changed_at', { ascending: false });
    setHistory(data || []);
    setHistoryLoading(false);
  };

  const lowStock = materials.filter(m => parseFloat(m.quantity_on_hand) <= parseFloat(m.reorder_point));

  return (
    <div style={S.page}>
      <NavBar />
      <div style={{ padding: '28px', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", color: '#ffc107', margin: 0, fontSize: '28px' }}>
            📦 Raw Materials
          </h1>
          <button onClick={openAdd} style={S.btn()}>+ Add Material</button>
        </div>

        {msg.text && (
          <div style={{
            padding: '12px 16px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px',
            background: msg.type === 'success' ? '#1a3a1a' : '#3a1a1a',
            color: msg.type === 'success' ? '#4caf50' : '#f44336',
            border: `1px solid ${msg.type === 'success' ? '#4caf50' : '#f44336'}`,
          }}>{msg.text}</div>
        )}

        {lowStock.length > 0 && (
          <div style={{ padding: '12px 16px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px', background: '#3a2a1a', color: '#ff9800', border: '1px solid #ff9800' }}>
            ⚠️ Low stock alert: {lowStock.map(m => m.name).join(', ')}
          </div>
        )}

        {loading ? <p style={{ color: '#999' }}>Loading...</p> : (
          <div style={S.card}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #333' }}>
                  {['Name', 'Unit', 'On Hand', 'Cost/Unit', 'Reorder Pt', 'Supplier', 'Actions'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: '#ffc107', fontWeight: '600', fontSize: '12px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {materials.map(item => {
                  const isLow = parseFloat(item.quantity_on_hand) <= parseFloat(item.reorder_point);
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid #222', background: isLow ? 'rgba(255,152,0,0.05)' : 'transparent' }}>
                      <td style={{ padding: '12px', fontWeight: '600' }}>
                        {isLow && <span title="Low stock">⚠️ </span>}{item.name}
                      </td>
                      <td style={{ padding: '12px', color: '#999' }}>{item.unit || '—'}</td>
                      <td style={{ padding: '12px', color: isLow ? '#ff9800' : '#fff' }}>{parseFloat(item.quantity_on_hand).toFixed(2)}</td>
                      <td style={{ padding: '12px', color: '#ffc107' }}>₱{parseFloat(item.cost_per_unit).toFixed(4)}</td>
                      <td style={{ padding: '12px', color: '#999' }}>{parseFloat(item.reorder_point).toFixed(2)}</td>
                      <td style={{ padding: '12px', color: '#999' }}>{item.supplier || '—'}</td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => openEdit(item)} style={S.outlineBtn('#ffc107')}>Edit</button>
                          <button onClick={() => showHistory(item)} style={S.outlineBtn('#2196f3')}>History</button>
                          <button onClick={() => handleDelete(item.id)} style={S.outlineBtn('#f44336')}>Del</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {materials.length === 0 && (
                  <tr><td colSpan="7" style={{ padding: '24px', textAlign: 'center', color: '#555' }}>No raw materials yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div style={S.modal}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ color: '#ffc107', fontFamily: "'Playfair Display', serif", margin: 0 }}>
                {editItem ? 'Edit Raw Material' : 'Add Raw Material'}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ ...S.btn('#333'), padding: '4px 10px', fontSize: '18px' }}>×</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={S.label}>Material Name *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={S.input} />
              </div>
              {[
                { label: 'Unit', key: 'unit', placeholder: 'g / kg / pc / L' },
                { label: 'Quantity on Hand', key: 'quantity_on_hand', type: 'number', placeholder: '0' },
                { label: 'Cost per Unit (₱)', key: 'cost_per_unit', type: 'number', placeholder: '0.0000' },
                { label: 'Reorder Point', key: 'reorder_point', type: 'number', placeholder: '0' },
                { label: 'Supplier', key: 'supplier', placeholder: 'Supplier name', col: '1/-1' },
              ].map(f => (
                <div key={f.key} style={{ gridColumn: f.col }}>
                  <label style={S.label}>{f.label}</label>
                  <input type={f.type || 'text'} step="0.0001" value={form[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder} style={S.input} />
                </div>
              ))}
            </div>

            {editItem && (
              <div style={{ marginTop: '12px', padding: '12px', background: '#2a2a2a', borderRadius: '6px', fontSize: '12px', color: '#999' }}>
                ℹ️ Changing the cost will automatically calculate weighted average cost and save to history.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', borderTop: '1px solid #333', paddingTop: '20px' }}>
              <button onClick={() => setShowModal(false)} style={S.outlineBtn('#999')}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ ...S.btn(), opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving...' : '💾 Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyItem && (
        <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) setHistoryItem(null); }}>
          <div style={S.modal}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ color: '#ffc107', fontFamily: "'Playfair Display', serif", margin: 0, fontSize: '18px' }}>
                Cost History: {historyItem.name}
              </h2>
              <button onClick={() => setHistoryItem(null)} style={{ ...S.btn('#333'), padding: '4px 10px', fontSize: '18px' }}>×</button>
            </div>

            {historyLoading ? <p style={{ color: '#999' }}>Loading...</p> : (
              history.length === 0 ? (
                <p style={{ color: '#555', textAlign: 'center', padding: '20px 0' }}>No cost changes recorded yet</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #333' }}>
                      {['Date', 'Old Cost', 'New Cost', 'Avg Cost'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: '#ffc107', fontSize: '12px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(h => (
                      <tr key={h.id} style={{ borderBottom: '1px solid #222' }}>
                        <td style={{ padding: '10px' }}>{new Date(h.changed_at).toLocaleDateString()}</td>
                        <td style={{ padding: '10px', color: '#f44336' }}>₱{parseFloat(h.old_cost).toFixed(4)}</td>
                        <td style={{ padding: '10px', color: '#4caf50' }}>₱{parseFloat(h.new_cost).toFixed(4)}</td>
                        <td style={{ padding: '10px', color: '#ffc107' }}>₱{parseFloat(h.average_cost).toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
