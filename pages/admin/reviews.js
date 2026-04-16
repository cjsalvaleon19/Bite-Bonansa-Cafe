import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import * as Dialog from '@radix-ui/react-dialog';
import { supabase } from '../../utils/supabaseClient';
import { getUserRole, ROLES, canAccessPage } from '../../utils/roleGuard';

// ─── Admin: Reviews Management ────────────────────────────────────────────────
// Displays customer reviews. Admins can view and delete inappropriate reviews.
// Auth-guarded: redirects to /login if no active session.
// Role-guarded: only admins can access this page.

const STARS = [5, 4, 3, 2, 1];

export default function ReviewsPage() {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterStars, setFilterStars] = useState(0); // 0 = all
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // ── Auth & Role guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    async function checkSession() {
      if (!supabase) {
        if (mounted) { setAuthLoading(false); router.replace('/login'); }
        return;
      }
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        if (!session) { router.replace('/login'); return; }
        
        // Check user role
        const roleData = await getUserRole();
        if (!roleData || !canAccessPage(roleData.role, '/admin/reviews')) {
          // User doesn't have permission, redirect to their default page
          if (roleData?.role === ROLES.CUSTOMER) {
            router.replace('/customer/menu');
          } else if (roleData?.role === ROLES.CASHIER) {
            router.replace('/cashier');
          } else if (roleData?.role === ROLES.RIDER) {
            router.replace('/rider/deliveries');
          } else {
            router.replace('/dashboard');
          }
          return;
        }
        
        setAuthLoading(false);
      } catch {
        if (mounted) { setAuthLoading(false); router.replace('/login'); }
      }
    }
    checkSession();
    return () => { mounted = false; };
  }, [router]);

  // ── Fetch reviews ───────────────────────────────────────────────────────────
  const fetchReviews = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('id, customer_name, rating, comment, created_at')
        .order('created_at', { ascending: false });
      if (!error && data) setReviews(data);
    } catch { /* non-fatal */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) fetchReviews();
  }, [authLoading, fetchReviews]);

  // ── Delete review ───────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await supabase.from('reviews').delete().eq('id', deleteTarget.id);
      setDeleteTarget(null);
      fetchReviews();
    } catch { /* non-fatal */ } finally {
      setDeleting(false);
    }
  };

  const filtered = filterStars
    ? reviews.filter((r) => r.rating === filterStars)
    : reviews;

  // Compute average rating
  const avgRating =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length
      : 0;

  if (authLoading) {
    return (
      <div style={styles.center}>
        <p style={{ color: '#ffc107', fontFamily: "'Poppins', sans-serif" }}>⏳ Loading…</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header style={styles.header}>
        <h1 style={styles.logo}>⭐ Reviews Management</h1>
        <button style={styles.backBtn} onClick={() => router.push('/dashboard').catch(console.error)}>← Dashboard</button>
      </header>

      <main style={styles.main}>
        {!supabase && (
          <p style={styles.notice}>
            ⚠️ Supabase is not configured. Connect your database to view customer reviews.
          </p>
        )}

        {/* ── Summary ────────────────────────────────────────────────────── */}
        {reviews.length > 0 && (
          <div style={styles.summary}>
            <span style={styles.summaryRating}>{avgRating.toFixed(1)} ★</span>
            <span style={styles.summaryCount}>Average from {reviews.length} review{reviews.length !== 1 ? 's' : ''}</span>
          </div>
        )}

        {/* ── Filter ─────────────────────────────────────────────────────── */}
        <div style={styles.filters}>
          <button
            style={{ ...styles.filterBtn, ...(filterStars === 0 ? styles.filterBtnActive : {}) }}
            onClick={() => setFilterStars(0)}
          >
            All
          </button>
          {STARS.map((s) => (
            <button
              key={s}
              style={{ ...styles.filterBtn, ...(filterStars === s ? styles.filterBtnActive : {}) }}
              onClick={() => setFilterStars(s)}
            >
              {s}★
            </button>
          ))}
        </div>

        {loading && <p style={{ color: '#aaa', fontSize: '14px' }}>Loading reviews…</p>}

        {!loading && reviews.length === 0 && supabase && (
          <p style={{ color: '#aaa', fontSize: '14px' }}>No reviews yet.</p>
        )}

        {/* ── Review cards ────────────────────────────────────────────────── */}
        <div style={styles.list}>
          {filtered.map((r) => (
            <div key={r.id} style={styles.reviewCard}>
              <div style={styles.reviewHeader}>
                <div>
                  <span style={styles.reviewName}>{r.customer_name ?? 'Anonymous'}</span>
                  <span style={styles.reviewDate}>
                    {r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}
                  </span>
                </div>
                <div style={styles.reviewRight}>
                  <span style={styles.reviewRating}>{'★'.repeat(r.rating ?? 0)}{'☆'.repeat(5 - (r.rating ?? 0))}</span>
                  <button
                    style={styles.deleteBtn}
                    onClick={() => setDeleteTarget(r)}
                    title="Delete review"
                  >
                    🗑
                  </button>
                </div>
              </div>
              {r.comment && <p style={styles.reviewComment}>{r.comment}</p>}
            </div>
          ))}
          {filtered.length === 0 && !loading && reviews.length > 0 && (
            <p style={{ color: '#aaa', fontSize: '14px' }}>
              No reviews with {filterStars} star{filterStars !== 1 ? 's' : ''}.
            </p>
          )}
        </div>
      </main>

      {/* ── Delete Confirm Dialog ───────────────────────────────────────────── */}
      <Dialog.Root open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <Dialog.Portal>
          <Dialog.Overlay style={styles.overlay} />
          <Dialog.Content style={styles.confirmBox}>
            <Dialog.Title style={styles.confirmTitle}>Delete Review</Dialog.Title>
            <Dialog.Description style={styles.confirmDesc}>
              Remove the review by &ldquo;{deleteTarget?.customer_name ?? 'Anonymous'}&rdquo;? This cannot be
              undone.
            </Dialog.Description>
            <div style={styles.confirmActions}>
              <Dialog.Close asChild>
                <button style={styles.cancelBtn}>Cancel</button>
              </Dialog.Close>
              <button
                style={{ ...styles.delConfirmBtn, opacity: deleting ? 0.6 : 1 }}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
    fontFamily: "'Poppins', sans-serif",
    color: '#fff',
  },
  center: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 32px',
    backgroundColor: '#1a1a1a',
    borderBottom: '1px solid #ffc107',
  },
  logo: {
    fontSize: '22px',
    fontFamily: "'Playfair Display', serif",
    color: '#ffc107',
    margin: 0,
  },
  backBtn: {
    padding: '8px 18px',
    backgroundColor: 'transparent',
    color: '#ffc107',
    border: '1px solid #ffc107',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
  main: {
    padding: '32px',
    maxWidth: '800px',
    margin: '0 auto',
  },
  notice: {
    color: '#ffb300',
    fontSize: '13px',
    marginBottom: '24px',
    backgroundColor: 'rgba(255,193,7,0.1)',
    padding: '10px 14px',
    borderRadius: '6px',
    border: '1px solid rgba(255,193,7,0.3)',
  },
  summary: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '12px',
    marginBottom: '20px',
  },
  summaryRating: {
    fontSize: '36px',
    fontWeight: '700',
    color: '#ffc107',
    fontFamily: "'Playfair Display', serif",
  },
  summaryCount: {
    fontSize: '14px',
    color: '#aaa',
  },
  filters: {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px',
    flexWrap: 'wrap',
  },
  filterBtn: {
    padding: '6px 14px',
    backgroundColor: 'transparent',
    color: '#aaa',
    border: '1px solid #444',
    borderRadius: '20px',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
  filterBtnActive: {
    backgroundColor: '#ffc107',
    color: '#0a0a0a',
    border: '1px solid #ffc107',
    fontWeight: '600',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  reviewCard: {
    backgroundColor: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '10px',
    padding: '20px',
  },
  reviewHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '10px',
    gap: '12px',
  },
  reviewName: {
    fontWeight: '600',
    color: '#fff',
    fontSize: '14px',
    display: 'block',
  },
  reviewDate: {
    fontSize: '12px',
    color: '#666',
    marginTop: '2px',
    display: 'block',
  },
  reviewRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexShrink: 0,
  },
  reviewRating: {
    color: '#ffc107',
    fontSize: '14px',
    letterSpacing: '2px',
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#666',
    padding: '2px 4px',
  },
  reviewComment: {
    fontSize: '14px',
    color: '#bbb',
    lineHeight: '1.6',
    margin: 0,
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    zIndex: 100,
  },
  confirmBox: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: '#1a1a1a',
    border: '1px solid #ffc107',
    borderRadius: '12px',
    padding: '32px',
    minWidth: '320px',
    zIndex: 101,
    boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
  },
  confirmTitle: {
    fontSize: '20px',
    fontFamily: "'Playfair Display', serif",
    color: '#ffc107',
    marginTop: 0,
    marginBottom: '12px',
  },
  confirmDesc: {
    color: '#ccc',
    fontSize: '14px',
    marginBottom: '24px',
  },
  confirmActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
  },
  cancelBtn: {
    padding: '8px 18px',
    backgroundColor: 'transparent',
    color: '#ccc',
    border: '1px solid #555',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
  delConfirmBtn: {
    padding: '8px 18px',
    backgroundColor: '#f44336',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
};
