import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../../utils/supabaseClient';
import NotificationBell from '../../components/NotificationBell';

export default function BitersReviews() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState([]);

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
          console.error('[BitersReviews] Failed to fetch user role:', userError.message);
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

        // Fetch all published reviews
        await fetchPublishedReviews();

        setLoading(false);
      } catch (err) {
        console.error('[BitersReviews] Session check failed:', err?.message ?? err);
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

  async function fetchPublishedReviews() {
    try {
      const { data, error } = await supabase
        .from('customer_reviews')
        .select(`
          *,
          users!customer_reviews_customer_id_fkey (
            id,
            full_name,
            email
          )
        `)
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReviews(data || []);
    } catch (err) {
      console.error('[BitersReviews] Failed to fetch reviews:', err);
    }
  }

  const renderStars = (rating) => {
    return (
      <div style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            style={{
              ...styles.star,
              color: star <= rating ? '#ffc107' : '#ddd'
            }}
          >
            ★
          </span>
        ))}
      </div>
    );
  };

  const getCustomerName = (review) => {
    if (review.users?.full_name) {
      return review.users.full_name;
    }
    if (review.users?.email) {
      return review.users.email.split('@')[0];
    }
    return 'Anonymous';
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p style={styles.loadingText}>Loading reviews...</p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Biter's Reviews - Bite Bonansa Cafe</title>
        <meta name="description" content="See what our customers are saying" />
      </Head>

      <div style={styles.container}>
        {/* Header */}
        <header style={styles.header}>
          <div style={styles.headerContent}>
            <Link href="/customer/dashboard" style={styles.backButton}>
              ← Back
            </Link>
            <h1 style={styles.headerTitle}>Biter's Reviews</h1>
            <NotificationBell userId={user?.id} />
          </div>
        </header>

        {/* Main Content */}
        <main style={styles.main}>
          <div style={styles.pageHeader}>
            <h2 style={styles.pageTitle}>⭐ What Our Biters Say</h2>
            <p style={styles.pageSubtitle}>
              Discover reviews from our valued customers
            </p>
          </div>

          {reviews.length === 0 ? (
            <div style={styles.emptyState}>
              <span style={styles.emptyIcon}>📝</span>
              <h3 style={styles.emptyTitle}>No Reviews Yet</h3>
              <p style={styles.emptyText}>
                Be the first to share your experience!
              </p>
              <Link href="/customer/reviews" style={styles.shareButton}>
                Share Your Review
              </Link>
            </div>
          ) : (
            <div style={styles.reviewsGrid}>
              {reviews.map((review) => {
                const images = review.image_urls ? JSON.parse(review.image_urls) : [];
                
                return (
                  <div key={review.id} style={styles.reviewCard}>
                    {/* Customer Info */}
                    <div style={styles.reviewHeader}>
                      <div style={styles.customerAvatar}>
                        {getCustomerName(review).charAt(0).toUpperCase()}
                      </div>
                      <div style={styles.customerInfo}>
                        <h4 style={styles.customerName}>{getCustomerName(review)}</h4>
                        <div style={styles.ratingContainer}>
                          {renderStars(review.star_rating)}
                          <span style={styles.ratingText}>{review.star_rating}.0</span>
                        </div>
                      </div>
                    </div>

                    {/* Review Title */}
                    {review.title && (
                      <h3 style={styles.reviewTitle}>{review.title}</h3>
                    )}

                    {/* Review Text */}
                    <p style={styles.reviewText}>{review.review_text}</p>

                    {/* Review Images */}
                    {images.length > 0 && (
                      <div style={styles.imagesContainer}>
                        {images.map((imageUrl, index) => (
                          <div key={index} style={styles.imageWrapper}>
                            <img
                              src={imageUrl}
                              alt={`Review photo ${index + 1} by ${getCustomerName(review)}`}
                              style={styles.reviewImage}
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Review Date */}
                    <p style={styles.reviewDate}>
                      {new Date(review.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f8f9fa',
    paddingBottom: '80px'
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#f8f9fa'
  },
  spinner: {
    border: '4px solid #f3f3f3',
    borderTop: '4px solid #ff6b35',
    borderRadius: '50%',
    width: '50px',
    height: '50px',
    animation: 'spin 1s linear infinite'
  },
  loadingText: {
    marginTop: '20px',
    fontSize: '16px',
    color: '#666'
  },
  header: {
    backgroundColor: '#fff',
    borderBottom: '1px solid #e0e0e0',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  headerContent: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '15px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  backButton: {
    fontSize: '16px',
    color: '#ff6b35',
    textDecoration: 'none',
    fontWeight: '500',
    padding: '8px 16px',
    borderRadius: '8px',
    transition: 'background-color 0.2s',
    cursor: 'pointer'
  },
  headerTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#333',
    margin: 0,
    flex: 1,
    textAlign: 'center'
  },
  main: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '30px 20px'
  },
  pageHeader: {
    textAlign: 'center',
    marginBottom: '40px'
  },
  pageTitle: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#333',
    margin: '0 0 10px 0'
  },
  pageSubtitle: {
    fontSize: '16px',
    color: '#666',
    margin: 0
  },
  reviewsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
    gap: '24px',
    marginTop: '30px'
  },
  reviewCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    transition: 'transform 0.2s, box-shadow 0.2s',
    cursor: 'default'
  },
  reviewHeader: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '16px',
    gap: '12px'
  },
  customerAvatar: {
    width: '50px',
    height: '50px',
    borderRadius: '50%',
    backgroundColor: '#ff6b35',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    fontWeight: 'bold',
    flexShrink: 0
  },
  customerInfo: {
    flex: 1
  },
  customerName: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#333',
    margin: '0 0 4px 0'
  },
  ratingContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  starsContainer: {
    display: 'flex',
    gap: '2px'
  },
  star: {
    fontSize: '18px'
  },
  ratingText: {
    fontSize: '14px',
    color: '#666',
    fontWeight: '500'
  },
  reviewTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#333',
    margin: '0 0 12px 0'
  },
  reviewText: {
    fontSize: '15px',
    color: '#555',
    lineHeight: '1.6',
    margin: '0 0 16px 0'
  },
  imagesContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: '8px',
    marginBottom: '16px'
  },
  imageWrapper: {
    position: 'relative',
    paddingBottom: '100%',
    borderRadius: '8px',
    overflow: 'hidden',
    backgroundColor: '#f0f0f0'
  },
  reviewImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },
  reviewDate: {
    fontSize: '13px',
    color: '#999',
    margin: 0
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    backgroundColor: '#fff',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
  },
  emptyIcon: {
    fontSize: '64px',
    marginBottom: '20px',
    display: 'block'
  },
  emptyTitle: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#333',
    margin: '0 0 10px 0'
  },
  emptyText: {
    fontSize: '16px',
    color: '#666',
    margin: '0 0 24px 0'
  },
  shareButton: {
    display: 'inline-block',
    padding: '12px 32px',
    backgroundColor: '#ff6b35',
    color: '#fff',
    textDecoration: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    transition: 'background-color 0.2s',
    cursor: 'pointer'
  }
};
