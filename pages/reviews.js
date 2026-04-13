import React, { useState, useEffect } from 'react';
import Link from 'next/link';

const bg = '#0a0a0a', card = '#1a1a1a', accent = '#ffc107', text = '#fff', muted = '#999';
const btn = (bg2='#ffc107', color='#000') => ({ background: bg2, color, border: 'none', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", fontWeight: '600', fontSize: '13px' });

function Stars({ rating, size = 18 }) {
  return (
    <span style={{ color: accent, fontSize: `${size}px` }}>
      {Array.from({ length: 5 }, (_, i) => i < rating ? '★' : '☆').join('')}
    </span>
  );
}

export default function PublicReviews() {
  const [reviews, setReviews] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const PER_PAGE = 10;

  useEffect(() => { fetchReviews(); }, [page]);

  const fetchReviews = async () => {
    const r = await fetch('/api/reviews?public=1&status=approved');
    const data = await r.json();
    setReviews(Array.isArray(data) ? data : []);
    setHasMore(data.length >= PER_PAGE);
  };

  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) : 0;
  const ratingCounts = [5,4,3,2,1].map(n => ({ n, count: reviews.filter(r => r.rating === n).length }));

  return (
    <div style={{ minHeight: '100vh', background: bg, fontFamily: "'Poppins', sans-serif", padding: '40px 20px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h1 style={{ color: accent, fontFamily: "'Playfair Display', serif", fontSize: '32px', margin: '0 0 4px' }}>⭐ Customer Reviews</h1>
            <p style={{ color: muted, margin: 0 }}>What our customers are saying</p>
          </div>
          <Link href="/" style={{ color: muted, fontSize: '13px', textDecoration: 'none' }}>← Home</Link>
        </div>

        {/* Rating Summary */}
        {reviews.length > 0 && (
          <div style={{ background: card, border: '1px solid #333', borderRadius: '12px', padding: '24px', marginBottom: '32px', display: 'flex', gap: '32px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: accent, fontWeight: '700', fontSize: '56px', lineHeight: '1' }}>{avgRating.toFixed(1)}</div>
              <Stars rating={Math.round(avgRating)} size={22} />
              <div style={{ color: muted, fontSize: '13px', marginTop: '4px' }}>{reviews.length} reviews</div>
            </div>
            <div style={{ flex: 1, minWidth: '200px' }}>
              {ratingCounts.map(({ n, count }) => (
                <div key={n} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ color: muted, fontSize: '12px', minWidth: '20px' }}>{n}★</span>
                  <div style={{ flex: 1, background: '#333', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                    <div style={{ background: accent, height: '100%', width: reviews.length > 0 ? `${(count / reviews.length) * 100}%` : '0%', borderRadius: '4px', transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ color: muted, fontSize: '12px', minWidth: '20px' }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reviews List */}
        {reviews.length === 0 ? (
          <div style={{ textAlign: 'center', color: muted, marginTop: '60px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>☕</div>
            <p>No reviews yet. Be the first to share your experience!</p>
          </div>
        ) : reviews.slice(0, page * PER_PAGE).map(r => (
          <div key={r.id} style={{ background: card, border: '1px solid #333', borderRadius: '12px', padding: '24px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <span style={{ color: text, fontWeight: '600', fontSize: '16px', marginRight: '12px' }}>{r.customer_name || 'Anonymous'}</span>
                <Stars rating={r.rating} />
                {r.recommended && <span style={{ color: '#4ade80', fontSize: '12px', marginLeft: '8px' }}>👍 Would recommend</span>}
              </div>
              <span style={{ color: muted, fontSize: '12px' }}>{new Date(r.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
            {r.review_text && (
              <p style={{ color: '#ddd', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>{r.review_text}</p>
            )}
          </div>
        ))}

        {hasMore && (
          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <button onClick={() => setPage(p => p + 1)} style={btn('#333', '#fff')}>Load More Reviews</button>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '40px' }}>
          <Link href="/review" style={{ color: accent, fontSize: '14px' }}>Leave a Review →</Link>
        </div>
      </div>
    </div>
  );
}
