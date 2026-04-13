import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../utils/supabaseClient';
import { calculatePointsEarned, calculateRedemption } from '../utils/pointsCalculator';

const SAMPLE_ITEMS = [
  { id: 1, name: 'Espresso', price: 90 },
  { id: 2, name: 'Americano', price: 110 },
  { id: 3, name: 'Cappuccino', price: 140 },
  { id: 4, name: 'Latte', price: 150 },
  { id: 5, name: 'Mocha', price: 160 },
  { id: 6, name: 'Frappuccino', price: 185 },
];

const cardStyle = {
  backgroundColor: '#1e1e1e',
  borderRadius: '12px',
  padding: '24px',
  border: '1px solid #333',
  marginBottom: '20px',
};

const inputStyle = {
  width: '100%',
  padding: '12px',
  border: '2px solid #ffc107',
  borderRadius: '6px',
  backgroundColor: '#2a2a2a',
  color: '#fff',
  fontSize: '14px',
  boxSizing: 'border-box',
};

export default function Payment() {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);

  const [cart, setCart] = useState({});
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [orderError, setOrderError] = useState('');

  useEffect(() => {
    loadCustomer();
  }, []);

  const loadCustomer = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) {
      window.location.href = '/login';
      return;
    }
    const { data } = await supabase
      .from('customers')
      .select('customer_id, name, points_balance')
      .eq('id', sessionData.session.user.id)
      .single();
    setCustomer(data || null);
    setLoading(false);
  };

  // Cart helpers
  const addToCart = (item) => setCart((prev) => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }));
  const removeFromCart = (itemId) =>
    setCart((prev) => {
      const next = { ...prev };
      if (next[itemId] > 1) next[itemId]--;
      else delete next[itemId];
      return next;
    });

  const cartItems = SAMPLE_ITEMS.filter((i) => cart[i.id] > 0).map((i) => ({
    ...i,
    quantity: cart[i.id],
    subtotal: i.price * cart[i.id],
  }));
  const totalAmount = cartItems.reduce((s, i) => s + i.subtotal, 0);

  const pointsBalance = customer ? parseFloat(customer.points_balance) : 0;
  const redemption = calculateRedemption(totalAmount, pointsToRedeem, pointsBalance);
  const pointsEarned = calculatePointsEarned(redemption.remainingBalance);

  const fullPaymentMethod =
    pointsToRedeem > 0
      ? redemption.remainingBalance > 0
        ? `Points+${paymentMethod}`
        : 'Points'
      : paymentMethod;

  const handleOrder = async () => {
    if (cartItems.length === 0) return;
    setOrderLoading(true);
    setOrderError('');

    const res = await fetch('/api/loyalty/process-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: customer?.customer_id || null,
        items: cartItems.map((i) => ({ productId: i.id, name: i.name, quantity: i.quantity, price: i.price })),
        totalAmount,
        pointsToRedeem: redemption.pointsApplied,
        paymentMethod: fullPaymentMethod,
        orderType: 'online',
      }),
    });

    const json = await res.json();
    setOrderLoading(false);

    if (!json.success) {
      setOrderError(json.message || 'Order failed');
      return;
    }

    setOrderSuccess(json);
    setCart({});
    setPointsToRedeem(0);
    if (customer) {
      setCustomer((prev) => ({ ...prev, points_balance: json.newPointsBalance }));
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', color: '#ffc107', fontFamily: "'Poppins', sans-serif" }}>
        <p>⏳ Loading...</p>
      </div>
    );
  }

  if (orderSuccess) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: "'Poppins', sans-serif", color: '#fff', padding: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: '480px', width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: '72px', marginBottom: '20px' }}>🎉</div>
          <h2 style={{ color: '#4caf50', fontSize: '30px', marginBottom: '16px' }}>Order Confirmed!</h2>
          <div style={{ backgroundColor: '#1e1e1e', borderRadius: '12px', padding: '28px', marginBottom: '24px', border: '1px solid #333' }}>
            <p style={{ color: '#999', margin: '0 0 10px' }}>Order Total: <strong style={{ color: '#fff' }}>₱{orderSuccess.order.total_amount?.toFixed(2)}</strong></p>
            {orderSuccess.pointsApplied > 0 && (
              <p style={{ color: '#999', margin: '0 0 10px' }}>Points Used: <strong style={{ color: '#ff6b6b' }}>-{orderSuccess.pointsApplied.toFixed(2)} pts</strong></p>
            )}
            {orderSuccess.remainingBalance > 0 && (
              <p style={{ color: '#999', margin: '0 0 10px' }}>
                Paid via {paymentMethod}: <strong style={{ color: '#fff' }}>₱{orderSuccess.remainingBalance.toFixed(2)}</strong>
              </p>
            )}
            {orderSuccess.pointsEarned > 0 && (
              <p style={{ color: '#4caf50', margin: 0, fontWeight: '600' }}>
                ⭐ +{orderSuccess.pointsEarned.toFixed(2)} points earned!
              </p>
            )}
            {customer && (
              <p style={{ color: '#999', margin: '10px 0 0', fontSize: '13px' }}>
                New Balance: <strong style={{ color: '#4caf50' }}>{parseFloat(orderSuccess.newPointsBalance || 0).toFixed(2)} pts</strong>
              </p>
            )}
          </div>
          <Link href="/dashboard" style={{ display: 'inline-block', padding: '14px 32px', backgroundColor: '#ffc107', color: '#0a0a0a', borderRadius: '8px', textDecoration: 'none', fontWeight: '700', fontSize: '16px' }}>
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0a0a0a 0%, #111 100%)', fontFamily: "'Poppins', sans-serif", color: '#fff', padding: '20px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <h1 style={{ color: '#ffc107', fontSize: '28px', fontWeight: 'bold', fontFamily: "'Playfair Display', serif" }}>☕ Order & Pay</h1>
          <Link href="/dashboard" style={{ color: '#ffc107', fontSize: '14px' }}>← Dashboard</Link>
        </div>

        {/* Points balance banner */}
        {customer && (
          <div style={{ ...cardStyle, background: 'linear-gradient(135deg, #001a0a 0%, #002a10 100%)', border: '1px solid #4caf50', marginBottom: '20px' }}>
            <p style={{ margin: 0, color: '#4caf50', fontSize: '14px' }}>
              ⭐ Your points balance: <strong style={{ fontSize: '18px' }}>{parseFloat(customer.points_balance).toFixed(2)} pts</strong>
              <span style={{ color: '#999', fontSize: '12px', marginLeft: '8px' }}>(1 pt = ₱1)</span>
            </p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '24px' }}>
          {/* Menu */}
          <div>
            <div style={cardStyle}>
              <h3 style={{ color: '#ffc107', fontSize: '16px', marginBottom: '14px' }}>🍵 Select Items</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
                {SAMPLE_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => addToCart(item)}
                    style={{
                      padding: '14px 10px',
                      backgroundColor: '#2a2a2a',
                      border: cart[item.id] ? '2px solid #ffc107' : '2px solid #333',
                      borderRadius: '8px',
                      color: '#fff',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <p style={{ margin: 0, fontWeight: '600', fontSize: '13px' }}>{item.name}</p>
                    <p style={{ margin: '4px 0 0', color: '#ffc107', fontSize: '14px' }}>₱{item.price}</p>
                    {cart[item.id] > 0 && <p style={{ margin: '4px 0 0', color: '#4caf50', fontSize: '12px' }}>× {cart[item.id]}</p>}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Order & Payment panel */}
          <div>
            <div style={{ ...cardStyle, position: 'sticky', top: '20px' }}>
              <h3 style={{ color: '#ffc107', fontSize: '18px', marginBottom: '16px' }}>🧾 Your Order</h3>

              {cartItems.length === 0 ? (
                <p style={{ color: '#666', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>No items selected</p>
              ) : (
                <>
                  {cartItems.map((item) => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div>
                        <p style={{ margin: 0, fontSize: '14px' }}>{item.name}</p>
                        <p style={{ margin: 0, fontSize: '12px', color: '#999' }}>× {item.quantity}</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#ffc107' }}>₱{item.subtotal}</span>
                        <button onClick={() => removeFromCart(item.id)} style={{ background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer', fontSize: '18px' }}>×</button>
                      </div>
                    </div>
                  ))}

                  <div style={{ borderTop: '1px solid #333', marginTop: '12px', paddingTop: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '18px', marginBottom: '16px' }}>
                      <span>Total</span>
                      <span style={{ color: '#ffc107' }}>₱{totalAmount.toFixed(2)}</span>
                    </div>

                    {/* Points redemption */}
                    {customer && pointsBalance > 0 && (
                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', color: '#4caf50', fontSize: '13px', marginBottom: '6px', fontWeight: '600' }}>
                          🎁 Use Points (available: {pointsBalance.toFixed(2)})
                        </label>
                        <input
                          type="number"
                          min="0"
                          max={Math.min(pointsBalance, totalAmount)}
                          step="0.01"
                          value={pointsToRedeem}
                          onChange={(e) => setPointsToRedeem(parseFloat(e.target.value) || 0)}
                          style={{ ...inputStyle, border: '2px solid #4caf50' }}
                        />
                        {pointsToRedeem > 0 && (
                          <div style={{ marginTop: '8px', fontSize: '13px' }}>
                            <p style={{ margin: '2px 0', color: '#ff6b6b' }}>Points: -₱{redemption.pointsApplied.toFixed(2)}</p>
                            <p style={{ margin: '2px 0', color: '#ffc107' }}>Balance to pay: ₱{redemption.remainingBalance.toFixed(2)}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Payment method */}
                    {(redemption.remainingBalance > 0 || pointsToRedeem === 0) && (
                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', color: '#ffc107', fontSize: '13px', marginBottom: '8px', fontWeight: '600' }}>
                          💳 Payment Method
                        </label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {['Cash', 'GCash'].map((m) => (
                            <button
                              key={m}
                              onClick={() => setPaymentMethod(m)}
                              style={{
                                flex: 1,
                                padding: '10px',
                                backgroundColor: paymentMethod === m ? '#ffc107' : '#2a2a2a',
                                color: paymentMethod === m ? '#0a0a0a' : '#fff',
                                border: '2px solid #ffc107',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: '600',
                                fontSize: '14px',
                              }}
                            >
                              {m === 'Cash' ? '💵 Cash' : '📱 GCash'}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {pointsEarned > 0 && (
                      <p style={{ fontSize: '13px', color: '#4caf50', marginBottom: '14px' }}>
                        ⭐ You'll earn: +{pointsEarned.toFixed(2)} points
                      </p>
                    )}

                    {orderError && <p style={{ color: '#ff6b6b', fontSize: '13px', marginBottom: '10px' }}>⚠️ {orderError}</p>}

                    <button
                      onClick={handleOrder}
                      disabled={cartItems.length === 0 || orderLoading}
                      style={{
                        width: '100%',
                        padding: '14px',
                        backgroundColor: cartItems.length === 0 || orderLoading ? '#555' : '#ffc107',
                        color: cartItems.length === 0 || orderLoading ? '#888' : '#0a0a0a',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '16px',
                        fontWeight: '700',
                        cursor: cartItems.length === 0 || orderLoading ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {orderLoading ? '⏳ Processing...' : '✅ Confirm & Pay'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
