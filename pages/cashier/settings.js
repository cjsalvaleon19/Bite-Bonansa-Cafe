import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../../utils/supabaseClient';
import { useRoleGuard } from '../../utils/useRoleGuard';
import NotificationBell from '../../components/NotificationBell';
import { connectPrinter, disconnectPrinter, isPrinterConnected } from '../../utils/bluetoothPrinter';

export default function CashierSettings() {
  const router = useRouter();
  const { loading: authLoading } = useRoleGuard('cashier');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deliveryEnabled, setDeliveryEnabled] = useState(true);
  const [menuItems, setMenuItems] = useState([]);
  const [saveStatus, setSaveStatus] = useState(null);
  const [pairing, setPairing] = useState(false);
  const [printerConnected, setPrinterConnected] = useState(false);
  const [pairStatus, setPairStatus] = useState(null);

  useEffect(() => {
    if (!authLoading) {
      fetchUser();
      initializePage();
      setPrinterConnected(isPrinterConnected());
    }
  }, [authLoading]);

  const fetchUser = async () => {
    if (!supabase) return;
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUser(authUser);
    } catch (err) {
      console.error('[Settings] Failed to fetch user:', err?.message ?? err);
    }
  };

  const initializePage = async () => {
    if (!supabase) return;

    try {
      await fetchSettings();
      await fetchMenuItems();
    } catch (err) {
      console.error('[Settings] Failed to initialize:', err?.message ?? err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from('cashier_settings')
        .select('*')
        .eq('setting_key', 'delivery_enabled')
        .maybeSingle();

      if (error) throw error;

      setDeliveryEnabled(data?.setting_value === 'true');
    } catch (err) {
      console.error('[Settings] Failed to fetch settings:', err?.message ?? err);
    }
  };

  const fetchMenuItems = async () => {
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select('id, name, category, available, is_sold_out')
        .eq('available', true)
        .order('category')
        .order('name');

      if (error) throw error;

      setMenuItems(data || []);
    } catch (err) {
      console.error('[Settings] Failed to fetch menu items:', err?.message ?? err);
    }
  };

  const handleDeliveryToggle = async () => {
    if (!supabase) return;

    setSaving(true);
    try {
      const newValue = !deliveryEnabled;
      
      const { error } = await supabase
        .from('cashier_settings')
        .upsert({
          setting_key: 'delivery_enabled',
          setting_value: newValue.toString(),
          description: 'Whether delivery orders are currently accepted',
        }, {
          onConflict: 'setting_key'
        });

      if (error) throw error;

      setDeliveryEnabled(newValue);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error('[Settings] Failed to toggle delivery:', err?.message ?? err);
      setSaveStatus('error');
      alert('Failed to update delivery setting. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleSoldOut = async (itemId, currentStatus) => {
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('menu_items')
        .update({ is_sold_out: !currentStatus })
        .eq('id', itemId);

      if (error) throw error;

      // Update local state
      setMenuItems(menuItems.map(item => 
        item.id === itemId 
          ? { ...item, is_sold_out: !currentStatus }
          : item
      ));

      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (err) {
      console.error('[Settings] Failed to toggle sold out:', err?.message ?? err);
      alert('Failed to update item status. Please try again.');
    }
  };

  const handlePairPrinter = async () => {
    setPairing(true);
    setPairStatus(null);
    try {
      await connectPrinter();
      setPrinterConnected(true);
      setPairStatus('success');
      setTimeout(() => setPairStatus(null), 3000);
    } catch (err) {
      console.error('[Settings] Bluetooth pairing failed:', err?.message ?? err);
      setPairStatus('error');
    } finally {
      setPairing(false);
    }
  };

  const handleForgetPrinter = () => {
    disconnectPrinter();
    setPrinterConnected(false);
    setPairStatus(null);
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

  // Group menu items by category
  const itemsByCategory = menuItems.reduce((acc, item) => {
    const category = item.category || 'Uncategorized';
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {});

  return (
    <>
      <Head>
        <title>Settings - Cashier - Bite Bonansa Cafe</title>
        <meta name="description" content="Cashier settings and configuration" />
      </Head>
      <div style={styles.page}>
        <header style={styles.header}>
          <h1 style={styles.logo}>☕ Bite Bonansa Cafe</h1>
          <nav style={styles.nav}>
            <Link href="/cashier/dashboard" style={styles.navLink}>Dashboard</Link>
            <Link href="/cashier/pos" style={styles.navLink}>POS</Link>
            <Link href="/cashier/orders-queue" style={styles.navLink}>Order Queue</Link>
            <Link href="/cashier/eod-report" style={styles.navLink}>EOD Report</Link>
            <Link href="/cashier/settings" style={styles.navLinkActive}>Settings</Link>
            <Link href="/cashier/profile" style={styles.navLink}>Profile</Link>
          </nav>
          <div style={styles.headerActions}>
            {user && <NotificationBell user={user} />}
            <button style={styles.logoutBtn} onClick={async () => {
              if (supabase) await supabase.auth.signOut();
              router.replace('/login');
            }}>
              Logout
            </button>
          </div>
        </header>

        <main style={styles.main}>
          <h2 style={styles.title}>⚙️ Cashier Settings</h2>

          {saveStatus === 'success' && (
            <div style={styles.successMessage}>
              ✓ Settings saved successfully
            </div>
          )}

          {/* Delivery Feature Toggle */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.sectionTitle}>🚚 Delivery Feature</h3>
              <p style={styles.sectionDesc}>
                Enable or disable delivery orders when no delivery riders are available
              </p>
            </div>
            <div style={styles.toggleContainer}>
              <label style={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={deliveryEnabled}
                  onChange={handleDeliveryToggle}
                  disabled={saving}
                  style={styles.toggleInput}
                />
                <span style={styles.toggleSlider(deliveryEnabled)}></span>
                <span style={styles.toggleText}>
                  Delivery is {deliveryEnabled ? 'ENABLED' : 'DISABLED'}
                </span>
              </label>
            </div>
          </div>

          {/* Sold Out Items Management */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.sectionTitle}>🖨️ Bluetooth Pairing</h3>
              <p style={styles.sectionDesc}>
                Pair and reconnect your receipt printer from Settings
              </p>
            </div>
            <div style={styles.btPairingRow}>
              <span style={styles.btStatus(printerConnected)}>
                {printerConnected ? 'Connected' : 'Not Connected'}
              </span>
              <div style={styles.btActions}>
                <button
                  onClick={handlePairPrinter}
                  disabled={pairing}
                  style={styles.btPrimaryBtn}
                >
                  {pairing ? 'Pairing…' : printerConnected ? 'Re-Pair Printer' : 'Pair Printer'}
                </button>
                {printerConnected && (
                  <button
                    onClick={handleForgetPrinter}
                    style={styles.btSecondaryBtn}
                  >
                    Forget Connection
                  </button>
                )}
              </div>
            </div>
            {pairStatus === 'success' && (
              <p style={styles.btMessageSuccess}>
                ✓ Bluetooth printer paired successfully.
              </p>
            )}
            {pairStatus === 'error' && (
              <p style={styles.btMessageError}>
                Failed to pair printer. Make sure Bluetooth is on and printer is discoverable.
              </p>
            )}
          </div>

          {/* Sold Out Items Management */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.sectionTitle}>📋 Menu Item Availability</h3>
              <p style={styles.sectionDesc}>
                Mark items as sold out to prevent customers from ordering them
              </p>
            </div>
            
            <div style={styles.menuList}>
              {Object.entries(itemsByCategory).map(([category, items]) => (
                <div key={category} style={styles.categoryGroup}>
                  <h4 style={styles.categoryTitle}>{category}</h4>
                  {items.map(item => (
                    <div key={item.id} style={styles.menuItem}>
                      <span style={styles.menuItemName}>{item.name}</span>
                      <button
                        onClick={() => handleToggleSoldOut(item.id, item.is_sold_out)}
                        style={item.is_sold_out ? styles.soldOutBtnActive : styles.soldOutBtn}
                      >
                        {item.is_sold_out ? '❌ Sold Out' : '✓ Available'}
                      </button>
                    </div>
                  ))}
                </div>
              ))}
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
    gap: '12px',
    alignItems: 'center',
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
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '32px',
  },
  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    marginBottom: '32px',
    color: '#ffc107',
  },
  successMessage: {
    padding: '12px 20px',
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    border: '1px solid #4caf50',
    borderRadius: '8px',
    color: '#4caf50',
    marginBottom: '24px',
    fontSize: '14px',
  },
  section: {
    backgroundColor: '#2a2a2a',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '24px',
    border: '1px solid #3a3a3a',
  },
  sectionHeader: {
    marginBottom: '20px',
  },
  sectionTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#ffc107',
    marginBottom: '8px',
  },
  sectionDesc: {
    fontSize: '14px',
    color: '#999',
    margin: 0,
  },
  btPairingRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  btStatus: (isConnected) => ({
    padding: '6px 12px',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: '600',
    backgroundColor: isConnected ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255,255,255,0.1)',
    border: isConnected ? '1px solid #4caf50' : '1px solid #555',
    color: isConnected ? '#4caf50' : '#ccc',
  }),
  btActions: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  btPrimaryBtn: {
    padding: '8px 14px',
    backgroundColor: '#ffc107',
    color: '#000',
    border: 'none',
    borderRadius: '6px',
    fontWeight: '700',
    fontSize: '13px',
    cursor: 'pointer',
  },
  btSecondaryBtn: {
    padding: '8px 14px',
    backgroundColor: 'transparent',
    color: '#ccc',
    border: '1px solid #666',
    borderRadius: '6px',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer',
  },
  btMessageSuccess: {
    marginTop: '12px',
    color: '#4caf50',
    fontSize: '13px',
  },
  btMessageError: {
    marginTop: '12px',
    color: '#ff6b6b',
    fontSize: '13px',
  },
  toggleContainer: {
    marginTop: '16px',
  },
  toggleLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    cursor: 'pointer',
    position: 'relative',
  },
  toggleInput: {
    position: 'absolute',
    opacity: 0,
    width: 0,
    height: 0,
  },
  toggleSlider: (isEnabled) => ({
    width: '60px',
    height: '30px',
    backgroundColor: isEnabled ? '#4caf50' : '#666',
    borderRadius: '15px',
    position: 'relative',
    transition: 'all 0.3s',
    boxShadow: isEnabled 
      ? '0 0 10px rgba(76, 175, 80, 0.5)' 
      : 'none',
    '::before': {
      content: '""',
      position: 'absolute',
      width: '24px',
      height: '24px',
      backgroundColor: '#fff',
      borderRadius: '50%',
      top: '3px',
      left: isEnabled ? '33px' : '3px',
      transition: 'all 0.3s',
    },
  }),
  toggleText: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#fff',
  },
  menuList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  categoryGroup: {
    borderBottom: '1px solid #3a3a3a',
    paddingBottom: '16px',
  },
  categoryTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#ffc107',
    marginBottom: '12px',
    textTransform: 'uppercase',
  },
  menuItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    backgroundColor: '#1a1a1a',
    borderRadius: '8px',
    marginBottom: '8px',
  },
  menuItemName: {
    fontSize: '14px',
    color: '#fff',
  },
  soldOutBtn: {
    padding: '6px 16px',
    backgroundColor: '#4caf50',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600',
    transition: 'all 0.2s',
  },
  soldOutBtnActive: {
    padding: '6px 16px',
    backgroundColor: '#d32f2f',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600',
    transition: 'all 0.2s',
  },
};
