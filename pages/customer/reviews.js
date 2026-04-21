import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../../utils/supabaseClient';

export default function CustomerReviews() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingReview, setEditingReview] = useState(null);
  const [form, setForm] = useState({
    title: '',
    review_text: '',
    star_rating: 5,
    images: [], // Array to store image files
    previewUrls: [] // Array to store object URLs for preview
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      try {
        if (!supabase) {
          if (mounted) {
            setLoading(false);
            router.replace('/login').catch(console.error);
          }
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();

        if (!mounted) return;

        if (!session) {
          router.replace('/login').catch(console.error);
          return;
        }

        setUser(session.user);

        // Fetch user role
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle();

        if (!mounted) return;

        if (userError) {
          console.error('[CustomerReviews] Failed to fetch user role:', userError.message);
          setLoading(false);
          return;
        }

        const role = userData?.role || 'customer';

        // Redirect if not a customer
        if (role !== 'customer') {
          if (role === 'admin') {
            router.replace('/dashboard').catch(console.error);
          } else if (role === 'cashier') {
            router.replace('/cashier').catch(console.error);
          } else if (role === 'rider') {
            router.replace('/rider/dashboard').catch(console.error);
          }
          return;
        }

        // Fetch customer reviews
        await fetchReviews(session.user.id);

        setLoading(false);
      } catch (err) {
        console.error('[CustomerReviews] Session check failed:', err?.message ?? err);
        if (mounted) {
          setLoading(false);
          router.replace('/login').catch(console.error);
        }
      }
    }

    checkSession();

    const { data: { subscription } } = supabase
      ? supabase.auth.onAuthStateChange((_event, session) => {
          if (!mounted) return;
          if (!session) {
            router.replace('/login').catch(console.error);
          }
        })
      : { data: { subscription: null } };

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [router]);

  async function fetchReviews(userId) {
    try {
      const { data, error } = await supabase
        .from('customer_reviews')
        .select('*')
        .eq('customer_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReviews(data || []);
    } catch (err) {
      console.error('[CustomerReviews] Failed to fetch reviews:', err);
    }
  }

  const handleOpenCreateModal = () => {
    setEditingReview(null);
    setForm({
      title: '',
      review_text: '',
      star_rating: 5,
      images: [],
      previewUrls: []
    });
    setFormError('');
    setShowCreateModal(true);
  };

  const handleOpenEditModal = (review) => {
    setEditingReview(review);
    setForm({
      title: review.title || '',
      review_text: review.review_text || '',
      star_rating: review.star_rating || 5,
      images: [], // Don't pre-load existing images for editing
      previewUrls: []
    });
    setFormError('');
    setShowCreateModal(true);
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    
    // Validate file count (max 5 images)
    if (files.length + form.images.length > 5) {
      setFormError('You can upload a maximum of 5 images');
      return;
    }

    // Validate file types (only images)
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const invalidFiles = files.filter(file => !validTypes.includes(file.type));
    
    if (invalidFiles.length > 0) {
      setFormError('Please upload only image files (JPEG, PNG, GIF, WebP)');
      return;
    }

    // Validate file sizes (max 5MB per image)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    const oversizedFiles = files.filter(file => file.size > maxSize);
    
    if (oversizedFiles.length > 0) {
      setFormError('Each image must be less than 5MB');
      return;
    }

    // Create object URLs for preview
    const newPreviewUrls = files.map(file => URL.createObjectURL(file));

    setForm(prev => ({
      ...prev,
      images: [...prev.images, ...files],
      previewUrls: [...prev.previewUrls, ...newPreviewUrls]
    }));
    setFormError('');
  };

  const handleRemoveImage = (index) => {
    // Revoke the object URL to prevent memory leaks
    if (form.previewUrls[index]) {
      URL.revokeObjectURL(form.previewUrls[index]);
    }

    setForm(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
      previewUrls: prev.previewUrls.filter((_, i) => i !== index)
    }));
  };

  // Cleanup object URLs when modal closes or component unmounts
  useEffect(() => {
    if (!showCreateModal && form.previewUrls.length > 0) {
      // Modal closed, cleanup all preview URLs
      form.previewUrls.forEach(url => {
        if (url) URL.revokeObjectURL(url);
      });
      setForm(prev => ({ ...prev, previewUrls: [] }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCreateModal]); // Intentionally omitting form.previewUrls to avoid cleanup on every change

  const uploadImagesToSupabase = async (images) => {
    const imageUrls = [];
    
    for (const image of images) {
      try {
        // Generate cryptographically secure unique filename
        const fileExt = image.name.split('.').pop();
        // Use crypto.randomUUID() or fallback to a more secure implementation
        let secureId;
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
          secureId = crypto.randomUUID();
        } else {
          // Fallback: Use multiple random values for better entropy
          const timestamp = Date.now().toString(36);
          const random1 = Math.random().toString(36).substring(2, 15);
          const random2 = Math.random().toString(36).substring(2, 15);
          secureId = `${user.id}-${timestamp}-${random1}${random2}`;
        }
        const fileName = `${secureId}.${fileExt}`;
        const filePath = `review-images/${fileName}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('reviews')
          .upload(filePath, image);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('reviews')
          .getPublicUrl(filePath);

        imageUrls.push(publicUrl);
      } catch (err) {
        console.error('Failed to upload image:', err);
        // Continue with other images even if one fails
      }
    }

    return imageUrls;
  };

  const handleSubmitReview = async () => {
    setFormError('');

    // Validation
    if (!form.review_text.trim()) {
      setFormError('Please write your review');
      return;
    }

    if (!form.star_rating || form.star_rating < 1 || form.star_rating > 5) {
      setFormError('Please select a star rating (1-5)');
      return;
    }

    setSubmitting(true);

    try {
      // Upload images if any
      let imageUrls = [];
      if (form.images.length > 0) {
        imageUrls = await uploadImagesToSupabase(form.images);
      }

      const reviewData = {
        customer_id: user.id,
        title: form.title.trim() || null,
        review_text: form.review_text.trim(),
        star_rating: parseInt(form.star_rating),
        image_urls: imageUrls.length > 0 ? imageUrls : null,
        status: 'pending'
      };

      if (editingReview) {
        // Update existing review
        const { error } = await supabase
          .from('customer_reviews')
          .update({
            ...reviewData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingReview.id);

        if (error) throw error;
        alert('Review updated successfully!');
      } else {
        // Create new review
        const { error } = await supabase
          .from('customer_reviews')
          .insert(reviewData);

        if (error) throw error;
        alert('Review submitted successfully! Admin will review it before publishing.');
      }

      // Refresh reviews list
      await fetchReviews(user.id);
      setShowCreateModal(false);
      
      // Cleanup preview URLs before resetting form
      form.previewUrls.forEach(url => {
        if (url) URL.revokeObjectURL(url);
      });
      
      setForm({ title: '', review_text: '', star_rating: 5, images: [], previewUrls: [] });
    } catch (err) {
      console.error('[CustomerReviews] Failed to submit review:', err);
      setFormError('Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.warn('[CustomerReviews] Sign out failed:', err?.message ?? err);
    }
    localStorage.removeItem('token');
    router.replace('/login').catch(console.error);
  };

  const renderStars = (rating, interactive = false, onChange = null) => {
    return (
      <div style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map(star => (
          <span
            key={star}
            style={{
              ...styles.star,
              color: star <= rating ? '#ffc107' : '#444',
              cursor: interactive ? 'pointer' : 'default'
            }}
            onClick={() => interactive && onChange && onChange(star)}
          >
            ★
          </span>
        ))}
      </div>
    );
  };

  const getStatusInfo = (status) => {
    const statusMap = {
      'pending': { label: 'Pending Review', color: '#ffc107', icon: '⏳' },
      'published': { label: 'Published', color: '#4caf50', icon: '✓' },
      'archived': { label: 'Archived', color: '#999', icon: '📦' }
    };
    return statusMap[status] || { label: status, color: '#999', icon: '?' };
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div style={styles.center}>
        <p style={{ color: '#ffc107', fontFamily: "'Poppins', sans-serif" }}>
          ⏳ Loading…
        </p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Share Review - Bite Bonansa Cafe</title>
        <meta name="description" content="Share your favorite bites with us" />
      </Head>
      <div style={styles.page}>
        <header style={styles.header}>
          <h1 style={styles.logo}>☕ Bite Bonansa Cafe</h1>
          <nav style={styles.nav}>
            <Link href="/customer/dashboard" style={styles.navLink}>Dashboard</Link>
            <Link href="/customer/order-portal" style={styles.navLink}>Order Portal</Link>
            <Link href="/customer/orders" style={styles.navLink}>Order Tracking</Link>
            <Link href="/customer/profile" style={styles.navLink}>My Profile</Link>
            <Link href="/customer/reviews" style={styles.navLink}>Share Review</Link>
          </nav>
          <button style={styles.logoutBtn} onClick={handleLogout}>
            Logout
          </button>
        </header>

        <main style={styles.main}>
          <div style={styles.titleContainer}>
            <h2 style={styles.title}>⭐ Share Your Favorite Bites</h2>
            <button style={styles.createBtn} onClick={handleOpenCreateModal}>
              ✍️ Write a Review
            </button>
          </div>
          
          {reviews.length > 0 ? (
            <div style={styles.reviewsGrid}>
              {reviews.map(review => {
                const statusInfo = getStatusInfo(review.status);
                return (
                  <div key={review.id} style={styles.reviewCard}>
                    <div style={styles.reviewHeader}>
                      <div>
                        {renderStars(review.star_rating)}
                        {review.title && (
                          <h3 style={styles.reviewTitle}>{review.title}</h3>
                        )}
                        <p style={styles.reviewDate}>{formatDate(review.created_at)}</p>
                      </div>
                      <div style={{...styles.statusBadge, backgroundColor: statusInfo.color}}>
                        {statusInfo.icon} {statusInfo.label}
                      </div>
                    </div>

                    <p style={styles.reviewText}>{review.review_text}</p>

                    {/* Display review images */}
                    {review.image_urls && review.image_urls.length > 0 && (
                      <div style={styles.reviewImages}>
                        {review.image_urls.map((url, index) => (
                          <img
                            key={index}
                            src={url}
                            alt={`Review image ${index + 1}`}
                            style={styles.reviewImage}
                          />
                        ))}
                      </div>
                    )}

                    {review.published_at && (
                      <p style={styles.publishedDate}>
                        Published on {formatDate(review.published_at)}
                      </p>
                    )}

                    <div style={styles.reviewActions}>
                      <button
                        style={styles.editBtn}
                        onClick={() => handleOpenEditModal(review)}
                      >
                        ✏️ Edit
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={styles.emptyState}>
              <span style={styles.emptyIcon}>⭐</span>
              <p style={styles.emptyText}>No reviews yet</p>
              <p style={styles.emptySubtext}>Share your experience with us!</p>
              <button style={styles.createBtnLarge} onClick={handleOpenCreateModal}>
                ✍️ Write Your First Review
              </button>
            </div>
          )}
        </main>

        {/* Create/Edit Review Modal */}
        {showCreateModal && (
          <div style={styles.modalOverlay} onClick={() => !submitting && setShowCreateModal(false)}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
              <h3 style={styles.modalTitle}>
                {editingReview ? 'Edit Review' : 'Write a Review'}
              </h3>
              
              <div style={styles.formGroup}>
                <label style={styles.label}>Star Rating *</label>
                {renderStars(form.star_rating, true, (rating) => setForm({...form, star_rating: rating}))}
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Title (Optional)</label>
                <input
                  type="text"
                  style={styles.input}
                  value={form.title}
                  onChange={(e) => setForm({...form, title: e.target.value})}
                  placeholder="Give your review a title"
                  maxLength={255}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Your Review *</label>
                <textarea
                  style={styles.textarea}
                  value={form.review_text}
                  onChange={(e) => setForm({...form, review_text: e.target.value})}
                  placeholder="Share your experience with us..."
                  rows={6}
                />
                <p style={styles.helperText}>
                  Tell us about your favorite bites! What did you love most?
                </p>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Upload Photos (Optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageChange}
                  style={styles.fileInput}
                />
                <p style={styles.helperText}>
                  📸 You can upload up to 5 images (max 5MB each). Supported formats: JPEG, PNG, GIF, WebP
                </p>
                
                {/* Image Preview */}
                {form.previewUrls.length > 0 && (
                  <div style={styles.imagePreviewContainer}>
                    {form.previewUrls.map((url, index) => {
                      // Get original filename if available
                      const fileName = form.images[index]?.name || '';
                      const altText = fileName ? `Preview of ${fileName}` : 'Review image preview';
                      return (
                        <div key={index} style={styles.imagePreviewItem}>
                          <img
                            src={url}
                            alt={altText}
                            style={styles.imagePreview}
                          />
                          <button
                            style={styles.removeImageBtn}
                            onClick={() => handleRemoveImage(index)}
                            type="button"
                            aria-label={`Remove ${fileName || `image ${index + 1}`}`}
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {formError && (
                <div style={styles.errorMessage}>{formError}</div>
              )}

              <div style={styles.infoBox}>
                <p style={styles.infoText}>
                  📢 Your review will be submitted to the admin for approval before it's published on our website.
                </p>
              </div>

              <div style={styles.modalActions}>
                <button
                  style={styles.modalBtnCancel}
                  onClick={() => {
                    // Cleanup preview URLs
                    form.previewUrls.forEach(url => {
                      if (url) URL.revokeObjectURL(url);
                    });
                    
                    setShowCreateModal(false);
                    setForm({ title: '', review_text: '', star_rating: 5, images: [], previewUrls: [] });
                    setFormError('');
                  }}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  style={styles.modalBtnConfirm}
                  onClick={handleSubmitReview}
                  disabled={submitting}
                >
                  {submitting ? 'Submitting...' : (editingReview ? 'Update Review' : 'Submit Review')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

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
    flexWrap: 'wrap',
    gap: '12px',
  },
  logo: {
    fontSize: '22px',
    fontFamily: "'Playfair Display', serif",
    color: '#ffc107',
    margin: 0,
  },
  nav: {
    display: 'flex',
    gap: '20px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  navLink: {
    color: '#ccc',
    textDecoration: 'none',
    fontSize: '14px',
    transition: 'color 0.3s',
    cursor: 'pointer',
  },
  logoutBtn: {
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
    padding: '40px 32px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  titleContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '32px',
    flexWrap: 'wrap',
    gap: '16px',
  },
  title: {
    fontSize: '32px',
    fontFamily: "'Playfair Display', serif",
    color: '#ffc107',
    margin: 0,
  },
  createBtn: {
    padding: '12px 24px',
    backgroundColor: '#ffc107',
    color: '#000',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
  createBtnLarge: {
    padding: '14px 32px',
    backgroundColor: '#ffc107',
    color: '#000',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
    marginTop: '24px',
  },
  reviewsGrid: {
    display: 'grid',
    gap: '24px',
  },
  reviewCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: '12px',
    padding: '24px',
    border: '1px solid #444',
  },
  reviewHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px',
  },
  starsContainer: {
    display: 'flex',
    gap: '4px',
    marginBottom: '8px',
  },
  star: {
    fontSize: '24px',
    transition: 'color 0.2s',
  },
  reviewTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#fff',
    margin: '8px 0 4px 0',
  },
  reviewDate: {
    fontSize: '12px',
    color: '#999',
    margin: 0,
  },
  statusBadge: {
    padding: '8px 16px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#000',
    whiteSpace: 'nowrap',
  },
  reviewText: {
    fontSize: '14px',
    color: '#ccc',
    lineHeight: '1.6',
    marginBottom: '16px',
  },
  publishedDate: {
    fontSize: '12px',
    color: '#4caf50',
    marginBottom: '16px',
    fontStyle: 'italic',
  },
  reviewActions: {
    display: 'flex',
    gap: '12px',
    borderTop: '1px solid #444',
    paddingTop: '16px',
  },
  editBtn: {
    padding: '8px 16px',
    backgroundColor: 'transparent',
    color: '#ffc107',
    border: '1px solid #ffc107',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
    fontWeight: 'bold',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 20px',
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: '80px',
    marginBottom: '20px',
    opacity: 0.5,
  },
  emptyText: {
    fontSize: '20px',
    color: '#ccc',
    marginBottom: '8px',
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: '14px',
    color: '#888',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    overflowY: 'auto',
    padding: '20px',
  },
  modal: {
    backgroundColor: '#2a2a2a',
    borderRadius: '12px',
    padding: '32px',
    maxWidth: '600px',
    width: '100%',
    border: '1px solid #ffc107',
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  modalTitle: {
    fontSize: '24px',
    color: '#ffc107',
    margin: '0 0 24px 0',
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    color: '#ccc',
    marginBottom: '8px',
    fontWeight: 'bold',
  },
  input: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#1a1a1a',
    color: '#fff',
    border: '1px solid #444',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: "'Poppins', sans-serif",
  },
  textarea: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#1a1a1a',
    color: '#fff',
    border: '1px solid #444',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: "'Poppins', sans-serif",
    resize: 'vertical',
  },
  helperText: {
    fontSize: '12px',
    color: '#999',
    marginTop: '4px',
    fontStyle: 'italic',
  },
  fileInput: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#1a1a1a',
    color: '#fff',
    border: '1px solid #444',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: "'Poppins', sans-serif",
    cursor: 'pointer',
  },
  imagePreviewContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
    gap: '12px',
    marginTop: '12px',
  },
  imagePreviewItem: {
    position: 'relative',
    width: '100%',
    paddingTop: '100%',
    borderRadius: '8px',
    overflow: 'hidden',
    border: '1px solid #444',
  },
  imagePreview: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  removeImageBtn: {
    position: 'absolute',
    top: '4px',
    right: '4px',
    width: '24px',
    height: '24px',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: '#fff',
    border: 'none',
    borderRadius: '50%',
    cursor: 'pointer',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewImages: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: '12px',
    marginTop: '12px',
  },
  reviewImage: {
    width: '100%',
    height: '150px',
    objectFit: 'cover',
    borderRadius: '8px',
    border: '1px solid #444',
  },
  infoBox: {
    backgroundColor: '#1a1a1a',
    border: '1px solid #ffc107',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '20px',
  },
  infoText: {
    fontSize: '13px',
    color: '#ffc107',
    margin: 0,
    lineHeight: '1.5',
  },
  errorMessage: {
    padding: '12px',
    backgroundColor: '#f443361a',
    color: '#f44336',
    borderRadius: '6px',
    marginBottom: '20px',
    fontSize: '14px',
    textAlign: 'center',
  },
  modalActions: {
    display: 'flex',
    gap: '12px',
  },
  modalBtnCancel: {
    flex: 1,
    padding: '12px',
    backgroundColor: 'transparent',
    color: '#ccc',
    border: '1px solid #444',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
  modalBtnConfirm: {
    flex: 1,
    padding: '12px',
    backgroundColor: '#ffc107',
    color: '#000',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
};
