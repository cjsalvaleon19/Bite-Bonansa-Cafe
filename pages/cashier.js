import React, { useState } from 'react';
import Link from 'next/link';
import { calculatePointsEarned, calculateRedemption } from '../utils/pointsCalculator';

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

const cardStyle = {
  backgroundColor: '#1e1e1e',
  borderRadius: '12px',
  padding: '24px',
  border: '1px solid #333',
  marginBottom: '20px',
};

const MENU_ITEMS = [
  { id: 1, name: 'Espresso', price: 90 },
  { id: 2, name: 'Americano', price: 110 },
  { id: 3, name: 'Cappuccino', price: 140 },
  { id: 4, name: 'Latte', price: 150 },
  { id: 5, name: 'Mocha', price: 160 },
  { id: 6, name: 'Frappuccino', price: 185 },
  { id: 7, name: 'Matcha Latte', price: 175 },
  { id: 8, name: 'Spanish Latte', price: 165 },
];

export default function Cashier() {
  const [customerId, setCustomerId] = useState('');
  const [customer, setCustomer] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');

  const [cart, setCart] = useState({});
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [orderError, setOrderError] = useState('');

  // --- Customer lookup ---
  const handleLookup = async (e) => {
    e.preventDefault();
    setLookupLoading(true);
    setLookupError('');
    setCustomer(null);

    const res = await fetch(`/api/loyalty/customer-lookup?customerId=${encodeURIComponent(customerId)}`);
    const json = await res.json();
    setLookupLoading(false);

    if (!json.success) {
      setLookupError(json.message || 'Customer not found');
      return;
    }
    setCustomer(json.customer);
    setPointsToRedeem(0);
  };

  // --- Cart helpers ---
  const addToCart = (item) => {
    setCart((prev) => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }));
  };

  const removeFromCart = (itemId) => {
    setCart((prev) => {
      const next = { ...prev };
      if (next[itemId] > 1) next[itemId]--;
      else delete next[itemId];
      return next;
    });
  };

  const cartItems = MENU_ITEMS.filter((i) => cart[i.id] > 0).map((i) => ({
    ...i,
    quantity: cart[i.id],
    subtotal: i.price * cart[i.id],
  }));

  const totalAmount = cartItems.reduce((s, i) => s + i.subtotal, 0);

  // --- Points/payment calculation ---
  const effectivePoints = customer ? customer.points_balance : 0;
  const redemption = calculateRedemption(totalAmount, pointsToRedeem, effectivePoints);
  const pointsEarned = calculatePointsEarned(redemption.remainingBalance);

  const showPointsPayment = customer && pointsToRedeem > 0;
  const hybridPayment = showPointsPayment && redemption.remainingBalance > 0;
  const fullPaymentMethod = showPointsPayment
    ? hybridPayment
      ? `Points+${paymentMethod}`
      : 'Points'
    : paymentMethod;

  // --- Place order ---
  const handlePlaceOrder = async () => {
    if (cartItems.length === 0) return;
    setOrderLoading(true);
    setOrderError('');
    setOrderSuccess(null);

    const res = await fetch('/api/loyalty/process-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: customer?.customer_id || null,
        items: cartItems.map((i) => ({ productId: i.id, name: i.name, quantity: i.quantity, price: i.price })),
        totalAmount,
        pointsToRedeem: redemption.pointsApplied,
        paymentMethod: fullPaymentMethod,
        orderType: 'cashier',
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
    // Refresh customer balance
    if (customer) {
      setCustomer((prev) => ({ ...prev, points_balance: json.newPointsBalance }));
    }
  };

  if (orderSuccess) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: "'Poppins', sans-serif", color: '#fff', padding: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: '500px', width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>✅</div>
          <h2 style={{ color: '#4caf50', fontSize: '28px', marginBottom: '12px' }}>Order Placed!</h2>
          <div style={{ backgroundColor: '#1e1e1e', borderRadius: '12px', padding: '24px', marginBottom: '20px', border: '1px solid #333' }}>
            <p style={{ color: '#999', margin: '0 0 8px' }}>Order Total: <strong style={{ color: '#fff' }}>₱{orderSuccess.order.total_amount?.toFixed(2)}</strong></p>
            {orderSuccess.pointsApplied > 0 && (
              <p style={{ color: '#999', margin: '0 0 8px' }}>Points Used: <strong style={{ color: '#ff6b6b' }}>-{orderSuccess.pointsApplied.toFixed(2)} pts</strong></p>
            )}
            {orderSuccess.remainingBalance > 0 && (
              <p style={{ color: '#999', margin: '0 0 8px' }}>Cash/GCash: <strong style={{ color: '#fff' }}>₱{orderSuccess.remainingBalance.toFixed(2)}</strong></p>
            )}
            {orderSuccess.pointsEarned > 0 && (
              <p style={{ color: '#999', margin: 0 }}>Points Earned: <strong style={{ color: '#4caf50' }}>+{orderSuccess.pointsEarned.toFixed(2)} pts</strong></p>
            )}
          </div>
          <button
            onClick={() => { setOrderSuccess(null); setCustomer(null); setCustomerId(''); }}
            style={{ padding: '12px 32px', backgroundColor: '#ffc107', color: '#0a0a0a', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: '700', cursor: 'pointer' }}
          >
            New Order
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0a0a0a 0%, #111 100%)', fontFamily: "'Poppins', sans-serif", color: '#fff', padding: '20px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <h1 style={{ color: '#ffc107', fontSize: '28px', fontWeight: 'bold', fontFamily: "'Playfair Display', serif" }}>
            ☕ Cashier – Bite Bonansa
          </h1>
          <Link href="/dashboard" style={{ color: '#ffc107', fontSize: '14px' }}>← Dashboard</Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px' }}>
          {/* Left: Menu + Customer */}
          <div>
            {/* Customer ID Lookup */}
            <div style={cardStyle}>
              <h3 style={{ color: '#ffc107', fontSize: '16px', marginBottom: '14px' }}>🔍 Customer Lookup (optional)</h3>
              <form onSubmit={handleLookup} style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  placeholder="Customer ID (e.g. BBC-000001)"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  type="submit"
                  disabled={lookupLoading || !customerId}
                  style={{ padding: '12px 20px', backgroundColor: '#ffc107', color: '#0a0a0a', border: 'none', borderRadius: '6px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  {lookupLoading ? '...' : 'Look Up'}
                </button>
              </form>

              {lookupError && <p style={{ color: '#ff6b6b', marginTop: '10px', fontSize: '14px' }}>⚠️ {lookupError}</p>}

              {customer && (
                <div style={{ marginTop: '14px', padding: '14px', backgroundColor: '#001a0a', borderRadius: '8px', border: '1px solid #4caf50' }}>
                  <p style={{ margin: 0, color: '#4caf50', fontWeight: '600' }}>✅ {customer.name}</p>
                  <p style={{ margin: '4px 0 0', color: '#999', fontSize: '13px' }}>ID: {customer.customer_id}</p>
                  <p style={{ margin: '4px 0 0', color: '#4caf50', fontSize: '13px' }}>
                    Points Balance: <strong>{parseFloat(customer.points_balance).toFixed(2)} pts</strong>
                  </p>
                </div>
              )}
            </div>

            {/* Menu */}
            <div style={cardStyle}>
              <h3 style={{ color: '#ffc107', fontSize: '16px', marginBottom: '14px' }}>🍵 Menu</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
                {MENU_ITEMS.map((item) => (
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
                      transition: 'all 0.2s',
                    }}
                  >
                    <p style={{ margin: 0, fontWeight: '600', fontSize: '13px' }}>{item.name}</p>
                    <p style={{ margin: '4px 0 0', color: '#ffc107', fontSize: '14px' }}>₱{item.price}</p>
                    {cart[item.id] > 0 && (
                      <p style={{ margin: '4px 0 0', color: '#4caf50', fontSize: '12px' }}>× {cart[item.id]} added</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Order Summary */}
          <div>
            <div style={{ ...cardStyle, position: 'sticky', top: '20px' }}>
              <h3 style={{ color: '#ffc107', fontSize: '18px', marginBottom: '16px' }}>🧾 Order Summary</h3>

              {cartItems.length === 0 ? (
                <p style={{ color: '#666', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>No items yet</p>
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
                        <button onClick={() => removeFromCart(item.id)} style={{ background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer', fontSize: '16px', padding: '0 4px' }}>×</button>
                      </div>
                    </div>
                  ))}

                  <div style={{ borderTop: '1px solid #333', marginTop: '12px', paddingTop: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px', marginBottom: '14px' }}>
                      <span>Total</span>
                      <span style={{ color: '#ffc107' }}>₱{totalAmount.toFixed(2)}</span>
                    </div>

                    {/* Points redemption */}
                    {customer && customer.points_balance > 0 && (
                      <div style={{ marginBottom: '14px' }}>
                        <label style={{ display: 'block', color: '#4caf50', fontSize: '13px', marginBottom: '6px' }}>
                          🎁 Redeem Points (max {parseFloat(customer.points_balance).toFixed(2)})
                        </label>
                        <input
                          type="number"
                          min="0"
                          max={Math.min(customer.points_balance, totalAmount)}
                          step="0.01"
                          value={pointsToRedeem}
                          onChange={(e) => setPointsToRedeem(parseFloat(e.target.value) || 0)}
                          style={{ ...inputStyle, border: '2px solid #4caf50' }}
                        />
                        {pointsToRedeem > 0 && (
                          <div style={{ marginTop: '8px', fontSize: '13px', color: '#999' }}>
                            <p style={{ margin: '2px 0', color: '#ff6b6b' }}>Points deducted: -{redemption.pointsApplied.toFixed(2)} pts</p>
                            <p style={{ margin: '2px 0', color: '#ffc107' }}>Remaining to pay: ₱{redemption.remainingBalance.toFixed(2)}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Payment method */}
                    {(redemption.remainingBalance > 0 || !customer || pointsToRedeem === 0) && (
                      <div style={{ marginBottom: '14px' }}>
                        <label style={{ display: 'block', color: '#ffc107', fontSize: '13px', marginBottom: '6px' }}>
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

                    {/* Points earned preview */}
                    {pointsEarned > 0 && (
                      <p style={{ fontSize: '13px', color: '#4caf50', marginBottom: '14px' }}>
                        ⭐ Will earn: +{pointsEarned.toFixed(2)} points
                      </p>
                    )}

                    {orderError && <p style={{ color: '#ff6b6b', fontSize: '13px', marginBottom: '10px' }}>⚠️ {orderError}</p>}

                    <button
                      onClick={handlePlaceOrder}
                      disabled={cartItems.length === 0 || orderLoading}
                      style={{
                        width: '100%',
                        padding: '14px',
                        backgroundColor: cartItems.length === 0 || orderLoading ? '#666' : '#ffc107',
                        color: cartItems.length === 0 || orderLoading ? '#999' : '#0a0a0a',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '16px',
                        fontWeight: '700',
                        cursor: cartItems.length === 0 || orderLoading ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {orderLoading ? '⏳ Processing...' : '✅ Place Order'}
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
