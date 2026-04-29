import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../../utils/supabaseClient';
import { useRoleGuard } from '../../utils/useRoleGuard';

export default function OrdersQueue() {
  const router = useRouter();
  const { loading: authLoading } = useRoleGuard('cashier');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState('all'); // 'all', 'dine-in', 'take-out', 'pick-up', 'delivery'
  const [riders, setRiders] = useState([]);
  const [selectedOrderForRider, setSelectedOrderForRider] = useState(null);
  const [showRiderModal, setShowRiderModal] = useState(false);

  useEffect(() => {
    if (!authLoading) {
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

  const fetchOrders = async () => {
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .in('status', ['order_in_queue', 'order_in_process'])
        .order('created_at', { ascending: true });

      if (error) throw error;

      setOrders(data || []);
    } catch (err) {
      console.error('[OrdersQueue] Failed to fetch orders:', err?.message ?? err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveItem = async (orderId, itemIndex) => {
    if (!supabase) return;
    if (!confirm('Are you sure you want to remove this item?')) return;

    try {
      const order = orders.find(o => o.id === orderId);
      if (!order) return;

      const updatedItems = order.items.filter((_, index) => index !== itemIndex);
      
      // If no items left, delete the order
      if (updatedItems.length === 0) {
        const { error } = await supabase
          .from('orders')
          .delete()
          .eq('id', orderId);

        if (error) throw error;
      } else {
        // Update the order with remaining items
        const newSubtotal = updatedItems.reduce((sum, item) => 
          sum + (item.price * item.quantity), 0
        );

        const { error } = await supabase
          .from('orders')
          .update({
            items: updatedItems,
            subtotal: newSubtotal,
            total_amount: newSubtotal,
          })
          .eq('id', orderId);

        if (error) throw error;
      }

      fetchOrders();
    } catch (err) {
      console.error('[OrdersQueue] Failed to remove item:', err?.message ?? err);
      alert('Failed to remove item. Please try again.');
    }
  };

  const handleMarkServed = async (orderId) => {
    if (!supabase) return;
    if (!confirm('Mark this order as served?')) return;

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'served' })
        .eq('id', orderId);

      if (error) throw error;

      fetchOrders();
    } catch (err) {
      console.error('[OrdersQueue] Failed to mark as served:', err?.message ?? err);
      alert('Failed to update order status. Please try again.');
    }
  };

  const fetchRiders = async () => {
    if (!supabase) return;

    try {
      // Fetch available riders
      const { data: ridersData, error } = await supabase
        .from('users')
        .select('id, full_name, email')
        .eq('role', 'rider')
        .order('full_name');

      if (error) throw error;

      setRiders(ridersData || []);
    } catch (err) {
      console.error('[OrdersQueue] Failed to fetch riders:', err?.message ?? err);
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
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'out_for_delivery',
          out_for_delivery_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (error) throw error;

      // Send notification to customer
      if (order.customer_id) {
        await supabase.from('notifications').insert({
          user_id: order.customer_id,
          title: 'Order Ready for Pick-up',
          message: `Your order #${order.order_number} is ready for pick-up!`,
          type: 'order_update',
          related_id: order.id,
          related_type: 'order'
        });
      }

      alert('Order marked as ready for pick-up!');
      fetchOrders();
    } catch (err) {
      console.error('[OrdersQueue] Failed to mark ready for pickup:', err?.message ?? err);
      alert('Failed to update order status. Please try again.');
    }
  };

  const handleAssignRider = async (riderId) => {
    if (!supabase || !selectedOrderForRider) return;

    try {
      // Update order with rider and status
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'out_for_delivery',
          rider_id: riderId,
          out_for_delivery_at: new Date().toISOString()
        })
        .eq('id', selectedOrderForRider.id);

      if (error) throw error;

      // Send notification to rider
      await supabase.from('notifications').insert({
        user_id: riderId,
        title: 'New Delivery Assignment',
        message: `You have been assigned to deliver order #${selectedOrderForRider.order_number}`,
        type: 'delivery_assignment',
        related_id: selectedOrderForRider.id,
        related_type: 'order'
      });

      // Send notification to customer
      if (selectedOrderForRider.customer_id) {
        await supabase.from('notifications').insert({
          user_id: selectedOrderForRider.customer_id,
          title: 'Order Out for Delivery',
          message: `Your order #${selectedOrderForRider.order_number} is out for delivery!`,
          type: 'order_update',
          related_id: selectedOrderForRider.id,
          related_type: 'order'
        });
      }

      alert('Rider assigned successfully!');
      setShowRiderModal(false);
      setSelectedOrderForRider(null);
      fetchOrders();
    } catch (err) {
      console.error('[OrdersQueue] Failed to assign rider:', err?.message ?? err);
      alert('Failed to assign rider. Please try again.');
    }
  };

  const filteredOrders = filterMode === 'all' 
    ? orders 
    : orders.filter(order => order.order_mode === filterMode);

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
          <button style={styles.logoutBtn} onClick={async () => {
            if (supabase) await supabase.auth.signOut();
            router.replace('/login');
          }}>
            Logout
          </button>
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
                        Order #{order.id.slice(0, 8)}
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
                    {order.items && order.items.map((item, index) => (
                      <div key={index} style={styles.itemRow}>
                        <div style={styles.itemInfo}>
                          <span style={styles.itemName}>{item.name}</span>
                          <span style={styles.itemQty}>x{item.quantity}</span>
                        </div>
                        <div style={styles.itemActions}>
                          <span style={styles.itemPrice}>
                            ₱{(item.price * item.quantity).toFixed(2)}
                          </span>
                          <button
                            style={styles.removeItemBtn}
                            onClick={() => handleRemoveItem(order.id, index)}
                            title="Remove item"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
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
                      <button
                        style={styles.servedBtn}
                        onClick={() => handleMarkServed(order.id)}
                      >
                        ✓ Mark as Served
                      </button>
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
                  <div style={styles.ridersList}>
                    {riders.map((rider) => (
                      <button
                        key={rider.id}
                        style={styles.riderItem}
                        onClick={() => handleAssignRider(rider.id)}
                      >
                        <span style={styles.riderIcon}>🏍️</span>
                        <div style={styles.riderInfo}>
                          <div style={styles.riderName}>{rider.full_name || 'Unnamed Rider'}</div>
                          <div style={styles.riderEmail}>{rider.email}</div>
                        </div>
                        <span style={styles.selectArrow}>→</span>
                      </button>
                    ))}
                  </div>
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
  removeItemBtn: {
    padding: '4px 8px',
    backgroundColor: 'transparent',
    color: '#f44336',
    border: '1px solid #f44336',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
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
