import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { calcTotalMaterialsCost, calcTotalLaborCost, calcTotalOverheadCost, calcTotalVariableCost, calcTotalCost, calcContributionMargin, calcMarkupPercent, suggestSellingPrice } from '../../utils/costingUtils';

const bg = '#0a0a0a', card = '#1a1a1a', accent = '#ffc107', text = '#fff', muted = '#999';
const inputStyle = { width: '100%', background: '#111', border: '1px solid #333', color: '#fff', padding: '10px 14px', borderRadius: '6px', fontFamily: "'Poppins', sans-serif", fontSize: '14px', boxSizing: 'border-box' };
const btn = (bg2='#ffc107', color='#000') => ({ background: bg2, color, border: 'none', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", fontWeight: '600', fontSize: '13px' });

export default function AdminMenu() {
  const [menuItems, setMenuItems] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({ name: '', description: '', selling_price: '', department_id: '', category: '', image_url: '', status: 'available' });
  const [ingredients, setIngredients] = useState([]);
  const [laborItems, setLaborItems] = useState([]);
  const [overheadItems, setOverheadItems] = useState([]);
  const [targetMargin, setTargetMargin] = useState(30);
  const [matSearch, setMatSearch] = useState('');
  const [matResults, setMatResults] = useState([]);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    const [menuR, deptR, matR] = await Promise.all([
      fetch('/api/menu-items').then(r => r.json()),
      fetch('/api/departments').then(r => r.json()),
      fetch('/api/raw-materials').then(r => r.json()),
    ]);
    setMenuItems(Array.isArray(menuR) ? menuR : []);
    setDepartments(Array.isArray(deptR) ? deptR : []);
    setRawMaterials(Array.isArray(matR) ? matR : []);
  };

  const searchMaterials = async (q) => {
    setMatSearch(q);
    if (!q) { setMatResults([]); return; }
    const r = await fetch(`/api/raw-materials?search=${q}`);
    const data = await r.json();
    setMatResults(Array.isArray(data) ? data : []);
  };

  const addIngredient = (mat) => {
    setIngredients(prev => [...prev, { raw_material_id: mat.id, material_name: mat.name, unit: mat.unit, quantity: 1, cost_per_unit: mat.cost_per_unit }]);
    setMatSearch(''); setMatResults([]);
  };

  const addManualIngredient = () => {
    setIngredients(prev => [...prev, { raw_material_id: null, material_name: '', unit: 'pcs', quantity: 1, cost_per_unit: 0 }]);
  };

  const updateIngredient = (idx, field, val) => {
    setIngredients(prev => prev.map((ing, i) => i === idx ? { ...ing, [field]: val } : ing));
  };

  const removeIngredient = (idx) => setIngredients(prev => prev.filter((_, i) => i !== idx));

  const addLabor = () => setLaborItems(prev => [...prev, { description: 'Preparation', hours: 0, hourly_rate: 300 }]);
  const updateLabor = (idx, field, val) => setLaborItems(prev => prev.map((l, i) => i === idx ? { ...l, [field]: val } : l));
  const removeLabor = (idx) => setLaborItems(prev => prev.filter((_, i) => i !== idx));

  const addOverhead = () => setOverheadItems(prev => [...prev, { description: 'Packaging', overhead_type: 'fixed', amount: 5 }]);
  const updateOverhead = (idx, field, val) => setOverheadItems(prev => prev.map((o, i) => i === idx ? { ...o, [field]: val } : o));
  const removeOverhead = (idx) => setOverheadItems(prev => prev.filter((_, i) => i !== idx));

  const matCost = calcTotalMaterialsCost(ingredients);
  const laborCost = calcTotalLaborCost(laborItems);
  const variableCost = matCost + laborCost;
  const overheadCost = calcTotalOverheadCost(overheadItems, variableCost);
  const totalCost = variableCost + overheadCost;
  const sellingPriceSuggested = suggestSellingPrice(ingredients, laborItems, overheadItems, targetMargin);
  const sellingPrice = Number(form.selling_price) || 0;
  const contribMargin = sellingPrice - variableCost;
  const markupPct = totalCost > 0 ? ((sellingPrice - totalCost) / totalCost) * 100 : 0;

  const handleSubmit = async () => {
    if (!form.name || !form.selling_price) { setMsg('❌ Name and price required'); return; }
    setLoading(true);
    const body = { ...form, selling_price: Number(form.selling_price), ingredients, labor: laborItems, overhead: overheadItems };
    const r = await fetch('/api/menu-items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await r.json();
    setLoading(false);
    if (data.id) {
      setMsg('✅ Item added!');
      fetchAll();
      setShowForm(false);
      setForm({ name: '', description: '', selling_price: '', department_id: '', category: '', image_url: '', status: 'available' });
      setIngredients([]); setLaborItems([]); setOverheadItems([]);
    } else {
      setMsg('❌ ' + (data.error || 'Failed'));
    }
    setTimeout(() => setMsg(''), 4000);
  };

  const deleteItem = async (id) => {
    if (!confirm('Delete this item?')) return;
    await fetch(`/api/menu-items?id=${id}`, { method: 'DELETE' });
    fetchAll();
  };

  const sectionHeader = (title) => (
    <h4 style={{ color: accent, marginBottom: '12px', marginTop: '20px', borderBottom: '1px solid #333', paddingBottom: '6px' }}>{title}</h4>
  );

  return (
    <div style={{ minHeight: '100vh', background: bg, fontFamily: "'Poppins', sans-serif", padding: '24px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={{ color: accent, fontFamily: "'Playfair Display', serif", fontSize: '28px', margin: 0 }}>🍽️ Menu Management</h1>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {msg && <span style={{ color: accent, fontSize: '13px' }}>{msg}</span>}
            <button onClick={() => setShowForm(!showForm)} style={btn()}>
              {showForm ? '✕ Cancel' : '+ Add Item'}
            </button>
            <Link href="/admin" style={{ color: muted, fontSize: '14px', textDecoration: 'none' }}>← Admin</Link>
          </div>
        </div>

        {showForm && (
          <div style={{ background: card, border: '1px solid #ffc107', borderRadius: '12px', padding: '28px', marginBottom: '28px' }}>
            <h3 style={{ color: text, marginTop: 0, marginBottom: '20px' }}>New Menu Item</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ color: muted, fontSize: '12px' }}>Item Name *</label>
                <input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} placeholder="e.g. Iced Coffee" style={{ ...inputStyle, marginTop: '4px' }} />
              </div>
              <div>
                <label style={{ color: muted, fontSize: '12px' }}>Category</label>
                <input value={form.category} onChange={e => setForm(p => ({...p, category: e.target.value}))} placeholder="e.g. Beverages" style={{ ...inputStyle, marginTop: '4px' }} />
              </div>
              <div>
                <label style={{ color: muted, fontSize: '12px' }}>Department</label>
                <select value={form.department_id} onChange={e => setForm(p => ({...p, department_id: e.target.value}))} style={{ ...inputStyle, marginTop: '4px' }}>
                  <option value="">Select Department</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ color: muted, fontSize: '12px' }}>Selling Price (₱) *</label>
                <input type="number" value={form.selling_price} onChange={e => setForm(p => ({...p, selling_price: e.target.value}))} placeholder="0.00" style={{ ...inputStyle, marginTop: '4px' }} />
              </div>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ color: muted, fontSize: '12px' }}>Description</label>
              <textarea value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} placeholder="Item description" rows={2} style={{ ...inputStyle, marginTop: '4px', resize: 'vertical' }} />
            </div>

            {sectionHeader('🧮 Cost Calculator')}

            <div style={{ marginBottom: '12px' }}>
              <label style={{ color: muted, fontSize: '12px' }}>Search Raw Material</label>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px', position: 'relative' }}>
                <input value={matSearch} onChange={e => searchMaterials(e.target.value)} placeholder="Search ingredients..." style={{ ...inputStyle, flex: 1 }} />
                <button onClick={addManualIngredient} style={btn('#333', '#fff')}>+ Manual</button>
              </div>
              {matResults.length > 0 && (
                <div style={{ background: '#111', border: '1px solid #333', borderRadius: '6px', marginTop: '4px', maxHeight: '160px', overflowY: 'auto' }}>
                  {matResults.map(m => (
                    <div key={m.id} onClick={() => addIngredient(m)} style={{ padding: '8px 12px', cursor: 'pointer', color: text, fontSize: '13px', borderBottom: '1px solid #222' }}
                      onMouseOver={e => e.currentTarget.style.background = '#222'}
                      onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                      {m.name} ({m.unit}) — ₱{Number(m.cost_per_unit).toFixed(4)}/unit
                    </div>
                  ))}
                </div>
              )}
            </div>

            {ingredients.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '6px', marginBottom: '6px' }}>
                  <span style={{ color: muted, fontSize: '11px' }}>Material</span>
                  <span style={{ color: muted, fontSize: '11px' }}>Qty</span>
                  <span style={{ color: muted, fontSize: '11px' }}>Unit</span>
                  <span style={{ color: muted, fontSize: '11px' }}>Cost/Unit</span>
                  <span></span>
                </div>
                {ingredients.map((ing, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '6px', marginBottom: '6px', alignItems: 'center' }}>
                    <input value={ing.material_name} onChange={e => updateIngredient(idx, 'material_name', e.target.value)} style={{ ...inputStyle, padding: '6px 10px', fontSize: '12px' }} />
                    <input type="number" value={ing.quantity} onChange={e => updateIngredient(idx, 'quantity', e.target.value)} style={{ ...inputStyle, padding: '6px 10px', fontSize: '12px' }} />
                    <input value={ing.unit} onChange={e => updateIngredient(idx, 'unit', e.target.value)} style={{ ...inputStyle, padding: '6px 10px', fontSize: '12px' }} />
                    <input type="number" value={ing.cost_per_unit} onChange={e => updateIngredient(idx, 'cost_per_unit', e.target.value)} style={{ ...inputStyle, padding: '6px 10px', fontSize: '12px' }} />
                    <button onClick={() => removeIngredient(idx)} style={{ ...btn('#ef4444', '#fff'), padding: '4px 8px' }}>✕</button>
                  </div>
                ))}
                <div style={{ color: muted, fontSize: '12px', textAlign: 'right' }}>Material Cost: ₱{matCost.toFixed(4)}</div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ color: text, fontSize: '13px' }}>Labor Costs</span>
              <button onClick={addLabor} style={{ ...btn('#333', '#fff'), padding: '4px 10px', fontSize: '12px' }}>+ Add Labor</button>
            </div>
            {laborItems.map((l, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '6px', marginBottom: '6px', alignItems: 'center' }}>
                <input value={l.description} onChange={e => updateLabor(idx, 'description', e.target.value)} placeholder="Description" style={{ ...inputStyle, padding: '6px 10px', fontSize: '12px' }} />
                <input type="number" value={l.hours} onChange={e => updateLabor(idx, 'hours', e.target.value)} placeholder="Hours" style={{ ...inputStyle, padding: '6px 10px', fontSize: '12px' }} />
                <input type="number" value={l.hourly_rate} onChange={e => updateLabor(idx, 'hourly_rate', e.target.value)} placeholder="₱/hr" style={{ ...inputStyle, padding: '6px 10px', fontSize: '12px' }} />
                <button onClick={() => removeLabor(idx)} style={{ ...btn('#ef4444', '#fff'), padding: '4px 8px' }}>✕</button>
              </div>
            ))}
            {laborItems.length > 0 && <div style={{ color: muted, fontSize: '12px', textAlign: 'right', marginBottom: '8px' }}>Labor Cost: ₱{laborCost.toFixed(4)}</div>}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ color: text, fontSize: '13px' }}>Overhead Costs</span>
              <button onClick={addOverhead} style={{ ...btn('#333', '#fff'), padding: '4px 10px', fontSize: '12px' }}>+ Add Overhead</button>
            </div>
            {overheadItems.map((o, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '6px', marginBottom: '6px', alignItems: 'center' }}>
                <input value={o.description} onChange={e => updateOverhead(idx, 'description', e.target.value)} placeholder="Description" style={{ ...inputStyle, padding: '6px 10px', fontSize: '12px' }} />
                <select value={o.overhead_type} onChange={e => updateOverhead(idx, 'overhead_type', e.target.value)} style={{ ...inputStyle, padding: '6px 10px', fontSize: '12px' }}>
                  <option value="fixed">Fixed ₱</option>
                  <option value="percentage">% of Variable</option>
                </select>
                <input type="number" value={o.amount} onChange={e => updateOverhead(idx, 'amount', e.target.value)} placeholder="Amount" style={{ ...inputStyle, padding: '6px 10px', fontSize: '12px' }} />
                <button onClick={() => removeOverhead(idx)} style={{ ...btn('#ef4444', '#fff'), padding: '4px 8px' }}>✕</button>
              </div>
            ))}
            {overheadItems.length > 0 && <div style={{ color: muted, fontSize: '12px', textAlign: 'right', marginBottom: '8px' }}>Overhead: ₱{overheadCost.toFixed(4)}</div>}

            {(ingredients.length > 0 || laborItems.length > 0 || overheadItems.length > 0) && (
              <div style={{ background: '#111', border: '1px solid #333', borderRadius: '8px', padding: '16px', marginTop: '16px', marginBottom: '16px' }}>
                <h4 style={{ color: accent, margin: '0 0 12px', fontSize: '14px' }}>📊 Cost Analysis</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
                  <span style={{ color: muted }}>Materials:</span><span style={{ color: text }}>₱{matCost.toFixed(2)}</span>
                  <span style={{ color: muted }}>Labor:</span><span style={{ color: text }}>₱{laborCost.toFixed(2)}</span>
                  <span style={{ color: muted }}>Variable Cost:</span><span style={{ color: text }}>₱{variableCost.toFixed(2)}</span>
                  <span style={{ color: muted }}>Overhead:</span><span style={{ color: text }}>₱{overheadCost.toFixed(2)}</span>
                  <span style={{ color: muted, fontWeight: '600' }}>Total Cost:</span><span style={{ color: accent, fontWeight: '600' }}>₱{totalCost.toFixed(2)}</span>
                  {sellingPrice > 0 && <>
                    <span style={{ color: muted }}>Contribution Margin:</span><span style={{ color: contribMargin >= 0 ? '#4ade80' : '#ef4444' }}>₱{contribMargin.toFixed(2)}</span>
                    <span style={{ color: muted }}>Mark-up %:</span><span style={{ color: markupPct >= 0 ? '#4ade80' : '#ef4444' }}>{markupPct.toFixed(1)}%</span>
                  </>}
                </div>
                <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ color: muted, fontSize: '12px' }}>Target Margin %:</span>
                  <input type="number" value={targetMargin} onChange={e => setTargetMargin(e.target.value)} style={{ ...inputStyle, width: '80px', padding: '4px 8px', fontSize: '12px' }} />
                  <button onClick={() => setForm(p => ({...p, selling_price: sellingPriceSuggested.toFixed(2)}))} style={{ ...btn('#4ade80', '#000'), padding: '6px 12px', fontSize: '12px' }}>
                    Use ₱{sellingPriceSuggested.toFixed(2)}
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button onClick={handleSubmit} disabled={loading} style={{ ...btn(), padding: '12px 24px', opacity: loading ? 0.6 : 1 }}>
                {loading ? '⏳ Saving...' : '✅ Save Menu Item'}
              </button>
              <button onClick={() => setShowForm(false)} style={btn('#333', '#fff')}>Cancel</button>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {menuItems.map(item => (
            <div key={item.id} style={{ background: card, border: `1px solid ${item.status === 'out_of_stock' ? '#ef4444' : '#333'}`, borderRadius: '10px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <h3 style={{ color: text, margin: 0, fontSize: '15px' }}>{item.name}</h3>
                <span style={{ color: accent, fontWeight: '700' }}>₱{Number(item.selling_price).toFixed(2)}</span>
              </div>
              {item.kitchen_departments && <div style={{ color: muted, fontSize: '12px', marginBottom: '4px' }}>🏪 {item.kitchen_departments.name}</div>}
              {item.category && <div style={{ color: muted, fontSize: '12px', marginBottom: '4px' }}>📂 {item.category}</div>}
              <div style={{ color: item.status === 'out_of_stock' ? '#ef4444' : '#4ade80', fontSize: '12px', marginBottom: '12px' }}>
                {item.status === 'out_of_stock' ? '❌ Out of Stock' : '✅ Available'}
              </div>
              {item.description && <p style={{ color: muted, fontSize: '12px', marginBottom: '12px' }}>{item.description}</p>}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => deleteItem(item.id)} style={{ ...btn('#ef4444', '#fff'), flex: 1 }}>🗑️ Delete</button>
              </div>
            </div>
          ))}
        </div>
        {menuItems.length === 0 && <p style={{ color: muted, textAlign: 'center', marginTop: '40px' }}>No menu items yet. Click "+ Add Item" to get started.</p>}
      </div>
    </div>
  );
}
