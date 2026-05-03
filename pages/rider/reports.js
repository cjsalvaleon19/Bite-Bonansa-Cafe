import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../../utils/supabaseClient';

const DEFAULT_DELIVERY_FEE = 50;
const MIN_PASSWORD_LENGTH = 6;
const RIDER_COMMISSION_RATE = 0.60; // 60% of delivery fee goes to rider
const BUSINESS_REVENUE_RATE = 0.40; // 40% of delivery fee is business revenue

export default function RiderReports() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [completedDeliveries, setCompletedDeliveries] = useState([]);
  const [submittedReports, setSubmittedReports] = useState([]);
  const [selectedDeliveries, setSelectedDeliveries] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'submitted'
  const [viewingReport, setViewingReport] = useState(null);
  const [reportDeliveries, setReportDeliveries] = useState([]);

  const fetchCompletedDeliveries = async (userId) => {
    if (!supabase) return;

    try {
      // Fetch all completed deliveries that haven't been submitted (no date filter for carry-over)
      const { data, error } = await supabase
        .from('deliveries')
        .select('*, orders(id, order_number, total, delivery_fee)')
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
  };

  const fetchSubmittedReports = async (userId) => {
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from('delivery_reports')
        .select('*')
        .eq('rider_id', userId)
        .order('submitted_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('[RiderReports] Failed to fetch submitted reports:', error.message);
      } else {
        setSubmittedReports(data || []);
      }
    } catch (err) {
      console.error('[RiderReports] Failed to fetch submitted reports:', err?.message ?? err);
    }
  };

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
        await fetchSubmittedReports(session.user.id);
        setLoading(false);
      } catch (err) {
        console.error('[RiderReports] Session check failed:', err?.message ?? err);
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
      .reduce((sum, d) => sum + (d.orders?.delivery_fee || 0), 0);
  };

  const calculateBusinessRevenue = () => {
    const totalFees = calculateTotalFees();
    return totalFees * BUSINESS_REVENUE_RATE;
  };

  const calculateRiderEarnings = () => {
    const totalFees = calculateTotalFees();
    return totalFees * RIDER_COMMISSION_RATE;
  };

  const calculateBillableDeliveryFee = (deliveryFee) => {
    // Don't fallback to DEFAULT_DELIVERY_FEE - use actual delivery fee or 0
    return (deliveryFee || 0) * RIDER_COMMISSION_RATE;
  };

  const viewReportDetails = async (report) => {
    if (!report.delivery_ids || report.delivery_ids.length === 0) {
      setViewingReport(report);
      setReportDeliveries([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('deliveries')
        .select('*, orders(id, order_number, total, delivery_fee)')
        .in('id', report.delivery_ids);

      if (error) {
        console.error('[RiderReports] Failed to fetch report deliveries:', error.message);
        setReportDeliveries([]);
      } else {
        setReportDeliveries(data || []);
      }
      setViewingReport(report);
    } catch (err) {
      console.error('[RiderReports] Failed to fetch report deliveries:', err?.message ?? err);
      setReportDeliveries([]);
      setViewingReport(report);
    }
  };

  const closeReportModal = () => {
    setViewingReport(null);
    setReportDeliveries([]);
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
      // Use ISO date string (UTC) for consistency across all riders regardless of timezone
      // The database constraint UNIQUE(rider_id, report_date) requires consistent date representation
      const reportDate = new Date().toISOString().substring(0, 10); // YYYY-MM-DD format

      const { error: reportError } = await supabase
        .from('delivery_reports')
        .insert({
          rider_id: user.id,
          report_date: reportDate,
          total_deliveries: selectedDeliveries.length,
          total_delivery_fees: calculateTotalFees(),
          business_revenue: calculateBusinessRevenue(),
          rider_earnings: calculateRiderEarnings(),
          delivery_ids: selectedDeliveries,
          status: 'submitted',
          submitted_at: new Date().toISOString(),
        });

      if (reportError) throw reportError;

      setSubmitStatus('success');
      setSelectedDeliveries([]);
      
      // Refresh both lists
      await fetchCompletedDeliveries(user.id);
      await fetchSubmittedReports(user.id);
      
      // Switch to submitted reports tab
      setTimeout(() => {
        setActiveTab('submitted');
      }, 1500);
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
          <h2 style={styles.title}>📊 Billing Portal</h2>
          <p style={styles.subtitle}>
            Select completed deliveries from today to submit your billing report. You earn 60% commission from each delivery fee.
          </p>

          {submitStatus === 'success' && (
            <div style={styles.successMessage}>
              ✅ Report submitted successfully! Cashier has been notified and will process payment.
            </div>
          )}

          {submitStatus === 'error' && (
            <div style={styles.errorMessage}>
              ❌ Failed to submit report. Please select at least one delivery and try again.
            </div>
          )}

          {/* Tab Navigation */}
          <div style={styles.tabContainer}>
            <button
              style={{
                ...styles.tab,
                ...(activeTab === 'pending' ? styles.tabActive : {}),
              }}
              onClick={() => setActiveTab('pending')}
            >
              📋 Billable Delivery Fees ({completedDeliveries.length})
            </button>
            <button
              style={{
                ...styles.tab,
                ...(activeTab === 'submitted' ? styles.tabActive : {}),
              }}
              onClick={() => setActiveTab('submitted')}
            >
              ✅ Submitted Reports ({submittedReports.length})
            </button>
          </div>

          <div style={styles.content}>
            {activeTab === 'pending' ? (
              // Pending deliveries tab
              completedDeliveries.length === 0 ? (
                <div style={styles.emptyState}>
                  <span style={styles.emptyIcon}>📄</span>
                  <p style={styles.emptyText}>No billable deliveries</p>
                  <p style={styles.emptySubtext}>
                    Completed deliveries will appear here for billing
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
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleDeliverySelection(delivery.id);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            style={styles.checkbox}
                          />
                        </div>
                        <div style={styles.deliveryInfo}>
                          <h3 style={styles.deliveryTitle}>
                            Order #{delivery.orders?.order_number || delivery.order_id}
                          </h3>
                          <p style={styles.deliveryDetail}>
                            📍 {delivery.customer_address || 'Address not available'}
                          </p>
                          <p style={styles.deliveryDetail}>
                            📅 {new Date(delivery.completed_at).toLocaleString()}
                          </p>
                          <div style={styles.deliveryFee}>
                            Billable Delivery Fee: ₱{calculateBillableDeliveryFee(delivery.orders?.delivery_fee).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {selectedDeliveries.length > 0 && (
                    <div style={styles.submitSection}>
                      <div style={styles.breakdownContainer}>
                        <div style={styles.breakdownRow}>
                          <span style={styles.breakdownLabel}>Total Deliveries:</span>
                          <span style={styles.breakdownValue}>{selectedDeliveries.length} {selectedDeliveries.length === 1 ? 'delivery' : 'deliveries'}</span>
                        </div>
                        <div style={styles.breakdownRow}>
                          <span style={styles.breakdownLabel}>Rider Earnings (60%):</span>
                          <span style={styles.breakdownEarnings}>₱{calculateRiderEarnings().toFixed(2)}</span>
                        </div>
                      </div>
                      <button
                        style={styles.submitBtn}
                        onClick={handleSubmitReport}
                        disabled={submitting}
                      >
                        {submitting ? '⏳ Submitting...' : '💵 Bill to Cashier'}
                      </button>
                    </div>
                  )}
                </>
              )
            ) : (
              // Submitted reports tab
              submittedReports.length === 0 ? (
                <div style={styles.emptyState}>
                  <span style={styles.emptyIcon}>📊</span>
                  <p style={styles.emptyText}>No submitted reports yet</p>
                  <p style={styles.emptySubtext}>
                    Your submitted billing reports will appear here
                  </p>
                </div>
              ) : (
                <div style={styles.reportList}>
                  {submittedReports.map((report) => (
                    <div key={report.id} style={styles.reportCard}>
                      <div style={styles.reportHeader}>
                        <h3 style={styles.reportTitle}>
                          Report #{report.id.substring(0, 8)}
                        </h3>
                        <span
                          style={{
                            ...styles.reportStatus,
                            ...(report.status === 'paid' ? styles.reportStatusPaid : styles.reportStatusPending),
                          }}
                        >
                          {report.status === 'paid' ? '✅ PAID' : '⏳ PENDING'}
                        </span>
                      </div>
                      <div style={styles.reportBody}>
                        <p style={styles.reportDetail}>
                          <strong>Submitted:</strong> {new Date(report.submitted_at).toLocaleString()}
                        </p>
                        {report.paid_at && (
                          <p style={styles.reportDetail}>
                            <strong>Paid:</strong> {new Date(report.paid_at).toLocaleString()}
                          </p>
                        )}
                        <p style={styles.reportDetail}>
                          <strong>Deliveries:</strong> {report.total_deliveries || 0}
                        </p>
                        <p style={styles.reportDetail}>
                          <strong>Total Fees:</strong> ₱{report.total_delivery_fees?.toFixed(2) || '0.00'}
                        </p>
                        <p style={styles.reportEarnings}>
                          <strong>Your Earnings (60%):</strong> ₱{report.rider_earnings?.toFixed(2) || '0.00'}
                        </p>
                        <button
                          style={styles.viewDetailsBtn}
                          onClick={() => viewReportDetails(report)}
                        >
                          📋 View Delivery List
                        </button>
                        {(report.status === 'submitted' || report.status === 'pending') && (
                          <div style={styles.pendingNote}>
                            ⏳ Waiting for cashier to process payment
                          </div>
                        )}
                        {report.status === 'paid' && (
                          <div style={styles.paidNote}>
                            🔒 This report has been paid. Details can no longer be edited.
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </main>

        {/* Report Details Modal */}
        {viewingReport && (
          <div style={styles.modalOverlay} onClick={closeReportModal}>
            <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <h2 style={styles.modalTitle}>
                  Report #{viewingReport.id.substring(0, 8)} - Delivery List
                </h2>
                <button style={styles.modalCloseBtn} onClick={closeReportModal}>
                  ✕
                </button>
              </div>
              <div style={styles.modalBody}>
                <div style={styles.modalSummary}>
                  <p style={styles.modalSummaryItem}>
                    <strong>Total Deliveries:</strong> {viewingReport.total_deliveries || 0}
                  </p>
                  <p style={styles.modalSummaryItem}>
                    <strong>Rider Earnings (60%):</strong> ₱{viewingReport.rider_earnings?.toFixed(2) || '0.00'}
                  </p>
                </div>
                <hr style={styles.modalDivider} />
                {reportDeliveries.length === 0 ? (
                  <p style={styles.modalNoData}>No delivery details available for this report.</p>
                ) : (
                  <div style={styles.modalDeliveryList}>
                    {reportDeliveries.map((delivery, index) => (
                      <div key={delivery.id} style={styles.modalDeliveryItem}>
                        <div style={styles.modalDeliveryNumber}>{index + 1}.</div>
                        <div style={styles.modalDeliveryDetails}>
                          <p style={styles.modalDeliveryTitle}>
                            Order #{delivery.orders?.order_number || delivery.order_id}
                          </p>
                          <p style={styles.modalDeliveryInfo}>
                            📍 {delivery.customer_address || 'Address not available'}
                          </p>
                          <p style={styles.modalDeliveryInfo}>
                            📅 {new Date(delivery.completed_at).toLocaleString()}
                          </p>
                          <p style={styles.modalDeliveryFee}>
                            Billable Delivery Fee: ₱{calculateBillableDeliveryFee(delivery.orders?.delivery_fee).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
    flexDirection: 'column',
    gap: '20px',
  },
  breakdownContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    width: '100%',
  },
  breakdownRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid #333',
  },
  breakdownLabel: {
    fontSize: '16px',
    color: '#ccc',
  },
  breakdownValue: {
    fontSize: '18px',
    color: '#fff',
    fontWeight: '600',
  },
  breakdownHighlight: {
    fontSize: '20px',
    color: '#ffc107',
    fontWeight: '700',
  },
  breakdownEarnings: {
    fontSize: '20px',
    color: '#4caf50',
    fontWeight: '700',
  },
  breakdownNote: {
    backgroundColor: '#0a0a0a',
    padding: '12px',
    borderRadius: '6px',
    textAlign: 'center',
    color: '#999',
    marginTop: '8px',
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
    width: '100%',
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
  tabContainer: {
    display: 'flex',
    gap: '12px',
    marginBottom: '32px',
    justifyContent: 'center',
  },
  tab: {
    padding: '12px 24px',
    backgroundColor: '#1a1a1a',
    color: '#ccc',
    border: '2px solid #333',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
    transition: 'all 0.3s ease',
  },
  tabActive: {
    backgroundColor: '#ffc107',
    color: '#0a0a0a',
    borderColor: '#ffc107',
  },
  reportList: {
    display: 'grid',
    gap: '20px',
  },
  reportCard: {
    backgroundColor: '#1a1a1a',
    border: '2px solid #333',
    borderRadius: '12px',
    padding: '20px',
  },
  reportHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    paddingBottom: '16px',
    borderBottom: '1px solid #333',
  },
  reportTitle: {
    fontSize: '18px',
    color: '#ffc107',
    margin: 0,
    fontWeight: '600',
  },
  reportStatus: {
    display: 'inline-block',
    padding: '6px 16px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '700',
  },
  reportStatusPaid: {
    backgroundColor: '#4caf50',
    color: '#fff',
  },
  reportStatusPending: {
    backgroundColor: '#ff9800',
    color: '#fff',
  },
  reportBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  reportDetail: {
    fontSize: '14px',
    color: '#ccc',
    margin: 0,
  },
  reportEarnings: {
    fontSize: '16px',
    color: '#4caf50',
    fontWeight: '700',
    margin: '8px 0',
  },
  pendingNote: {
    backgroundColor: '#1f1f1f',
    color: '#ff9800',
    padding: '12px',
    borderRadius: '6px',
    fontSize: '13px',
    marginTop: '12px',
    border: '1px solid #ff9800',
  },
  paidNote: {
    backgroundColor: '#1a4d1a',
    color: '#90ee90',
    padding: '12px',
    borderRadius: '6px',
    fontSize: '13px',
    marginTop: '12px',
    border: '1px solid #90ee90',
  },
  viewDetailsBtn: {
    padding: '10px 20px',
    backgroundColor: '#ffc107',
    color: '#0a0a0a',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
    marginTop: '12px',
    width: '100%',
    transition: 'all 0.3s ease',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: '12px',
    maxWidth: '800px',
    width: '100%',
    maxHeight: '90vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    border: '2px solid #ffc107',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid #333',
    backgroundColor: '#0a0a0a',
  },
  modalTitle: {
    fontSize: '20px',
    color: '#ffc107',
    margin: 0,
    fontWeight: '600',
  },
  modalCloseBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#ccc',
    fontSize: '24px',
    cursor: 'pointer',
    padding: '0',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
    transition: 'all 0.3s ease',
  },
  modalBody: {
    padding: '24px',
    overflowY: 'auto',
    flex: 1,
  },
  modalSummary: {
    backgroundColor: '#0a0a0a',
    padding: '16px',
    borderRadius: '8px',
    marginBottom: '20px',
  },
  modalSummaryItem: {
    fontSize: '14px',
    color: '#ccc',
    margin: '8px 0',
  },
  modalDivider: {
    border: 'none',
    borderTop: '1px solid #333',
    margin: '20px 0',
  },
  modalNoData: {
    textAlign: 'center',
    color: '#888',
    padding: '40px 20px',
    fontSize: '14px',
  },
  modalDeliveryList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  modalDeliveryItem: {
    display: 'flex',
    gap: '12px',
    padding: '16px',
    backgroundColor: '#0a0a0a',
    borderRadius: '8px',
    border: '1px solid #333',
  },
  modalDeliveryNumber: {
    fontSize: '16px',
    color: '#ffc107',
    fontWeight: '700',
    minWidth: '24px',
  },
  modalDeliveryDetails: {
    flex: 1,
  },
  modalDeliveryTitle: {
    fontSize: '16px',
    color: '#ffc107',
    fontWeight: '600',
    margin: '0 0 8px 0',
  },
  modalDeliveryInfo: {
    fontSize: '13px',
    color: '#ccc',
    margin: '4px 0',
  },
  modalDeliveryFee: {
    fontSize: '14px',
    color: '#fff',
    fontWeight: '600',
    marginTop: '8px',
  },
};
