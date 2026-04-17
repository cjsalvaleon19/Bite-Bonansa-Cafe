import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../../utils/supabaseClient';

const DEFAULT_DELIVERY_FEE = 50;

export default function RiderReports() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [completedDeliveries, setCompletedDeliveries] = useState([]);
  const [selectedDeliveries, setSelectedDeliveries] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);

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
          console.error('[RiderReports] Failed to fetch user role:', userError.message);
          setLoading(false);
          return;
        }

        const role = userData?.role || 'customer';
        setUserRole(role);

        // Redirect if not a rider
        if (role !== 'rider') {
          if (role === 'admin') {
            router.replace('/dashboard').catch(console.error);
          } else if (role === 'cashier') {
            router.replace('/cashier').catch(console.error);
          } else {
            router.replace('/customer/menu').catch(console.error);
          }
          return;
        }

        // Fetch completed deliveries without submitted reports
        await fetchCompletedDeliveries(session.user.id);
        setLoading(false);
      } catch (err) {
        console.error('[RiderReports] Session check failed:', err?.message ?? err);
        if (mounted) {
          setLoading(false);
          router.replace('/login').catch(console.error);
        }
      }
    }

    async function fetchCompletedDeliveries(userId) {
      if (!supabase) return;

      try {
        const { data, error } = await supabase
          .from('deliveries')
          .select('*, orders(id, total)')
          .eq('rider_id', userId)
          .eq('status', 'completed')
          .or('report_submitted.is.null,report_submitted.eq.false')
          .order('completed_at', { ascending: false });

        if (error) {
          console.error('[RiderReports] Failed to fetch deliveries:', error.message);
        } else {
          setCompletedDeliveries(data || []);
        }
      } catch (err) {
        console.error('[RiderReports] Failed to fetch deliveries:', err?.message ?? err);
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

  const handleLogout = async () => {
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.warn('[RiderReports] Sign out failed:', err?.message ?? err);
    }
    localStorage.removeItem('token');
    router.replace('/login').catch(console.error);
  };

  const toggleDeliverySelection = (deliveryId) => {
    setSelectedDeliveries((prev) =>
      prev.includes(deliveryId)
        ? prev.filter((id) => id !== deliveryId)
        : [...prev, deliveryId]
    );
  };

  const calculateTotalFees = () => {
    return completedDeliveries
      .filter((d) => selectedDeliveries.includes(d.id))
      .reduce((sum, d) => sum + (d.delivery_fee || DEFAULT_DELIVERY_FEE), 0);
  };

  const handleSubmitReport = async () => {
    if (selectedDeliveries.length === 0) {
      setSubmitStatus('error');
      return;
    }

    setSubmitting(true);
    setSubmitStatus(null);

    try {
      if (!supabase) throw new Error('Supabase not available');

      // Update selected deliveries to mark reports as submitted
      const { error: updateError } = await supabase
        .from('deliveries')
        .update({ 
          report_submitted: true,
          report_submitted_at: new Date().toISOString()
        })
        .in('id', selectedDeliveries);

      if (updateError) throw updateError;

      // Create a delivery report record
      const { error: reportError } = await supabase
        .from('delivery_reports')
        .insert({
          rider_id: user.id,
          delivery_ids: selectedDeliveries,
          total_fees: calculateTotalFees(),
          status: 'pending',
          submitted_at: new Date().toISOString(),
        });

      if (reportError) throw reportError;

      setSubmitStatus('success');
      setSelectedDeliveries([]);
      
      // Refresh the list
      const { data, error: fetchError } = await supabase
        .from('deliveries')
        .select('*, orders(id, total)')
        .eq('rider_id', user.id)
        .eq('status', 'completed')
        .or('report_submitted.is.null,report_submitted.eq.false')
        .order('completed_at', { ascending: false });

      if (!fetchError) {
        setCompletedDeliveries(data || []);
      }
    } catch (err) {
      console.error('[RiderReports] Failed to submit report:', err?.message ?? err);
      setSubmitStatus('error');
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
        <title>Delivery Reports - Bite Bonansa Cafe</title>
        <meta name="description" content="Submit delivery fee billing reports" />
      </Head>
      <div style={styles.page}>
        <header style={styles.header}>
          <h1 style={styles.logo}>☕ Bite Bonansa Cafe</h1>
          <span style={styles.welcome}>
            Welcome, {user?.email ?? 'Rider'}
          </span>
          <button style={styles.logoutBtn} onClick={handleLogout}>
            Logout
          </button>
        </header>

        <nav style={styles.nav}>
          <Link href="/rider/dashboard" style={styles.navLink}>
            🏠 Dashboard
          </Link>
          <Link href="/rider/deliveries" style={styles.navLink}>
            🚚 Deliveries
          </Link>
          <Link href="/rider/reports" style={{ ...styles.navLink, ...styles.navLinkActive }}>
            📊 Reports
          </Link>
          <Link href="/rider/profile" style={styles.navLink}>
            👤 Profile
          </Link>
        </nav>

        <main style={styles.main}>
          <h2 style={styles.title}>📊 Delivery Reports</h2>
          <p style={styles.subtitle}>
            Select completed deliveries to submit delivery fee billing to the cashier
          </p>

          {submitStatus === 'success' && (
            <div style={styles.successMessage}>
              ✅ Report submitted successfully! The cashier will review your submission.
            </div>
          )}

          {submitStatus === 'error' && (
            <div style={styles.errorMessage}>
              ❌ Failed to submit report. Please select at least one delivery and try again.
            </div>
          )}

          <div style={styles.content}>
            {completedDeliveries.length === 0 ? (
              <div style={styles.emptyState}>
                <span style={styles.emptyIcon}>📄</span>
                <p style={styles.emptyText}>No pending reports</p>
                <p style={styles.emptySubtext}>
                  All completed deliveries have been reported
                </p>
              </div>
            ) : (
              <>
                <div style={styles.deliveryList}>
                  {completedDeliveries.map((delivery) => (
                    <div
                      key={delivery.id}
                      style={{
                        ...styles.deliveryCard,
                        ...(selectedDeliveries.includes(delivery.id) ? styles.deliveryCardSelected : {}),
                      }}
                      onClick={() => toggleDeliverySelection(delivery.id)}
                    >
                      <div style={styles.checkboxContainer}>
                        <input
                          type="checkbox"
                          checked={selectedDeliveries.includes(delivery.id)}
                          onChange={() => toggleDeliverySelection(delivery.id)}
                          style={styles.checkbox}
                        />
                      </div>
                      <div style={styles.deliveryInfo}>
                        <h3 style={styles.deliveryTitle}>
                          Order #{delivery.order_id}
                        </h3>
                        <p style={styles.deliveryDetail}>
                          📍 {delivery.customer_address || 'Address not available'}
                        </p>
                        <p style={styles.deliveryDetail}>
                          📅 {new Date(delivery.completed_at || delivery.created_at).toLocaleDateString()}
                        </p>
                        <div style={styles.deliveryFee}>
                          Delivery Fee: ₱{delivery.delivery_fee || DEFAULT_DELIVERY_FEE}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {selectedDeliveries.length > 0 && (
                  <div style={styles.submitSection}>
                    <div style={styles.totalSection}>
                      <span style={styles.totalLabel}>Total Delivery Fees:</span>
                      <span style={styles.totalAmount}>₱{calculateTotalFees()}</span>
                    </div>
                    <button
                      style={styles.submitBtn}
                      onClick={handleSubmitReport}
                      disabled={submitting}
                    >
                      {submitting ? '⏳ Submitting...' : '📤 Submit Report to Cashier'}
                    </button>
                  </div>
                )}
              </>
            )}
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
  },
  welcome: {
    color: '#ccc',
    fontSize: '14px',
    flex: 1,
    textAlign: 'center',
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
  nav: {
    display: 'flex',
    justifyContent: 'center',
    gap: '24px',
    padding: '20px 32px',
    backgroundColor: '#0a0a0a',
    borderBottom: '1px solid #333',
  },
  navLink: {
    color: '#ccc',
    textDecoration: 'none',
    fontSize: '16px',
    padding: '8px 16px',
    borderRadius: '6px',
    transition: 'all 0.3s ease',
  },
  navLinkActive: {
    color: '#ffc107',
    backgroundColor: '#1a1a1a',
    fontWeight: '600',
  },
  main: {
    padding: '40px 32px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  title: {
    fontSize: '32px',
    fontFamily: "'Playfair Display', serif",
    color: '#ffc107',
    marginBottom: '12px',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: '16px',
    color: '#ccc',
    textAlign: 'center',
    marginBottom: '32px',
  },
  content: {
    minHeight: '400px',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
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
  deliveryList: {
    display: 'grid',
    gap: '16px',
    marginBottom: '32px',
  },
  deliveryCard: {
    backgroundColor: '#1a1a1a',
    border: '2px solid #333',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  deliveryCardSelected: {
    borderColor: '#ffc107',
    backgroundColor: '#1f1f1f',
  },
  checkboxContainer: {
    paddingTop: '4px',
  },
  checkbox: {
    width: '20px',
    height: '20px',
    cursor: 'pointer',
  },
  deliveryInfo: {
    flex: 1,
  },
  deliveryTitle: {
    fontSize: '18px',
    color: '#ffc107',
    margin: '0 0 12px 0',
    fontWeight: '600',
  },
  deliveryDetail: {
    fontSize: '14px',
    color: '#ccc',
    margin: '4px 0',
  },
  deliveryFee: {
    fontSize: '16px',
    color: '#ffc107',
    fontWeight: '600',
    marginTop: '12px',
  },
  submitSection: {
    backgroundColor: '#1a1a1a',
    border: '2px solid #ffc107',
    borderRadius: '12px',
    padding: '24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '16px',
  },
  totalSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  totalLabel: {
    fontSize: '14px',
    color: '#ccc',
  },
  totalAmount: {
    fontSize: '28px',
    color: '#ffc107',
    fontWeight: '700',
  },
  submitBtn: {
    padding: '12px 32px',
    backgroundColor: '#ffc107',
    color: '#0a0a0a',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
    transition: 'all 0.3s ease',
  },
  successMessage: {
    backgroundColor: '#1a4d1a',
    color: '#90ee90',
    padding: '16px',
    borderRadius: '8px',
    marginBottom: '24px',
    border: '1px solid #90ee90',
    textAlign: 'center',
  },
  errorMessage: {
    backgroundColor: '#4d1a1a',
    color: '#ff6b6b',
    padding: '16px',
    borderRadius: '8px',
    marginBottom: '24px',
    border: '1px solid #ff6b6b',
    textAlign: 'center',
  },
};
