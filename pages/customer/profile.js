import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../../utils/supabaseClient';

export default function CustomerProfile() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState({
    full_name: '',
    customer_id: '',
    address: '',
    email: '',
    created_at: '',
    loyalty_balance: 0
  });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

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

        // Fetch user profile
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('role, full_name, customer_id, address, email, created_at')
          .eq('id', session.user.id)
          .maybeSingle();

        if (!mounted) return;

        if (userError) {
          console.error('[CustomerProfile] Failed to fetch user profile:', userError.message);
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

        // Fetch loyalty balance from transactions
        const { data: transactions, error: transError } = await supabase
          .from('loyalty_transactions')
          .select('amount')
          .eq('customer_id', session.user.id);

        const loyaltyBalance = (!transError && transactions) 
          ? transactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0) 
          : 0;

        setProfile({
          full_name: userData.full_name || '',
          customer_id: userData.customer_id || '',
          address: userData.address || '',
          email: userData.email || session.user.email,
          created_at: userData.created_at || '',
          loyalty_balance: loyaltyBalance
        });

        setLoading(false);
      } catch (err) {
        console.error('[CustomerProfile] Session check failed:', err?.message ?? err);
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

  const handleUpdatePassword = async () => {
    setPasswordError('');

    // Validation
    if (!newPassword || !confirmPassword) {
      setPasswordError('Please fill in all fields');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setUpdatingPassword(true);

    try {
      // Update password
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      // Clear form and close modal
      setNewPassword('');
      setConfirmPassword('');
      setCurrentPassword('');
      setShowPasswordModal(false);
      alert('Password updated successfully!');
    } catch (err) {
      console.error('[CustomerProfile] Failed to update password:', err);
      setPasswordError(err.message || 'Failed to update password');
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.warn('[CustomerProfile] Sign out failed:', err?.message ?? err);
    }
    localStorage.removeItem('token');
    router.replace('/login').catch(console.error);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
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
        <title>My Profile - Bite Bonansa Cafe</title>
        <meta name="description" content="Customer profile" />
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
          <h2 style={styles.title}>👤 My Profile</h2>
          
          <div style={styles.profileCard}>
            <div style={styles.profileHeader}>
              <div style={styles.avatar}>
                {profile.full_name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div>
                <h3 style={styles.profileName}>{profile.full_name || 'No Name'}</h3>
                <p style={styles.customerId}>{profile.customer_id}</p>
              </div>
            </div>

            <div style={styles.profileSection}>
              <h3 style={styles.sectionTitle}>Account Information</h3>
              
              <div style={styles.fieldGroup}>
                <label style={styles.fieldLabel}>Complete Name</label>
                <div style={styles.fieldValue}>{profile.full_name || 'Not provided'}</div>
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.fieldLabel}>Customer ID Number</label>
                <div style={styles.fieldValue}>{profile.customer_id || 'Not assigned'}</div>
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.fieldLabel}>Email Address</label>
                <div style={styles.fieldValue}>{profile.email || 'Not provided'}</div>
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.fieldLabel}>Delivery Address</label>
                <div style={styles.fieldValue}>{profile.address || 'Not provided'}</div>
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.fieldLabel}>Date of Membership</label>
                <div style={styles.fieldValue}>{formatDate(profile.created_at)}</div>
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.fieldLabel}>Loyalty Balance</label>
                <div style={{...styles.fieldValue, color: '#4caf50', fontWeight: 'bold'}}>
                  ₱{profile.loyalty_balance.toFixed(2)}
                </div>
              </div>
            </div>

            <div style={styles.profileSection}>
              <h3 style={styles.sectionTitle}>Security</h3>
              
              <div style={styles.fieldGroup}>
                <label style={styles.fieldLabel}>Password</label>
                <div style={styles.passwordField}>
                  <div style={styles.passwordValue}>
                    ••••••••
                  </div>
                </div>
                <p style={styles.passwordNote}>
                  For security reasons, passwords cannot be viewed. Use "Update Password" to change your password.
                </p>
                <button
                  style={styles.updatePasswordBtn}
                  onClick={() => setShowPasswordModal(true)}
                >
                  Update Password
                </button>
              </div>
            </div>
          </div>
        </main>

        {/* Password Update Modal */}
        {showPasswordModal && (
          <div style={styles.modalOverlay} onClick={() => !updatingPassword && setShowPasswordModal(false)}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
              <h3 style={styles.modalTitle}>Update Password</h3>
              
              <div style={styles.formGroup}>
                <label style={styles.label}>New Password</label>
                <input
                  type="password"
                  style={styles.input}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 6 characters)"
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Confirm New Password</label>
                <input
                  type="password"
                  style={styles.input}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                />
              </div>

              {passwordError && (
                <div style={styles.errorMessage}>{passwordError}</div>
              )}

              <div style={styles.modalActions}>
                <button
                  style={styles.modalBtnCancel}
                  onClick={() => {
                    setShowPasswordModal(false);
                    setNewPassword('');
                    setConfirmPassword('');
                    setPasswordError('');
                  }}
                  disabled={updatingPassword}
                >
                  Cancel
                </button>
                <button
                  style={styles.modalBtnConfirm}
                  onClick={handleUpdatePassword}
                  disabled={updatingPassword}
                >
                  {updatingPassword ? 'Updating...' : 'Save Password'}
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
    maxWidth: '800px',
    margin: '0 auto',
  },
  title: {
    fontSize: '32px',
    fontFamily: "'Playfair Display', serif",
    color: '#ffc107',
    marginBottom: '32px',
    textAlign: 'center',
  },
  profileCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: '12px',
    padding: '32px',
    border: '1px solid #444',
  },
  profileHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
    marginBottom: '32px',
    paddingBottom: '24px',
    borderBottom: '1px solid #444',
  },
  avatar: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    backgroundColor: '#ffc107',
    color: '#000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '36px',
    fontWeight: 'bold',
  },
  profileName: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#fff',
    margin: '0 0 4px 0',
  },
  customerId: {
    fontSize: '14px',
    color: '#999',
    margin: 0,
  },
  profileSection: {
    marginBottom: '32px',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#ffc107',
    marginBottom: '20px',
  },
  fieldGroup: {
    marginBottom: '20px',
  },
  fieldLabel: {
    display: 'block',
    fontSize: '13px',
    color: '#999',
    marginBottom: '8px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  fieldValue: {
    fontSize: '16px',
    color: '#fff',
    padding: '12px',
    backgroundColor: '#1a1a1a',
    borderRadius: '6px',
  },
  passwordField: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  passwordValue: {
    flex: 1,
    fontSize: '16px',
    color: '#fff',
    padding: '12px',
    backgroundColor: '#1a1a1a',
    borderRadius: '6px',
  },
  passwordNote: {
    fontSize: '12px',
    color: '#999',
    marginTop: '8px',
    fontStyle: 'italic',
  },
  updatePasswordBtn: {
    marginTop: '12px',
    padding: '10px 20px',
    backgroundColor: 'transparent',
    color: '#ffc107',
    border: '1px solid #ffc107',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
    fontWeight: 'bold',
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
  },
  modal: {
    backgroundColor: '#2a2a2a',
    borderRadius: '12px',
    padding: '32px',
    maxWidth: '500px',
    width: '90%',
    border: '1px solid #ffc107',
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
