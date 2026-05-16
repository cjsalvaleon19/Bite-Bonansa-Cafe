import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../../utils/supabaseClient';
import NotificationBell from '../../components/NotificationBell';
import { getRegisteredSubvariantCount, getRegisteredSubvariantPreview } from '../../utils/variantPreview';

export default function CustomerMenu() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [menuItems, setMenuItems] = useState([]);
  const [variantMetaMap, setVariantMetaMap] = useState({});
  const [menuLoading, setMenuLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Derived: unique category list
  const categories = useMemo(() => {
    const cats = Array.from(new Set(menuItems.map((item) => item.category).filter(Boolean))).sort();
    return ['All', ...cats];
  }, [menuItems]);

  // Derived: filtered items based on search and category
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return menuItems.filter((item) => {
      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
      const matchesSearch = !q || item.name.toLowerCase().includes(q) || (item.category || '').toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [menuItems, searchQuery, selectedCategory]);

  const fetchMenuItems = async () => {
    if (!supabase) return;
    setMenuLoading(true);
    try {
      const [itemsResult, variantTypesResult] = await Promise.all([
        supabase
          .from('menu_items')
          .select('id, name, price, category, has_variants')
          .eq('available', true)
          .order('category'),
        supabase
          .from('menu_item_variant_types')
          .select(`
            menu_item_id,
            variant_type_name,
            display_order,
            options:menu_item_variant_options(
              option_name,
              available,
              display_order
            )
          `),
      ]);

      if (itemsResult.data) {
        setMenuItems(itemsResult.data);
      }

      if (variantTypesResult.data) {
        const nextVariantMetaMap = {};
        variantTypesResult.data.forEach((variantType) => {
          const menuItemId = variantType.menu_item_id;
          if (!menuItemId) return;
          if (!nextVariantMetaMap[menuItemId]) nextVariantMetaMap[menuItemId] = { variantTypes: [] };
          nextVariantMetaMap[menuItemId].variantTypes.push(variantType);
        });
        Object.keys(nextVariantMetaMap).forEach((menuItemId) => {
          const variantTypes = nextVariantMetaMap[menuItemId].variantTypes;
          nextVariantMetaMap[menuItemId] = {
            variantCount: getRegisteredSubvariantCount(variantTypes) > 0 ? variantTypes.length : 0,
            subvariantPreview: getRegisteredSubvariantPreview(variantTypes, 3),
            subvariantCount: getRegisteredSubvariantCount(variantTypes),
          };
        });
        setVariantMetaMap(nextVariantMetaMap);
      }
    } catch (err) {
      console.error('[CustomerMenu] Failed to fetch menu items:', err?.message ?? err);
    } finally {
      setMenuLoading(false);
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
          console.error('[CustomerMenu] Failed to fetch user role:', userError.message);
          setLoading(false);
          return;
        }

        const role = userData?.role || 'customer';
        setUserRole(role);

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
        fetchMenuItems();
      } catch (err) {
        console.error('[CustomerMenu] Session check failed:', err?.message ?? err);
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
      console.warn('[CustomerMenu] Sign out failed:', err?.message ?? err);
    }
    localStorage.removeItem('token');
    router.replace('/login').catch(console.error);
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
        <title>Menu Items - Bite Bonansa Cafe</title>
        <meta name="description" content="Browse our menu and place orders" />
      </Head>
      <div style={styles.page}>
        <header style={styles.header}>
          <h1 style={styles.logo}>☕ Bite Bonansa Cafe</h1>
          <span style={styles.welcome}>
            Welcome, {user?.email ?? 'Customer'}
          </span>
          <div style={styles.headerActions}>
            <NotificationBell user={user} />
            <button style={styles.logoutBtn} onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>

        <main style={styles.main}>
          <h2 style={styles.title}>Menu Items</h2>

          {/* Search bar */}
          <input
            type="text"
            placeholder="🔍 Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchInput}
          />

          {/* Category filter buttons */}
          <div style={styles.categoriesRow}>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                style={selectedCategory === cat ? styles.categoryBtnActive : styles.categoryBtn}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Items grid */}
          {menuLoading ? (
            <div style={styles.loadingState}>
              <p style={{ color: '#ffc107', fontFamily: "'Poppins', sans-serif", fontSize: '14px' }}>
                ⏳ Loading menu…
              </p>
            </div>
          ) : filteredItems.length > 0 ? (
              <div style={styles.itemsGrid}>
              {filteredItems.map((item) => {
                const variantMeta = variantMetaMap[item.id] || { variantCount: 0, subvariantPreview: [], subvariantCount: 0 };
                const variantCount = variantMeta.variantCount || 0;
                const subvariantPreview = variantMeta.subvariantPreview || [];
                const hiddenSubvariantCount = Math.max(0, (variantMeta.subvariantCount || 0) - subvariantPreview.length);
                return (
                  <div key={item.id} style={styles.itemCard}>
                    <h4 style={styles.itemName}>{item.name}</h4>
                    {subvariantPreview.length > 0 && (
                      <div style={styles.subvariantRow}>
                        {subvariantPreview.map((subvariant) => (
                          <span key={subvariant} style={styles.subvariantChip}>{subvariant}</span>
                        ))}
                        {hiddenSubvariantCount > 0 && (
                          <span style={styles.subvariantOverflowChip}>+{hiddenSubvariantCount} more</span>
                        )}
                      </div>
                    )}
                    <p style={styles.itemCategory}>{item.category}</p>
                    <p style={styles.itemPrice}>₱{item.price?.toFixed(2) ?? '0.00'}</p>
                    {variantCount > 0 && (
                      <span style={styles.variantBadge}>⚙ {variantCount} variant{variantCount !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={styles.emptyState}>
              <span style={styles.emptyIcon}>🍕</span>
              <p style={styles.emptyText}>No items found</p>
              <p style={styles.emptySubtext}>
                {searchQuery ? 'Try a different search term or category.' : 'Check back later for our offerings.'}
              </p>
            </div>
          )}
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
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
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
  main: {
    padding: '40px 32px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  // "Menu Items" heading: Playfair Display, 32px, #ffc107, left-aligned
  title: {
    fontSize: '32px',
    fontFamily: "'Playfair Display', serif",
    color: '#ffc107',
    marginBottom: '24px',
    textAlign: 'left',
  },
  // Search bar: Poppins, 14px, dark bg, muted placeholder
  searchInput: {
    width: '100%',
    padding: '14px 18px',
    backgroundColor: '#1a1a1a',
    color: '#ccc',
    border: '1px solid #333',
    borderRadius: '10px',
    fontSize: '14px',
    fontFamily: "'Poppins', sans-serif",
    marginBottom: '20px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  // Category filter row
  categoriesRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    marginBottom: '28px',
  },
  // Inactive category button: dark bg, yellow border + yellow text, Poppins 14px
  categoryBtn: {
    padding: '8px 18px',
    backgroundColor: 'transparent',
    color: '#ffc107',
    border: '1px solid #ffc107',
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: "'Poppins', sans-serif",
    cursor: 'pointer',
  },
  // Active category button: yellow bg, black text, Poppins 14px bold
  categoryBtnActive: {
    padding: '8px 18px',
    backgroundColor: '#ffc107',
    color: '#000',
    border: '1px solid #ffc107',
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: "'Poppins', sans-serif",
    cursor: 'pointer',
    fontWeight: '600',
  },
  // 3-column responsive grid
  itemsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: '20px',
  },
  // Item card: dark bg, yellow border, rounded
  itemCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: '12px',
    padding: '18px',
    border: '1px solid #ffc107',
    color: '#fff',
    textAlign: 'left',
  },
  // Item name: Poppins, 600, white, 16px
  itemName: {
    fontSize: '16px',
    fontWeight: '600',
    fontFamily: "'Poppins', sans-serif",
    color: '#fff',
    margin: '0 0 6px 0',
  },
  subvariantRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    margin: '0 0 8px 0',
  },
  subvariantChip: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 8px',
    backgroundColor: 'rgba(255, 193, 7, 0.12)',
    border: '1px solid rgba(255, 193, 7, 0.35)',
    borderRadius: '999px',
    color: '#ffc107',
    fontSize: '11px',
    fontFamily: "'Poppins', sans-serif",
    fontWeight: '600',
  },
  subvariantOverflowChip: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 8px',
    backgroundColor: 'rgba(136, 136, 136, 0.12)',
    border: '1px solid rgba(136, 136, 136, 0.35)',
    borderRadius: '999px',
    color: '#aaa',
    fontSize: '11px',
    fontFamily: "'Poppins', sans-serif",
    fontWeight: '600',
  },
  // Item category label: Poppins, 14px, muted gray #888
  itemCategory: {
    fontSize: '14px',
    fontFamily: "'Poppins', sans-serif",
    color: '#888',
    margin: '0 0 10px 0',
  },
  // Item price: Poppins, bold, #ffc107, 18px
  itemPrice: {
    fontSize: '18px',
    fontWeight: 'bold',
    fontFamily: "'Poppins', sans-serif",
    color: '#ffc107',
    margin: '0 0 12px 0',
  },
  // Variants badge: small, dark bg, yellow border + text, 12px
  variantBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '4px 10px',
    backgroundColor: 'transparent',
    border: '1px solid #ffc107',
    borderRadius: '6px',
    color: '#ffc107',
    fontSize: '12px',
    fontFamily: "'Poppins', sans-serif",
  },
  loadingState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
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
};
