import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../../utils/supabaseClient';

export default function MyProfile() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postal_code: '',
  });
  const [newPassword, setNewPassword] = useState('');

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
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        if (!mounted) return;

        if (userError) {
          console.error('[MyProfile] Failed to fetch user data:', userError.message);
          setLoading(false);
          return;
        }

        const role = userDataResult?.role || 'customer';
        setUserRole(role);
        setUserData(userDataResult);

        // Initialize form data
        setFormData({
          full_name: userDataResult?.full_name || '',
          email: userDataResult?.email || '',
          phone: userDataResult?.phone || '',
          address: userDataResult?.address || '',
          city: userDataResult?.city || '',
          postal_code: userDataResult?.postal_code || '',
        });

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
        console.error('[MyProfile] Session check failed:', err?.message ?? err);
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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      // Update user data in database
      const { error: updateError } = await supabase
        .from('users')
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
          address: formData.address,
          city: formData.city,
          postal_code: formData.postal_code,
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Failed to update profile:', updateError);
        alert('Failed to update profile. Please try again.');
        setSaving(false);
        return;
      }

      // Update password if provided
      if (newPassword.trim()) {
        const { error: passwordError } = await supabase.auth.updateUser({
          password: newPassword,
        });

        if (passwordError) {
          console.error('Failed to update password:', passwordError);
          alert('Profile updated but password change failed. Please try again.');
          setSaving(false);
          return;
        }
        setNewPassword('');
      }

      // Refresh user data
      const { data: refreshedData } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (refreshedData) {
        setUserData(refreshedData);
      }

      setEditing(false);
      alert('Profile updated successfully!');
    } catch (err) {
      console.error('Error updating profile:', err);
      alert('An error occurred. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      full_name: userData?.full_name || '',
      email: userData?.email || '',
      phone: userData?.phone || '',
      address: userData?.address || '',
      city: userData?.city || '',
      postal_code: userData?.postal_code || '',
    });
    setNewPassword('');
    setEditing(false);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
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
        <meta name="description" content="Manage your profile" />
      </Head>
      <div style={styles.page}>
        <header style={styles.header}>
          <button style={styles.backBtn} onClick={() => router.push('/customer/dashboard')}>
            ← Back
          </button>
          <h1 style={styles.logo}>👤 My Profile</h1>
          <div style={{ width: '80px' }}></div>
        </header>

        <main style={styles.main}>
          <div style={styles.profileContainer}>
            {/* Profile Header */}
            <div style={styles.profileHeader}>
              <div style={styles.avatar}>
                {(formData.full_name || formData.email)?.[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <h2 style={styles.profileName}>
                  {formData.full_name || formData.email?.split('@')[0] || 'Customer'}
                </h2>
                <p style={styles.profileEmail}>{formData.email}</p>
              </div>
            </div>

            {/* Account Information */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Account Information</h3>
              <div style={styles.infoGrid}>
                <InfoItem 
                  label="Customer ID" 
                  value={userData?.customer_id || 'N/A'}
                  highlight={true}
                />
                <InfoItem 
                  label="Date of Membership" 
                  value={formatDate(userData?.created_at)}
                />
                <InfoItem 
                  label="Account Status" 
                  value="Active"
                  statusColor="#4caf50"
                />
                <InfoItem 
                  label="Loyalty Points" 
                  value={userData?.loyalty_balance || 0}
                />
              </div>
            </div>

            {/* Personal Information */}
            <div style={styles.section}>
              <div style={styles.sectionHeader}>
                <h3 style={styles.sectionTitle}>Personal Information</h3>
                {!editing && (
                  <button style={styles.editBtn} onClick={() => setEditing(true)}>
                    Edit
                  </button>
                )}
              </div>

              <div style={styles.formGrid}>
                <FormField
                  label="Full Name"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleInputChange}
                  disabled={!editing}
                />
                <FormField
                  label="Email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled={true}
                  hint="Email cannot be changed"
                />
                <FormField
                  label="Phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  disabled={!editing}
                  placeholder="+63 XXX XXX XXXX"
                />
                <FormField
                  label="Address"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  disabled={!editing}
                  fullWidth={true}
                />
                <FormField
                  label="City"
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  disabled={!editing}
                />
                <FormField
                  label="Postal Code"
                  name="postal_code"
                  value={formData.postal_code}
                  onChange={handleInputChange}
                  disabled={!editing}
                />
              </div>
            </div>

            {/* Password Section */}
            {editing && (
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>Change Password (Optional)</h3>
                <div style={styles.passwordField}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    style={styles.input}
                  />
                  <button
                    type="button"
                    style={styles.togglePasswordBtn}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
                <p style={styles.hint}>
                  Leave blank to keep current password
                </p>
              </div>
            )}

            {/* Action Buttons */}
            {editing && (
              <div style={styles.actions}>
                <button 
                  style={styles.cancelBtn} 
                  onClick={handleCancel}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button 
                  style={{
                    ...styles.saveBtn,
                    opacity: saving ? 0.6 : 1,
                    cursor: saving ? 'not-allowed' : 'pointer',
                  }}
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}

function InfoItem({ label, value, highlight, statusColor }) {
  return (
    <div style={styles.infoItem}>
      <span style={styles.infoLabel}>{label}</span>
      <span 
        style={{
          ...styles.infoValue,
          color: statusColor || (highlight ? '#ffc107' : '#fff'),
          fontWeight: highlight ? '700' : '600',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function FormField({ label, name, value, onChange, disabled, placeholder, hint, fullWidth }) {
  return (
    <div style={{ ...styles.formField, gridColumn: fullWidth ? '1 / -1' : 'auto' }}>
      <label style={styles.label}>{label}</label>
      <input
        type="text"
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        style={{
          ...styles.input,
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? 'not-allowed' : 'text',
        }}
      />
      {hint && <span style={styles.hint}>{hint}</span>}
    </div>
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
    maxWidth: '900px',
    margin: '0 auto',
  },
  profileContainer: {
    backgroundColor: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '12px',
    padding: '32px',
  },
  profileHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    marginBottom: '32px',
    paddingBottom: '32px',
    borderBottom: '1px solid #2a2a2a',
  },
  avatar: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    backgroundColor: '#ffc107',
    color: '#0a0a0a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '32px',
    fontWeight: '700',
  },
  profileName: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#fff',
    margin: 0,
    marginBottom: '4px',
  },
  profileEmail: {
    fontSize: '14px',
    color: '#999',
    margin: 0,
  },
  section: {
    marginBottom: '32px',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#ffc107',
    margin: 0,
    marginBottom: '16px',
  },
  editBtn: {
    padding: '6px 16px',
    backgroundColor: 'transparent',
    color: '#ffc107',
    border: '1px solid #ffc107',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '16px',
  },
  infoItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  infoLabel: {
    fontSize: '12px',
    color: '#666',
  },
  infoValue: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#fff',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '16px',
  },
  formField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#ccc',
  },
  input: {
    backgroundColor: '#0a0a0a',
    border: '1px solid #2a2a2a',
    borderRadius: '6px',
    padding: '10px 12px',
    fontSize: '14px',
    color: '#fff',
    fontFamily: "'Poppins', sans-serif",
    outline: 'none',
  },
  hint: {
    fontSize: '11px',
    color: '#666',
  },
  passwordField: {
    position: 'relative',
    maxWidth: '400px',
  },
  togglePasswordBtn: {
    position: 'absolute',
    right: '10px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '18px',
    padding: '4px',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    paddingTop: '24px',
    borderTop: '1px solid #2a2a2a',
  },
  cancelBtn: {
    padding: '10px 20px',
    backgroundColor: 'transparent',
    color: '#ccc',
    border: '1px solid #555',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
  saveBtn: {
    padding: '10px 20px',
    backgroundColor: '#ffc107',
    color: '#0a0a0a',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
};
