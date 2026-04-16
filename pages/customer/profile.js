import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../../utils/supabaseClient';

export default function CustomerProfile() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [profileData, setProfileData] = useState({
    full_name: '',
    phone: '',
    email: '',
    address: '',
    shipping_address: '',
    city: '',
    postal_code: '',
    payment_method: 'cash_on_delivery',
    customer_id: '',
    loyalty_balance: 0,
  });

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
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

        // Fetch user profile data
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (userError) {
          console.error('[CustomerProfile] Failed to fetch user data:', userError.message);
        } else {
          setProfileData({
            full_name: userData.full_name || '',
            phone: userData.phone || '',
            email: userData.email || session.user.email,
            address: userData.address || '',
            shipping_address: userData.shipping_address || '',
            city: userData.city || '',
            postal_code: userData.postal_code || '',
            payment_method: userData.payment_method || 'cash_on_delivery',
            customer_id: userData.customer_id || '',
            loyalty_balance: userData.loyalty_balance || 0,
          });
        }

        setLoading(false);
      } catch (err) {
        console.error('[CustomerProfile] Error:', err?.message ?? err);
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [router]);

  const handleChange = (e) => {
    setProfileData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      if (!supabase || !user) {
        setMessage({ type: 'error', text: 'Unable to save profile. Please try again.' });
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from('users')
        .update({
          full_name: profileData.full_name,
          phone: profileData.phone,
          address: profileData.address,
          shipping_address: profileData.shipping_address,
          city: profileData.city,
          postal_code: profileData.postal_code,
          payment_method: profileData.payment_method,
        })
        .eq('id', user.id);

      if (error) {
        setMessage({ type: 'error', text: error.message });
      } else {
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
      }
    } catch (err) {
      console.error('[CustomerProfile] Save error:', err);
      setMessage({ type: 'error', text: 'Failed to update profile. Please try again.' });
    }

    setSaving(false);
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
        <meta name="description" content="Manage your profile and shipping details" />
      </Head>
      <div style={styles.page}>
        <header style={styles.header}>
          <h1 style={styles.logo}>☕ Bite Bonansa Cafe</h1>
          <button
            onClick={() => router.push('/dashboard').catch(console.error)}
            style={styles.backBtn}
          >
            ← Back to Dashboard
          </button>
        </header>

        <main style={styles.main}>
          <h2 style={styles.title}>My Profile</h2>

          {message.text && (
            <div
              style={{
                ...styles.message,
                backgroundColor: message.type === 'error' ? '#3a1a1a' : '#1a3a1a',
                borderColor: message.type === 'error' ? '#ff6b6b' : '#4caf50',
                color: message.type === 'error' ? '#ff6b6b' : '#4caf50',
              }}
            >
              {message.type === 'error' ? '⚠️' : '✓'} {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Account Information</h3>
              <div style={styles.infoCard}>
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>Customer ID:</span>
                  <span style={styles.infoValue}>{profileData.customer_id || 'N/A'}</span>
                </div>
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>Loyalty Points:</span>
                  <span style={styles.infoValue}>{profileData.loyalty_balance || 0}</span>
                </div>
              </div>
            </div>

            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Personal Information</h3>
              <div style={styles.formGrid}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Full Name</label>
                  <input
                    type="text"
                    name="full_name"
                    value={profileData.full_name}
                    onChange={handleChange}
                    style={styles.input}
                    required
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Email</label>
                  <input
                    type="email"
                    name="email"
                    value={profileData.email}
                    disabled
                    style={{ ...styles.input, backgroundColor: '#2a2a2a', cursor: 'not-allowed' }}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Phone Number</label>
                  <input
                    type="tel"
                    name="phone"
                    value={profileData.phone}
                    onChange={handleChange}
                    style={styles.input}
                    required
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Billing Address</label>
                  <input
                    type="text"
                    name="address"
                    value={profileData.address}
                    onChange={handleChange}
                    style={styles.input}
                  />
                </div>
              </div>
            </div>

            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Shipping Details</h3>
              <div style={styles.formGrid}>
                <div style={{ ...styles.formGroup, gridColumn: '1 / -1' }}>
                  <label style={styles.label}>Shipping Address</label>
                  <input
                    type="text"
                    name="shipping_address"
                    value={profileData.shipping_address}
                    onChange={handleChange}
                    placeholder="Street address, apartment, suite, etc."
                    style={styles.input}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>City</label>
                  <input
                    type="text"
                    name="city"
                    value={profileData.city}
                    onChange={handleChange}
                    style={styles.input}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Postal Code</label>
                  <input
                    type="text"
                    name="postal_code"
                    value={profileData.postal_code}
                    onChange={handleChange}
                    style={styles.input}
                  />
                </div>
              </div>
            </div>

            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Payment Preferences</h3>
              <div style={styles.formGroup}>
                <label style={styles.label}>Preferred Payment Method</label>
                <select
                  name="payment_method"
                  value={profileData.payment_method}
                  onChange={handleChange}
                  style={styles.select}
                >
                  <option value="cash_on_delivery">Cash on Delivery</option>
                  <option value="gcash">GCash</option>
                  <option value="paymaya">PayMaya</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="credit_card">Credit/Debit Card</option>
                </select>
              </div>
            </div>

            <div style={styles.actions}>
              <button
                type="button"
                onClick={() => router.push('/dashboard').catch(console.error)}
                style={styles.cancelBtn}
              >
                Cancel
              </button>
              <button type="submit" disabled={saving} style={styles.saveBtn}>
                {saving ? '⏳ Saving...' : '💾 Save Changes'}
              </button>
            </div>
          </form>
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
    padding: '40px 32px',
    maxWidth: '900px',
    margin: '0 auto',
  },
  title: {
    fontSize: '28px',
    fontFamily: "'Playfair Display', serif",
    color: '#ffc107',
    marginBottom: '30px',
  },
  message: {
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '20px',
    fontSize: '14px',
    border: '1px solid',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '32px',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  sectionTitle: {
    fontSize: '18px',
    fontFamily: "'Playfair Display', serif",
    color: '#ffc107',
    marginBottom: '8px',
  },
  infoCard: {
    backgroundColor: '#1a1a1a',
    border: '1px solid #ffc107',
    borderRadius: '8px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    color: '#999',
    fontSize: '14px',
  },
  infoValue: {
    color: '#ffc107',
    fontSize: '16px',
    fontWeight: '600',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '16px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    color: '#ffc107',
    fontSize: '14px',
    fontWeight: '600',
  },
  input: {
    width: '100%',
    padding: '12px',
    border: '2px solid #ffc107',
    borderRadius: '6px',
    backgroundColor: '#1a1a1a',
    color: '#fff',
    fontSize: '14px',
    boxSizing: 'border-box',
    transition: 'all 0.3s',
    fontFamily: "'Poppins', sans-serif",
  },
  select: {
    width: '100%',
    padding: '12px',
    border: '2px solid #ffc107',
    borderRadius: '6px',
    backgroundColor: '#1a1a1a',
    color: '#fff',
    fontSize: '14px',
    boxSizing: 'border-box',
    transition: 'all 0.3s',
    fontFamily: "'Poppins', sans-serif",
    cursor: 'pointer',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '20px',
  },
  cancelBtn: {
    padding: '12px 24px',
    backgroundColor: 'transparent',
    color: '#ccc',
    border: '1px solid #555',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif',
  },
  saveBtn: {
    padding: '12px 24px',
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
