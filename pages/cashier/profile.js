import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../../utils/supabaseClient';
import { useRoleGuard } from '../../utils/useRoleGuard';
import NotificationBell from '../../components/NotificationBell';

export default function CashierProfile() {
  const router = useRouter();
  const { loading: authLoading } = useRoleGuard('cashier');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const MIN_PASSWORD_LENGTH = 6;
  const [profile, setProfile] = useState({
    full_name: '',
    contact_number: '',
    cashier_id: '', // Display only - derived from user.id
  });
  const [showPassword, setShowPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [updatingPassword, setUpdatingPassword] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      fetchProfile();
    }
  }, [authLoading]);

  const fetchProfile = async () => {
    if (!supabase) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }

      setUser(session.user);

      const { data: userData, error } = await supabase
        .from('users')
        .select('full_name, phone')
        .eq('id', session.user.id)
        .maybeSingle();

      if (error) throw error;

      setProfile({
        full_name: userData?.full_name || '',
        contact_number: userData?.phone || '',
      });
      
      // Display user ID as cashier ID (read-only)
      if (session.user?.id) {
        setProfile(prev => ({ ...prev, cashier_id: session.user.id.substring(0, 8) }));
      }
    } catch (err) {
      console.error('[CashierProfile] Failed to fetch profile:', err?.message ?? err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!supabase || !user) return;

    setSaving(true);
    setSaveStatus(null);

    try {
      const { error } = await supabase
        .from('users')
        .update({
          full_name: profile.full_name,
          phone: profile.contact_number,
        })
        .eq('id', user.id);

      if (error) throw error;

      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error('[CashierProfile] Failed to save profile:', err?.message ?? err);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!supabase) return;

    if (passwordData.newPassword.length < MIN_PASSWORD_LENGTH) {
      alert(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('New password and confirmation do not match.');
      return;
    }

    setUpdatingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });

      if (error) throw error;

      alert('Password updated successfully!');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPassword(false);
    } catch (err) {
      console.error('[CashierProfile] Failed to update password:', err?.message ?? err);
      alert('Failed to update password. Please try again.');
    } finally {
      setUpdatingPassword(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div style={styles.center}>
        <p style={{ color: '#ffc107', fontFamily: "'Poppins', sans-serif" }}>
          ⏳ Loading…
        </p>
      </div>
    );
  }

  const handleNotificationClick = (notification) => {
    if (notification?.type === 'new_online_order') {
      router.push('/cashier/dashboard?tab=pending');
    }
  };

  return (
    <>
      <Head>
        <title>Cashier Profile - Bite Bonansa Cafe</title>
        <meta name="description" content="Cashier profile management" />
      </Head>
      <div style={styles.page}>
        <header style={styles.header}>
          <h1 style={styles.logo}>☕ Bite Bonansa Cafe</h1>
          <nav style={styles.nav}>
            <Link href="/cashier/dashboard" style={styles.navLink}>Dashboard</Link>
            <Link href="/cashier/pos" style={styles.navLink}>POS</Link>
            <Link href="/cashier/orders-queue" style={styles.navLink}>Order Queue</Link>
            <Link href="/cashier/eod-report" style={styles.navLink}>EOD Report</Link>
            <Link href="/cashier/settings" style={styles.navLink}>Settings</Link>
            <Link href="/cashier/profile" style={styles.navLinkActive}>Profile</Link>
          </nav>
          <div style={styles.headerActions}>
            {user && <NotificationBell user={user} onNotificationClick={handleNotificationClick} />}
            <button style={styles.logoutBtn} onClick={async () => {
              if (supabase) await supabase.auth.signOut();
              router.replace('/login');
            }}>
              Logout
            </button>
          </div>
        </header>

        <main style={styles.main}>
          <h2 style={styles.title}>👤 My Profile</h2>

          <div style={styles.formContainer}>
            <div style={styles.formSection}>
              <h3 style={styles.sectionTitle}>Personal Information</h3>

              <div style={styles.formGroup}>
                <label style={styles.label}>Email Address</label>
                <input
                  style={{ ...styles.input, ...styles.inputDisabled }}
                  type="email"
                  value={user?.email || ''}
                  disabled
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Cashier's Name</label>
                <input
                  style={styles.input}
                  type="text"
                  value={profile.full_name}
                  onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                  placeholder="Enter full name"
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Cashier's ID Number</label>
                <input
                  style={styles.input}
                  type="text"
                  value={profile.cashier_id}
                  placeholder="Auto-generated ID"
                  disabled
                  readOnly
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Contact Number</label>
                <input
                  style={styles.input}
                  type="tel"
                  value={profile.contact_number}
                  onChange={(e) => setProfile({ ...profile, contact_number: e.target.value })}
                  placeholder="Enter contact number"
                />
              </div>

              {saveStatus === 'success' && (
                <p style={styles.successMsg}>✅ Profile updated successfully!</p>
              )}
              {saveStatus === 'error' && (
                <p style={styles.errorMsg}>❌ Failed to update profile. Please try again.</p>
              )}

              <button
                style={styles.saveBtn}
                onClick={handleSaveProfile}
                disabled={saving}
              >
                {saving ? '⏳ Saving...' : '💾 Save Changes'}
              </button>
            </div>

            <div style={styles.formSection}>
              <h3 style={styles.sectionTitle}>Security</h3>

              <div style={styles.formGroup}>
                <label style={styles.label}>Password</label>
                <div style={styles.passwordRow}>
                  <input
                    style={styles.input}
                    type={showPassword ? 'text' : 'password'}
                    value="••••••••"
                    disabled
                  />
                  <button
                    style={styles.eyeBtn}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>

              {showPassword && (
                <div style={styles.passwordForm}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>New Password</label>
                    <input
                      style={styles.input}
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) =>
                        setPasswordData({ ...passwordData, newPassword: e.target.value })
                      }
                      placeholder="Enter new password"
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Confirm New Password</label>
                    <input
                      style={styles.input}
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) =>
                        setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                      }
                      placeholder="Confirm new password"
                    />
                  </div>

                  <button
                    style={styles.updatePasswordBtn}
                    onClick={handleUpdatePassword}
                    disabled={updatingPassword || !passwordData.newPassword}
                  >
                    {updatingPassword ? '⏳ Updating...' : '🔒 Update Password'}
                  </button>
                </div>
              )}
            </div>
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
    position: 'sticky',
    top: 0,
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 32px',
    backgroundColor: '#1a1a1a',
    borderBottom: '1px solid #ffc107',
    gap: '24px',
  },
  logo: {
    fontSize: '22px',
    fontFamily: "'Playfair Display', serif",
    color: '#ffc107',
    margin: 0,
    whiteSpace: 'nowrap',
  },
  nav: {
    display: 'flex',
    gap: '16px',
    flex: 1,
    justifyContent: 'center',
  },
  navLink: {
    color: '#ccc',
    textDecoration: 'none',
    fontSize: '14px',
    padding: '8px 12px',
    borderRadius: '6px',
    transition: 'all 0.2s',
  },
  navLinkActive: {
    color: '#ffc107',
    textDecoration: 'none',
    fontSize: '14px',
    padding: '8px 12px',
    borderRadius: '6px',
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    border: '1px solid #ffc107',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
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
    whiteSpace: 'nowrap',
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
  formContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '32px',
  },
  formSection: {
    backgroundColor: '#1a1a1a',
    border: '1px solid #ffc107',
    borderRadius: '12px',
    padding: '24px',
  },
  sectionTitle: {
    fontSize: '20px',
    color: '#ffc107',
    marginTop: 0,
    marginBottom: '20px',
  },
  formGroup: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    color: '#ccc',
    marginBottom: '8px',
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    border: '1px solid #444',
    borderRadius: '6px',
    backgroundColor: '#2a2a2a',
    color: '#fff',
    fontSize: '14px',
    boxSizing: 'border-box',
    outline: 'none',
  },
  inputDisabled: {
    backgroundColor: '#1a1a1a',
    color: '#888',
    cursor: 'not-allowed',
  },
  passwordRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  eyeBtn: {
    padding: '10px 14px',
    backgroundColor: '#2a2a2a',
    color: '#ffc107',
    border: '1px solid #444',
    borderRadius: '6px',
    fontSize: '16px',
    cursor: 'pointer',
  },
  passwordForm: {
    marginTop: '16px',
    padding: '16px',
    backgroundColor: '#2a2a2a',
    borderRadius: '8px',
  },
  saveBtn: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#ffc107',
    color: '#0a0a0a',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    marginTop: '8px',
  },
  updatePasswordBtn: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#ffc107',
    color: '#0a0a0a',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    marginTop: '12px',
  },
  successMsg: {
    color: '#4caf50',
    fontSize: '13px',
    marginTop: '12px',
  },
  errorMsg: {
    color: '#f44336',
    fontSize: '13px',
    marginTop: '12px',
  },
};
