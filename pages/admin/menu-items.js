import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../../utils/supabaseClient';

const DEPARTMENTS = ['Fryer 1', 'Fryer 2', 'Drinks', 'Pastries'];

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
    padding: '6px 14px', background: 'transparent', color: color,
    border: `1px solid ${color}`, borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
  }),
  card: { background: '#1a1a1a', border: '1px solid #333', borderRadius: '10px', padding: '20px' },
  input: {
    width: '100%', padding: '10px 12px', background: '#2a2a2a', border: '1px solid #444',
    borderRadius: '6px', color: '#fff', fontSize: '13px', boxSizing: 'border-box',
    fontFamily: "'Poppins', sans-serif",
  },
  label: { display: 'block', marginBottom: '6px', color: '#ffc107', fontSize: '12px', fontWeight: '600' },
  tab: (active) => ({
    padding: '10px 18px', cursor: 'pointer', border: 'none', background: 'transparent',
    color: active ? '#ffc107' : '#999', borderBottom: active ? '2px solid #ffc107' : '2px solid transparent',
    fontSize: '13px', fontWeight: active ? '700' : '400', fontFamily: "'Poppins', sans-serif",
  }),
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000,
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '20px',
  },
  modal: {
    background: '#1a1a1a', border: '1px solid #333', borderRadius: '12px',
    padding: '28px', width: '100%', maxWidth: '700px', position: 'relative', marginTop: '20px',
  },
};

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

const emptyForm = {
  name: '', description: '', department: 'Fryer 1', selling_price: '', status: 'active',
  ingredients: [],
  labor: { hours_needed: '', hourly_rate: '' },
  overhead: { overhead_amount: '', overhead_type: 'fixed' },
};

function calcCosts(form) {
  const matCost = (form.ingredients || []).reduce(
    (s, i) => s + (parseFloat(i.quantity_per_serving) || 0) * (parseFloat(i.cost_per_unit) || 0), 0
  );
  const labCost = (parseFloat(form.labor?.hours_needed) || 0) * (parseFloat(form.labor?.hourly_rate) || 0);
  const varCost = matCost + labCost;
  let overhead = 0;
  if (form.overhead?.overhead_type === 'percentage') {
    overhead = varCost * ((parseFloat(form.overhead?.overhead_amount) || 0) / 100);
  } else {
    overhead = parseFloat(form.overhead?.overhead_amount) || 0;
  }
  const totalCost = varCost + overhead;
  const selling = parseFloat(form.selling_price) || 0;
  const cm = selling - varCost;
  const markup = totalCost > 0 ? ((selling - totalCost) / totalCost * 100) : 0;
  return { matCost, labCost, varCost, overhead, totalCost, cm, markup };
}

export default function MenuItemsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formTab, setFormTab] = useState('basic');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [rawMaterials, setRawMaterials] = useState([]);

  const FORM_TABS = ['basic', 'ingredients', 'labor', 'overhead', 'pricing'];

  const fetchItems = () => {
    setLoading(true);
    fetch('/api/menu-items?includeOutOfStock=true')
      .then(r => r.json())
      .then(d => { setItems(d.data || []); setLoading(false); });
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) window.location.href = '/login';
    });
    fetchItems();
    fetch('/api/raw-materials').then(r => r.json()).then(d => setRawMaterials(d.data || []));
  }, []);

  const openAdd = () => { setEditItem(null); setForm(emptyForm); setFormTab('basic'); setShowModal(true); };
  const openEdit = (item) => {
    setEditItem(item);
    setForm({
      name: item.name, description: item.description || '', department: item.department,
      selling_price: item.selling_price, status: item.status,
      ingredients: item.menu_item_ingredients || [],
      labor: item.menu_item_labor?.[0] || { hours_needed: '', hourly_rate: '' },
      overhead: item.menu_item_overhead?.[0] || { overhead_amount: '', overhead_type: 'fixed' },
    });
    setFormTab('basic');
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this menu item?')) return;
    const resp = await fetch(`/api/menu-items?id=${id}`, { method: 'DELETE' });
    if (resp.ok) { setMsg({ text: 'Item deleted', type: 'success' }); fetchItems(); }
    else setMsg({ text: 'Delete failed', type: 'error' });
    setTimeout(() => setMsg({ text: '', type: '' }), 3000);
  };

  const handleSave = async () => {
    if (!form.name || !form.department) { setMsg({ text: 'Name and department required', type: 'error' }); return; }
    setSaving(true);
    const payload = {
      name: form.name, description: form.description, department: form.department,
      selling_price: parseFloat(form.selling_price) || 0, status: form.status,
      ingredients: form.ingredients,
      labor: form.labor?.hours_needed ? form.labor : null,
      overhead: form.overhead?.overhead_amount ? form.overhead : null,
    };
    if (editItem) payload.id = editItem.id;

    const resp = await fetch('/api/menu-items', {
      method: editItem ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await resp.json();
    setSaving(false);
    if (resp.ok) {
      setMsg({ text: editItem ? 'Item updated!' : 'Item created!', type: 'success' });
      setShowModal(false);
      fetchItems();
    } else {
      setMsg({ text: result.error || 'Save failed', type: 'error' });
    }
    setTimeout(() => setMsg({ text: '', type: '' }), 4000);
  };

  const addIngredient = () => {
    setForm(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, { raw_material_name: '', quantity_per_serving: '', unit: '', cost_per_unit: '' }],
    }));
  };

  const updateIngredient = (idx, field, val) => {
    setForm(prev => ({
      ...prev,
      ingredients: prev.ingredients.map((ing, i) => i === idx ? { ...ing, [field]: val } : ing),
    }));
  };

  const removeIngredient = (idx) => {
    setForm(prev => ({ ...prev, ingredients: prev.ingredients.filter((_, i) => i !== idx) }));
  };

  const costs = calcCosts(form);

  return (
    <div style={S.page}>
      <NavBar />
      <div style={{ padding: '28px', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", color: '#ffc107', margin: 0, fontSize: '28px' }}>
            🍽️ Menu Items
          </h1>
          <button onClick={openAdd} style={S.btn()}>+ Add New Item</button>
        </div>

        {msg.text && (
          <div style={{
            padding: '12px 16px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px',
            background: msg.type === 'success' ? '#1a3a1a' : '#3a1a1a',
            color: msg.type === 'success' ? '#4caf50' : '#f44336',
            border: `1px solid ${msg.type === 'success' ? '#4caf50' : '#f44336'}`,
          }}>{msg.text}</div>
        )}

        {loading ? <p style={{ color: '#999' }}>Loading...</p> : (
          <div style={S.card}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #333' }}>
                  {['Name', 'Department', 'Price', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: '#ffc107', fontWeight: '600', fontSize: '12px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #222' }}>
                    <td style={{ padding: '12px' }}>{item.name}</td>
                    <td style={{ padding: '12px', color: '#999' }}>{item.department}</td>
                    <td style={{ padding: '12px', color: '#ffc107', fontWeight: '600' }}>₱{parseFloat(item.selling_price).toFixed(2)}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '600',
                        background: item.status === 'active' ? '#1a3a1a' : '#3a1a1a',
                        color: item.status === 'active' ? '#4caf50' : '#f44336',
                      }}>
                        {item.status === 'active' ? '● Active' : '● Out of Stock'}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => openEdit(item)} style={S.outlineBtn('#ffc107')}>Edit</button>
                        <button onClick={() => handleDelete(item.id)} style={S.outlineBtn('#f44336')}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr><td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: '#555' }}>No menu items yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div style={S.modal}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ color: '#ffc107', fontFamily: "'Playfair Display', serif", margin: 0 }}>
                {editItem ? 'Edit Menu Item' : 'Add New Menu Item'}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ ...S.btn('#333'), padding: '4px 10px', fontSize: '18px' }}>×</button>
            </div>

            {/* Form Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #333', marginBottom: '20px' }}>
              {FORM_TABS.map(t => (
                <button key={t} style={S.tab(formTab === t)} onClick={() => setFormTab(t)}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            {/* Basic Info */}
            {formTab === 'basic' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={S.label}>Item Name *</label>
                  <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={S.input} />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={S.label}>Description</label>
                  <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    style={{ ...S.input, resize: 'vertical', minHeight: '70px' }} />
                </div>
                <div>
                  <label style={S.label}>Department *</label>
                  <select value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} style={S.input}>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Status</label>
                  <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} style={S.input}>
                    <option value="active">Active</option>
                    <option value="out_of_stock">Out of Stock</option>
                  </select>
                </div>
              </div>
            )}

            {/* Ingredients */}
            {formTab === 'ingredients' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <span style={{ color: '#ffc107', fontWeight: '600', fontSize: '14px' }}>Raw Material Ingredients</span>
                  <button onClick={addIngredient} style={S.btn()}>+ Add Ingredient</button>
                </div>
                {form.ingredients.length === 0 && <p style={{ color: '#555', fontSize: '13px' }}>No ingredients added yet</p>}
                {form.ingredients.map((ing, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '8px', marginBottom: '10px', alignItems: 'end' }}>
                    <div>
                      {idx === 0 && <label style={S.label}>Ingredient Name</label>}
                      <input value={ing.raw_material_name} onChange={e => updateIngredient(idx, 'raw_material_name', e.target.value)}
                        placeholder="e.g. Chicken" style={S.input} />
                    </div>
                    <div>
                      {idx === 0 && <label style={S.label}>Qty/Serving</label>}
                      <input type="number" value={ing.quantity_per_serving} onChange={e => updateIngredient(idx, 'quantity_per_serving', e.target.value)}
                        placeholder="0" style={S.input} />
                    </div>
                    <div>
                      {idx === 0 && <label style={S.label}>Unit</label>}
                      <input value={ing.unit} onChange={e => updateIngredient(idx, 'unit', e.target.value)}
                        placeholder="g / pc" style={S.input} />
                    </div>
                    <div>
                      {idx === 0 && <label style={S.label}>Cost/Unit (₱)</label>}
                      <input type="number" value={ing.cost_per_unit} onChange={e => updateIngredient(idx, 'cost_per_unit', e.target.value)}
                        placeholder="0.00" style={S.input} />
                    </div>
                    <button onClick={() => removeIngredient(idx)} style={{ ...S.btn('#f44336'), padding: '10px 10px' }}>×</button>
                  </div>
                ))}
                {form.ingredients.length > 0 && (
                  <div style={{ marginTop: '16px', padding: '12px', background: '#2a2a2a', borderRadius: '6px', fontSize: '13px' }}>
                    <span style={{ color: '#999' }}>Total Material Cost: </span>
                    <span style={{ color: '#ffc107', fontWeight: '700' }}>₱{costs.matCost.toFixed(4)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Labor */}
            {formTab === 'labor' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={S.label}>Hours Needed</label>
                  <input type="number" step="0.01" value={form.labor?.hours_needed || ''}
                    onChange={e => setForm(p => ({ ...p, labor: { ...p.labor, hours_needed: e.target.value } }))} style={S.input} />
                </div>
                <div>
                  <label style={S.label}>Hourly Rate (₱)</label>
                  <input type="number" step="0.01" value={form.labor?.hourly_rate || ''}
                    onChange={e => setForm(p => ({ ...p, labor: { ...p.labor, hourly_rate: e.target.value } }))} style={S.input} />
                </div>
                <div style={{ gridColumn: '1/-1', padding: '12px', background: '#2a2a2a', borderRadius: '6px', fontSize: '13px' }}>
                  <span style={{ color: '#999' }}>Labor Cost: </span>
                  <span style={{ color: '#ffc107', fontWeight: '700' }}>₱{costs.labCost.toFixed(4)}</span>
                </div>
              </div>
            )}

            {/* Overhead */}
            {formTab === 'overhead' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={S.label}>Overhead Amount</label>
                  <input type="number" step="0.01" value={form.overhead?.overhead_amount || ''}
                    onChange={e => setForm(p => ({ ...p, overhead: { ...p.overhead, overhead_amount: e.target.value } }))} style={S.input} />
                </div>
                <div>
                  <label style={S.label}>Type</label>
                  <select value={form.overhead?.overhead_type || 'fixed'}
                    onChange={e => setForm(p => ({ ...p, overhead: { ...p.overhead, overhead_type: e.target.value } }))} style={S.input}>
                    <option value="fixed">Fixed (₱)</option>
                    <option value="percentage">Percentage (% of variable cost)</option>
                  </select>
                </div>
                <div style={{ gridColumn: '1/-1', padding: '12px', background: '#2a2a2a', borderRadius: '6px', fontSize: '13px' }}>
                  <span style={{ color: '#999' }}>Overhead Cost: </span>
                  <span style={{ color: '#ffc107', fontWeight: '700' }}>₱{costs.overhead.toFixed(4)}</span>
                </div>
              </div>
            )}

            {/* Pricing */}
            {formTab === 'pricing' && (
              <div>
                <div style={{ ...S.card, background: '#2a2a2a', marginBottom: '20px' }}>
                  <h3 style={{ color: '#ffc107', marginBottom: '16px', fontSize: '15px' }}>Cost Breakdown</h3>
                  {[
                    { label: 'Raw Material Cost', value: costs.matCost },
                    { label: 'Labor Cost', value: costs.labCost },
                    { label: 'Total Variable Cost', value: costs.varCost, bold: true },
                    { label: 'Overhead', value: costs.overhead },
                    { label: 'Total Cost', value: costs.totalCost, bold: true, color: '#ff9800' },
                    { label: 'Contribution Margin', value: costs.cm, color: costs.cm >= 0 ? '#4caf50' : '#f44336' },
                    { label: 'Mark-up %', value: costs.markup, suffix: '%', color: costs.markup >= 0 ? '#4caf50' : '#f44336' },
                  ].map(row => (
                    <div key={row.label} style={{
                      display: 'flex', justifyContent: 'space-between', padding: '8px 0',
                      borderBottom: '1px solid #333', fontSize: '13px',
                      fontWeight: row.bold ? '700' : '400',
                    }}>
                      <span style={{ color: '#999' }}>{row.label}</span>
                      <span style={{ color: row.color || '#fff' }}>
                        {row.suffix ? `${row.value.toFixed(2)}%` : `₱${row.value.toFixed(2)}`}
                      </span>
                    </div>
                  ))}
                </div>
                <div>
                  <label style={S.label}>Selling Price (₱) *</label>
                  <input type="number" step="0.01" value={form.selling_price}
                    onChange={e => setForm(p => ({ ...p, selling_price: e.target.value }))}
                    placeholder="0.00" style={{ ...S.input, fontSize: '18px', fontWeight: '700', color: '#ffc107' }} />
                  {costs.totalCost > 0 && (
                    <p style={{ color: '#999', fontSize: '12px', marginTop: '4px' }}>
                      Suggested (2x cost): ₱{(costs.totalCost * 2).toFixed(2)} | At cost: ₱{costs.totalCost.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', borderTop: '1px solid #333', paddingTop: '20px' }}>
              <button onClick={() => setShowModal(false)} style={S.outlineBtn('#999')}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ ...S.btn(), opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving...' : '💾 Save Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
