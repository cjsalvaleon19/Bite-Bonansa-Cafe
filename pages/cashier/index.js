import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../utils/supabaseClient';

// ─── Shared Styles ───────────────────────────────────────────────────────────
const S = {
  page: {
    minHeight: '100vh', background: '#0a0a0a', fontFamily: "'Poppins', sans-serif", color: '#fff',
  },
  nav: {
    background: '#1a1a1a', borderBottom: '1px solid #333', padding: '0 24px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '56px',
  },
  logo: { color: '#ffc107', fontFamily: "'Playfair Display', serif", fontSize: '20px', fontWeight: 'bold' },
  navRight: { display: 'flex', alignItems: 'center', gap: '12px' },
  btn: (color = '#ffc107') => ({
    padding: '8px 16px', backgroundColor: color, color: color === '#ffc107' ? '#0a0a0a' : '#fff',
    border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  }),
  outlineBtn: {
    padding: '8px 16px', background: 'transparent', color: '#ffc107',
    border: '1px solid #ffc107', borderRadius: '6px', fontSize: '13px', cursor: 'pointer',
  },
  card: {
    background: '#1a1a1a', border: '1px solid #333', borderRadius: '10px', padding: '20px',
  },
  input: {
    width: '100%', padding: '10px 12px', background: '#2a2a2a', border: '1px solid #444',
    borderRadius: '6px', color: '#fff', fontSize: '13px', boxSizing: 'border-box',
    fontFamily: "'Poppins', sans-serif",
  },
  label: { display: 'block', marginBottom: '6px', color: '#ffc107', fontSize: '12px', fontWeight: '600' },
  tab: (active) => ({
    padding: '10px 20px', cursor: 'pointer', border: 'none', background: 'transparent',
    color: active ? '#ffc107' : '#999', borderBottom: active ? '2px solid #ffc107' : '2px solid transparent',
    fontSize: '14px', fontWeight: active ? '700' : '400', fontFamily: "'Poppins', sans-serif",
  }),
  success: { background: '#1a3a1a', color: '#4caf50', padding: '10px 14px', borderRadius: '6px', border: '1px solid #4caf50', fontSize: '13px' },
  error: { background: '#3a1a1a', color: '#f44336', padding: '10px 14px', borderRadius: '6px', border: '1px solid #f44336', fontSize: '13px' },
};

function calcPointsEarned(total) {
  const t = parseFloat(total) || 0;
  if (t >= 500) return parseFloat((t * 0.005).toFixed(2));
  if (t > 0) return parseFloat((t * 0.002).toFixed(2));
  return 0;
}

// ─── NavBar ───────────────────────────────────────────────────────────────────
function NavBar({ user }) {
  const logout = async () => { await supabase.auth.signOut(); window.location.href = '/login'; };
  return (
    <nav style={S.nav}>
      <span style={S.logo}>☕ Bite Bonansa — Cashier</span>
      <div style={S.navRight}>
        <span style={{ color: '#999', fontSize: '13px' }}>{user?.email}</span>
        <button onClick={logout} style={S.btn('#333')}>Logout</button>
      </div>
    </nav>
  );
}

// ─── POS Tab ──────────────────────────────────────────────────────────────────
function POSTab() {
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [customer, setCustomer] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [cashTendered, setCashTendered] = useState('');
  const [loading, setLoading] = useState(false);
  const [orderResult, setOrderResult] = useState(null);
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [deptFilter, setDeptFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  const DEPARTMENTS = ['All', 'Fryer 1', 'Fryer 2', 'Drinks', 'Pastries'];

  useEffect(() => {
    fetch('/api/menu-items?includeOutOfStock=false')
      .then(r => r.json())
      .then(d => setMenuItems(d.data || []));
  }, []);

  const lookupCustomer = async () => {
    if (!customerId.trim()) return;
    const r = await fetch(`/api/customers?customer_id=${customerId.trim()}`);
    const d = await r.json();
    if (r.ok) { setCustomer(d.data); setMsg({ text: `Customer: ${d.data.name} | Points: ${d.data.points_balance}`, type: 'success' }); }
    else setMsg({ text: 'Customer not found', type: 'error' });
  };

  const addToCart = (item) => {
    setCart(prev => {
      const exists = prev.find(c => c.id === item.id);
      if (exists) return prev.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { ...item, quantity: 1, special_instructions: '' }];
    });
  };

  const updateQty = (id, delta) => {
    setCart(prev => prev
      .map(c => c.id === id ? { ...c, quantity: c.quantity + delta } : c)
      .filter(c => c.quantity > 0)
    );
  };

  const updateInstructions = (id, val) => {
    setCart(prev => prev.map(c => c.id === id ? { ...c, special_instructions: val } : c));
  };

  const subtotal = cart.reduce((s, c) => s + c.selling_price * c.quantity, 0);
  const maxRedeemable = customer ? Math.min(customer.points_balance, subtotal) : 0;
  const effectiveRedemption = Math.min(parseFloat(pointsToRedeem) || 0, maxRedeemable);
  const totalAfterPoints = Math.max(0, subtotal - effectiveRedemption);
  const pointsEarned = calcPointsEarned(totalAfterPoints);
  const change = paymentMethod === 'cash' ? Math.max(0, parseFloat(cashTendered || 0) - totalAfterPoints) : 0;

  const processOrder = async () => {
    if (!cart.length) { setMsg({ text: 'Cart is empty', type: 'error' }); return; }
    setLoading(true);
    const resp = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: customer?.customer_id || null,
        order_type: 'cashier',
        payment_method: paymentMethod,
        items: cart.map(c => ({
          menu_item_id: c.id, name: c.name, quantity: c.quantity,
          unit_price: c.selling_price, department: c.department,
          special_instructions: c.special_instructions,
        })),
        subtotal,
        points_used: effectiveRedemption,
        cash_amount: parseFloat(cashTendered || 0),
        total_amount: totalAfterPoints,
      }),
    });
    const result = await resp.json();
    setLoading(false);
    if (resp.ok) {
      setOrderResult({ ...result.data, items: cart, pointsEarned, change, totalAfterPoints, customerId: customer?.customer_id });
      setCart([]); setCustomer(null); setCustomerId(''); setPointsToRedeem(0); setCashTendered('');
      setMsg({ text: `Order placed! Points earned: ${pointsEarned}`, type: 'success' });
    } else {
      setMsg({ text: result.error || 'Order failed', type: 'error' });
    }
  };

  const filtered = menuItems.filter(i =>
    (deptFilter === 'All' || i.department === deptFilter) &&
    i.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '20px', padding: '20px', minHeight: 'calc(100vh - 96px)' }}>
      {/* Menu Panel */}
      <div>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <input
            placeholder="🔍 Search menu..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            style={{ ...S.input, width: '200px' }}
          />
          {DEPARTMENTS.map(d => (
            <button key={d} onClick={() => setDeptFilter(d)} style={{
              padding: '8px 14px', borderRadius: '20px', border: '1px solid',
              borderColor: deptFilter === d ? '#ffc107' : '#444',
              background: deptFilter === d ? '#ffc107' : 'transparent',
              color: deptFilter === d ? '#0a0a0a' : '#999', cursor: 'pointer', fontSize: '12px',
            }}>{d}</button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
          {filtered.map(item => (
            <div key={item.id} onClick={() => addToCart(item)} style={{
              ...S.card, cursor: 'pointer', transition: 'all 0.2s', padding: '16px',
              borderColor: cart.find(c => c.id === item.id) ? '#ffc107' : '#333',
            }}
              onMouseOver={e => e.currentTarget.style.borderColor = '#ffc107'}
              onMouseOut={e => e.currentTarget.style.borderColor = cart.find(c => c.id === item.id) ? '#ffc107' : '#333'}
            >
              <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>{item.department}</div>
              <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '6px' }}>{item.name}</div>
              <div style={{ color: '#ffc107', fontWeight: '700', fontSize: '16px' }}>₱{parseFloat(item.selling_price).toFixed(2)}</div>
            </div>
          ))}
          {filtered.length === 0 && <p style={{ color: '#666', gridColumn: '1/-1' }}>No items found.</p>}
        </div>
      </div>

      {/* Cart Panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {msg.text && <div style={S[msg.type]}>{msg.text}</div>}

        {/* Customer Lookup */}
        <div style={S.card}>
          <label style={S.label}>🪙 Loyalty Customer ID</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input value={customerId} onChange={e => setCustomerId(e.target.value.toUpperCase())}
              placeholder="BBC-XXXXX" style={{ ...S.input, flex: 1 }}
              onKeyDown={e => e.key === 'Enter' && lookupCustomer()}
            />
            <button onClick={lookupCustomer} style={S.btn()}>Find</button>
          </div>
          {customer && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#4caf50' }}>
              ✓ {customer.name} | Balance: {customer.points_balance} pts
            </div>
          )}
        </div>

        {/* Cart Items */}
        <div style={{ ...S.card, flex: 1, overflowY: 'auto', maxHeight: '300px' }}>
          <div style={{ fontWeight: '600', color: '#ffc107', marginBottom: '12px', fontSize: '14px' }}>
            🛒 Cart ({cart.reduce((s, c) => s + c.quantity, 0)} items)
          </div>
          {cart.length === 0 && <p style={{ color: '#555', fontSize: '13px' }}>Add items from the menu</p>}
          {cart.map(item => (
            <div key={item.id} style={{ borderBottom: '1px solid #333', paddingBottom: '10px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', flex: 1 }}>{item.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button onClick={() => updateQty(item.id, -1)} style={{ ...S.btn('#333'), padding: '2px 8px', fontSize: '16px' }}>−</button>
                  <span style={{ minWidth: '20px', textAlign: 'center', fontSize: '13px' }}>{item.quantity}</span>
                  <button onClick={() => updateQty(item.id, 1)} style={{ ...S.btn('#333'), padding: '2px 8px', fontSize: '16px' }}>+</button>
                </div>
                <span style={{ color: '#ffc107', minWidth: '70px', textAlign: 'right', fontSize: '13px' }}>
                  ₱{(item.selling_price * item.quantity).toFixed(2)}
                </span>
              </div>
              <input
                placeholder="Special instructions..." value={item.special_instructions}
                onChange={e => updateInstructions(item.id, e.target.value)}
                style={{ ...S.input, marginTop: '6px', fontSize: '11px', padding: '6px' }}
              />
            </div>
          ))}
        </div>

        {/* Payment */}
        <div style={S.card}>
          <div style={{ marginBottom: '12px' }}>
            <label style={S.label}>Payment Method</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['cash', 'gcash', 'hybrid'].map(m => (
                <button key={m} onClick={() => setPaymentMethod(m)} style={{
                  padding: '6px 14px', borderRadius: '4px', border: '1px solid',
                  borderColor: paymentMethod === m ? '#ffc107' : '#444',
                  background: paymentMethod === m ? '#ffc107' : 'transparent',
                  color: paymentMethod === m ? '#0a0a0a' : '#999', cursor: 'pointer', fontSize: '12px', textTransform: 'uppercase',
                }}>{m}</button>
              ))}
            </div>
          </div>

          {customer && maxRedeemable > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <label style={S.label}>Points to Redeem (max {maxRedeemable})</label>
              <input
                type="number" min="0" max={maxRedeemable} value={pointsToRedeem}
                onChange={e => setPointsToRedeem(Math.min(parseFloat(e.target.value) || 0, maxRedeemable))}
                style={S.input}
              />
              <span style={{ fontSize: '11px', color: '#999' }}>1 point = ₱1</span>
            </div>
          )}

          {paymentMethod === 'cash' && (
            <div style={{ marginBottom: '12px' }}>
              <label style={S.label}>Cash Tendered</label>
              <input type="number" value={cashTendered} onChange={e => setCashTendered(e.target.value)} style={S.input} placeholder="0.00" />
            </div>
          )}

          <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#999' }}>Subtotal:</span><span>₱{subtotal.toFixed(2)}</span>
            </div>
            {effectiveRedemption > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4caf50' }}>
                <span>Points Discount:</span><span>−₱{effectiveRedemption.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', fontSize: '15px', borderTop: '1px solid #333', paddingTop: '8px', marginTop: '4px' }}>
              <span>Total:</span><span style={{ color: '#ffc107' }}>₱{totalAfterPoints.toFixed(2)}</span>
            </div>
            {paymentMethod === 'cash' && cashTendered && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4caf50' }}>
                <span>Change:</span><span>₱{change.toFixed(2)}</span>
              </div>
            )}
            {customer && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ffc107', fontSize: '12px' }}>
                <span>Points to earn:</span><span>+{pointsEarned}</span>
              </div>
            )}
          </div>

          <button onClick={processOrder} disabled={loading || cart.length === 0} style={{
            ...S.btn(), width: '100%', padding: '12px', fontSize: '15px',
            opacity: (loading || cart.length === 0) ? 0.6 : 1, cursor: (loading || cart.length === 0) ? 'not-allowed' : 'pointer',
          }}>
            {loading ? '⏳ Processing...' : '✅ Process Order'}
          </button>
        </div>

        {/* Receipt */}
        {orderResult && (
          <div style={{ ...S.card, border: '1px solid #4caf50' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ color: '#4caf50', fontWeight: '700', fontSize: '14px' }}>✅ Order Complete!</span>
              <button onClick={() => window.print()} style={S.btn()}>🖨️ Print</button>
            </div>
            <div id="receipt" style={{ fontSize: '12px', color: '#ccc' }}>
              <div style={{ textAlign: 'center', marginBottom: '8px', fontFamily: "'Playfair Display', serif", color: '#ffc107' }}>
                ☕ BITE BONANSA CAFE
              </div>
              <div>Order: {orderResult.id?.slice(0, 8)}...</div>
              <div>{new Date().toLocaleString()}</div>
              <hr style={{ borderColor: '#333', margin: '8px 0' }} />
              {orderResult.items?.map((i, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{i.name} x{i.quantity}</span>
                  <span>₱{(i.selling_price * i.quantity).toFixed(2)}</span>
                </div>
              ))}
              <hr style={{ borderColor: '#333', margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700' }}>
                <span>Total:</span><span>₱{orderResult.totalAfterPoints?.toFixed(2)}</span>
              </div>
              {orderResult.change > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Change:</span><span>₱{orderResult.change?.toFixed(2)}</span>
                </div>
              )}
              {orderResult.pointsEarned > 0 && (
                <div style={{ color: '#ffc107', marginTop: '6px' }}>Points earned: +{orderResult.pointsEarned}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Delivery Toggle Tab ──────────────────────────────────────────────────────
function DeliveryTab() {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/delivery-settings')
      .then(r => r.json())
      .then(d => { setEnabled(d.enabled); setLoading(false); });
  }, []);

  const toggle = async () => {
    setSaving(true);
    const resp = await fetch('/api/delivery-settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !enabled }),
    });
    const d = await resp.json();
    setSaving(false);
    if (resp.ok) { setEnabled(!enabled); setMsg(`Delivery ${!enabled ? 'enabled' : 'disabled'}!`); setTimeout(() => setMsg(''), 3000); }
  };

  return (
    <div style={{ padding: '40px', maxWidth: '500px', margin: '0 auto' }}>
      <h2 style={{ color: '#ffc107', fontFamily: "'Playfair Display', serif", marginBottom: '8px' }}>
        🛵 Delivery Settings
      </h2>
      <p style={{ color: '#999', marginBottom: '40px', fontSize: '14px' }}>
        Disable delivery when no riders are available. This affects the customer ordering page.
      </p>

      {loading ? (
        <p style={{ color: '#999' }}>Loading...</p>
      ) : (
        <div style={{ ...S.card, textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>{enabled ? '🟢' : '🔴'}</div>
          <div style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px', color: enabled ? '#4caf50' : '#f44336' }}>
            Delivery is {enabled ? 'ENABLED' : 'DISABLED'}
          </div>
          <p style={{ color: '#999', marginBottom: '30px', fontSize: '14px' }}>
            {enabled ? 'Customers can order for delivery' : 'Customers see pickup-only message'}
          </p>

          {/* Toggle Switch */}
          <div onClick={toggle} style={{
            display: 'inline-block', width: '80px', height: '40px', borderRadius: '20px',
            background: enabled ? '#4caf50' : '#555', position: 'relative', cursor: saving ? 'not-allowed' : 'pointer',
            transition: 'background 0.3s', marginBottom: '20px',
          }}>
            <div style={{
              position: 'absolute', top: '4px', left: enabled ? '44px' : '4px',
              width: '32px', height: '32px', borderRadius: '50%', background: '#fff',
              transition: 'left 0.3s', boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
            }} />
          </div>

          {msg && <div style={{ ...S.success, marginTop: '16px' }}>{msg}</div>}
          <p style={{ color: '#666', fontSize: '12px', marginTop: '16px' }}>Click the toggle to {enabled ? 'disable' : 'enable'} delivery</p>
        </div>
      )}
    </div>
  );
}

// ─── Inventory Tab ────────────────────────────────────────────────────────────
function InventoryTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ text: '', type: '' });

  const fetchItems = () => {
    setLoading(true);
    fetch('/api/menu-items?includeOutOfStock=true')
      .then(r => r.json())
      .then(d => { setItems(d.data || []); setLoading(false); });
  };

  useEffect(() => { fetchItems(); }, []);

  const toggleStatus = async (item) => {
    const newStatus = item.status === 'active' ? 'out_of_stock' : 'active';
    const resp = await fetch('/api/menu-items', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, status: newStatus }),
    });
    if (resp.ok) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: newStatus } : i));
      setMsg({ text: `${item.name} marked as ${newStatus === 'active' ? 'Available' : 'Out of Stock'}`, type: 'success' });
      setTimeout(() => setMsg({ text: '', type: '' }), 3000);
    }
  };

  const depts = ['All', ...new Set(items.map(i => i.department))];
  const [deptFilter, setDeptFilter] = useState('All');
  const filtered = deptFilter === 'All' ? items : items.filter(i => i.department === deptFilter);

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ color: '#ffc107', fontFamily: "'Playfair Display', serif", margin: 0 }}>📦 Inventory Status</h2>
        <button onClick={fetchItems} style={S.outlineBtn}>↻ Refresh</button>
      </div>

      {msg.text && <div style={{ ...S[msg.type], marginBottom: '16px' }}>{msg.text}</div>}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {depts.map(d => (
          <button key={d} onClick={() => setDeptFilter(d)} style={{
            padding: '6px 14px', borderRadius: '20px', border: '1px solid',
            borderColor: deptFilter === d ? '#ffc107' : '#444',
            background: deptFilter === d ? '#ffc107' : 'transparent',
            color: deptFilter === d ? '#0a0a0a' : '#999', cursor: 'pointer', fontSize: '12px',
          }}>{d}</button>
        ))}
      </div>

      {loading ? <p style={{ color: '#999' }}>Loading...</p> : (
        <div style={{ ...S.card, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #333' }}>
                {['Item', 'Department', 'Price', 'Status', 'Action'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: '#ffc107', fontWeight: '600', fontSize: '13px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid #222' }}>
                  <td style={{ padding: '12px' }}>{item.name}</td>
                  <td style={{ padding: '12px', color: '#999' }}>{item.department}</td>
                  <td style={{ padding: '12px', color: '#ffc107' }}>₱{parseFloat(item.selling_price).toFixed(2)}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600',
                      background: item.status === 'active' ? '#1a3a1a' : '#3a1a1a',
                      color: item.status === 'active' ? '#4caf50' : '#f44336',
                    }}>
                      {item.status === 'active' ? '● Available' : '● Out of Stock'}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <button onClick={() => toggleStatus(item)} style={{
                      padding: '5px 12px', borderRadius: '4px', border: '1px solid',
                      borderColor: item.status === 'active' ? '#f44336' : '#4caf50',
                      background: 'transparent',
                      color: item.status === 'active' ? '#f44336' : '#4caf50',
                      cursor: 'pointer', fontSize: '12px',
                    }}>
                      {item.status === 'active' ? 'Mark Out of Stock' : 'Mark Available'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Kitchen Receipts Tab ─────────────────────────────────────────────────────
function KitchenTab() {
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [deptFilter, setDeptFilter] = useState('All');
  const DEPARTMENTS = ['All', 'Fryer 1', 'Fryer 2', 'Drinks', 'Pastries'];

  useEffect(() => {
    fetch('/api/orders?limit=20')
      .then(r => r.json())
      .then(d => { const data = d.data || []; setOrders(data); if (data.length) setSelected(data[0]); });
  }, []);

  const getDeptItems = (order) => {
    if (!order?.order_items) return [];
    if (deptFilter === 'All') return order.order_items;
    return order.order_items.filter(i => i.department === deptFilter);
  };

  const printReceipt = () => {
    const printContent = document.getElementById('kitchen-receipt');
    const w = window.open('', '_blank', 'width=400,height=600');
    w.document.write(`<html><head><title>Kitchen Receipt</title><style>
      body{font-family:monospace;font-size:12px;margin:0;padding:10px;max-width:280px}
      h2{text-align:center;font-size:14px;border-bottom:1px dashed #000;padding-bottom:8px}
      .item{display:flex;justify-content:space-between;margin:4px 0}
      .dept{font-weight:bold;border-bottom:1px solid #000;margin:8px 0 4px}
      @media print{@page{margin:0;size:80mm auto}}
    </style></head><body>${printContent.innerHTML}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
    w.close();
  };

  const deptItems = selected ? getDeptItems(selected) : [];

  return (
    <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '220px 1fr', gap: '20px' }}>
      {/* Order List */}
      <div style={S.card}>
        <div style={{ color: '#ffc107', fontWeight: '700', marginBottom: '12px', fontSize: '14px' }}>Recent Orders</div>
        {orders.map(o => (
          <div key={o.id} onClick={() => setSelected(o)} style={{
            padding: '8px 10px', borderRadius: '6px', marginBottom: '6px', cursor: 'pointer', fontSize: '12px',
            background: selected?.id === o.id ? '#2a2a1a' : 'transparent',
            border: `1px solid ${selected?.id === o.id ? '#ffc107' : '#333'}`,
          }}>
            <div style={{ fontWeight: '600' }}>#{o.id?.slice(0, 8)}...</div>
            <div style={{ color: '#999' }}>{new Date(o.created_at).toLocaleTimeString()}</div>
            <div style={{ color: '#ffc107' }}>₱{parseFloat(o.total_amount).toFixed(2)}</div>
          </div>
        ))}
        {orders.length === 0 && <p style={{ color: '#555', fontSize: '12px' }}>No orders yet</p>}
      </div>

      {/* Receipt Panel */}
      <div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          {DEPARTMENTS.map(d => (
            <button key={d} onClick={() => setDeptFilter(d)} style={{
              padding: '6px 14px', borderRadius: '20px', border: '1px solid',
              borderColor: deptFilter === d ? '#ffc107' : '#444',
              background: deptFilter === d ? '#ffc107' : 'transparent',
              color: deptFilter === d ? '#0a0a0a' : '#999', cursor: 'pointer', fontSize: '12px',
            }}>{d}</button>
          ))}
          <button onClick={printReceipt} style={{ ...S.btn(), marginLeft: 'auto' }}>🖨️ Print</button>
        </div>

        {selected && (
          <div style={S.card}>
            <div id="kitchen-receipt">
              <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                <div style={{ fontFamily: "'Playfair Display', serif", color: '#ffc107', fontSize: '18px' }}>☕ BITE BONANSA</div>
                <div style={{ color: '#999', fontSize: '12px' }}>KITCHEN RECEIPT</div>
                <div style={{ color: '#999', fontSize: '12px' }}>Order: #{selected.id?.slice(0, 8).toUpperCase()}</div>
                <div style={{ color: '#999', fontSize: '12px' }}>{new Date(selected.created_at).toLocaleString()}</div>
              </div>

              {deptItems.length === 0 ? (
                <p style={{ color: '#555', textAlign: 'center' }}>No items for this department</p>
              ) : (
                <>
                  {deptFilter !== 'All' && <div style={{ color: '#ffc107', fontWeight: '700', borderBottom: '1px solid #333', paddingBottom: '6px', marginBottom: '10px' }}>
                    📍 {deptFilter}
                  </div>}
                  {deptItems.map((item, idx) => (
                    <div key={idx} style={{ borderBottom: '1px solid #222', paddingBottom: '10px', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '600' }}>
                        <span>{item.menu_item_name || item.name}</span>
                        <span style={{ color: '#ffc107' }}>x{item.quantity}</span>
                      </div>
                      {item.special_instructions && (
                        <div style={{ color: '#ff9800', fontSize: '12px', marginTop: '4px' }}>
                          ⚠️ {item.special_instructions}
                        </div>
                      )}
                      {item.department && deptFilter === 'All' && (
                        <div style={{ color: '#666', fontSize: '11px' }}>{item.department}</div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Cashier Page ────────────────────────────────────────────────────────
export default function CashierPage() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('pos');
  const TABS = [
    { id: 'pos', label: '🧾 POS / New Order' },
    { id: 'delivery', label: '🛵 Delivery Toggle' },
    { id: 'inventory', label: '📦 Inventory' },
    { id: 'kitchen', label: '🍳 Kitchen Receipts' },
  ];

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { window.location.href = '/login'; return; }
      setUser(session.user);
    });
  }, []);

  if (!user) return (
    <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: '#ffc107' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>☕</div>
        <p style={{ color: '#999' }}>Loading...</p>
      </div>
    </div>
  );

  return (
    <div style={S.page}>
      <style>{`@media print { nav, .no-print { display: none !important; } }`}</style>
      <NavBar user={user} />

      {/* Tabs */}
      <div style={{ background: '#1a1a1a', borderBottom: '1px solid #333', padding: '0 20px', display: 'flex' }} className="no-print">
        {TABS.map(t => (
          <button key={t.id} style={S.tab(activeTab === t.id)} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'pos' && <POSTab />}
      {activeTab === 'delivery' && <DeliveryTab />}
      {activeTab === 'inventory' && <InventoryTab />}
      {activeTab === 'kitchen' && <KitchenTab />}
    </div>
  );
}
