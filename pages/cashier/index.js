import React, { useState, useEffect } from 'react';
import Link from 'next/link';

const bg = '#0a0a0a', card = '#1a1a1a', accent = '#ffc107', text = '#fff', muted = '#999';

const escHtml = (str) => String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const inputStyle = { width: '100%', background: '#111', border: '1px solid #333', color: '#fff', padding: '10px 14px', borderRadius: '6px', fontFamily: "'Poppins', sans-serif", fontSize: '14px', boxSizing: 'border-box' };
const btnStyle = (bg2='#ffc107', color='#000') => ({ background: bg2, color, border: 'none', borderRadius: '6px', padding: '10px 18px', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", fontWeight: '600', fontSize: '14px' });

export default function CashierPOS() {
  const [menuItems, setMenuItems] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [cart, setCart] = useState([]);
  const [orderType, setOrderType] = useState('dine_in');
  const [customerId, setCustomerId] = useState('');
  const [customer, setCustomer] = useState(null);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [cashAmount, setCashAmount] = useState(0);
  const [gcashAmount, setGcashAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [receiptDetails, setReceiptDetails] = useState({ customer_name: 'Walk-in', address: '', tin: '', business_style: '' });
  const [deliveryEnabled, setDeliveryEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [orderResult, setOrderResult] = useState(null);
  const [activeTab, setActiveTab] = useState('pos'); // pos | delivery | inventory
  const [filterDept, setFilterDept] = useState('all');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetchMenu();
    fetchDepartments();
    fetchDeliverySetting();
  }, []);

  const fetchMenu = async () => {
    const r = await fetch('/api/menu-items');
    const data = await r.json();
    setMenuItems(Array.isArray(data) ? data : []);
  };

  const fetchDepartments = async () => {
    const r = await fetch('/api/departments');
    const data = await r.json();
    setDepartments(Array.isArray(data) ? data : []);
  };

  const fetchDeliverySetting = async () => {
    const r = await fetch('/api/delivery-settings');
    const data = await r.json();
    if (data?.enabled !== undefined) setDeliveryEnabled(data.enabled);
  };

  const toggleDelivery = async () => {
    const newVal = !deliveryEnabled;
    await fetch('/api/delivery-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: newVal }) });
    setDeliveryEnabled(newVal);
    setMsg(newVal ? '✅ Delivery enabled' : '🚫 Delivery disabled');
    setTimeout(() => setMsg(''), 3000);
  };

  const toggleItemStatus = async (item) => {
    const newStatus = item.status === 'available' ? 'out_of_stock' : 'available';
    await fetch('/api/menu-items', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, status: newStatus }) });
    setMenuItems(prev => prev.map(m => m.id === item.id ? { ...m, status: newStatus } : m));
    setMsg(`${item.name}: ${newStatus === 'out_of_stock' ? 'Marked out of stock' : 'Marked available'}`);
    setTimeout(() => setMsg(''), 3000);
  };

  const lookupCustomer = async () => {
    if (!customerId.trim()) return;
    const r = await fetch(`/api/customers?customer_id=${customerId.trim()}`);
    const data = await r.json();
    if (data?.id) {
      setCustomer(data);
      setReceiptDetails(prev => ({ ...prev, customer_name: data.full_name }));
      setMsg(`✅ Customer found: ${data.full_name}`);
    } else {
      setMsg('❌ Customer not found');
      setCustomer(null);
    }
    setTimeout(() => setMsg(''), 3000);
  };

  const addToCart = (item) => {
    if (item.status === 'out_of_stock') return;
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id);
      if (existing) return prev.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { ...item, quantity: 1, special_instructions: '' }];
    });
  };

  const updateCartQty = (id, qty) => {
    if (qty <= 0) setCart(prev => prev.filter(c => c.id !== id));
    else setCart(prev => prev.map(c => c.id === id ? { ...c, quantity: qty } : c));
  };

  const updateInstructions = (id, val) => {
    setCart(prev => prev.map(c => c.id === id ? { ...c, special_instructions: val } : c));
  };

  const subtotal = cart.reduce((s, c) => s + c.selling_price * c.quantity, 0);
  const total = subtotal;
  const pointsValue = Math.min(Number(pointsToRedeem), customer?.points_balance || 0, total);
  const amountDue = Math.max(0, total - pointsValue);
  const change = Math.max(0, (Number(cashAmount) + Number(gcashAmount)) - amountDue);

  const placeOrder = async () => {
    if (cart.length === 0) { setMsg('❌ Cart is empty'); setTimeout(() => setMsg(''), 3000); return; }
    setLoading(true);
    const items = cart.map(c => ({
      menu_item_id: c.id, name: c.name, department_id: c.department_id,
      department_name: c.kitchen_departments?.name || c.department_name || '',
      quantity: c.quantity, unit_price: c.selling_price,
      special_instructions: c.special_instructions
    }));
    const body = {
      customer_id: customerId || null,
      customer_name: receiptDetails.customer_name,
      order_type: orderType,
      items, subtotal, total,
      points_redeemed: pointsValue,
      cash_amount: Number(cashAmount),
      gcash_amount: Number(gcashAmount),
      change_amount: change,
      payment_method: paymentMethod,
      receipt_details: { address: receiptDetails.address, tin: receiptDetails.tin, business_style: receiptDetails.business_style }
    };
    const r = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await r.json();
    setLoading(false);
    if (data.order) {
      setOrderResult(data);
      setCart([]);
      setCustomer(null);
      setCustomerId('');
      setPointsToRedeem(0);
      setCashAmount(0);
      setGcashAmount(0);
      setReceiptDetails({ customer_name: 'Walk-in', address: '', tin: '', business_style: '' });
    } else {
      setMsg('❌ ' + (data.error || 'Failed to place order'));
      setTimeout(() => setMsg(''), 4000);
    }
  };

  const printCustomerReceipt = (orderData) => {
    const { order, receipt } = orderData;
    const w = window.open('', '_blank', 'width=320,height=600');
    w.document.write(`
      <html><head><title>Receipt</title><style>
        body { font-family: monospace; font-size: 12px; margin: 10px; width: 280px; }
        hr { border-top: 1px dashed #000; }
        .center { text-align: center; }
        .row { display: flex; justify-content: space-between; }
        .bold { font-weight: bold; }
      </style></head><body>
      <div class="center bold">BITE BONANSA CAFE</div>
      <div class="center">Laconon-Salacafe Rd, Tboli, SC</div>
      <hr/>
      <div>Receipt: ${escHtml(receipt?.receipt_number)}</div>
      <div>Date: ${new Date().toLocaleString('en-PH')}</div>
      <div>Order Type: ${escHtml(order?.order_type?.replace('_',' ').toUpperCase())}</div>
      <hr/>
      <div>Customer: ${escHtml(receiptDetails.customer_name || order?.customer_name || 'Walk-in')}</div>
      ${customerId ? `<div>ID: ${escHtml(customerId)}</div>` : ''}
      ${receiptDetails.address ? `<div>Address: ${escHtml(receiptDetails.address)}</div>` : ''}
      ${receiptDetails.tin ? `<div>TIN: ${escHtml(receiptDetails.tin)}</div>` : ''}
      ${receiptDetails.business_style ? `<div>Business: ${escHtml(receiptDetails.business_style)}</div>` : ''}
      <hr/>
      <div class="bold">ITEMS</div>
      ${cart.map(item => `<div class="row"><span>${item.quantity}x ${escHtml(item.name)}</span><span>₱${(item.selling_price * item.quantity).toFixed(2)}</span></div>${item.special_instructions ? `<div style="color:#666;font-size:11px">  Note: ${escHtml(item.special_instructions)}</div>` : ''}`).join('')}
      <hr/>
      <div class="row"><span>SUBTOTAL:</span><span>₱${subtotal.toFixed(2)}</span></div>
      <div class="row bold"><span>TOTAL:</span><span>₱${total.toFixed(2)}</span></div>
      ${pointsValue > 0 ? `<div class="row"><span>Points Redeemed:</span><span>-₱${pointsValue.toFixed(2)}</span></div>` : ''}
      ${Number(cashAmount) > 0 ? `<div class="row"><span>Cash:</span><span>₱${Number(cashAmount).toFixed(2)}</span></div>` : ''}
      ${Number(gcashAmount) > 0 ? `<div class="row"><span>GCash:</span><span>₱${Number(gcashAmount).toFixed(2)}</span></div>` : ''}
      ${change > 0 ? `<div class="row"><span>Change:</span><span>₱${change.toFixed(2)}</span></div>` : ''}
      ${customer ? `<div class="row"><span>Points Balance:</span><span>${(Number(customer.points_balance) - pointsValue + (total > 0 ? Math.floor(total * (total >= 500 ? 0.005 : 0.002)) : 0)).toFixed(2)} pts</span></div>` : ''}
      <hr/>
      <div class="center">We hope we satisfied your cravings!</div>
      ${receipt ? `<div class="center" style="margin-top:10px">Scan QR for reviews:</div><div class="center">${escHtml(receipt.qr_code_data)}</div>` : ''}
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  const printKitchenReceipts = (orderData) => {
    const { order } = orderData;
    // Group items by department
    const byDept = {};
    cart.forEach(item => {
      const deptName = item.kitchen_departments?.name || item.department_name || 'General';
      if (!byDept[deptName]) byDept[deptName] = [];
      byDept[deptName].push(item);
    });
    Object.entries(byDept).forEach(([deptName, deptItems]) => {
      const w = window.open('', '_blank', 'width=300,height=400');
      w.document.write(`
        <html><head><title>Kitchen - ${escHtml(deptName)}</title><style>
          body { font-family: monospace; font-size: 13px; margin: 10px; width: 280px; }
          hr { border-top: 1px dashed #000; }
          .center { text-align: center; }
          .big { font-size: 16px; font-weight: bold; }
        </style></head><body>
        <div class="center big">KITCHEN: ${escHtml(deptName.toUpperCase())}</div>
        <div class="center">${new Date().toLocaleTimeString('en-PH')}</div>
        <div>Order: ${escHtml(order?.order_number || 'NEW')}</div>
        <div>Type: ${escHtml(order?.order_type?.replace('_',' ').toUpperCase() || '')}</div>
        <hr/>
        ${deptItems.map(item => `
          <div class="big">${item.quantity}x ${escHtml(item.name)}</div>
          ${item.special_instructions ? `<div>** ${escHtml(item.special_instructions)} **</div>` : ''}
          <hr/>
        `).join('')}
        </body></html>
      `);
      w.document.close();
      w.print();
    });
  };

  const filteredMenu = menuItems.filter(m => filterDept === 'all' || m.department_id === filterDept);

  if (orderResult) {
    return (
      <div style={{ minHeight: '100vh', background: bg, fontFamily: "'Poppins', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ background: card, border: '2px solid #ffc107', borderRadius: '16px', padding: '40px', maxWidth: '500px', width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: '60px', marginBottom: '16px' }}>✅</div>
          <h2 style={{ color: accent, fontSize: '24px', marginBottom: '8px', fontFamily: "'Playfair Display', serif" }}>Order Placed!</h2>
          <p style={{ color: muted, marginBottom: '8px' }}>Order: {orderResult.order?.order_number}</p>
          <p style={{ color: muted, marginBottom: '24px' }}>Receipt: {orderResult.receipt?.receipt_number}</p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => printCustomerReceipt(orderResult)} style={btnStyle()}>🖨️ Print Customer Receipt</button>
            <button onClick={() => printKitchenReceipts(orderResult)} style={btnStyle('#333', '#fff')}>🍳 Print Kitchen Receipts</button>
            <button onClick={() => setOrderResult(null)} style={btnStyle('#1a1a1a', '#fff')}>➕ New Order</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: bg, fontFamily: "'Poppins', sans-serif" }}>
      {/* Header */}
      <div style={{ background: card, borderBottom: '1px solid #333', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ color: accent, margin: 0, fontSize: '20px', fontFamily: "'Playfair Display', serif" }}>☕ Cashier POS</h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {msg && <span style={{ color: accent, fontSize: '13px' }}>{msg}</span>}
          <button onClick={() => setActiveTab('pos')} style={btnStyle(activeTab==='pos'?accent:'#333', activeTab==='pos'?'#000':'#fff')}>🧾 POS</button>
          <button onClick={() => setActiveTab('delivery')} style={btnStyle(activeTab==='delivery'?accent:'#333', activeTab==='delivery'?'#000':'#fff')}>🛵 Delivery</button>
          <button onClick={() => setActiveTab('inventory')} style={btnStyle(activeTab==='inventory'?accent:'#333', activeTab==='inventory'?'#000':'#fff')}>📦 Inventory</button>
          <Link href="/dashboard" style={{ color: muted, fontSize: '13px' }}>← Dashboard</Link>
        </div>
      </div>

      {/* Delivery Tab */}
      {activeTab === 'delivery' && (
        <div style={{ padding: '32px', maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{ color: accent }}>🛵 Delivery Management</h2>
          <div style={{ background: card, border: '1px solid #333', borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
            <p style={{ color: muted, marginBottom: '24px' }}>Toggle online delivery availability. When disabled, customers cannot select delivery at checkout.</p>
            <div style={{ fontSize: '18px', color: text, marginBottom: '24px' }}>
              Status: <strong style={{ color: deliveryEnabled ? '#4ade80' : '#ef4444' }}>{deliveryEnabled ? '🟢 ENABLED' : '🔴 DISABLED'}</strong>
            </div>
            <button onClick={toggleDelivery} style={btnStyle(deliveryEnabled ? '#ef4444' : '#4ade80', '#fff')}>
              {deliveryEnabled ? '🚫 Disable Delivery' : '✅ Enable Delivery'}
            </button>
          </div>
        </div>
      )}

      {/* Inventory Tab */}
      {activeTab === 'inventory' && (
        <div style={{ padding: '32px' }}>
          <h2 style={{ color: accent }}>📦 Inventory Status</h2>
          <p style={{ color: muted }}>Mark items as out of stock to hide them from online orders.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
            {menuItems.map(item => (
              <div key={item.id} style={{ background: card, border: `1px solid ${item.status === 'out_of_stock' ? '#ef4444' : '#333'}`, borderRadius: '10px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: text, fontWeight: '600', marginBottom: '4px' }}>{item.name}</div>
                  <div style={{ color: item.status === 'out_of_stock' ? '#ef4444' : '#4ade80', fontSize: '12px' }}>
                    {item.status === 'out_of_stock' ? '❌ Out of Stock' : '✅ Available'}
                  </div>
                </div>
                <button onClick={() => toggleItemStatus(item)} style={btnStyle(item.status === 'out_of_stock' ? '#4ade80' : '#ef4444', '#fff')}>
                  {item.status === 'out_of_stock' ? 'Restore' : 'Mark OOS'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* POS Tab */}
      {activeTab === 'pos' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', height: 'calc(100vh - 57px)' }}>
          {/* Menu Panel */}
          <div style={{ padding: '20px', overflowY: 'auto' }}>
            {/* Department filter */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <button onClick={() => setFilterDept('all')} style={btnStyle(filterDept==='all'?accent:'#333', filterDept==='all'?'#000':'#fff')}>All</button>
              {departments.map(d => (
                <button key={d.id} onClick={() => setFilterDept(d.id)} style={btnStyle(filterDept===d.id?accent:'#333', filterDept===d.id?'#000':'#fff')}>{d.name}</button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
              {filteredMenu.map(item => (
                <div key={item.id} onClick={() => addToCart(item)}
                  style={{ background: card, border: `1px solid ${item.status === 'out_of_stock' ? '#555' : '#333'}`, borderRadius: '10px', padding: '16px', cursor: item.status === 'out_of_stock' ? 'not-allowed' : 'pointer', opacity: item.status === 'out_of_stock' ? 0.5 : 1, transition: 'border-color 0.2s' }}
                  onMouseOver={e => { if (item.status !== 'out_of_stock') e.currentTarget.style.borderColor = accent; }}
                  onMouseOut={e => { e.currentTarget.style.borderColor = item.status === 'out_of_stock' ? '#555' : '#333'; }}>
                  <div style={{ fontSize: '13px', color: muted, marginBottom: '4px' }}>{item.kitchen_departments?.name || ''}</div>
                  <div style={{ fontWeight: '600', color: text, marginBottom: '6px', fontSize: '14px' }}>{item.name}</div>
                  <div style={{ color: accent, fontWeight: '700' }}>₱{Number(item.selling_price).toFixed(2)}</div>
                  {item.status === 'out_of_stock' && <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px' }}>Out of Stock</div>}
                </div>
              ))}
            </div>
          </div>

          {/* Cart Panel */}
          <div style={{ background: card, borderLeft: '1px solid #333', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid #333' }}>
              <h3 style={{ color: accent, margin: '0 0 12px' }}>Order Details</h3>
              {/* Order Type */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                {['dine_in','pickup','delivery'].map(ot => (
                  <button key={ot} disabled={ot === 'delivery' && !deliveryEnabled}
                    onClick={() => setOrderType(ot)}
                    style={{ ...btnStyle(orderType===ot?accent:'#333', orderType===ot?'#000':'#fff'), fontSize: '11px', padding: '6px 10px', opacity: (ot==='delivery' && !deliveryEnabled) ? 0.4 : 1 }}>
                    {ot === 'dine_in' ? '🍽️ Dine-in' : ot === 'pickup' ? '🥡 Pickup' : '🛵 Delivery'}
                  </button>
                ))}
              </div>
              {/* Customer Lookup */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input value={customerId} onChange={e => setCustomerId(e.target.value)} placeholder="Customer ID (BBC-XXXXX)" style={{ ...inputStyle, flex: 1 }} />
                <button onClick={lookupCustomer} style={btnStyle()}>🔍</button>
              </div>
              {customer && <div style={{ color: '#4ade80', fontSize: '12px', marginBottom: '8px' }}>✅ {customer.full_name} | {Number(customer.points_balance).toFixed(2)} pts</div>}
              {/* Receipt Details */}
              <input value={receiptDetails.customer_name} onChange={e => setReceiptDetails(p => ({...p, customer_name: e.target.value}))} placeholder="Customer Name (default: Walk-in)" style={{ ...inputStyle, marginBottom: '6px' }} />
              <input value={receiptDetails.address} onChange={e => setReceiptDetails(p => ({...p, address: e.target.value}))} placeholder="Address (optional)" style={{ ...inputStyle, marginBottom: '6px' }} />
              <input value={receiptDetails.tin} onChange={e => setReceiptDetails(p => ({...p, tin: e.target.value}))} placeholder="TIN (optional)" style={{ ...inputStyle, marginBottom: '6px' }} />
              <input value={receiptDetails.business_style} onChange={e => setReceiptDetails(p => ({...p, business_style: e.target.value}))} placeholder="Business Style (optional)" style={inputStyle} />
            </div>

            {/* Cart Items */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
              {cart.length === 0 ? (
                <p style={{ color: muted, textAlign: 'center', marginTop: '20px' }}>Add items from the menu</p>
              ) : cart.map(item => (
                <div key={item.id} style={{ borderBottom: '1px solid #333', paddingBottom: '10px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ color: text, fontSize: '14px', flex: 1 }}>{item.name}</span>
                    <span style={{ color: accent, fontWeight: '700', fontSize: '14px' }}>₱{(item.selling_price * item.quantity).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button onClick={() => updateCartQty(item.id, item.quantity - 1)} style={{ ...btnStyle('#333','#fff'), padding: '4px 10px' }}>−</button>
                    <span style={{ color: text, minWidth: '24px', textAlign: 'center' }}>{item.quantity}</span>
                    <button onClick={() => updateCartQty(item.id, item.quantity + 1)} style={{ ...btnStyle('#333','#fff'), padding: '4px 10px' }}>+</button>
                    <input value={item.special_instructions} onChange={e => updateInstructions(item.id, e.target.value)} placeholder="Notes" style={{ ...inputStyle, fontSize: '12px', padding: '4px 8px' }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Payment */}
            <div style={{ padding: '16px 20px', borderTop: '1px solid #333' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: muted }}>Subtotal</span>
                <span style={{ color: text }}>₱{subtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span style={{ color: text, fontWeight: '700', fontSize: '18px' }}>TOTAL</span>
                <span style={{ color: accent, fontWeight: '700', fontSize: '18px' }}>₱{total.toFixed(2)}</span>
              </div>
              {customer && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ color: muted, fontSize: '12px' }}>Redeem Points (max {Number(customer.points_balance).toFixed(0)} pts = ₱{Number(customer.points_balance).toFixed(2)})</label>
                  <input type="number" min="0" max={customer.points_balance} value={pointsToRedeem} onChange={e => setPointsToRedeem(e.target.value)} style={{ ...inputStyle, marginTop: '4px' }} />
                  {pointsValue > 0 && <div style={{ color: '#4ade80', fontSize: '12px', marginTop: '4px' }}>Redeeming: ₱{pointsValue.toFixed(2)} | Amount Due: ₱{amountDue.toFixed(2)}</div>}
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                {['cash','gcash','points','hybrid'].map(pm => (
                  <button key={pm} onClick={() => setPaymentMethod(pm)} style={{ ...btnStyle(paymentMethod===pm?accent:'#333', paymentMethod===pm?'#000':'#fff'), fontSize: '11px', padding: '6px 10px', flex: 1 }}>
                    {pm === 'cash' ? '💵 Cash' : pm === 'gcash' ? '📱 GCash' : pm === 'points' ? '⭐ Points' : '🔀 Hybrid'}
                  </button>
                ))}
              </div>
              {(paymentMethod === 'cash' || paymentMethod === 'hybrid') && (
                <input type="number" value={cashAmount} onChange={e => setCashAmount(e.target.value)} placeholder="Cash Amount" style={{ ...inputStyle, marginBottom: '6px' }} />
              )}
              {(paymentMethod === 'gcash' || paymentMethod === 'hybrid') && (
                <input type="number" value={gcashAmount} onChange={e => setGcashAmount(e.target.value)} placeholder="GCash Amount" style={{ ...inputStyle, marginBottom: '6px' }} />
              )}
              {change > 0 && <div style={{ color: '#4ade80', fontSize: '14px', marginBottom: '8px' }}>Change: ₱{change.toFixed(2)}</div>}
              <button onClick={placeOrder} disabled={loading || cart.length === 0} style={{ ...btnStyle(), width: '100%', padding: '14px', fontSize: '16px', opacity: loading || cart.length === 0 ? 0.6 : 1 }}>
                {loading ? '⏳ Processing...' : `💳 Place Order — ₱${total.toFixed(2)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
