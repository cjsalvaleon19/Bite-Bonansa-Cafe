import React, { useState, useEffect } from 'react';
import { RIDER_FEE_PERCENTAGE } from '../utils/deliveryCalculator';
import { supabase } from '../utils/supabaseClient';

export default function ReceiptModal({ delivery, onClose }) {
  const [customerLoyaltyId, setCustomerLoyaltyId] = useState(null);

  if (!delivery) return null;

  const order = delivery.orders || {};
  // Handle items from both JSONB column (order.items) and related table (order.order_items)
  // order.items is the JSONB column, order_items would be from a join
  const items = order.items || order.order_items || [];
  
  // Helper function to strip variant details from item name (for legacy data)
  const stripVariantsFromName = (name) => {
    // Remove anything in parentheses at the end of the name (e.g., "Americano (12oz Hot | Extra Shot)" -> "Americano")
    return name.replace(/\s*\([^)]*\)\s*$/, '').trim();
  };
  
  // Calculate totals - handle case where order.total may already include delivery fee
  const deliveryFee = order.delivery_fee || delivery.delivery_fee || 0;
  const riderDeliveryFee = deliveryFee * RIDER_FEE_PERCENTAGE;
  const pointsUsed = order.points_used || 0;
  
  let subtotal, total, netAmount, cashTendered, change;
  
  if (order.subtotal) {
    // If subtotal exists, use it and add delivery fee
    subtotal = order.subtotal;
    total = subtotal + deliveryFee;
  } else if (order.total) {
    // If only total exists, it likely already includes delivery fee
    total = order.total;
    subtotal = total - deliveryFee;
  } else {
    // Fallback: calculate from items if neither exists
    subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    total = subtotal + deliveryFee;
  }
  
  // Calculate net amount (after points deduction)
  netAmount = total - pointsUsed;
  
  // Get cash tendered and calculate change
  cashTendered = order.cash_amount || 0;
  change = Math.max(0, cashTendered - netAmount);
  
  // Fetch customer loyalty ID if customer_id exists
  useEffect(() => {
    const fetchCustomerLoyaltyId = async () => {
      if (!order.customer_id || !supabase) return;
      
      try {
        const { data, error } = await supabase
          .from('users')
          .select('customer_id')
          .eq('id', order.customer_id)
          .single();
        
        if (!error && data && data.customer_id) {
          setCustomerLoyaltyId(data.customer_id);
        }
      } catch (err) {
        console.error('Error fetching customer loyalty ID:', err);
      }
    };
    
    fetchCustomerLoyaltyId();
  }, [order.customer_id]);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Receipt - Order {order.order_number || delivery.order_id}</h2>
          <button style={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div style={styles.content}>
          {/* Receipt Display */}
          <div style={styles.receipt}>
            <div style={styles.receiptHeader}>
              <h2 style={styles.businessName}>Bite Bonansa Cafe</h2>
              <p style={styles.businessInfo}>Laconon-Salacafe Rd, Brgy. Poblacion, T'boli, South Cotabato</p>
              <p style={styles.businessInfo}>Tel: 0907-200-8247</p>
              <p style={styles.invoiceTitle}>SALES INVOICE</p>
            </div>

            <div style={styles.orderInfo}>
              <p>Order#: {order.order_number || delivery.order_id}</p>
              <p>Date  : {new Date(delivery.created_at || Date.now()).toLocaleString()}</p>
              <p>Type  : {order.order_mode || 'delivery'}</p>
              <p>Name  : {order.customer_name || delivery.customer_name || 'N/A'}</p>
              {(order.customer_phone || delivery.customer_phone) && (
                <p>Phone : {order.customer_phone || delivery.customer_phone}</p>
              )}
              {customerLoyaltyId && (
                <p><strong>Customer ID:</strong> {customerLoyaltyId}</p>
              )}
            </div>

            <div style={styles.section}>
              <p style={styles.sectionTitle}>ITEMS ORDERED</p>
              <div style={styles.items}>
                {items.length > 0 ? (
                  items.map((item, idx) => {
                    const displayName = stripVariantsFromName(item.name);
                    const variants = item.variantDetails || item.variant_details;
                    const hasVariants = variants && typeof variants === 'object' && Object.keys(variants).length > 0;
                    
                    return (
                    <div key={idx} style={styles.itemRow}>
                      <div style={styles.itemInfo}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <span>{displayName} x{item.quantity}</span>
                          <span style={styles.itemPrice}>₱{(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                        {hasVariants && (
                          <div style={styles.variantDetails}>
                            (Add Ons: {Object.entries(variants).map(([type, value]) => 
                              `${value}`
                            ).join(', ')})
                          </div>
                        )}
                      </div>
                    </div>
                  )})
                ) : (
                  <p style={{ fontStyle: 'italic', color: '#666', padding: '10px 0' }}>
                    No items found. Please check the order data.
                  </p>
                )}
              </div>
            </div>

            <div style={styles.totals}>
              <div style={styles.totalRow}>
                <span><strong>Subtotal:</strong></span>
                <span>₱{subtotal.toFixed(2)}</span>
              </div>
              {/* Always show delivery fee for delivery orders */}
              {order.order_mode === 'delivery' && (
                <div style={styles.totalRow}>
                  <span><strong>Delivery Fee:</strong></span>
                  <span>₱{deliveryFee.toFixed(2)}</span>
                </div>
              )}
              <div style={{ ...styles.totalRow, ...styles.grandTotal }}>
                <span><strong>Total:</strong></span>
                <span><strong>₱{total.toFixed(2)}</strong></span>
              </div>
              {pointsUsed > 0 && (
                <div style={styles.totalRow}>
                  <span><strong>Points Claimed:</strong></span>
                  <span>-₱{pointsUsed.toFixed(2)}</span>
                </div>
              )}
              <div style={{ ...styles.totalRow, borderTop: '1px solid #000', paddingTop: '8px', marginTop: '4px' }}>
                <span><strong>Net Amount:</strong></span>
                <span><strong>₱{netAmount.toFixed(2)}</strong></span>
              </div>
              <div style={styles.totalRow}>
                <span><strong>Cash Tendered:</strong></span>
                <span>₱{cashTendered.toFixed(2)}</span>
              </div>
              <div style={styles.totalRow}>
                <span><strong>Change:</strong></span>
                <span>₱{change.toFixed(2)}</span>
              </div>
              <div style={{ ...styles.totalRow, borderTop: '1px dashed #000', paddingTop: '8px', marginTop: '8px' }}>
                <span><strong>Payment:</strong></span>
                <span>{order.payment_method || 'cash'}</span>
              </div>
            </div>

            {(() => {
              // Extract only customer order notes from special_instructions
              // Remove GCash reference number and proof URL
              let orderNotes = delivery.special_instructions || '';
              if (orderNotes) {
                // Split by | delimiter and take only the first part (customer notes)
                orderNotes = orderNotes.split('|')[0].trim();
              }
              
              return orderNotes ? (
                <div style={styles.section}>
                  <p style={styles.sectionTitle}>SPECIAL INSTRUCTIONS</p>
                  <p style={styles.instructions}>{orderNotes}</p>
                </div>
              ) : null;
            })()}

            <div style={styles.footer}>
              <p>Thank you for your order, Biter!</p>
              <div style={styles.qrSection}>
                <img src="/qr-code.png" alt="Scan to order online" style={styles.qrCode} />
                <p style={styles.qrLabel}>Scan to Order Online</p>
                <p style={styles.qrUrl}>bitebonansacafe.com</p>
              </div>
            </div>
          </div>
        </div>

        <div style={styles.actions}>
          <button style={styles.printBtn} onClick={() => window.print()}>
            🖨️ Print Receipt
          </button>
          <button style={styles.cancelBtn} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    fontFamily: "'Poppins', sans-serif",
  },
  modal: {
    backgroundColor: '#1a1a1a',
    borderRadius: '12px',
    width: '90%',
    maxWidth: '600px',
    maxHeight: '90vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    border: '2px solid #ffc107',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    borderBottom: '2px solid #333',
    backgroundColor: '#222',
  },
  title: {
    margin: 0,
    color: '#ffc107',
    fontSize: '20px',
    fontWeight: '600',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#ffc107',
    fontSize: '32px',
    cursor: 'pointer',
    padding: '0',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'Arial, sans-serif',
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: '20px',
  },
  receipt: {
    backgroundColor: '#fff',
    color: '#000',
    padding: '30px',
    borderRadius: '8px',
    fontFamily: 'monospace',
    fontSize: '12px',
  },
  receiptHeader: {
    textAlign: 'center',
    marginBottom: '20px',
    paddingBottom: '15px',
    borderBottom: '2px dashed #000',
  },
  businessName: {
    margin: '0 0 10px 0',
    fontSize: '18px',
    fontWeight: 'bold',
  },
  businessInfo: {
    margin: '5px 0',
    fontSize: '12px',
  },
  invoiceTitle: {
    marginTop: '15px',
    fontWeight: 'bold',
    fontSize: '13px',
  },
  orderInfo: {
    marginBottom: '20px',
    fontSize: '12px',
    lineHeight: '1.6',
  },
  section: {
    marginTop: '20px',
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: '10px',
    textDecoration: 'underline',
    fontSize: '13px',
  },
  items: {
    marginBottom: '15px',
  },
  itemRow: {
    marginBottom: '12px',
    fontSize: '12px',
  },
  itemInfo: {
    width: '100%',
  },
  variantDetails: {
    fontSize: '10px',
    color: '#666',
    marginTop: '3px',
    paddingLeft: '15px',
  },
  itemPrice: {
    whiteSpace: 'nowrap',
  },
  totals: {
    marginTop: '20px',
    paddingTop: '15px',
    borderTop: '2px dashed #000',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '8px',
    fontSize: '13px',
  },
  grandTotal: {
    marginTop: '10px',
    paddingTop: '10px',
    borderTop: '2px solid #000',
    fontSize: '15px',
  },
  instructions: {
    fontSize: '11px',
    fontStyle: 'italic',
    color: '#333',
  },
  footer: {
    textAlign: 'center',
    marginTop: '25px',
    paddingTop: '15px',
    borderTop: '2px dashed #000',
    fontSize: '12px',
  },
  qrSection: {
    marginTop: '15px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  qrCode: {
    width: '100px',
    height: '100px',
    marginBottom: '6px',
  },
  qrLabel: {
    margin: '2px 0',
    fontSize: '11px',
    fontWeight: 'bold',
    letterSpacing: '0.5px',
  },
  qrUrl: {
    margin: '2px 0',
    fontSize: '11px',
    color: '#333',
  },
  actions: {
    display: 'flex',
    gap: '12px',
    padding: '20px',
    borderTop: '2px solid #333',
    backgroundColor: '#222',
  },
  printBtn: {
    flex: 1,
    padding: '12px 24px',
    backgroundColor: '#ffc107',
    color: '#000',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
    transition: 'all 0.3s ease',
  },
  cancelBtn: {
    flex: 1,
    padding: '12px 24px',
    backgroundColor: '#444',
    color: '#fff',
    border: '1px solid #666',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
    transition: 'all 0.3s ease',
  },
};
