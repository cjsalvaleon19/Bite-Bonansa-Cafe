import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../../utils/supabaseClient';

export default function RiderProfile() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const MIN_PASSWORD_LENGTH = 6;
  const [profile, setProfile] = useState({
    full_name: '',
    phone: '',
    driver_id: '',
    cellphone_number: '',
    vehicle_type: '',
    vehicle_plate: '',
    emergency_contact: '',
    emergency_phone: '',
    is_available: true,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [updatingPassword, setUpdatingPassword] = useState(false);

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
          .select('role, full_name, phone')
          .eq('id', session.user.id)
          .maybeSingle();

        if (!mounted) return;

        if (userError) {
          console.error('[RiderProfile] Failed to fetch user role:', userError.message);
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

        // Fetch rider profile
        await fetchProfile(session.user.id, userData);
        setLoading(false);
      } catch (err) {
        console.error('[RiderProfile] Session check failed:', err?.message ?? err);
        if (mounted) {
          setLoading(false);
          router.replace('/login').catch(console.error);
        }
      }
    }

    async function fetchProfile(userId, userData) {
      if (!supabase) return;

      try {
        const { data: riderData, error } = await supabase
          .from('riders')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('[RiderProfile] Failed to fetch rider profile:', error.message);
        }

        setProfile({
          full_name: userData?.full_name || '',
          phone: userData?.phone || '',
          driver_id: riderData?.driver_id || '',
          cellphone_number: riderData?.cellphone_number || '',
          vehicle_type: riderData?.vehicle_type || '',
          vehicle_plate: riderData?.vehicle_plate || '',
          emergency_contact: riderData?.emergency_contact || '',
          emergency_phone: riderData?.emergency_phone || '',
          is_available: riderData?.is_available ?? true,
        });
      } catch (err) {
        console.error('[RiderProfile] Failed to fetch profile:', err?.message ?? err);
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
      console.warn('[RiderProfile] Sign out failed:', err?.message ?? err);
    }
    localStorage.removeItem('token');
    router.replace('/login').catch(console.error);
  };

  const handleInputChange = (field, value) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setSaveStatus(null);

    try {
      if (!supabase) throw new Error('Supabase not available');

      // Validate driver_id is provided
      if (!profile.driver_id || profile.driver_id.trim() === '') {
        throw new Error('Driver ID is required');
      }

      // Update users table
      const { error: userError } = await supabase
        .from('users')
        .update({
          full_name: profile.full_name,
          phone: profile.phone,
        })
        .eq('id', user.id);

      if (userError) throw userError;

      // Upsert rider profile
      const { error: riderError } = await supabase
        .from('riders')
        .upsert({
          user_id: user.id,
          driver_id: profile.driver_id,
          cellphone_number: profile.cellphone_number,
          vehicle_type: profile.vehicle_type,
          vehicle_plate: profile.vehicle_plate,
          emergency_contact: profile.emergency_contact,
          emergency_phone: profile.emergency_phone,
          is_available: profile.is_available,
        }, {
          onConflict: 'user_id'
        });

      if (riderError) throw riderError;

      setSaveStatus('success');
    } catch (err) {
      console.error('[RiderProfile] Failed to save profile:', err?.message ?? err);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
    setUpdatingPassword(true);
    setSaveStatus(null);

    try {
      if (!supabase) throw new Error('Supabase not available');

      // Validate password fields
      if (!passwordData.newPassword || passwordData.newPassword.length < MIN_PASSWORD_LENGTH) {
        throw new Error(`New password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      }

      if (passwordData.newPassword !== passwordData.confirmPassword) {
        throw new Error('Passwords do not match');
      }

      // Update password using Supabase auth
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (error) throw error;

      // Clear password fields
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setShowPassword(false);
      setSaveStatus('password-success');
    } catch (err) {
      console.error('[RiderProfile] Failed to update password:', err?.message ?? err);
      setSaveStatus('password-error');
    } finally {
      setUpdatingPassword(false);
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
        <title>My Profile - Bite Bonansa Cafe</title>
        <meta name="description" content="Manage your rider profile" />
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
          <Link href="/rider/reports" style={styles.navLink}>
            📊 Reports
          </Link>
          <Link href="/rider/profile" style={{ ...styles.navLink, ...styles.navLinkActive }}>
            👤 Profile
          </Link>
        </nav>

        <main style={styles.main}>
          <h2 style={styles.title}>👤 My Profile</h2>

          {saveStatus === 'success' && (
            <div style={styles.successMessage}>
              ✅ Profile updated successfully!
            </div>
          )}

          {saveStatus === 'error' && (
            <div style={styles.errorMessage}>
              ❌ Failed to update profile. Please try again.
            </div>
          )}

          {saveStatus === 'password-success' && (
            <div style={styles.successMessage}>
              ✅ Password updated successfully!
            </div>
          )}

          {saveStatus === 'password-error' && (
            <div style={styles.errorMessage}>
              ❌ Failed to update password. Please check your input and try again.
            </div>
          )}

          <div style={styles.content}>
            <div style={styles.formSection}>
              <h3 style={styles.sectionTitle}>Personal Information</h3>
              <div style={styles.formGrid}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Driver's Name <span style={styles.required}>*</span></label>
                  <input
                    type="text"
                    value={profile.full_name}
                    onChange={(e) => handleInputChange('full_name', e.target.value)}
                    style={styles.input}
                    placeholder="Enter your full name"
                    required
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Driver ID Number <span style={styles.required}>*</span></label>
                  <input
                    type="text"
                    value={profile.driver_id}
                    onChange={(e) => handleInputChange('driver_id', e.target.value)}
                    style={styles.input}
                    placeholder="Enter unique driver ID"
                    required
                  />
                  <small style={styles.fieldHelp}>This must be a unique identifier</small>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Cellphone Number</label>
                  <input
                    type="tel"
                    value={profile.cellphone_number}
                    onChange={(e) => handleInputChange('cellphone_number', e.target.value)}
                    style={styles.input}
                    placeholder="Enter your cellphone number"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Phone Number</label>
                  <input
                    type="tel"
                    value={profile.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    style={styles.input}
                    placeholder="Enter alternate phone number"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Email (Read-only)</label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    style={{ ...styles.input, ...styles.inputDisabled }}
                  />
                </div>
              </div>
            </div>

            <div style={styles.formSection}>
              <h3 style={styles.sectionTitle}>Vehicle Information</h3>
              <div style={styles.formGrid}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Vehicle Type</label>
                  <select
                    value={profile.vehicle_type}
                    onChange={(e) => handleInputChange('vehicle_type', e.target.value)}
                    style={styles.input}
                  >
                    <option value="">Select vehicle type</option>
                    <option value="motorcycle">Motorcycle</option>
                    <option value="scooter">Scooter</option>
                    <option value="bicycle">Bicycle</option>
                    <option value="car">Car</option>
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Plate Number</label>
                  <input
                    type="text"
                    value={profile.vehicle_plate}
                    onChange={(e) => handleInputChange('vehicle_plate', e.target.value)}
                    style={styles.input}
                    placeholder="Enter plate number"
                  />
                </div>
              </div>
            </div>

            <div style={styles.formSection}>
              <h3 style={styles.sectionTitle}>Emergency Contact</h3>
              <div style={styles.formGrid}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Emergency Contact Name</label>
                  <input
                    type="text"
                    value={profile.emergency_contact}
                    onChange={(e) => handleInputChange('emergency_contact', e.target.value)}
                    style={styles.input}
                    placeholder="Enter emergency contact name"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Emergency Contact Phone</label>
                  <input
                    type="tel"
                    value={profile.emergency_phone}
                    onChange={(e) => handleInputChange('emergency_phone', e.target.value)}
                    style={styles.input}
                    placeholder="Enter emergency contact phone"
                  />
                </div>
              </div>
            </div>

            <div style={styles.formSection}>
              <h3 style={styles.sectionTitle}>Availability Status</h3>
              <div style={styles.availabilityToggle}>
                <label style={styles.toggleLabel}>
                  <input
                    type="checkbox"
                    checked={profile.is_available}
                    onChange={(e) => handleInputChange('is_available', e.target.checked)}
                    style={styles.checkbox}
                  />
                  <span style={styles.toggleText}>
                    I am currently available for deliveries
                  </span>
                </label>
                <p style={styles.toggleDescription}>
                  {profile.is_available
                    ? '✅ You will receive new delivery assignments'
                    : '⏸️ You will not receive new delivery assignments'}
                </p>
              </div>
            </div>

            <div style={styles.formSection}>
              <h3 style={styles.sectionTitle}>Password Management</h3>
              <div style={styles.passwordSection}>
                <button
                  type="button"
                  style={styles.togglePasswordBtn}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? '🔒 Hide Password Section' : '🔓 Change Password'}
                </button>

                {showPassword && (
                  <div style={styles.passwordForm}>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>New Password</label>
                      <input
                        type="password"
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                        style={styles.input}
                        placeholder="Enter new password (min 6 characters)"
                      />
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.label}>Confirm New Password</label>
                      <input
                        type="password"
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                        style={styles.input}
                        placeholder="Confirm new password"
                      />
                    </div>

                    <button
                      type="button"
                      style={styles.updatePasswordBtn}
                      onClick={handleUpdatePassword}
                      disabled={updatingPassword}
                    >
                      {updatingPassword ? '⏳ Updating...' : '🔑 Update Password'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div style={styles.actions}>
              <button
                style={styles.saveBtn}
                onClick={handleSaveProfile}
                disabled={saving}
              >
                {saving ? '⏳ Saving...' : '💾 Save Profile'}
              </button>
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
    maxWidth: '900px',
    margin: '0 auto',
  },
  title: {
    fontSize: '32px',
    fontFamily: "'Playfair Display', serif",
    color: '#ffc107',
    marginBottom: '32px',
    textAlign: 'center',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: '32px',
  },
  formSection: {
    backgroundColor: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '12px',
    padding: '24px',
  },
  sectionTitle: {
    fontSize: '20px',
    color: '#ffc107',
    marginBottom: '20px',
    fontFamily: "'Playfair Display', serif",
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '20px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    color: '#ccc',
    fontWeight: '500',
  },
  input: {
    padding: '12px',
    backgroundColor: '#0a0a0a',
    border: '1px solid #333',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '14px',
    fontFamily: "'Poppins', sans-serif",
  },
  inputDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  availabilityToggle: {
    padding: '16px',
  },
  toggleLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    cursor: 'pointer',
  },
  checkbox: {
    width: '20px',
    height: '20px',
    cursor: 'pointer',
  },
  toggleText: {
    fontSize: '16px',
    color: '#fff',
  },
  toggleDescription: {
    fontSize: '14px',
    color: '#ccc',
    marginTop: '12px',
    marginLeft: '32px',
  },
  actions: {
    display: 'flex',
    justifyContent: 'center',
    paddingTop: '16px',
  },
  saveBtn: {
    padding: '14px 48px',
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
  required: {
    color: '#ff6b6b',
    marginLeft: '4px',
  },
  fieldHelp: {
    fontSize: '12px',
    color: '#888',
    marginTop: '4px',
    display: 'block',
  },
  passwordSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  togglePasswordBtn: {
    padding: '10px 20px',
    backgroundColor: '#333',
    color: '#ffc107',
    border: '1px solid #ffc107',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
    transition: 'all 0.3s ease',
    alignSelf: 'flex-start',
  },
  passwordForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    padding: '16px',
    backgroundColor: '#0a0a0a',
    borderRadius: '8px',
    border: '1px solid #333',
  },
  updatePasswordBtn: {
    padding: '10px 24px',
    backgroundColor: '#ffc107',
    color: '#0a0a0a',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
    transition: 'all 0.3s ease',
    alignSelf: 'flex-start',
  },
};
