import React, { useState, useEffect } from 'react';
import Link from 'next/link';

const bg = '#0a0a0a', card = '#1a1a1a', accent = '#ffc107', text = '#fff', muted = '#999';
const inputStyle = { width: '100%', background: '#111', border: '1px solid #333', color: '#fff', padding: '12px 16px', borderRadius: '8px', fontFamily: "'Poppins', sans-serif", fontSize: '14px', boxSizing: 'border-box' };
const btn = (bg2='#ffc107', color='#000') => ({ background: bg2, color, border: 'none', borderRadius: '8px', padding: '12px 24px', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", fontWeight: '600', fontSize: '15px' });

export default function ReviewPage() {
  const [receiptNumber, setReceiptNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [recommended, setRecommended] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const receipt = params.get('receipt');
    if (receipt) setReceiptNumber(receipt);
    // Try to pre-fill from receipt
    if (receipt) {
      fetch(`/api/reviews?receipt_number=${receipt}`).then(r => r.json()).then(data => {
        if (Array.isArray(data) && data.length > 0) {
          // Already reviewed, pre-fill name
        }
      });
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rating) { setError('Please select a rating'); return; }
    if (!receiptNumber) { setError('Receipt number is required'); return; }
    setLoading(true); setError('');
    const r = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receipt_number: receiptNumber, customer_name: customerName || 'Anonymous', rating, review_text: reviewText, recommended })
    });
    const data = await r.json();
    setLoading(false);
    if (data.id) setSubmitted(true);
    else setError(data.error || 'Failed to submit. Please try again.');
  };

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', background: bg, fontFamily: "'Poppins', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ background: card, border: '2px solid #ffc107', borderRadius: '16px', padding: '48px', maxWidth: '480px', width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>🙏</div>
          <h2 style={{ color: accent, fontFamily: "'Playfair Display', serif", marginBottom: '12px' }}>Thank You!</h2>
          <p style={{ color: muted, marginBottom: '24px' }}>Your review has been submitted and is pending approval. We appreciate your feedback!</p>
          <Link href="/reviews" style={{ ...btn(), textDecoration: 'none', display: 'inline-block' }}>View All Reviews</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: bg, fontFamily: "'Poppins', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: card, border: '1px solid #333', borderRadius: '16px', padding: '40px', maxWidth: '500px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ color: accent, fontFamily: "'Playfair Display', serif", fontSize: '28px', margin: '0 0 8px' }}>☕ Leave a Review</h1>
          <p style={{ color: muted, margin: 0, fontSize: '14px' }}>Share your experience at Bite Bonansa Cafe</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ color: muted, fontSize: '13px', display: 'block', marginBottom: '6px' }}>Receipt Number</label>
            <input value={receiptNumber} onChange={e => setReceiptNumber(e.target.value)} placeholder="RCP-XXXXXXXX-XXXXXX" style={inputStyle} required />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ color: muted, fontSize: '13px', display: 'block', marginBottom: '6px' }}>Your Name (optional)</label>
            <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Enter your name" style={inputStyle} />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ color: muted, fontSize: '13px', display: 'block', marginBottom: '10px' }}>Rating *</label>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              {[1,2,3,4,5].map(n => (
                <button key={n} type="button"
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHoverRating(n)}
                  onMouseLeave={() => setHoverRating(0)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '40px', color: n <= (hoverRating || rating) ? accent : '#444', transition: 'color 0.15s, transform 0.15s', transform: n <= (hoverRating || rating) ? 'scale(1.2)' : 'scale(1)' }}>
                  ★
                </button>
              ))}
            </div>
            {rating > 0 && (
              <div style={{ textAlign: 'center', color: accent, fontSize: '13px', marginTop: '8px' }}>
                {['','Terrible','Poor','Okay','Good','Excellent!'][rating]}
              </div>
            )}
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ color: muted, fontSize: '13px', display: 'block', marginBottom: '6px' }}>Your Review</label>
            <textarea value={reviewText} onChange={e => setReviewText(e.target.value)} placeholder="Tell us about your experience..." rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ color: muted, fontSize: '13px', display: 'block', marginBottom: '10px' }}>Would you recommend us?</label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="button" onClick={() => setRecommended(true)}
                style={{ ...btn(recommended === true ? '#4ade80' : '#333', recommended === true ? '#000' : '#fff'), flex: 1 }}>
                👍 Yes, I would!
              </button>
              <button type="button" onClick={() => setRecommended(false)}
                style={{ ...btn(recommended === false ? '#ef4444' : '#333', recommended === false ? '#fff' : '#fff'), flex: 1 }}>
                👎 Not really
              </button>
            </div>
          </div>

          {error && <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '16px' }}>{error}</p>}

          <button type="submit" disabled={loading || !rating} style={{ ...btn(), width: '100%', padding: '14px', opacity: loading || !rating ? 0.6 : 1 }}>
            {loading ? '⏳ Submitting...' : '✅ Submit Review'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <Link href="/reviews" style={{ color: muted, fontSize: '13px', textDecoration: 'none' }}>View all reviews →</Link>
        </div>
      </div>
    </div>
  );
}
