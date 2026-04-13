import React, { useState, useEffect } from 'react';
import Link from 'next/link';

const bg = '#0a0a0a', card = '#1a1a1a', accent = '#ffc107', text = '#fff', muted = '#999';
const btn = (bg2='#ffc107', color='#000') => ({ background: bg2, color, border: 'none', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", fontWeight: '600', fontSize: '12px' });

function Stars({ rating }) {
  return <span style={{ color: accent }}>{Array.from({ length: 5 }, (_, i) => i < rating ? '★' : '☆').join('')}</span>;
}

export default function AdminReviews() {
  const [reviews, setReviews] = useState([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [msg, setMsg] = useState('');

  useEffect(() => { fetchReviews(); }, [activeTab]);

  const fetchReviews = async () => {
    const r = await fetch(`/api/reviews?status=${activeTab}`);
    const data = await r.json();
    setReviews(Array.isArray(data) ? data : []);
  };

  const action = async (id, act) => {
    const r = await fetch('/api/reviews', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: act }) });
    const data = await r.json();
    if (data.id) { setMsg(`✅ Review ${act}d`); fetchReviews(); }
    else setMsg('❌ Failed');
    setTimeout(() => setMsg(''), 3000);
  };

  const deleteReview = async (id) => {
    if (!confirm('Permanently delete this review?')) return;
    await fetch(`/api/reviews?id=${id}`, { method: 'DELETE' });
    fetchReviews();
  };

  const tabs = ['pending', 'approved', 'rejected'];

  return (
    <div style={{ minHeight: '100vh', background: bg, fontFamily: "'Poppins', sans-serif", padding: '24px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={{ color: accent, fontFamily: "'Playfair Display', serif", fontSize: '28px', margin: 0 }}>⭐ Review Moderation</h1>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {msg && <span style={{ color: accent, fontSize: '13px' }}>{msg}</span>}
            <Link href="/admin" style={{ color: muted, fontSize: '14px', textDecoration: 'none' }}>← Admin</Link>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          {tabs.map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{ ...btn(activeTab === t ? accent : '#333', activeTab === t ? '#000' : '#fff'), padding: '8px 20px', fontSize: '14px', textTransform: 'capitalize' }}>
              {t}
            </button>
          ))}
        </div>

        {reviews.length === 0 ? (
          <p style={{ color: muted, textAlign: 'center', marginTop: '40px' }}>No {activeTab} reviews</p>
        ) : reviews.map(r => (
          <div key={r.id} style={{ background: card, border: '1px solid #333', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <span style={{ color: text, fontWeight: '600', fontSize: '15px', marginRight: '12px' }}>{r.customer_name || 'Anonymous'}</span>
                <Stars rating={r.rating} />
                {r.recommended && <span style={{ color: '#4ade80', fontSize: '12px', marginLeft: '8px' }}>👍 Recommends</span>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: muted, fontSize: '12px' }}>Receipt: {r.receipt_number}</div>
                <div style={{ color: muted, fontSize: '11px' }}>{new Date(r.created_at).toLocaleDateString('en-PH')}</div>
              </div>
            </div>
            {r.review_text && <p style={{ color: '#ccc', fontSize: '14px', margin: '0 0 16px', lineHeight: '1.5' }}>{r.review_text}</p>}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {activeTab === 'pending' && <>
                <button onClick={() => action(r.id, 'approve')} style={btn('#4ade80', '#000')}>✅ Approve</button>
                <button onClick={() => action(r.id, 'reject')} style={btn('#ef4444', '#fff')}>❌ Reject</button>
              </>}
              {activeTab === 'approved' && <>
                {r.visibility === 'public' ? <button onClick={() => action(r.id, 'hide')} style={btn('#888', '#fff')}>👁️ Hide</button>
                : <button onClick={() => action(r.id, 'show')} style={btn('#4ade80', '#000')}>👁️ Show</button>}
                <button onClick={() => action(r.id, 'reject')} style={btn('#ef4444', '#fff')}>❌ Remove</button>
              </>}
              <button onClick={() => deleteReview(r.id)} style={btn('#333', '#ef4444')}>🗑️ Delete</button>
              <Link href="/reviews" target="_blank" style={{ ...btn('#222', '#fff'), textDecoration: 'none', display: 'inline-block' }}>🌐 Preview</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
