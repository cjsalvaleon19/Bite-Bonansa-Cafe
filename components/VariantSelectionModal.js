import React, { useState, useEffect } from 'react';

/**
 * Modal component for selecting menu item variants (size, flavor, add-ons, etc.)
 * Displays variant types and options, calculates total price with modifiers
 */
export default function VariantSelectionModal({ item, onConfirm, onCancel }) {
  const [selectedVariants, setSelectedVariants] = useState({});
  const [quantity, setQuantity] = useState(1);

  // Reset state when item changes
  useEffect(() => {
    setSelectedVariants({});
    setQuantity(1);
  }, [item]);

  // Handle variant selection for a specific variant type
  const handleVariantSelect = (typeId, optionId, optionName, priceModifier) => {
    setSelectedVariants(prev => ({
      ...prev,
      [typeId]: { optionId, optionName, priceModifier }
    }));
  };

  // Calculate total price including base price + all variant modifiers
  const calculatePrice = () => {
    let price = parseFloat(item.base_price || 0);
    Object.values(selectedVariants).forEach(variant => {
      price += parseFloat(variant.priceModifier || 0);
    });
    return price;
  };

  // Validate all required variants are selected
  const isValid = () => {
    if (!item.variant_types || item.variant_types.length === 0) {
      return true; // No variants required
    }
    
    return item.variant_types.every(type => {
      if (type.is_required) {
        return selectedVariants[type.id] !== undefined;
      }
      return true;
    });
  };

  const handleConfirm = () => {
    if (!isValid()) {
      return;
    }

    const finalPrice = calculatePrice();
    
    // Build variant description for display
    const variantDescription = Object.entries(selectedVariants).map(([typeId, variant]) => {
      const variantType = item.variant_types.find(vt => vt.id === typeId);
      return `${variantType?.variant_type_name}: ${variant.optionName}`;
    }).join(', ');

    onConfirm({
      ...item,
      selectedVariants,
      variantDescription,
      price: finalPrice,
      quantity,
      // Create unique cart ID based on item + selected variants
      cartItemId: `${item.id}_${Object.values(selectedVariants).map(v => v.optionId).join('_')}`
    });
  };

  if (!item) return null;

  return (
    <div style={styles.overlay} onClick={onCancel}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>{item.name}</h3>
          <button style={styles.closeBtn} onClick={onCancel}>✕</button>
        </div>

        {item.description && (
          <p style={styles.description}>{item.description}</p>
        )}

        <div style={styles.modalBody}>
          {/* Variant Type Sections */}
          {item.variant_types && item.variant_types.length > 0 ? (
            item.variant_types.map(type => (
              <div key={type.id} style={styles.variantSection}>
                <h4 style={styles.variantTypeLabel}>
                  {type.variant_type_name}
                  {type.is_required && <span style={styles.required}> *</span>}
                </h4>
                <div style={styles.optionsGrid}>
                  {type.options && type.options.map(option => {
                    const isSelected = selectedVariants[type.id]?.optionId === option.id;
                    return (
                      <button
                        key={option.id}
                        style={{
                          ...styles.optionBtn,
                          ...(isSelected ? styles.optionBtnActive : {})
                        }}
                        onClick={() => handleVariantSelect(
                          type.id,
                          option.id,
                          option.option_name,
                          option.price_modifier
                        )}
                      >
                        <span style={styles.optionName}>{option.option_name}</span>
                        {parseFloat(option.price_modifier || 0) > 0 && (
                          <span style={styles.optionPrice}>
                            +₱{parseFloat(option.price_modifier).toFixed(2)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            <p style={styles.noVariantsText}>No customization options available</p>
          )}

          {/* Quantity Selector */}
          <div style={styles.quantitySection}>
            <label style={styles.quantityLabel}>Quantity:</label>
            <div style={styles.quantityControls}>
              <button
                style={styles.quantityBtn}
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
              >
                -
              </button>
              <span style={styles.quantityValue}>{quantity}</span>
              <button
                style={styles.quantityBtn}
                onClick={() => setQuantity(quantity + 1)}
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Footer with Price and Actions */}
        <div style={styles.modalFooter}>
          <div style={styles.priceDisplay}>
            <span style={styles.priceLabel}>Total:</span>
            <span style={styles.priceValue}>
              ₱{(calculatePrice() * quantity).toFixed(2)}
            </span>
          </div>
          <div style={styles.modalActions}>
            <button onClick={onCancel} style={styles.cancelBtn}>
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!isValid()}
              style={{
                ...styles.confirmBtn,
                ...(isValid() ? {} : styles.confirmBtnDisabled)
              }}
            >
              Add to Cart
            </button>
          </div>
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
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  modal: {
    backgroundColor: '#1a1a1a',
    borderRadius: '12px',
    maxWidth: '600px',
    width: '100%',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid #2a2a2a',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    borderBottom: '1px solid #2a2a2a',
  },
  modalTitle: {
    fontSize: '22px',
    fontFamily: "'Playfair Display', serif",
    color: '#ffc107',
    margin: 0,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#999',
    fontSize: '24px',
    cursor: 'pointer',
    padding: '0',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'color 0.2s',
  },
  description: {
    padding: '0 20px',
    paddingTop: '12px',
    fontSize: '14px',
    color: '#999',
    margin: 0,
  },
  modalBody: {
    padding: '20px',
    overflowY: 'auto',
    flex: 1,
  },
  variantSection: {
    marginBottom: '24px',
  },
  variantTypeLabel: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#fff',
    marginBottom: '12px',
    fontFamily: "'Poppins', sans-serif",
  },
  required: {
    color: '#ff4444',
    fontSize: '18px',
  },
  optionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '8px',
  },
  optionBtn: {
    padding: '12px',
    backgroundColor: '#0a0a0a',
    color: '#ccc',
    border: '1px solid #444',
    borderRadius: '8px',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
    transition: 'all 0.2s',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  optionBtnActive: {
    backgroundColor: '#ffc107',
    color: '#0a0a0a',
    border: '1px solid #ffc107',
    fontWeight: '600',
  },
  optionName: {
    fontSize: '13px',
    textAlign: 'center',
  },
  optionPrice: {
    fontSize: '11px',
    fontWeight: '600',
  },
  noVariantsText: {
    color: '#999',
    fontSize: '14px',
    textAlign: 'center',
    padding: '20px',
  },
  quantitySection: {
    marginTop: '24px',
    paddingTop: '20px',
    borderTop: '1px solid #2a2a2a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quantityLabel: {
    fontSize: '14px',
    color: '#fff',
    fontWeight: '600',
  },
  quantityControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  quantityBtn: {
    width: '32px',
    height: '32px',
    backgroundColor: '#2a2a2a',
    color: '#fff',
    border: '1px solid #444',
    borderRadius: '6px',
    fontSize: '16px',
    cursor: 'pointer',
    fontWeight: '600',
    transition: 'all 0.2s',
  },
  quantityValue: {
    fontSize: '16px',
    color: '#fff',
    fontWeight: '600',
    minWidth: '32px',
    textAlign: 'center',
  },
  modalFooter: {
    padding: '20px',
    borderTop: '1px solid #2a2a2a',
  },
  priceDisplay: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  priceLabel: {
    fontSize: '16px',
    color: '#fff',
    fontWeight: '600',
  },
  priceValue: {
    fontSize: '24px',
    color: '#ffc107',
    fontWeight: '700',
  },
  modalActions: {
    display: 'flex',
    gap: '12px',
  },
  cancelBtn: {
    flex: 1,
    padding: '12px',
    backgroundColor: 'transparent',
    color: '#ffc107',
    border: '1px solid #ffc107',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
    transition: 'all 0.2s',
  },
  confirmBtn: {
    flex: 1,
    padding: '12px',
    backgroundColor: '#ffc107',
    color: '#0a0a0a',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
    transition: 'all 0.2s',
  },
  confirmBtnDisabled: {
    backgroundColor: '#555',
    color: '#999',
    cursor: 'not-allowed',
    opacity: 0.5,
  },
};
