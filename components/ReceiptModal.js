import React from 'react';

export default function ReceiptModal({ delivery, onClose }) {
  if (!delivery) return null;

  const order = delivery.orders || {};
  const items = order.items || [];
  
  // Calculate totals - handle case where order.total may already include delivery fee
  const deliveryFee = order.delivery_fee || delivery.delivery_fee || 0;
  const RIDER_FEE_PERCENTAGE = 0.6; // Rider receives 60% of delivery fee, company keeps 40%
  const riderDeliveryFee = deliveryFee * RIDER_FEE_PERCENTAGE;
  let subtotal, total;
  
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
              <p style={styles.businessInfo}>123 Main Street, City</p>
              <p style={styles.businessInfo}>Tel: (123) 456-7890</p>
              <p style={styles.invoiceTitle}>SALES INVOICE</p>
            </div>

            <div style={styles.orderInfo}>
              <p><strong>Order Number:</strong> {order.order_number || delivery.order_id}</p>
              <p><strong>Date:</strong> {new Date(delivery.created_at || Date.now()).toLocaleString()}</p>
              <p><strong>Order Type:</strong> {order.order_mode || 'delivery'}</p>
              <p><strong>Customer:</strong> {order.customer_name || delivery.customer_name || 'N/A'}</p>
              {(order.customer_phone || delivery.customer_phone) && (
                <p><strong>Contact Number:</strong> {order.customer_phone || delivery.customer_phone}</p>
              )}
              {delivery.customer_address && (
                <p><strong>Delivery Address:</strong> {delivery.customer_address}</p>
              )}
            </div>

            <div style={styles.section}>
              <p style={styles.sectionTitle}>ITEMS ORDERED</p>
              <div style={styles.items}>
                {items.map((item, idx) => (
                  <div key={idx} style={styles.itemRow}>
                    <div style={styles.itemInfo}>
                      <span>{item.name} x{item.quantity}</span>
                      {item.variantDetails && Object.keys(item.variantDetails).length > 0 && (
                        <div style={styles.variantDetails}>
                          ({Object.entries(item.variantDetails).map(([type, value]) => 
                            `${type}: ${value}`
                          ).join(', ')})
                        </div>
                      )}
                    </div>
                    <span style={styles.itemPrice}>₱{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={styles.totals}>
              <div style={styles.totalRow}>
                <span><strong>Subtotal:</strong></span>
                <span>₱{subtotal.toFixed(2)}</span>
              </div>
              {deliveryFee > 0 && (
                <>
                  <div style={styles.totalRow}>
                    <span><strong>Delivery Fee (Customer Paid):</strong></span>
                    <span>₱{deliveryFee.toFixed(2)}</span>
                  </div>
                  <div style={styles.totalRow}>
                    <span><strong>Delivery Fee (Rider's Share - 60%):</strong></span>
                    <span style={{ color: '#4caf50', fontWeight: 'bold' }}>₱{riderDeliveryFee.toFixed(2)}</span>
                  </div>
                </>
              )}
              <div style={{ ...styles.totalRow, ...styles.grandTotal }}>
                <span><strong>Total:</strong></span>
                <span><strong>₱{total.toFixed(2)}</strong></span>
              </div>
            </div>

            {delivery.special_instructions && (
              <div style={styles.section}>
                <p style={styles.sectionTitle}>SPECIAL INSTRUCTIONS</p>
                <p style={styles.instructions}>{delivery.special_instructions}</p>
              </div>
            )}

            <div style={styles.footer}>
              <p>Thank you for your order, Biter!</p>
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
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '8px',
    fontSize: '12px',
  },
  itemInfo: {
    flex: 1,
  },
  variantDetails: {
    fontSize: '10px',
    color: '#666',
    marginTop: '3px',
    paddingLeft: '10px',
  },
  itemPrice: {
    marginLeft: '10px',
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
