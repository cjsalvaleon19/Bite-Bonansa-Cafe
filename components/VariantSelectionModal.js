import React, { useState, useEffect } from 'react';

const SILOG_MEALS_NAME = 'Silog Meals';
const SILOG_VARIETY_TYPE = 'Variety';
const SIOMAISILOG_OPTION = 'Siomaisilog';
const SIOMAI_STYLE_TYPE = 'Siomai Style';

const normalizeSelectedVariants = (variants) => {
  if (!variants || typeof variants !== 'object') return {};
  return Object.fromEntries(
    Object.entries(variants).map(([typeId, options]) => ([
      typeId,
      Array.isArray(options)
        ? options.map((option) => ({
          ...option,
          quantity: Math.max(1, Number(option?.quantity) || 1)
        }))
        : []
    ]))
  );
};

export default function VariantSelectionModal({
  item,
  onConfirm,
  onCancel,
  initialSelectedVariants = null,
  initialQuantity = 1,
  confirmLabel = 'Add to Cart'
}) {
  const [selectedVariants, setSelectedVariants] = useState({});
  const [quantity, setQuantity] = useState(1);

  const isSiomaisilogSelected = () => {
    if (item?.name !== SILOG_MEALS_NAME || !Array.isArray(item?.variant_types)) return false;
    const varietyType = item.variant_types.find((type) => type.variant_type_name === SILOG_VARIETY_TYPE);
    if (!varietyType) return false;
    const selected = selectedVariants[varietyType.id];
    return Array.isArray(selected) && selected.some((opt) => opt.optionName === SIOMAISILOG_OPTION);
  };

  const isTypeRequired = (type) => {
    if (type?.is_required) return true;
    return item?.name === SILOG_MEALS_NAME
      && type?.variant_type_name === SIOMAI_STYLE_TYPE
      && isSiomaisilogSelected();
  };

  useEffect(() => {
    setSelectedVariants(normalizeSelectedVariants(initialSelectedVariants));
    setQuantity(Math.max(1, Number(initialQuantity) || 1));
  }, [item?.id, initialSelectedVariants, initialQuantity]);

  // Handle variant selection
  const handleVariantSelect = (typeId, optionId, optionName, priceModifier, allowMultiple) => {
    if (allowMultiple) {
      setSelectedVariants(prev => {
        const currentOptions = prev[typeId] || [];
        const exists = currentOptions.find(opt => opt.optionId === optionId);
        
        if (exists) {
          return {
            ...prev,
            [typeId]: currentOptions.filter(opt => opt.optionId !== optionId)
          };
        } else {
          return {
            ...prev,
            [typeId]: [...currentOptions, { optionId, optionName, priceModifier, quantity: 1 }]
          };
        }
      });
    } else {
      // For single selection, replace
      setSelectedVariants(prev => {
        const next = {
          ...prev,
          [typeId]: [{ optionId, optionName, priceModifier }]
        };

        const selectedType = item?.variant_types?.find((type) => type.id === typeId);
        const isSilogVariety = item?.name === SILOG_MEALS_NAME && selectedType?.variant_type_name === SILOG_VARIETY_TYPE;
        if (isSilogVariety && optionName !== SIOMAISILOG_OPTION) {
          const siomaiStyleType = item?.variant_types?.find((type) => type.variant_type_name === SIOMAI_STYLE_TYPE);
          if (siomaiStyleType) {
            delete next[siomaiStyleType.id];
          }
        }

        return next;
      });
    }
  };

  const handleMultiOptionQuantityChange = (typeId, optionId, delta) => {
    setSelectedVariants((prev) => {
      const currentOptions = prev[typeId] || [];
      const nextOptions = currentOptions
        .map((option) => {
          if (option.optionId !== optionId) return option;
          const nextQuantity = Math.max(0, (Number(option.quantity) || 1) + delta);
          return { ...option, quantity: nextQuantity };
        })
        .filter((option) => (Number(option.quantity) || 0) > 0);

      return {
        ...prev,
        [typeId]: nextOptions
      };
    });
  };

  // Check if an option is selected
  const isOptionSelected = (typeId, optionId) => {
    const options = selectedVariants[typeId];
    if (!options || !Array.isArray(options)) return false;
    return options.some(opt => opt.optionId === optionId);
  };

  // Calculate total price including base price and all variant modifiers
  const calculatePrice = () => {
    // Use item.price (from menu_items table) or item.base_price (from legacy menu_items_base table) as fallback
    let price = parseFloat(item.price || item.base_price || 0);
    
    Object.values(selectedVariants).forEach(options => {
      if (Array.isArray(options)) {
        options.forEach(option => {
          price += parseFloat(option.priceModifier || 0) * (Number(option.quantity) || 1);
        });
      }
    });
    
    return price;
  };

  // Validate all required variants are selected
  const isValid = () => {
    if (!item.variant_types || item.variant_types.length === 0) {
      return true; // No variants required
    }

    return item.variant_types.every(type => {
      if (isTypeRequired(type)) {
        const selected = selectedVariants[type.id];
        return selected && Array.isArray(selected) && selected.length > 0;
      }
      return true;
    });
  };

  const handleConfirm = () => {
    if (isValid()) {
      // Format selected variants for cart - create a Map for efficient lookup
      const variantTypesMap = new Map(
        item.variant_types.map(type => [type.id, type.variant_type_name])
      );
      
      const variantDetails = {};
      Object.entries(selectedVariants).forEach(([typeId, options]) => {
        const variantTypeName = variantTypesMap.get(typeId);
        if (variantTypeName) {
          variantDetails[variantTypeName] = options
            .map(opt => {
              const optionQuantity = Math.max(1, Number(opt.quantity) || 1);
              return optionQuantity > 1 ? `${opt.optionName} x${optionQuantity}` : opt.optionName;
            })
            .join(', ');
        }
      });

      // Create a unique cart key based on item ID and selected variants
      const variantKeys = Object.entries(selectedVariants)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([typeId, options]) => 
          options
            .map(opt => `${opt.optionId}x${Math.max(1, Number(opt.quantity) || 1)}`)
            .sort()
            .join(',')
        )
        .join('|');
      const cartKey = `${item.id}|${variantKeys}`;

      onConfirm({
        ...item,
        cartKey,
        selectedVariants,
        variantDetails,
        finalPrice: calculatePrice(),
        quantity
      });
    }
  };

  const unitPrice = calculatePrice();
  const totalPrice = unitPrice * quantity;

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
          {item.variant_types && item.variant_types.length > 0 ? (
            item.variant_types
              .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
              .filter(type => {
                if (item?.name !== SILOG_MEALS_NAME) return true;
                if (type.variant_type_name !== SIOMAI_STYLE_TYPE) return true;
                return isSiomaisilogSelected();
              })
              .map(type => (
                <div key={type.id} style={styles.variantSection}>
                  <h4 style={styles.variantTitle}>
                    {type.variant_type_name}
                    {isTypeRequired(type) && <span style={styles.required}> *</span>}
                    {type.allow_multiple && <span style={styles.hint}> (Select multiple)</span>}
                  </h4>
                  <div style={styles.optionsGrid}>
                    {type.options && type.options.length > 0 ? (
                      type.options
                        .filter(option => option.available !== false) // Only show available options
                        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
                        .map(option => (
                          <div
                            key={option.id}
                            style={{
                              ...styles.optionBtn,
                              ...(isOptionSelected(type.id, option.id) ? styles.optionBtnActive : {})
                            }}
                          >
                            <button
                              style={styles.optionMainBtn}
                              onClick={() => handleVariantSelect(
                                type.id,
                                option.id,
                                option.option_name,
                                option.price_modifier,
                                type.allow_multiple
                              )}
                            >
                              <span style={styles.optionName}>{option.option_name}</span>
                              {option.price_modifier > 0 && (
                                <span style={styles.optionPrice}>+₱{parseFloat(option.price_modifier).toFixed(2)}</span>
                              )}
                            </button>
                            {type.allow_multiple && isOptionSelected(type.id, option.id) && (
                              <div style={styles.optionQtyControls}>
                                <button
                                  type="button"
                                  style={styles.optionQtyBtn}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMultiOptionQuantityChange(type.id, option.id, -1);
                                  }}
                                >
                                  −
                                </button>
                                <span style={styles.optionQtyValue}>
                                  {Math.max(1, Number((selectedVariants[type.id] || []).find(opt => opt.optionId === option.id)?.quantity) || 1)}
                                </span>
                                <button
                                  type="button"
                                  style={styles.optionQtyBtn}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMultiOptionQuantityChange(type.id, option.id, 1);
                                  }}
                                >
                                  +
                                </button>
                              </div>
                            )}
                          </div>
                        ))
                    ) : (
                      <p style={styles.noOptions}>No options available</p>
                    )}
                  </div>
                </div>
              ))
          ) : (
            <p style={styles.noVariants}>No variants available for this item</p>
          )}

          {/* Quantity Selector */}
          <div style={styles.quantitySection}>
            <label style={styles.quantityLabel}>Quantity:</label>
            <div style={styles.quantityControls}>
              <button
                style={styles.quantityBtn}
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
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

          {/* Price Display */}
          <div style={styles.priceSection}>
            <div style={styles.priceRow}>
              <span style={styles.priceLabel}>Unit Price:</span>
              <span style={styles.priceValue}>₱{unitPrice.toFixed(2)}</span>
            </div>
            {quantity > 1 && (
              <div style={styles.priceRow}>
                <span style={styles.priceLabel}>Quantity:</span>
                <span style={styles.priceValue}>× {quantity}</span>
              </div>
            )}
            <div style={{...styles.priceRow, ...styles.totalRow}}>
              <span style={styles.totalLabel}>Total:</span>
              <span style={styles.totalValue}>₱{totalPrice.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div style={styles.modalFooter}>
          <button onClick={onCancel} style={styles.cancelBtn}>Cancel</button>
          <button
            onClick={handleConfirm}
            disabled={!isValid()}
            style={{
              ...styles.confirmBtn,
              ...(isValid() ? {} : styles.confirmBtnDisabled)
            }}
          >
            {confirmLabel}
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
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid #2a2a2a',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid #2a2a2a',
  },
  modalTitle: {
    fontSize: '20px',
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
    width: '30px',
    height: '30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: {
    padding: '12px 24px 0',
    color: '#999',
    fontSize: '14px',
    margin: 0,
    lineHeight: '1.5',
  },
  modalBody: {
    padding: '20px 24px',
    overflowY: 'auto',
    flex: 1,
  },
  variantSection: {
    marginBottom: '24px',
  },
  variantTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#fff',
    marginBottom: '12px',
    fontFamily: "'Poppins', sans-serif",
  },
  required: {
    color: '#ff4444',
  },
  hint: {
    fontSize: '13px',
    fontWeight: '400',
    color: '#999',
    fontStyle: 'italic',
  },
  optionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '8px',
  },
  optionBtn: {
    padding: '12px',
    backgroundColor: '#2a2a2a',
    color: '#fff',
    border: '2px solid #3a3a3a',
    borderRadius: '8px',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
    transition: 'all 0.2s',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    textAlign: 'center',
  },
  optionMainBtn: {
    width: '100%',
    background: 'none',
    border: 'none',
    color: 'inherit',
    font: 'inherit',
    padding: 0,
    margin: 0,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    textAlign: 'center',
  },
  optionBtnActive: {
    backgroundColor: '#ffc107',
    color: '#0a0a0a',
    border: '2px solid #ffc107',
    fontWeight: '600',
  },
  optionName: {
    fontSize: '13px',
  },
  optionPrice: {
    fontSize: '12px',
    fontWeight: '600',
  },
  optionQtyControls: {
    marginTop: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  optionQtyBtn: {
    width: '22px',
    height: '22px',
    borderRadius: '4px',
    border: '1px solid rgba(255, 255, 255, 0.35)',
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    color: 'inherit',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    lineHeight: 1,
    padding: 0,
  },
  optionQtyValue: {
    minWidth: '18px',
    textAlign: 'center',
    fontSize: '12px',
    fontWeight: '700',
  },
  noOptions: {
    color: '#999',
    fontSize: '13px',
    fontStyle: 'italic',
  },
  noVariants: {
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
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quantityLabel: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#fff',
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
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '600',
  },
  quantityValue: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#fff',
    minWidth: '30px',
    textAlign: 'center',
  },
  priceSection: {
    marginTop: '20px',
    padding: '16px',
    backgroundColor: '#0f0f0f',
    borderRadius: '8px',
  },
  priceRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '8px',
  },
  priceLabel: {
    fontSize: '14px',
    color: '#999',
  },
  priceValue: {
    fontSize: '14px',
    color: '#fff',
  },
  totalRow: {
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid #2a2a2a',
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#fff',
  },
  totalValue: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#ffc107',
  },
  modalFooter: {
    display: 'flex',
    gap: '12px',
    padding: '20px 24px',
    borderTop: '1px solid #2a2a2a',
  },
  cancelBtn: {
    flex: 1,
    padding: '12px',
    backgroundColor: 'transparent',
    color: '#999',
    border: '1px solid #444',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
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
  },
  confirmBtnDisabled: {
    backgroundColor: '#555',
    color: '#999',
    cursor: 'not-allowed',
  },
};
