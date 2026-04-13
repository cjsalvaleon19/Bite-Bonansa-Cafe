import React, { useState, useEffect } from 'react';
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
  card: { background: '#1a1a1a', border: '1px solid #333', borderRadius: '10px', padding: '20px' },
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
};

function calcPointsEarned(total) {
  const t = parseFloat(total) || 0;
  if (t >= 500) return parseFloat((t * 0.005).toFixed(2));
  if (t > 0) return parseFloat((t * 0.002).toFixed(2));
  return 0;
}

function NavBar({ customerName }) {
  const logout = async () => { await supabase.auth.signOut(); window.location.href = '/login'; };
  return (
    <nav style={S.nav}>
      <span style={S.logo}>☕ Bite Bonansa</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {customerName && <span style={{ color: '#999', fontSize: '13px' }}>Hi, {customerName}!</span>}
        <button onClick={logout} style={S.btn('#333')}>Logout</button>
      </div>
    </nav>
  );
}

// ─── Loyalty Card ─────────────────────────────────────────────────────────────
function LoyaltyCard({ customer }) {
  if (!customer) return null;
  return (
    <div style={{
      background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a1a 100%)',
      border: '2px solid #ffc107', borderRadius: '16px', padding: '28px',
      boxShadow: '0 8px 32px rgba(255,193,7,0.2)', maxWidth: '400px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>LOYALTY CARD</div>
          <div style={{ fontFamily: "'Playfair Display', serif", color: '#ffc107', fontSize: '22px' }}>☕ Bite Bonansa</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '10px', color: '#999' }}>MEMBER</div>
          <div style={{ fontSize: '11px', color: '#ffc107' }}>
            {new Date(customer.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short' })}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>CUSTOMER ID</div>
        <div style={{ fontFamily: 'monospace', fontSize: '24px', letterSpacing: '4px', color: '#fff', fontWeight: '700' }}>
          {customer.customer_id}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>CARDHOLDER</div>
          <div style={{ fontWeight: '600', fontSize: '16px' }}>{customer.name}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>POINTS BALANCE</div>
          <div style={{ fontWeight: '700', fontSize: '24px', color: '#ffc107' }}>
            {parseFloat(customer.points_balance).toFixed(0)}
            <span style={{ fontSize: '12px', color: '#999', marginLeft: '4px' }}>pts</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CustomerPage() {
  const [user, setUser] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [deliveryEnabled, setDeliveryEnabled] = useState(true);
  const [cart, setCart] = useState([]);
  const [activeTab, setActiveTab] = useState('menu');
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [orderMsg, setOrderMsg] = useState({ text: '', type: '' });
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [deptFilter, setDeptFilter] = useState('All');
  const DEPARTMENTS = ['All', 'Fryer 1', 'Fryer 2', 'Drinks', 'Pastries'];

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { window.location.href = '/login'; return; }
      setUser(session.user);

      // Fetch customer record
      const resp = await fetch(`/api/customers?user_id=${session.user.id}`);
      if (resp.ok) {
        const d = await resp.json();
        setCustomer(d.data);
      }

      // Fetch menu + delivery status in parallel
      const [menuResp, deliveryResp] = await Promise.all([
        fetch('/api/menu-items?includeOutOfStock=false'),
        fetch('/api/delivery-settings'),
      ]);
      const menuData = await menuResp.json();
      const deliveryData = await deliveryResp.json();
      setMenuItems(menuData.data || []);
      setDeliveryEnabled(deliveryData.enabled);
      setLoading(false);
    });
  }, []);

  const addToCart = (item) => {
    setCart(prev => {
      const exists = prev.find(c => c.id === item.id);
      if (exists) return prev.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { ...item, quantity: 1, special_instructions: '' }];
    });
  };

  const updateQty = (id, delta) => {
    setCart(prev => prev.map(c => c.id === id ? { ...c, quantity: c.quantity + delta } : c).filter(c => c.quantity > 0));
  };

  const subtotal = cart.reduce((s, c) => s + c.selling_price * c.quantity, 0);
  const maxRedeemable = customer ? Math.min(parseFloat(customer.points_balance), subtotal) : 0;
  const effectiveRedemption = Math.min(parseFloat(pointsToRedeem) || 0, maxRedeemable);
  const total = Math.max(0, subtotal - effectiveRedemption);
  const pointsEarned = calcPointsEarned(total);

  const placeOrder = async () => {
    if (!cart.length) { setOrderMsg({ text: 'Add items to your cart first!', type: 'error' }); return; }
    if (!deliveryEnabled) { setOrderMsg({ text: 'Delivery is unavailable. Please visit the cafe for pickup.', type: 'error' }); return; }

    const resp = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: customer?.customer_id,
        order_type: 'online',
        payment_method: pointsToRedeem > 0 ? 'hybrid' : paymentMethod,
        items: cart.map(c => ({
          menu_item_id: c.id, name: c.name, quantity: c.quantity,
          unit_price: c.selling_price, department: c.department,
          special_instructions: c.special_instructions,
        })),
        subtotal, points_used: effectiveRedemption, cash_amount: total, total_amount: total,
      }),
    });

    const result = await resp.json();
    if (resp.ok) {
      setOrderSuccess({ ...result.data, items: [...cart], pointsEarned, total });
      setCart([]);
      setPointsToRedeem(0);
      // Refresh customer data
      const custResp = await fetch(`/api/customers?user_id=${user.id}`);
      if (custResp.ok) { const d = await custResp.json(); setCustomer(d.data); }
      setActiveTab('orders');
      setOrderMsg({ text: `Order placed! You earned ${pointsEarned} loyalty points!`, type: 'success' });
    } else {
      setOrderMsg({ text: result.error || 'Order failed', type: 'error' });
    }
    setTimeout(() => setOrderMsg({ text: '', type: '' }), 5000);
  };

  const filtered = menuItems.filter(i => deptFilter === 'All' || i.department === deptFilter);

  if (loading) return (
    <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>☕</div>
        <p style={{ color: '#999' }}>Loading your account...</p>
      </div>
    </div>
  );

  return (
    <div style={S.page}>
      <NavBar customerName={customer?.name} />

      {/* Tabs */}
      <div style={{ background: '#1a1a1a', borderBottom: '1px solid #333', padding: '0 20px', display: 'flex' }}>
        {[
          { id: 'menu', label: '🍽️ Menu' },
          { id: 'cart', label: `🛒 Cart (${cart.reduce((s, c) => s + c.quantity, 0)})` },
          { id: 'loyalty', label: '🪙 Loyalty' },
          { id: 'orders', label: '📋 My Orders' },
        ].map(t => (
          <button key={t.id} style={S.tab(activeTab === t.id)} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {orderMsg.text && (
        <div style={{
          margin: '12px 20px', padding: '12px 16px', borderRadius: '6px', fontSize: '13px',
          background: orderMsg.type === 'success' ? '#1a3a1a' : '#3a1a1a',
          color: orderMsg.type === 'success' ? '#4caf50' : '#f44336',
          border: `1px solid ${orderMsg.type === 'success' ? '#4caf50' : '#f44336'}`,
        }}>{orderMsg.text}</div>
      )}

      {/* Delivery Banner */}
      {!deliveryEnabled && (
        <div style={{ margin: '12px 20px', padding: '12px 16px', borderRadius: '6px', fontSize: '13px', background: '#3a2a1a', color: '#ff9800', border: '1px solid #ff9800' }}>
          🛵 Delivery is currently unavailable — Pickup only. Visit us at the cafe!
        </div>
      )}

      {/* Menu Tab */}
      {activeTab === 'menu' && (
        <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {DEPARTMENTS.map(d => (
              <button key={d} onClick={() => setDeptFilter(d)} style={{
                padding: '7px 16px', borderRadius: '20px', border: '1px solid',
                borderColor: deptFilter === d ? '#ffc107' : '#444',
                background: deptFilter === d ? '#ffc107' : 'transparent',
                color: deptFilter === d ? '#0a0a0a' : '#999', cursor: 'pointer', fontSize: '13px',
              }}>{d}</button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
            {filtered.map(item => (
              <div key={item.id} style={{ ...S.card, position: 'relative' }}>
                <div style={{ fontSize: '11px', color: '#999', marginBottom: '4px' }}>{item.department}</div>
                <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '6px' }}>{item.name}</div>
                {item.description && <div style={{ color: '#999', fontSize: '12px', marginBottom: '10px', lineHeight: '1.4' }}>{item.description}</div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                  <span style={{ color: '#ffc107', fontWeight: '700', fontSize: '18px' }}>₱{parseFloat(item.selling_price).toFixed(2)}</span>
                  <button onClick={() => addToCart(item)} style={{ ...S.btn(), padding: '6px 14px', fontSize: '12px' }}>
                    + Add
                  </button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <p style={{ color: '#555', gridColumn: '1/-1', textAlign: 'center', padding: '40px 0' }}>No items available</p>
            )}
          </div>
        </div>
      )}

      {/* Cart Tab */}
      {activeTab === 'cart' && (
        <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{ color: '#ffc107', fontFamily: "'Playfair Display', serif", marginBottom: '20px' }}>Your Cart</h2>

          {cart.length === 0 ? (
            <div style={{ ...S.card, textAlign: 'center', padding: '48px' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>🛒</div>
              <p style={{ color: '#555' }}>Your cart is empty</p>
              <button onClick={() => setActiveTab('menu')} style={{ ...S.btn(), marginTop: '16px' }}>Browse Menu</button>
            </div>
          ) : (
            <>
              <div style={S.card}>
                {cart.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #222' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', fontSize: '14px' }}>{item.name}</div>
                      <div style={{ color: '#ffc107', fontSize: '13px' }}>₱{parseFloat(item.selling_price).toFixed(2)}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button onClick={() => updateQty(item.id, -1)} style={{ ...S.btn('#333'), padding: '3px 10px' }}>−</button>
                      <span style={{ fontSize: '14px', minWidth: '20px', textAlign: 'center' }}>{item.quantity}</span>
                      <button onClick={() => updateQty(item.id, 1)} style={{ ...S.btn('#333'), padding: '3px 10px' }}>+</button>
                    </div>
                    <span style={{ minWidth: '80px', textAlign: 'right', fontWeight: '600' }}>
                      ₱{(item.selling_price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Payment Options */}
              <div style={{ ...S.card, marginTop: '16px' }}>
                <label style={S.label}>Payment Method</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  {['cash', 'gcash'].map(m => (
                    <button key={m} onClick={() => setPaymentMethod(m)} style={{
                      padding: '8px 20px', borderRadius: '6px', border: '1px solid',
                      borderColor: paymentMethod === m ? '#ffc107' : '#444',
                      background: paymentMethod === m ? '#ffc107' : 'transparent',
                      color: paymentMethod === m ? '#0a0a0a' : '#999', cursor: 'pointer', textTransform: 'uppercase', fontSize: '12px',
                    }}>{m}</button>
                  ))}
                </div>

                {customer && maxRedeemable > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={S.label}>Use Points (max {maxRedeemable.toFixed(0)} pts = ₱{maxRedeemable.toFixed(2)})</label>
                    <input type="number" min="0" max={maxRedeemable} value={pointsToRedeem}
                      onChange={e => setPointsToRedeem(Math.min(parseFloat(e.target.value) || 0, maxRedeemable))}
                      style={S.input} />
                    <p style={{ color: '#999', fontSize: '11px', marginTop: '4px' }}>1 point = ₱1 discount</p>
                  </div>
                )}

                <div style={{ fontSize: '14px', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#999' }}>Subtotal:</span><span>₱{subtotal.toFixed(2)}</span>
                  </div>
                  {effectiveRedemption > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4caf50' }}>
                      <span>Points Discount:</span><span>−₱{effectiveRedemption.toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', fontSize: '16px', borderTop: '1px solid #333', paddingTop: '8px', marginTop: '4px' }}>
                    <span>Total:</span><span style={{ color: '#ffc107' }}>₱{total.toFixed(2)}</span>
                  </div>
                  {pointsEarned > 0 && (
                    <div style={{ fontSize: '12px', color: '#ffc107' }}>You'll earn {pointsEarned} loyalty points!</div>
                  )}
                </div>

                {!deliveryEnabled && (
                  <div style={{ padding: '10px', background: '#3a2a1a', borderRadius: '6px', color: '#ff9800', fontSize: '13px', marginBottom: '12px' }}>
                    🛵 Online ordering unavailable — Pickup only
                  </div>
                )}

                <button onClick={placeOrder} disabled={!deliveryEnabled} style={{
                  ...S.btn(), width: '100%', padding: '14px', fontSize: '15px',
                  opacity: !deliveryEnabled ? 0.5 : 1, cursor: !deliveryEnabled ? 'not-allowed' : 'pointer',
                }}>
                  {deliveryEnabled ? '✅ Place Order' : '🚫 Delivery Unavailable'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Loyalty Tab */}
      {activeTab === 'loyalty' && (
        <div style={{ padding: '20px', maxWidth: '700px', margin: '0 auto' }}>
          <h2 style={{ color: '#ffc107', fontFamily: "'Playfair Display', serif", marginBottom: '20px' }}>🪙 Loyalty Program</h2>

          {customer ? (
            <>
              <LoyaltyCard customer={customer} />

              <div style={{ ...S.card, marginTop: '20px' }}>
                <div style={{ marginBottom: '16px' }}>
                  <h3 style={{ color: '#ffc107', margin: '0 0 8px', fontSize: '16px' }}>How to Earn Points</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px', color: '#999' }}>
                    <div style={{ padding: '12px', background: '#2a2a2a', borderRadius: '6px' }}>
                      <div style={{ color: '#fff', fontWeight: '600', marginBottom: '4px' }}>Orders under ₱500</div>
                      <div>Earn <span style={{ color: '#ffc107' }}>0.2%</span> of your total as points</div>
                    </div>
                    <div style={{ padding: '12px', background: '#2a2a2a', borderRadius: '6px' }}>
                      <div style={{ color: '#fff', fontWeight: '600', marginBottom: '4px' }}>Orders ₱500 and above</div>
                      <div>Earn <span style={{ color: '#ffc107' }}>0.5%</span> of your total as points</div>
                    </div>
                  </div>
                  <div style={{ marginTop: '10px', padding: '10px', background: '#2a2a2a', borderRadius: '6px', fontSize: '13px', color: '#999' }}>
                    💡 <span style={{ color: '#fff' }}>1 point = ₱1</span> — Redeem your points at checkout for discounts!
                  </div>
                </div>

                <h3 style={{ color: '#ffc107', margin: '20px 0 12px', fontSize: '15px' }}>Points History</h3>
                {(customer.transactions || []).length === 0 ? (
                  <p style={{ color: '#555', fontSize: '13px' }}>No transactions yet. Start ordering to earn points!</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #333' }}>
                        {['Date', 'Description', 'Points'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '8px', color: '#ffc107', fontSize: '12px' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {customer.transactions.map(t => (
                        <tr key={t.id} style={{ borderBottom: '1px solid #222' }}>
                          <td style={{ padding: '10px 8px', color: '#999' }}>{new Date(t.created_at).toLocaleDateString('en-PH')}</td>
                          <td style={{ padding: '10px 8px' }}>{t.description}</td>
                          <td style={{ padding: '10px 8px', fontWeight: '700', color: t.type === 'earn' ? '#4caf50' : '#f44336' }}>
                            {t.type === 'earn' ? '+' : '−'}{parseFloat(t.amount).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          ) : (
            <div style={{ ...S.card, textAlign: 'center', padding: '48px' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>🪙</div>
              <p style={{ color: '#555' }}>No loyalty account found for your profile</p>
            </div>
          )}
        </div>
      )}

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <div style={{ padding: '20px', maxWidth: '700px', margin: '0 auto' }}>
          <h2 style={{ color: '#ffc107', fontFamily: "'Playfair Display', serif", marginBottom: '20px' }}>📋 My Orders</h2>

          {orderSuccess && (
            <div style={{ ...S.card, border: '1px solid #4caf50', marginBottom: '20px' }}>
              <div style={{ color: '#4caf50', fontWeight: '700', marginBottom: '10px' }}>✅ Order Confirmed!</div>
              <div style={{ fontSize: '13px', color: '#ccc' }}>
                <div>Order #{orderSuccess.id?.slice(0, 8).toUpperCase()}</div>
                <div>Total: ₱{parseFloat(orderSuccess.total || 0).toFixed(2)}</div>
                {orderSuccess.pointsEarned > 0 && <div style={{ color: '#ffc107' }}>Points earned: +{orderSuccess.pointsEarned}</div>}
                <div style={{ marginTop: '8px' }}>
                  {(orderSuccess.items || []).map((item, i) => (
                    <div key={i}>{item.name} x{item.quantity} — ₱{(item.selling_price * item.quantity).toFixed(2)}</div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!orderSuccess && (
            <div style={{ ...S.card, textAlign: 'center', padding: '48px' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>📋</div>
              <p style={{ color: '#555' }}>Place an order to see it here!</p>
              <button onClick={() => setActiveTab('menu')} style={{ ...S.btn(), marginTop: '16px' }}>Browse Menu</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
