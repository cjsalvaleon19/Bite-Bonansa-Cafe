import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../../utils/supabaseClient';
import { useRoleGuard } from '../../utils/useRoleGuard';
import NotificationBell from '../../components/NotificationBell';

// Configuration constant for fallback rider availability
// When riders are found in users table but not in riders table (incomplete profile),
// this determines their default availability status for emergency assignments.
// Set to true to allow assignment with warnings, false to require profile completion.
const DEFAULT_FALLBACK_AVAILABILITY = true;

export default function OrdersQueue() {
  const router = useRouter();
  const { loading: authLoading } = useRoleGuard('cashier');
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState('all'); // 'all', 'dine-in', 'take-out', 'pick-up', 'delivery'
  const [riders, setRiders] = useState([]);
  const [selectedOrderForRider, setSelectedOrderForRider] = useState(null);
  const [showRiderModal, setShowRiderModal] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      fetchUser();
      fetchOrders();
      fetchRiders();
      
      // Set up real-time subscription for orders
      const subscription = supabase
        ?.channel('orders_queue_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
          fetchOrders();
        })
        .subscribe();

      return () => {
        subscription?.unsubscribe();
      };
    }
  }, [authLoading]);

  const fetchUser = async () => {
    if (!supabase) return;
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUser(authUser);
    } catch (err) {
      console.error('[OrdersQueue] Failed to fetch user:', err?.message ?? err);
    }
  };

  const fetchOrders = async () => {
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            menu_item_id,
            name,
            price,
            quantity,
            subtotal,
            notes,
            served
          )
        `)
        .in('status', ['order_in_queue', 'order_in_process', 'out_for_delivery'])
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Filter to show only:
      // 1. All orders in 'order_in_queue' or 'order_in_process'
      // 2. Pick-up orders in 'out_for_delivery' status (waiting to be completed)
      // 3. Exclude orders where all items are already served (dine-in/take-out completed orders)
      const filteredOrders = (data || []).filter(order => {
        // Check if all items in the order are served
        const orderItems = order.order_items || order.items || [];
        const allItemsServed = orderItems.length > 0 && orderItems.every(item => item.served);
        
        // Exclude orders where all items are served (they should be completed)
        if (allItemsServed && (order.order_mode === 'dine-in' || order.order_mode === 'take-out')) {
          return false;
        }
        
        if (order.status === 'order_in_queue' || order.status === 'order_in_process') {
          return true;
        }
        // Only show pick-up orders in out_for_delivery status
        return order.status === 'out_for_delivery' && order.order_mode === 'pick-up';
      });

      setOrders(filteredOrders);
    } catch (err) {
      console.error('[OrdersQueue] Failed to fetch orders:', err?.message ?? err);
    } finally {
      setLoading(false);
    }
  };



  const handleItemServed = async (orderId, itemId) => {
    if (!supabase) return;

    try {
      // Mark the item as served
      const { error } = await supabase
        .from('order_items')
        .update({ served: true })
        .eq('id', itemId);

      if (error) throw error;

      // Check if all items in the order are served
      const { data: allItems, error: fetchError } = await supabase
        .from('order_items')
        .select('served')
        .eq('order_id', orderId);

      if (fetchError) throw fetchError;

      // If all items are served, mark the order as completed
      if (allItems && allItems.every(item => item.served)) {
        const { error: updateOrderError } = await supabase
          .from('orders')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', orderId);

        if (updateOrderError) throw updateOrderError;
      }

      fetchOrders();
    } catch (err) {
      console.error('[OrdersQueue] Failed to mark item as served:', err?.message ?? err);
      alert('Failed to update item status. Please try again.');
    }
  };

  // Helper function to fetch riders from users table
  // Used as fallback when riders table has no records or on error
  const fetchRidersFromUsersTable = async () => {
    if (!supabase) return [];
    
    try {
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, full_name, email, role')
        .eq('role', 'rider')
        .order('full_name');

      if (usersError) throw usersError;
      
      console.log('[OrdersQueue] Fetched riders from users table:', {
        count: usersData?.length || 0,
        riders: usersData?.map(u => ({ id: u.id, email: u.email, role: u.role }))
      });
      
      // Transform users data to match the expected structure with is_available field
      // 
      // IMPORTANT DESIGN DECISION:
      // We use DEFAULT_FALLBACK_AVAILABILITY constant for the is_available field
      // This is a TEMPORARY fallback for edge cases where:
      // 1. Rider just created account and hasn't completed profile yet
      // 2. Emergency assignment needed before profile completion
      // 3. Rider record was deleted from riders table but user exists
      //
      // TRADE-OFFS:
      // - PRO: Allows assignment in edge cases, unblocks cashier workflow
      // - CON: Rider might not actually be available (mitigated by UI warnings)
      //
      // MITIGATION:
      // - Prominent orange warning banner shown to cashier
      // - Warning badge (⚠️) shown next to rider name
      // - Tooltip instructs rider to complete profile
      // - Cashier must consciously verify rider is ready
      //
      // CONFIGURATION:
      // - Change DEFAULT_FALLBACK_AVAILABILITY constant at top of file to modify behavior
      // - Set to false to require profile completion before assignment
      //
      // LONG-TERM SOLUTION:
      // Require riders to complete profile at /rider/profile before allowing assignment.
      // This would involve checking riders table has record before showing in list.
      // For now, this fallback with warnings provides flexibility while alerting cashier.
      return (usersData || []).map(user => ({
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        is_available: DEFAULT_FALLBACK_AVAILABILITY, // Use constant - see documentation above
        incomplete_profile: true // Triggers UI warnings
      }));
    } catch (err) {
      console.error('[OrdersQueue] Failed to fetch riders from users table:', err?.message ?? err);
      return [];
    }
  };

  const fetchRiders = async () => {
    if (!supabase) return;

    try {
      // Fetch available riders from riders table joined with users
      // We need user_id (not riders.id) for the orders.rider_id foreign key
      const { data: ridersData, error } = await supabase
        .from('riders')
        .select(`
          user_id,
          is_available,
          users!riders_user_id_fkey (
            id,
            full_name,
            email
          )
        `)
        .eq('is_available', true);

      if (error) throw error;

      // Log the raw data for debugging
      console.log('[OrdersQueue] Fetched riders from riders table:', {
        count: ridersData?.length || 0,
        sample: ridersData?.slice(0, 2).map(r => ({ 
          user_id: r.user_id, 
          has_users: !!r.users,
          user_email: r.users?.email 
        }))
      });

      // Transform the data to have a flat structure with user_id as the ID to use
      // Filter out any riders with null user_id to prevent FK constraint violations
      const transformedRiders = (ridersData || [])
        .filter(rider => {
          if (rider.user_id == null) {
            console.warn('[OrdersQueue] Skipping rider with null user_id:', rider);
            return false;
          }
          if (rider.users == null) {
            console.warn('[OrdersQueue] Skipping rider with null users data:', { user_id: rider.user_id });
            return false;
          }
          return true;
        })
        .map(rider => ({
          id: rider.user_id, // Use user_id for assignment (matches orders.rider_id FK)
          full_name: rider.users.full_name,
          email: rider.users.email,
          is_available: rider.is_available
        }));

      // If no riders found in riders table, fallback to users table
      // This handles cases where a user has 'rider' role but hasn't completed their rider profile
      if (transformedRiders.length === 0) {
        console.warn('[OrdersQueue] No riders found in riders table, checking users table');
        const fallbackRiders = await fetchRidersFromUsersTable();
        setRiders(fallbackRiders);
        return;
      }

      // Sort by full_name
      transformedRiders.sort((a, b) => {
        const nameA = (a.full_name || '').toLowerCase();
        const nameB = (b.full_name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });

      console.log('[OrdersQueue] Final riders list:', {
        count: transformedRiders.length,
        riders: transformedRiders.map(r => ({ id: r.id, email: r.email }))
      });

      setRiders(transformedRiders);
    } catch (err) {
      console.error('[OrdersQueue] Failed to fetch riders:', err?.message ?? err);
      
      // Fallback: try fetching from users table directly (for backward compatibility)
      const fallbackRiders = await fetchRidersFromUsersTable();
      setRiders(fallbackRiders);
    }
  };

  const handleOutForDelivery = (order) => {
    setSelectedOrderForRider(order);
    setShowRiderModal(true);
  };

  const handleReadyForPickup = async (order) => {
    if (!supabase) return;
    if (!confirm('Mark this order as ready for pick-up?')) return;

    try {
      // Update order status to out_for_delivery (which will be displayed as "Ready for Pick-up" for pick-up orders)
      // Note: Database trigger will automatically create notification for customer
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'out_for_delivery',
          out_for_delivery_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (error) throw error;

      alert('Order marked as ready for pick-up!');
      fetchOrders();
    } catch (err) {
      console.error('[OrdersQueue] Failed to mark ready for pickup:', err?.message ?? err);
      alert('Failed to update order status. Please try again.');
    }
  };

  const handleCompletePickup = async (order) => {
    if (!supabase) return;
    if (!confirm('Mark this pick-up order as complete?')) return;

    try {
      // Update order status to order_delivered (completed)
      // Note: Database trigger will automatically create notification for customer
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'order_delivered',
          completed_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (error) throw error;

      alert('Order marked as complete!');
      fetchOrders();
    } catch (err) {
      console.error('[OrdersQueue] Failed to complete pickup order:', err?.message ?? err);
      alert('Failed to update order status. Please try again.');
    }
  };

  const handleAssignRider = async (riderId) => {
    if (!supabase || !selectedOrderForRider) return;

    try {
      // Validate riderId is not null/undefined before proceeding
      if (!riderId) {
        console.error('[OrdersQueue] Invalid rider ID:', { riderId });
        alert('Invalid rider selected. Please refresh the page and try again.');
        return;
      }

      console.log('[OrdersQueue] Attempting to assign rider:', {
        riderId,
        riderIdType: typeof riderId,
        orderId: selectedOrderForRider.id
      });

      // Validate that the rider exists in users table before assigning
      const { data: riderExists, error: checkError } = await supabase
        .from('users')
        .select('id, email, role')
        .eq('id', riderId)
        .single();

      console.log('[OrdersQueue] Rider validation result:', {
        riderExists,
        checkError: checkError?.message
      });

      if (checkError || !riderExists) {
        throw new Error('Selected rider does not exist in the system. Please refresh and try again.');
      }
      
      // Additional check: Ensure the rider has the 'rider' role
      if (riderExists.role !== 'rider') {
        throw new Error(`User ${riderExists.email} is not a rider (role: ${riderExists.role}). Cannot assign to order.`);
      }

      // Update order with rider and status
      // Note: Database trigger will automatically create notification for customer
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'out_for_delivery',
          rider_id: riderId,
          out_for_delivery_at: new Date().toISOString()
        })
        .eq('id', selectedOrderForRider.id);

      if (error) {
        console.error('[OrdersQueue] Order update error details:', {
          error,
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint
        });
        throw error;
      }

      // Send notification to rider (not handled by trigger)
      await supabase.from('notifications').insert({
        user_id: riderId,
        title: 'New Delivery Assignment',
        message: `You have been assigned to deliver order #${selectedOrderForRider.order_number}`,
        type: 'delivery_assignment',
        related_id: selectedOrderForRider.id,
        related_type: 'order'
      });

      alert('Rider assigned successfully!');
      setShowRiderModal(false);
      setSelectedOrderForRider(null);
      fetchOrders();
    } catch (err) {
      console.error('[OrdersQueue] Failed to assign rider:', err?.message ?? err);
      alert(`Failed to assign rider: ${err?.message || 'Please try again.'}`);
    }
  };

  const filteredOrders = filterMode === 'all' 
    ? orders 
    : orders.filter(order => order.order_mode === filterMode);

  // Memoize check for riders with incomplete profiles to avoid unnecessary re-computation
  const hasIncompleteProfiles = useMemo(() => 
    riders.some(r => r.incomplete_profile), 
    [riders]
  );

  if (authLoading || loading) {
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
        <title>Order Queue - Bite Bonansa Cafe</title>
        <meta name="description" content="Manage pending orders" />
      </Head>
      <div style={styles.page}>
        <header style={styles.header}>
          <h1 style={styles.logo}>☕ Bite Bonansa Cafe</h1>
          <nav style={styles.nav}>
            <Link href="/cashier/dashboard" style={styles.navLink}>Dashboard</Link>
            <Link href="/cashier/pos" style={styles.navLink}>POS</Link>
            <Link href="/cashier/orders-queue" style={styles.navLinkActive}>Order Queue</Link>
            <Link href="/cashier/eod-report" style={styles.navLink}>EOD Report</Link>
            <Link href="/cashier/settings" style={styles.navLink}>Settings</Link>
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
          <h2 style={styles.title}>📋 Order Queue</h2>

          {/* Filter Tabs */}
          <div style={styles.filterTabs}>
            <button
              style={filterMode === 'all' ? styles.filterTabActive : styles.filterTab}
              onClick={() => setFilterMode('all')}
            >
              All Orders ({orders.length})
            </button>
            <button
              style={filterMode === 'dine-in' ? styles.filterTabActive : styles.filterTab}
              onClick={() => setFilterMode('dine-in')}
            >
              🍽️ Dine-in ({orders.filter(o => o.order_mode === 'dine-in').length})
            </button>
            <button
              style={filterMode === 'take-out' ? styles.filterTabActive : styles.filterTab}
              onClick={() => setFilterMode('take-out')}
            >
              🥡 Take-out ({orders.filter(o => o.order_mode === 'take-out').length})
            </button>
            <button
              style={filterMode === 'pick-up' ? styles.filterTabActive : styles.filterTab}
              onClick={() => setFilterMode('pick-up')}
            >
              📦 Pick-up ({orders.filter(o => o.order_mode === 'pick-up').length})
            </button>
            <button
              style={filterMode === 'delivery' ? styles.filterTabActive : styles.filterTab}
              onClick={() => setFilterMode('delivery')}
            >
              🚚 Delivery ({orders.filter(o => o.order_mode === 'delivery').length})
            </button>
          </div>

          {/* Orders List */}
          {filteredOrders.length === 0 ? (
            <div style={styles.emptyState}>
              <p style={styles.emptyIcon}>📭</p>
              <p style={styles.emptyText}>No pending orders</p>
            </div>
          ) : (
            <div style={styles.ordersList}>
              {filteredOrders.map((order) => (
                <div key={order.id} style={styles.orderCard}>
                  <div style={styles.orderHeader}>
                    <div>
                      <h3 style={styles.orderNumber}>
                        Order #{order.order_number || order.id.slice(0, 8)}
                      </h3>
                      <p style={styles.orderTime}>
                        {new Date(order.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div style={styles.orderBadge}>
                      {order.order_mode || 'N/A'}
                    </div>
                  </div>

                  <div style={styles.itemsList}>
                    {/* Display order_items if available, otherwise fall back to items array */}
                    {(order.order_items && order.order_items.length > 0 ? order.order_items : order.items || [])
                      .filter(item => !item.served) // Only show unserved items
                      .map((item, index) => (
                      <div key={item.id || index} style={styles.itemRow}>
                        <div style={styles.itemInfo}>
                          <span style={styles.itemName}>{item.name}</span>
                          <span style={styles.itemQty}>x{item.quantity}</span>
                        </div>
                        <div style={styles.itemActions}>
                          <span style={styles.itemPrice}>
                            ₱{((item.price || 0) * (item.quantity || 0)).toFixed(2)}
                          </span>
                          {/* Show Served button for dine-in and take-out orders */}
                          {(order.order_mode === 'dine-in' || order.order_mode === 'take-out') && item.id && (
                            <button
                              style={styles.itemServedBtn}
                              onClick={() => handleItemServed(order.id, item.id)}
                            >
                              ✓ Served
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {/* Show message if all items are served */}
                    {(order.order_items && order.order_items.length > 0 ? order.order_items : order.items || [])
                      .every(item => item.served) && (
                      <div style={styles.allServedMessage}>
                        ✓ All items served
                      </div>
                    )}
                  </div>

                  <div style={styles.orderFooter}>
                    <div style={styles.orderTotal}>
                      Total: ₱{parseFloat(order.total_amount || 0).toFixed(2)}
                    </div>
                    <div style={styles.orderActions}>
                      {/* Show Out for Delivery button only for delivery orders in process status */}
                      {order.order_mode === 'delivery' && order.status === 'order_in_process' && (
                        <button
                          style={styles.deliveryBtn}
                          onClick={() => handleOutForDelivery(order)}
                        >
                          🚚 Out for Delivery
                        </button>
                      )}
                      {/* Show Ready for Pick-Up button only for pick-up orders in process status */}
                      {order.order_mode === 'pick-up' && order.status === 'order_in_process' && (
                        <button
                          style={styles.pickupReadyBtn}
                          onClick={() => handleReadyForPickup(order)}
                        >
                          ✅ Ready for Pick-Up
                        </button>
                      )}
                      {/* Show Order Complete button only for pick-up orders that are ready (out_for_delivery status) */}
                      {order.order_mode === 'pick-up' && order.status === 'out_for_delivery' && (
                        <button
                          style={styles.completeBtn}
                          onClick={() => handleCompletePickup(order)}
                        >
                          ✓ Order Complete
                        </button>
                      )}
                      {/* Removed "Mark as Served" button - individual item serving is now handled per-item */}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Rider Selection Modal */}
          {showRiderModal && selectedOrderForRider && (
            <div style={styles.modal} onClick={() => setShowRiderModal(false)}>
              <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <h3 style={styles.modalTitle}>Select Delivery Rider</h3>
                <p style={styles.modalSubtext}>
                  Order #{selectedOrderForRider.order_number || selectedOrderForRider.id.slice(0, 8)}
                </p>
                
                {riders.length === 0 ? (
                  <p style={styles.noRidersText}>No riders available</p>
                ) : (
                  <>
                    {hasIncompleteProfiles && (
                      <div style={styles.warningBanner}>
                        <span>⚠️</span>
                        <span style={{ marginLeft: '8px' }}>
                          Some riders haven't completed their profile. Verify availability before assigning.
                        </span>
                      </div>
                    )}
                    <div style={styles.ridersList}>
                      {riders.map((rider) => (
                        <button
                          key={rider.id}
                          style={styles.riderItem}
                          onClick={() => handleAssignRider(rider.id)}
                        >
                          <span style={styles.riderIcon}>🏍️</span>
                          <div style={styles.riderInfo}>
                            <div style={styles.riderName}>
                              {rider.full_name || 'Unnamed Rider'}
                              {rider.incomplete_profile && (
                                <span style={styles.incompleteProfileBadge} title="Profile incomplete - rider should complete at /rider/profile">
                                  ⚠️
                                </span>
                              )}
                            </div>
                            <div style={styles.riderEmail}>{rider.email}</div>
                          </div>
                          <span style={styles.selectArrow}>→</span>
                        </button>
                    ))}
                    </div>
                  </>
                )}
                
                <button 
                  style={styles.modalCloseBtn} 
                  onClick={() => {
                    setShowRiderModal(false);
                    setSelectedOrderForRider(null);
                  }}
                >
                  Cancel
                </button>
              </div>
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
    maxWidth: '1200px',
    margin: '0 auto',
  },
  title: {
    fontSize: '32px',
    fontFamily: "'Playfair Display', serif",
    color: '#ffc107',
    marginBottom: '32px',
    textAlign: 'center',
  },
  filterTabs: {
    display: 'flex',
    gap: '12px',
    marginBottom: '32px',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  filterTab: {
    padding: '10px 20px',
    backgroundColor: '#1a1a1a',
    color: '#ccc',
    border: '1px solid #444',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  filterTabActive: {
    padding: '10px 20px',
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    color: '#ffc107',
    border: '1px solid #ffc107',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer',
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
  },
  emptyIcon: {
    fontSize: '64px',
    marginBottom: '16px',
  },
  emptyText: {
    fontSize: '18px',
    color: '#888',
  },
  ordersList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
    gap: '20px',
  },
  orderCard: {
    backgroundColor: '#1a1a1a',
    border: '1px solid #ffc107',
    borderRadius: '12px',
    padding: '20px',
  },
  orderHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: '1px solid #2a2a2a',
  },
  orderNumber: {
    fontSize: '16px',
    color: '#ffc107',
    margin: '0 0 4px 0',
  },
  orderTime: {
    fontSize: '12px',
    color: '#888',
    margin: 0,
  },
  orderBadge: {
    padding: '4px 12px',
    backgroundColor: '#2a2a2a',
    color: '#ffc107',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '600',
  },
  itemsList: {
    marginBottom: '16px',
  },
  itemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid #2a2a2a',
  },
  itemInfo: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    flex: 1,
  },
  itemName: {
    fontSize: '14px',
    color: '#fff',
  },
  itemQty: {
    fontSize: '12px',
    color: '#888',
  },
  itemActions: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  itemPrice: {
    fontSize: '14px',
    color: '#ffc107',
    fontWeight: '600',
  },
  itemServedBtn: {
    padding: '4px 12px',
    backgroundColor: '#4caf50',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
  removeItemBtn: {
    padding: '4px 8px',
    backgroundColor: 'transparent',
    color: '#f44336',
    border: '1px solid #f44336',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  allServedMessage: {
    textAlign: 'center',
    padding: '12px',
    color: '#4caf50',
    fontSize: '14px',
    fontWeight: '600',
  },
  orderFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '16px',
    paddingTop: '12px',
    borderTop: '1px solid #2a2a2a',
  },
  orderTotal: {
    fontSize: '16px',
    color: '#ffc107',
    fontWeight: '700',
  },
  orderActions: {
    display: 'flex',
    gap: '8px',
  },
  servedBtn: {
    padding: '8px 16px',
    backgroundColor: '#4caf50',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
  completeBtn: {
    padding: '8px 16px',
    backgroundColor: '#4caf50',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
  deliveryBtn: {
    padding: '8px 16px',
    backgroundColor: '#2196f3',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
  pickupReadyBtn: {
    padding: '8px 16px',
    backgroundColor: '#ff9800',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
  modal: {
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
  modalContent: {
    backgroundColor: '#1a1a1a',
    border: '2px solid #ffc107',
    borderRadius: '12px',
    padding: '32px',
    maxWidth: '500px',
    width: '90%',
    maxHeight: '80vh',
    overflow: 'auto',
  },
  modalTitle: {
    fontSize: '20px',
    color: '#ffc107',
    marginBottom: '8px',
    textAlign: 'center',
  },
  modalSubtext: {
    fontSize: '14px',
    color: '#888',
    marginBottom: '24px',
    textAlign: 'center',
  },
  noRidersText: {
    fontSize: '14px',
    color: '#888',
    textAlign: 'center',
    padding: '20px',
  },
  warningBanner: {
    backgroundColor: '#ff9800',
    color: '#000',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '16px',
    fontSize: '13px',
    fontWeight: '500',
    display: 'flex',
    alignItems: 'center',
  },
  ridersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '24px',
  },
  riderItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    backgroundColor: '#2a2a2a',
    border: '1px solid #444',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: "'Poppins', sans-serif",
    width: '100%',
    textAlign: 'left',
  },
  riderIcon: {
    fontSize: '24px',
  },
  riderInfo: {
    flex: 1,
  },
  riderName: {
    fontSize: '15px',
    color: '#fff',
    fontWeight: '600',
    marginBottom: '4px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  incompleteProfileBadge: {
    fontSize: '12px',
    padding: '2px 6px',
    backgroundColor: '#ff9800',
    color: '#000',
    borderRadius: '4px',
    fontWeight: '600',
    cursor: 'help',
  },
  riderEmail: {
    fontSize: '12px',
    color: '#888',
  },
  selectArrow: {
    fontSize: '18px',
    color: '#ffc107',
  },
  modalCloseBtn: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#444',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
};
