import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../../utils/supabaseClient';

export default function ShareReview() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [images, setImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

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

        // Fetch user role and data
        const { data: userDataResult, error: userError } = await supabase
          .from('users')
          .select('role, full_name, email')
          .eq('id', session.user.id)
          .maybeSingle();

        if (!mounted) return;

        if (userError) {
          console.error('[ShareReview] Failed to fetch user role:', userError.message);
          setLoading(false);
          return;
        }

        const role = userDataResult?.role || 'customer';
        setUserRole(role);
        setUserData(userDataResult);

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

        setLoading(false);
      } catch (err) {
        console.error('[ShareReview] Session check failed:', err?.message ?? err);
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

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + images.length > 5) {
      alert('You can only upload up to 5 images');
      return;
    }

    // Convert files to base64 for preview
    const readers = files.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve({
            file,
            preview: e.target.result,
            name: file.name,
          });
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(readers).then(newImages => {
      setImages([...images, ...newImages]);
    });
  };

  const removeImage = (index) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (rating === 0) {
      alert('Please select a rating');
      return;
    }

    if (!comment.trim()) {
      alert('Please write a comment');
      return;
    }

    setSubmitting(true);

    try {
      const customerName = userData?.full_name || user?.email?.split('@')[0] || 'Anonymous';

      // For now, we'll store image data as base64 in a JSON field
      // In production, you'd want to upload to storage and store URLs
      const imageData = images.map(img => ({
        name: img.name,
        data: img.preview,
      }));

      const { error } = await supabase
        .from('reviews')
        .insert([{
          customer_name: customerName,
          user_id: user.id,
          rating,
          comment: comment.trim(),
          images: imageData.length > 0 ? JSON.stringify(imageData) : null,
          created_at: new Date().toISOString(),
        }]);

      if (error) {
        console.error('Failed to submit review:', error);
        alert('Failed to submit review. Please try again.');
      } else {
        setSuccess(true);
        setRating(0);
        setComment('');
        setImages([]);
        
        setTimeout(() => {
          setSuccess(false);
        }, 3000);
      }
    } catch (err) {
      console.error('Error submitting review:', err);
      alert('An error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
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
        <meta name="description" content="Share your experience with us" />
      </Head>
      <div style={styles.page}>
        <header style={styles.header}>
          <button style={styles.backBtn} onClick={() => router.push('/customer/dashboard')}>
            ← Back
          </button>
          <h1 style={styles.logo}>⭐ Share Review</h1>
          <div style={{ width: '80px' }}></div>
        </header>

        <main style={styles.main}>
          <div style={styles.formContainer}>
            <p style={styles.subtitle}>
              We'd love to hear about your experience!
            </p>

            {success && (
              <div style={styles.successMessage}>
                ✓ Thank you! Your review has been submitted successfully.
              </div>
            )}

            <form onSubmit={handleSubmit} style={styles.form}>
              {/* Rating */}
              <div style={styles.formGroup}>
                <label style={styles.label}>Rating *</label>
                <div style={styles.starsContainer}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      style={styles.starBtn}
                      onClick={() => setRating(star)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.2)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      {star <= rating ? '★' : '☆'}
                    </button>
                  ))}
                  {rating > 0 && (
                    <span style={styles.ratingText}>
                      {rating} star{rating !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Comment */}
              <div style={styles.formGroup}>
                <label style={styles.label}>Your Review *</label>
                <textarea
                  style={styles.textarea}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Tell us about your experience..."
                  rows={5}
                  maxLength={1000}
                />
                <span style={styles.charCount}>
                  {comment.length}/1000 characters
                </span>
              </div>

              {/* Image Upload */}
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  Add Photos (Optional)
                </label>
                <p style={styles.hint}>
                  Share photos of your experience (up to 5 images)
                </p>
                
                {images.length < 5 && (
                  <label style={styles.uploadBtn}>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      style={styles.fileInput}
                    />
                    📷 Choose Images
                  </label>
                )}

                {images.length > 0 && (
                  <div style={styles.imagePreviewContainer}>
                    {images.map((img, index) => (
                      <div key={index} style={styles.imagePreview}>
                        <img 
                          src={img.preview} 
                          alt={`Preview ${index + 1}`}
                          style={styles.previewImg}
                        />
                        <button
                          type="button"
                          style={styles.removeImageBtn}
                          onClick={() => removeImage(index)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button 
                type="submit" 
                style={{
                  ...styles.submitBtn,
                  opacity: submitting ? 0.6 : 1,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                }}
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : 'Submit Review'}
              </button>
            </form>
          </div>
        </main>
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
  },
  logo: {
    fontSize: '22px',
    fontFamily: "'Playfair Display', serif",
    color: '#ffc107',
    margin: 0,
    flex: 1,
    textAlign: 'center',
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
    maxWidth: '700px',
    margin: '0 auto',
  },
  formContainer: {
    backgroundColor: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '12px',
    padding: '32px',
  },
  subtitle: {
    fontSize: '16px',
    color: '#ccc',
    marginBottom: '24px',
    textAlign: 'center',
  },
  successMessage: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    color: '#4caf50',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '24px',
    textAlign: 'center',
    border: '1px solid rgba(76, 175, 80, 0.3)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#ffc107',
  },
  hint: {
    fontSize: '12px',
    color: '#666',
    margin: 0,
  },
  starsContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  starBtn: {
    fontSize: '32px',
    background: 'none',
    border: 'none',
    color: '#ffc107',
    cursor: 'pointer',
    padding: 0,
    transition: 'transform 0.2s',
  },
  ratingText: {
    fontSize: '14px',
    color: '#ccc',
    marginLeft: '8px',
  },
  textarea: {
    backgroundColor: '#0a0a0a',
    border: '1px solid #2a2a2a',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '14px',
    color: '#fff',
    fontFamily: "'Poppins', sans-serif",
    resize: 'vertical',
    outline: 'none',
  },
  charCount: {
    fontSize: '12px',
    color: '#666',
    textAlign: 'right',
  },
  uploadBtn: {
    display: 'inline-block',
    padding: '10px 20px',
    backgroundColor: '#2a2a2a',
    color: '#ffc107',
    border: '1px solid #444',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
    width: 'fit-content',
    transition: 'all 0.2s',
  },
  fileInput: {
    display: 'none',
  },
  imagePreviewContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: '12px',
    marginTop: '12px',
  },
  imagePreview: {
    position: 'relative',
    aspectRatio: '1',
    borderRadius: '8px',
    overflow: 'hidden',
    border: '1px solid #2a2a2a',
  },
  previewImg: {
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
    backgroundColor: 'rgba(0,0,0,0.7)',
    color: '#fff',
    border: 'none',
    borderRadius: '50%',
    fontSize: '18px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  submitBtn: {
    padding: '14px',
    backgroundColor: '#ffc107',
    color: '#0a0a0a',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
    transition: 'all 0.2s',
  },
};
