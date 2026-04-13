import React, { useState, useEffect } from 'react';
import Link from 'next/link';

const bg = '#0a0a0a', card = '#1a1a1a', accent = '#ffc107', text = '#fff', muted = '#999';
const btn = (bg2='#ffc107', color='#000') => ({ background: bg2, color, border: 'none', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", fontWeight: '600', fontSize: '13px' });
const inputStyle = { width: '100%', background: '#111', border: '1px solid #333', color: '#fff', padding: '10px 14px', borderRadius: '6px', fontFamily: "'Poppins', sans-serif", fontSize: '14px', boxSizing: 'border-box' };

export default function CustomerMenu() {
  const [menuItems, setMenuItems] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [cart, setCart] = useState([]);
  const [orderType, setOrderType] = useState('dine_in');
  const [deliveryEnabled, setDeliveryEnabled] = useState(true);
  const [filterDept, setFilterDept] = useState('all');
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [customer, setCustomer] = useState(null);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [orderNotes, setOrderNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [orderResult, setOrderResult] = useState(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/menu-items?online=1').then(r => r.json()).then(d => setMenuItems(Array.isArray(d) ? d : []));
    fetch('/api/departments').then(r => r.json()).then(d => setDepartments(Array.isArray(d) ? d : []));
    fetch('/api/delivery-settings').then(r => r.json()).then(d => { if (d?.enabled !== undefined) setDeliveryEnabled(d.enabled); });
  }, []);

  const addToCart = (item) => {
    setCart(prev => {
      const ex = prev.find(c => c.id === item.id);
      if (ex) return prev.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { ...item, quantity: 1, special_instructions: '' }];
    });
  };

  const updateQty = (id, qty) => {
    if (qty <= 0) setCart(prev => prev.filter(c => c.id !== id));
    else setCart(prev => prev.map(c => c.id === id ? { ...c, quantity: qty } : c));
  };

  const lookupCustomer = async () => {
    if (!customerId.trim()) return;
    const r = await fetch(`/api/customers?customer_id=${customerId.trim()}`);
    const data = await r.json();
    if (data?.id) { setCustomer(data); setMsg(`✅ Welcome, ${data.full_name}!`); }
    else { setMsg('Customer not found'); setCustomer(null); }
    setTimeout(() => setMsg(''), 3000);
  };

  const subtotal = cart.reduce((s, c) => s + c.selling_price * c.quantity, 0);
  const pointsValue = Math.min(Number(pointsToRedeem), customer?.points_balance || 0, subtotal);
  const amountDue = Math.max(0, subtotal - pointsValue);

  const placeOrder = async () => {
    if (cart.length === 0) return;
    if (orderType === 'delivery' && !deliveryEnabled) { setMsg('❌ Delivery is currently unavailable'); return; }
    setLoading(true);
    const items = cart.map(c => ({
      menu_item_id: c.id, name: c.name,
      department_id: c.department_id,
      department_name: c.kitchen_departments?.name || '',
      quantity: c.quantity, unit_price: c.selling_price,
      special_instructions: c.special_instructions
    }));
    const body = {
      customer_id: customerId || null,
      customer_name: customer?.full_name || 'Walk-in',
      order_type: orderType,
      items, subtotal, total: subtotal,
      points_redeemed: pointsValue,
      cash_amount: paymentMethod === 'cash' ? amountDue : 0,
      gcash_amount: paymentMethod === 'gcash' ? amountDue : 0,
      change_amount: 0,
      payment_method: paymentMethod,
      notes: orderNotes
    };
    const r = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await r.json();
    setLoading(false);
    if (data.order) {
      setOrderResult(data);
      setCart([]);
    } else {
      setMsg('❌ ' + (data.error || 'Failed to place order'));
      setTimeout(() => setMsg(''), 4000);
    }
  };

  const totalItems = cart.reduce((s, c) => s + c.quantity, 0);
  const filtered = menuItems.filter(m => filterDept === 'all' || m.department_id === filterDept);

  if (orderResult) {
    return (
      <div style={{ minHeight: '100vh', background: bg, fontFamily: "'Poppins', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ background: card, border: '2px solid #ffc107', borderRadius: '16px', padding: '40px', maxWidth: '480px', width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: '60px', marginBottom: '16px' }}>🎉</div>
          <h2 style={{ color: accent, fontFamily: "'Playfair Display', serif" }}>Order Confirmed!</h2>
          <p style={{ color: muted }}>Order #: <strong style={{ color: text }}>{orderResult.order?.order_number}</strong></p>
          <p style={{ color: muted }}>Receipt: <strong style={{ color: text }}>{orderResult.receipt?.receipt_number}</strong></p>
          <p style={{ color: muted, fontSize: '13px' }}>We hoped we satisfied your cravings! ☕</p>
          {orderResult.receipt?.qr_code_data && (
            <p style={{ color: muted, fontSize: '12px' }}>Leave a review: <a href={orderResult.receipt.qr_code_data} target="_blank" style={{ color: accent }}>{orderResult.receipt.qr_code_data}</a></p>
          )}
          <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button onClick={() => setOrderResult(null)} style={btn()}>Order Again</button>
            <Link href="/" style={{ ...btn('#333', '#fff'), textDecoration: 'none', display: 'inline-block' }}>Home</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: bg, fontFamily: "'Poppins', sans-serif" }}>
      {/* Header */}
      <div style={{ background: card, borderBottom: '1px solid #333', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100 }}>
        <h1 style={{ color: accent, margin: 0, fontSize: '20px', fontFamily: "'Playfair Display', serif" }}>☕ Bite Bonansa Cafe</h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {msg && <span style={{ color: accent, fontSize: '13px' }}>{msg}</span>}
          <button onClick={() => setShowCart(!showCart)} style={btn()}>
            🛒 Cart {totalItems > 0 && `(${totalItems})`}
          </button>
          <Link href="/reviews" style={{ color: muted, fontSize: '13px', textDecoration: 'none' }}>⭐ Reviews</Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: showCart ? '1fr 360px' : '1fr', maxWidth: '1200px', margin: '0 auto', padding: '24px', gap: '24px' }}>
        <div>
          {/* Loyalty lookup */}
          <div style={{ background: card, border: '1px solid #333', borderRadius: '10px', padding: '16px', marginBottom: '20px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: muted, fontSize: '13px' }}>Have a loyalty card?</span>
            <input value={customerId} onChange={e => setCustomerId(e.target.value)} placeholder="BBC-XXXXX" style={{ ...inputStyle, width: '160px' }} />
            <button onClick={lookupCustomer} style={btn()}>Look Up</button>
            {customer && <span style={{ color: '#4ade80', fontSize: '13px' }}>✅ {customer.full_name} — {Number(customer.points_balance).toFixed(2)} pts</span>}
          </div>

          {/* Order type */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {[
              { key: 'dine_in', label: '🍽️ Dine-in' },
              { key: 'pickup', label: '🥡 Pickup' },
              { key: 'delivery', label: '🛵 Delivery', disabled: !deliveryEnabled }
            ].map(ot => (
              <button key={ot.key} onClick={() => !ot.disabled && setOrderType(ot.key)} disabled={ot.disabled}
                style={{ ...btn(orderType === ot.key ? accent : '#333', orderType === ot.key ? '#000' : '#fff'), opacity: ot.disabled ? 0.4 : 1 }}>
                {ot.label}{ot.disabled ? ' (Unavailable)' : ''}
              </button>
            ))}
          </div>

          {/* Dept filters */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <button onClick={() => setFilterDept('all')} style={btn(filterDept === 'all' ? accent : '#333', filterDept === 'all' ? '#000' : '#fff')}>All</button>
            {departments.map(d => (
              <button key={d.id} onClick={() => setFilterDept(d.id)} style={btn(filterDept === d.id ? accent : '#333', filterDept === d.id ? '#000' : '#fff')}>{d.name}</button>
            ))}
          </div>

          {/* Menu grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
            {filtered.map(item => (
              <div key={item.id} style={{ background: card, border: '1px solid #333', borderRadius: '12px', padding: '20px', cursor: 'pointer', transition: 'border-color 0.2s' }}
                onMouseOver={e => e.currentTarget.style.borderColor = accent}
                onMouseOut={e => e.currentTarget.style.borderColor = '#333'}
                onClick={() => addToCart(item)}>
                {item.image_url && <img src={item.image_url} alt={item.name} style={{ width: '100%', borderRadius: '8px', marginBottom: '10px', height: '120px', objectFit: 'cover' }} />}
                <div style={{ color: muted, fontSize: '11px', marginBottom: '4px' }}>{item.kitchen_departments?.name || ''}</div>
                <div style={{ color: text, fontWeight: '600', marginBottom: '6px' }}>{item.name}</div>
                {item.description && <p style={{ color: muted, fontSize: '12px', marginBottom: '8px', lineHeight: '1.4' }}>{item.description}</p>}
                <div style={{ color: accent, fontWeight: '700', fontSize: '16px' }}>₱{Number(item.selling_price).toFixed(2)}</div>
              </div>
            ))}
          </div>
          {filtered.length === 0 && <p style={{ color: muted, textAlign: 'center', marginTop: '40px' }}>No items available</p>}
        </div>

        {/* Cart Sidebar */}
        {showCart && (
          <div style={{ background: card, border: '1px solid #333', borderRadius: '12px', padding: '20px', height: 'fit-content', position: 'sticky', top: '80px' }}>
            <h3 style={{ color: accent, margin: '0 0 16px' }}>🛒 Your Order</h3>
            {cart.length === 0 ? <p style={{ color: muted }}>Cart is empty</p> : (
              <>
                {cart.map(item => (
                  <div key={item.id} style={{ borderBottom: '1px solid #333', paddingBottom: '10px', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ color: text, fontSize: '13px' }}>{item.name}</span>
                      <span style={{ color: accent, fontSize: '13px' }}>₱{(item.selling_price * item.quantity).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <button onClick={() => updateQty(item.id, item.quantity - 1)} style={{ ...btn('#333', '#fff'), padding: '2px 8px' }}>−</button>
                      <span style={{ color: text, minWidth: '20px', textAlign: 'center', fontSize: '13px' }}>{item.quantity}</span>
                      <button onClick={() => updateQty(item.id, item.quantity + 1)} style={{ ...btn('#333', '#fff'), padding: '2px 8px' }}>+</button>
                    </div>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid #333', paddingTop: '12px', marginTop: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: text, fontWeight: '600' }}>Total</span>
                    <span style={{ color: accent, fontWeight: '700', fontSize: '18px' }}>₱{subtotal.toFixed(2)}</span>
                  </div>
                  {customer && (
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ color: muted, fontSize: '12px' }}>Redeem Points (balance: {Number(customer.points_balance).toFixed(0)} pts)</label>
                      <input type="number" min="0" max={customer.points_balance} value={pointsToRedeem} onChange={e => setPointsToRedeem(e.target.value)} style={{ ...inputStyle, marginTop: '4px', fontSize: '12px' }} />
                      {pointsValue > 0 && <span style={{ color: '#4ade80', fontSize: '12px' }}>-₱{pointsValue.toFixed(2)} | Due: ₱{amountDue.toFixed(2)}</span>}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                    {['cash', 'gcash'].map(pm => (
                      <button key={pm} onClick={() => setPaymentMethod(pm)} style={{ ...btn(paymentMethod === pm ? accent : '#333', paymentMethod === pm ? '#000' : '#fff'), padding: '6px 12px', fontSize: '12px', flex: 1 }}>
                        {pm === 'cash' ? '💵 Cash' : '📱 GCash'}
                      </button>
                    ))}
                  </div>
                  <textarea value={orderNotes} onChange={e => setOrderNotes(e.target.value)} placeholder="Order notes (optional)" rows={2} style={{ ...inputStyle, resize: 'none', fontSize: '12px', marginBottom: '12px' }} />
                  <button onClick={placeOrder} disabled={loading} style={{ ...btn(), width: '100%', padding: '12px', opacity: loading ? 0.6 : 1 }}>
                    {loading ? '⏳ Processing...' : `✅ Place Order — ₱${amountDue.toFixed(2)}`}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
