import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../../utils/supabaseClient';
import useCartStore from '../../store/useCartStore';
import { useRoleGuard } from '../../utils/useRoleGuard';
import VariantSelectionModal from '../../components/VariantSelectionModal';
import OpenStreetMapPicker from '../../components/OpenStreetMapPicker';
import { STORE_LOCATION, calculateDeliveryFee, getDistanceBetweenCoordinates } from '../../utils/deliveryCalculator';

const DELIVERY_FEE_DEFAULT = 30;
const VAT_RATE = 0; // Currently disabled as per requirements
const MAX_DISPLAYED_OPTIONS = 3; // Maximum number of variant options to display before showing "+X more"

export default function CashierPOS() {
  const router = useRouter();
  const { loading: authLoading } = useRoleGuard('cashier');
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [menuLoading, setMenuLoading] = useState(false);
  const [orderStatus, setOrderStatus] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null); // For variant selection
  const [showVariantModal, setShowVariantModal] = useState(false);
  
  // Order details
  const [orderMode, setOrderMode] = useState('dine-in');
  const [customerInfo, setCustomerInfo] = useState({
    userId: null, // UUID from users.id (for orders.customer_id foreign key)
    customerId: '', // Loyalty card ID from users.customer_id database field (format: BBC-XXXXX)
    customerName: 'Walk-in',
    address: '',
    contactNumber: '',
  });
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentDetails, setPaymentDetails] = useState({
    cashTendered: '',
    gcashReference: '',
  });
  const [pointsToUse, setPointsToUse] = useState(0);
  const [customerPointsBalance, setCustomerPointsBalance] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [customerSearchResults, setCustomerSearchResults] = useState([]);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [combinedPayment, setCombinedPayment] = useState(false); // For points + cash/gcash
  const [deliveryCoordinates, setDeliveryCoordinates] = useState(null); // { lat, lng }
  const [showMapPicker, setShowMapPicker] = useState(false);

  const { items, addItem, removeItem, updateQuantity, clearCart, getTotalPrice } =
    useCartStore();

  useEffect(() => {
    if (!authLoading) fetchMenu();
  }, [authLoading]);

  useEffect(() => {
    if (orderMode === 'delivery') {
      setDeliveryFee(DELIVERY_FEE_DEFAULT);
    } else {
      setDeliveryFee(0);
    }
  }, [orderMode]);

  // Calculate delivery fee when coordinates change
  useEffect(() => {
    if (orderMode === 'delivery' && deliveryCoordinates) {
      const distance = getDistanceBetweenCoordinates(
        STORE_LOCATION.latitude,
        STORE_LOCATION.longitude,
        deliveryCoordinates.lat,
        deliveryCoordinates.lng
      );
      const fee = calculateDeliveryFee(distance);
      setDeliveryFee(fee);
    }
  }, [orderMode, deliveryCoordinates]);

  const fetchMenu = useCallback(async () => {
    if (!supabase) return;
    setMenuLoading(true);
    try {
      // Fetch menu items with variants
      const { data: menuData, error: menuError } = await supabase
        .from('menu_items')
        .select('id, name, price, base_price, category, available, has_variants, is_sold_out')
        .eq('available', true)
        .order('category');

      if (menuError) {
        console.error('[POS] Error fetching menu:', menuError);
        return;
      }

      // For items with variants, fetch their variant data
      const itemsWithVariants = await Promise.all(
        (menuData || []).map(async (item) => {
          if (!item.has_variants) return item;

          const { data: variantTypes, error: variantError } = await supabase
            .from('menu_item_variant_types')
            .select(`
              id,
              variant_type_name,
              is_required,
              allow_multiple,
              display_order,
              options:menu_item_variant_options(
                id,
                option_name,
                price_modifier,
                display_order,
                available
              )
            `)
            .eq('menu_item_id', item.id)
            .order('display_order');

          if (variantError) {
            console.error(`[POS] Error fetching variants for ${item.name}:`, variantError);
            return item;
          }

          return {
            ...item,
            variant_types: variantTypes || []
          };
        })
      );

      setMenuItems(itemsWithVariants);

      // Fetch categories
      const { data: cats, error: catsError } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order');

      if (!catsError && cats) {
        setCategories(cats);
      } else {
        // If categories table doesn't exist yet, extract unique categories from menu items
        const uniqueCategories = Array.from(
          new Set((menuData || []).map(item => item.category).filter(Boolean))
        ).map((name, index) => ({ id: String(index), name }));
        setCategories(uniqueCategories);
      }
    } catch (err) {
      console.error('[POS] Failed to fetch menu:', err?.message ?? err);
    } finally {
      setMenuLoading(false);
    }
  }, []);

  const handleAddItem = (item) => {
    // Check if item is sold out
    if (item.is_sold_out) {
      alert('This item is currently sold out and cannot be added to the cart.');
      return;
    }

    // Check if item has variants
    if (item.has_variants && item.variant_types && item.variant_types.length > 0) {
      setSelectedItem(item);
      setShowVariantModal(true);
    } else {
      // Add item without variants
      addItem({
        ...item,
        finalPrice: parseFloat(item.price || item.base_price || 0),
        quantity: 1,
      });
    }
  };

  const handleVariantConfirm = (itemWithVariants) => {
    addItem(itemWithVariants);
    setShowVariantModal(false);
    setSelectedItem(null);
  };

  const fetchCustomerData = async (customerId) => {
    if (!supabase || !customerId) return;

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, phone, address, customer_id')
        .eq('customer_id', customerId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        // Fetch loyalty balance from transactions
        const { data: transactions, error: transError } = await supabase
          .from('loyalty_transactions')
          .select('amount')
          .eq('customer_id', data.id);

        const loyaltyBalance = (!transError && transactions) 
          ? transactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0) 
          : 0;

        setCustomerInfo({
          ...customerInfo,
          userId: data.id, // Store the actual UUID for orders
          customerId: data.customer_id || customerId,
          customerName: data.full_name || 'Customer',
          address: data.address || '',
          contactNumber: data.phone || '',
        });
        setCustomerPointsBalance(loyaltyBalance);
      }
    } catch (err) {
      console.error('[POS] Failed to fetch customer data:', err?.message ?? err);
      alert('Customer not found');
    }
  };

  const searchCustomerByName = async (searchTerm) => {
    if (!supabase || !searchTerm || searchTerm.length < 2) {
      setCustomerSearchResults([]);
      setShowCustomerSearch(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, phone, address, customer_id')
        .eq('role', 'customer')
        .ilike('full_name', `%${searchTerm}%`)
        .limit(10);

      if (error) throw error;

      setCustomerSearchResults(data || []);
      setShowCustomerSearch(data && data.length > 0);
    } catch (err) {
      console.error('[POS] Failed to search customers:', err?.message ?? err);
      setCustomerSearchResults([]);
      setShowCustomerSearch(false);
    }
  };

  const selectCustomer = async (customer) => {
    // Fetch loyalty balance
    const { data: transactions, error: transError } = await supabase
      .from('loyalty_transactions')
      .select('amount')
      .eq('customer_id', customer.id);

    const loyaltyBalance = (!transError && transactions) 
      ? transactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0) 
      : 0;

    setCustomerInfo({
      userId: customer.id, // Store the actual UUID for orders
      customerId: customer.customer_id || '',
      customerName: customer.full_name || 'Customer',
      address: customer.address || '',
      contactNumber: customer.phone || '',
    });
    setCustomerPointsBalance(loyaltyBalance);
    setShowCustomerSearch(false);
    setCustomerSearchResults([]);
  };

  const handleCustomerIdChange = (value) => {
    setCustomerInfo({ ...customerInfo, customerId: value });
    if (value && value.length >= 5) {
      fetchCustomerData(value);
    } else {
      setCustomerInfo({
        customerId: value,
        customerName: 'Walk-in',
        address: '',
        contactNumber: '',
      });
      setCustomerPointsBalance(0);
      setPointsToUse(0);
    }
  };

  const handleCheckout = async () => {
    if (items.length === 0) {
      alert('Please add items to the cart');
      return;
    }

    const subtotal = getTotalPrice();
    const vatAmount = subtotal * VAT_RATE;
    let totalAmount = subtotal + vatAmount + deliveryFee;
    
    // Apply points first if combined payment or points only
    let finalPointsUsed = 0;
    let remainingAmount = totalAmount;
    
    if (combinedPayment || paymentMethod === 'points') {
      finalPointsUsed = Math.min(pointsToUse, customerPointsBalance, totalAmount);
      remainingAmount = totalAmount - finalPointsUsed;
    }

    // Validate payment
    if (paymentMethod === 'cash' || (combinedPayment && paymentMethod === 'cash')) {
      const cashTendered = parseFloat(paymentDetails.cashTendered || 0);
      const change = cashTendered - remainingAmount;
      if (change < 0) {
        alert(`Insufficient cash tendered. Need ₱${remainingAmount.toFixed(2)}, got ₱${cashTendered.toFixed(2)}`);
        return;
      }
    }

    if (paymentMethod === 'gcash' || (combinedPayment && paymentMethod === 'gcash')) {
      if (!paymentDetails.gcashReference) {
        alert('Please enter GCash reference number');
        return;
      }
    }

    if (paymentMethod === 'points' && !combinedPayment) {
      if (pointsToUse > customerPointsBalance) {
        alert('Insufficient points balance');
        return;
      }
      if (pointsToUse < totalAmount) {
        alert('Insufficient points to cover total amount. Use combined payment for points + cash/gcash');
        return;
      }
    }

    if (combinedPayment) {
      if (pointsToUse > customerPointsBalance) {
        alert('Points to use cannot exceed available balance');
        return;
      }
      if (remainingAmount <= 0) {
        alert('Points cover the full amount. No need for combined payment');
        return;
      }
    }

    setCheckoutLoading(true);
    setOrderStatus(null);

    try {
      if (!supabase) throw new Error('Database not available');

      // Determine final payment method string
      let finalPaymentMethod = paymentMethod;
      if (combinedPayment) {
        finalPaymentMethod = `points+${paymentMethod}`;
      }

      const orderData = {
        items: items.map(({ id, name, price, quantity }) => ({
          id,
          name,
          price,
          quantity,
        })),
        order_mode: orderMode,
        customer_name: customerInfo.customerName,
        customer_id: customerInfo.userId || null, // Use UUID, not loyalty card ID
        contact_number: customerInfo.contactNumber || null,
        customer_address: orderMode === 'delivery' ? customerInfo.address : null,
        delivery_address: orderMode === 'delivery' ? customerInfo.address : null,
        delivery_latitude: deliveryCoordinates?.lat || null,
        delivery_longitude: deliveryCoordinates?.lng || null,
        subtotal: subtotal,
        vat_amount: vatAmount,
        delivery_fee: deliveryFee,
        points_used: finalPointsUsed,
        total_amount: totalAmount,
        payment_method: finalPaymentMethod,
        cash_amount: (paymentMethod === 'cash' || combinedPayment) ? parseFloat(paymentDetails.cashTendered || 0) : 0,
        gcash_amount: (paymentMethod === 'gcash' || combinedPayment) ? remainingAmount : 0,
        gcash_reference: (paymentMethod === 'gcash' || combinedPayment) ? paymentDetails.gcashReference : null,
        status: 'order_in_queue',
        created_at: new Date().toISOString(),
      };

      const { data: order, error } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (error) throw error;

      // Insert order_items
      if (order && items.length > 0) {
        const orderItems = items.map(item => {
          // Format item name with variant details if present
          let displayName = item.name;
          if (item.variantDetails) {
            const variantParts = Object.entries(item.variantDetails)
              .map(([type, value]) => value)
              .filter(Boolean);
            if (variantParts.length > 0) {
              displayName = `${item.name} (${variantParts.join(' | ')})`;
            }
          }

          return {
            order_id: order.id,
            menu_item_id: item.id,
            name: displayName,
            price: item.finalPrice || item.price || item.base_price || 0,
            quantity: item.quantity || 1,
            subtotal: (item.finalPrice || item.price || item.base_price || 0) * (item.quantity || 1),
          };
        });

        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(orderItems);

        if (itemsError) {
          console.error('[POS] Failed to insert order items:', itemsError);
        }
      }

      // Deduct loyalty points if used
      if (finalPointsUsed > 0 && customerInfo.userId) {
        await supabase.from('loyalty_transactions').insert({
          customer_id: customerInfo.userId,
          amount: -finalPointsUsed,
          transaction_type: 'redeem',
          description: `Points used for order #${order.order_number || order.id.slice(0, 8)}`,
        });
      }

      // Generate receipt (simple print)
      printReceipt(order, remainingAmount);

      // Clear form
      clearCart();
      setCustomerInfo({
        userId: null,
        customerId: '',
        customerName: 'Walk-in',
        address: '',
        contactNumber: '',
      });
      setPaymentDetails({
        cashTendered: '',
        gcashReference: '',
      });
      setPointsToUse(0);
      setCustomerPointsBalance(0);
      setOrderMode('dine-in');
      setPaymentMethod('cash');
      setCombinedPayment(false);

      setOrderStatus('success');
      setTimeout(() => setOrderStatus(null), 3000);
    } catch (err) {
      console.error('[POS] Checkout failed:', err?.message ?? err);
      setOrderStatus('error');
      alert('Failed to place order: ' + (err?.message || 'Unknown error'));
    } finally {
      setCheckoutLoading(false);
    }
  };

  const printReceipt = (order, paidAmount) => {
    const receiptWindow = window.open('', '_blank', 'width=300,height=600');
    if (!receiptWindow) return;

    const cashTendered = parseFloat(paymentDetails.cashTendered || 0);
    const change = (paymentMethod === 'cash' || combinedPayment) ? cashTendered - paidAmount : 0;

    receiptWindow.document.write(`
      <html>
        <head>
          <title>Receipt - ${order.order_number || order.id.slice(0, 8)}</title>
          <style>
            body { font-family: monospace; font-size: 12px; padding: 20px; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px dashed #000; padding-bottom: 10px; }
            .items { margin: 20px 0; }
            .item { display: flex; justify-content: space-between; margin: 5px 0; }
            .footer { border-top: 2px dashed #000; padding-top: 10px; margin-top: 20px; }
            .total { font-weight: bold; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>Bite Bonansa Cafe</h2>
            <p><strong>Order #${order.order_number || order.id.slice(0, 8)}</strong></p>
            <p>${new Date().toLocaleString()}</p>
            <p>Mode: ${order.order_mode}</p>
            <p>Customer: ${order.customer_name}</p>
          </div>
          <div class="items">
            ${order.items.map(item => `
              <div class="item">
                <span>
                  ${item.name} x${item.quantity}
                  ${item.variantDetails && Object.keys(item.variantDetails).length > 0 
                    ? `<br><small style="padding-left: 10px; color: #666; font-size: 10px;">
                        ${Object.entries(item.variantDetails).map(([type, value]) => 
                          `${type}: ${value}`
                        ).join(', ')}
                      </small>`
                    : ''
                  }
                </span>
                <span>₱${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            `).join('')}
          </div>
          <div class="footer">
            <div class="item"><span>Subtotal:</span><span>₱${order.subtotal.toFixed(2)}</span></div>
            ${order.vat_amount > 0 ? `<div class="item"><span>VAT:</span><span>₱${order.vat_amount.toFixed(2)}</span></div>` : ''}
            ${order.delivery_fee > 0 ? `<div class="item"><span>Delivery Fee:</span><span>₱${order.delivery_fee.toFixed(2)}</span></div>` : ''}
            ${order.points_used > 0 ? `<div class="item"><span>Less: Points:</span><span>-₱${order.points_used.toFixed(2)}</span></div>` : ''}
            <div class="item total"><span>Net Amount:</span><span>₱${order.total_amount.toFixed(2)}</span></div>
            ${paymentMethod === 'cash' ? `
              <div class="item"><span>Cash Tendered:</span><span>₱${cashTendered.toFixed(2)}</span></div>
              <div class="item"><span>Change:</span><span>₱${change.toFixed(2)}</span></div>
            ` : ''}
          </div>
          <div style="text-align: center; margin-top: 20px;">
            <p>Thank you for your order!</p>
          </div>
        </body>
      </html>
    `);

    receiptWindow.document.close();
    setTimeout(() => {
      receiptWindow.print();
    }, 250);
  };

  if (authLoading) {
    return (
      <div style={styles.center}>
        <p style={{ color: '#ffc107' }}>⏳ Loading…</p>
      </div>
    );
  }

  const subtotal = getTotalPrice();
  const vatAmount = subtotal * VAT_RATE;
  const totalBeforePayment = subtotal + vatAmount + deliveryFee;
  const netAmount = totalBeforePayment - pointsToUse;
  const cashTendered = parseFloat(paymentDetails.cashTendered || 0);
  const change = paymentMethod === 'cash' ? cashTendered - netAmount : 0;

  return (
    <>
      <Head>
        <title>POS - Bite Bonansa Cafe</title>
      </Head>
      <div style={styles.page}>
        <header style={styles.header}>
          <h1 style={styles.logo}>☕ Point of Sale</h1>
          <nav style={styles.nav}>
            <Link href="/cashier/dashboard" style={styles.navLink}>Dashboard</Link>
          </nav>
          <button style={styles.logoutBtn} onClick={async () => {
            if (supabase) await supabase.auth.signOut();
            router.replace('/login');
          }}>
            Logout
          </button>
        </header>

        <div style={styles.body}>
          <section style={styles.menuPanel}>
            <h2 style={styles.sectionTitle}>Menu Items</h2>
            {menuLoading && <p style={styles.loadingText}>Loading menu…</p>}
            {!menuLoading && menuItems.length === 0 && <p style={styles.emptyText}>No menu items available</p>}
            
            {!menuLoading && menuItems.length > 0 && (
              <div style={styles.searchContainer}>
                <input
                  type="text"
                  placeholder="🔍 Search items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={styles.searchInput}
                />
              </div>
            )}
            
            {!menuLoading && categories.length > 0 && (
              <div style={styles.categoryTabs}>
                <button
                  style={{
                    ...styles.categoryTab,
                    ...(selectedCategory === 'all' ? styles.categoryTabActive : {})
                  }}
                  onClick={() => setSelectedCategory('all')}
                >
                  All
                </button>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    style={{
                      ...styles.categoryTab,
                      ...(selectedCategory === category.name ? styles.categoryTabActive : {})
                    }}
                    onClick={() => setSelectedCategory(category.name)}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            )}
            
            <div style={styles.menuGrid}>
              {menuItems
                .filter(item => {
                  // Filter by category
                  const categoryMatch = selectedCategory === 'all' || item.category === selectedCategory;
                  // Filter by search term
                  const searchMatch = searchTerm === '' || 
                    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    item.category.toLowerCase().includes(searchTerm.toLowerCase());
                  return categoryMatch && searchMatch;
                })
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((item) => (
                <button
                  key={item.id}
                  style={{
                    ...styles.menuCard,
                    ...(item.is_sold_out ? styles.soldOutCard : {})
                  }}
                  onClick={() => handleAddItem(item)}
                  disabled={item.is_sold_out}
                >
                  <span style={styles.menuItemName}>{item.name}</span>
                  <span style={styles.menuItemCategory}>{item.category}</span>
                  <span style={styles.menuItemPrice}>₱{Number(item.price || item.base_price || 0).toFixed(2)}</span>
                  
                  {/* Badge to indicate item has variants */}
                  {item.has_variants && item.variant_types && item.variant_types.length > 0 && (
                    <span style={styles.variantBadge}>
                      ⚙️ {item.variant_types.length} variant{item.variant_types.length > 1 ? 's' : ''}
                    </span>
                  )}
                  
                  {/* Detailed variant type summary */}
                  {item.has_variants && item.variant_types && item.variant_types.length > 0 && (
                    <div style={styles.variantInfo}>
                      {item.variant_types.map((vt, idx) => {
                        if (!vt.id) {
                          console.warn('[POS] Variant type missing ID:', vt);
                        }
                        // Filter available options once for reuse
                        const availableOptions = vt.options ? vt.options.filter(opt => opt.available !== false) : [];
                        const optionNames = availableOptions.slice(0, MAX_DISPLAYED_OPTIONS).map(opt => opt.option_name);
                        const totalOptions = availableOptions.length;
                        const hasMoreOptions = totalOptions > MAX_DISPLAYED_OPTIONS;
                        return (
                          <div key={vt.id || idx} style={styles.variantType}>
                            <span style={styles.variantTypeName}>
                              {vt.variant_type_name}{vt.is_required ? '*' : ''}:
                            </span>
                            <span style={styles.variantOptions}>
                              {optionNames.join(', ')}
                              {hasMoreOptions && ` +${totalOptions - MAX_DISPLAYED_OPTIONS} more`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {item.is_sold_out && (
                    <span style={styles.soldOutBadge}>SOLD OUT</span>
                  )}
                </button>
              ))}
            </div>
          </section>

          <section style={styles.orderPanel}>
            <h2 style={styles.sectionTitle}>Current Order</h2>

            <div style={styles.formGroup}>
              <label style={styles.label}>Order Mode</label>
              <select style={styles.input} value={orderMode} onChange={(e) => setOrderMode(e.target.value)}>
                <option value="dine-in">🍽️ Dine-in</option>
                <option value="take-out">🥡 Take-out</option>
                <option value="pick-up">📦 Pick-up</option>
                <option value="delivery">🚚 Delivery</option>
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Customer ID</label>
              <input
                style={styles.input}
                type="text"
                placeholder="BBC-XXXXX"
                value={customerInfo.customerId}
                onChange={(e) => handleCustomerIdChange(e.target.value)}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Customer Name 🔍</label>
              <div style={{ position: 'relative' }}>
                <input
                  style={styles.input}
                  type="text"
                  value={customerInfo.customerName}
                  onChange={(e) => {
                    setCustomerInfo({ ...customerInfo, customerName: e.target.value });
                    searchCustomerByName(e.target.value);
                  }}
                  placeholder="Type to search registered customers"
                />
                {showCustomerSearch && customerSearchResults.length > 0 && (
                  <div style={styles.searchDropdown}>
                    {customerSearchResults.map((customer) => (
                      <div
                        key={customer.id}
                        style={styles.searchResultItem}
                        onClick={() => selectCustomer(customer)}
                      >
                        <div style={styles.searchResultName}>{customer.full_name}</div>
                        <div style={styles.searchResultDetails}>
                          ID: {customer.customer_id} | {customer.phone || 'No phone'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Contact Number</label>
              <input
                style={styles.input}
                type="tel"
                placeholder="09XXXXXXXXX"
                value={customerInfo.contactNumber}
                onChange={(e) => setCustomerInfo({ ...customerInfo, contactNumber: e.target.value })}
              />
            </div>

            {orderMode === 'delivery' && (
              <>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Delivery Address *</label>
                  <textarea
                    style={{ ...styles.input, minHeight: '60px' }}
                    placeholder="Enter delivery address"
                    value={customerInfo.address}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, address: e.target.value })}
                    required
                  />
                </div>
                
                <div style={styles.formGroup}>
                  <button
                    type="button"
                    style={styles.mapButton}
                    onClick={() => setShowMapPicker(true)}
                  >
                    📍 {deliveryCoordinates ? 'Update Location on Map' : 'Select Location on Map'}
                  </button>
                  {deliveryCoordinates && (
                    <div style={styles.coordinatesInfo}>
                      <small>
                        📌 Location: {deliveryCoordinates.lat.toFixed(6)}, {deliveryCoordinates.lng.toFixed(6)}
                      </small>
                    </div>
                  )}
                  <div style={styles.deliveryFeeInfo}>
                    <strong>Delivery Fee: ₱{deliveryFee.toFixed(2)}</strong>
                    {deliveryCoordinates && (
                      <small> (Calculated based on distance)</small>
                    )}
                  </div>
                </div>
              </>
            )}

            <div style={styles.formGroup}>
              <label style={styles.label}>Payment Method</label>
              <select style={styles.input} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option value="cash">💰 Cash</option>
                <option value="gcash">📱 GCash</option>
                <option value="points">🎁 Points</option>
              </select>
            </div>

            {/* Combined Payment Option */}
            {customerPointsBalance > 0 && paymentMethod !== 'points' && (
              <div style={styles.formGroup}>
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={combinedPayment}
                    onChange={(e) => setCombinedPayment(e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  Use Points + {paymentMethod === 'cash' ? 'Cash' : 'GCash'}
                </label>
                {combinedPayment && (
                  <div style={{ marginTop: '8px' }}>
                    <label style={styles.label}>Points to Use (Balance: ₱{customerPointsBalance.toFixed(2)})</label>
                    <input
                      style={styles.input}
                      type="number"
                      step="0.01"
                      placeholder="Points to use"
                      value={pointsToUse}
                      onChange={(e) => setPointsToUse(Math.min(parseFloat(e.target.value) || 0, customerPointsBalance))}
                      max={customerPointsBalance}
                    />
                  </div>
                )}
              </div>
            )}

            {paymentMethod === 'cash' && (
              <div style={styles.formGroup}>
                <label style={styles.label}>Cash Tendered *</label>
                <input
                  style={styles.input}
                  type="number"
                  step="0.01"
                  placeholder="Amount received"
                  value={paymentDetails.cashTendered}
                  onChange={(e) => setPaymentDetails({ ...paymentDetails, cashTendered: e.target.value })}
                  required
                />
              </div>
            )}

            {paymentMethod === 'gcash' && (
              <div style={styles.formGroup}>
                <label style={styles.label}>GCash Reference Number *</label>
                <input
                  style={styles.input}
                  type="text"
                  placeholder="Enter GCash reference"
                  value={paymentDetails.gcashReference}
                  onChange={(e) => setPaymentDetails({ ...paymentDetails, gcashReference: e.target.value })}
                  required
                />
              </div>
            )}

            {paymentMethod === 'points' && (
              <div style={styles.formGroup}>
                <label style={styles.label}>Points Balance: ₱{customerPointsBalance.toFixed(2)}</label>
                <input
                  style={styles.input}
                  type="number"
                  step="0.01"
                  placeholder="Points to use"
                  value={pointsToUse}
                  onChange={(e) => setPointsToUse(parseFloat(e.target.value) || 0)}
                  max={Math.min(customerPointsBalance, totalBeforePayment)}
                />
              </div>
            )}

            <div style={styles.cartSection}>
              <h3 style={styles.cartTitle}>Cart Items</h3>
              {items.length === 0 ? (
                <p style={styles.emptyText}>No items added</p>
              ) : (
                <ul style={styles.cartList}>
                  {items.map((item) => {
                    // Format item name with variant details if present
                    let displayName = item.name;
                    if (item.variantDetails) {
                      const variantParts = Object.entries(item.variantDetails)
                        .map(([type, value]) => value)
                        .filter(Boolean);
                      if (variantParts.length > 0) {
                        displayName = `${item.name} (${variantParts.join(' | ')})`;
                      }
                    }
                    
                    // Calculate price correctly using finalPrice if available
                    const itemPrice = item.finalPrice || item.price || item.base_price || 0;
                    const totalItemPrice = itemPrice * item.quantity;
                    const itemKey = item.cartKey || item.id;

                    return (
                      <li key={itemKey} style={styles.cartItem}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                          <span style={styles.cartItemName}>{displayName}</span>
                          <button style={styles.removeBtn} onClick={() => removeItem(itemKey)}>✕</button>
                        </div>
                        <div style={styles.cartControls}>
                          <button style={styles.qtyBtn} onClick={() => updateQuantity(itemKey, item.quantity - 1)}>−</button>
                          <span style={styles.qtyValue}>{item.quantity}</span>
                          <button style={styles.qtyBtn} onClick={() => updateQuantity(itemKey, item.quantity + 1)}>+</button>
                          <span style={styles.cartItemPrice}>₱{totalItemPrice.toFixed(2)}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div style={styles.totalsSection}>
              <div style={styles.totalRow}><span>Subtotal:</span><span>₱{subtotal.toFixed(2)}</span></div>
              <div style={styles.totalRow}><span>VAT (disabled):</span><span>₱{vatAmount.toFixed(2)}</span></div>
              {deliveryFee > 0 && <div style={styles.totalRow}><span>Delivery Fee:</span><span>₱{deliveryFee.toFixed(2)}</span></div>}
              {pointsToUse > 0 && <div style={styles.totalRow}><span>Less: Points:</span><span>-₱{pointsToUse.toFixed(2)}</span></div>}
              <div style={{ ...styles.totalRow, ...styles.netAmountRow }}><span>Net Amount:</span><span>₱{netAmount.toFixed(2)}</span></div>
            </div>

            {paymentMethod === 'cash' && (
              <div style={styles.formGroup}>
                <label style={styles.label}>Cash Tendered *</label>
                <input
                  style={styles.input}
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={paymentDetails.cashTendered}
                  onChange={(e) => setPaymentDetails({ ...paymentDetails, cashTendered: e.target.value })}
                  required
                />
                <div style={styles.changeDisplay}>
                  Change: ₱{change >= 0 ? change.toFixed(2) : '0.00'}
                  {change < 0 && <span style={styles.errorText}> (Insufficient)</span>}
                </div>
              </div>
            )}

            {orderStatus === 'success' && <p style={styles.successMsg}>✅ Order placed successfully!</p>}
            {orderStatus === 'error' && <p style={styles.errorMsg}>❌ Failed to place order</p>}

            <div style={styles.cartActions}>
              <button style={styles.clearBtn} onClick={clearCart} disabled={items.length === 0}>Clear</button>
              <button
                style={{ ...styles.checkoutBtn, opacity: items.length === 0 || checkoutLoading ? 0.6 : 1 }}
                onClick={handleCheckout}
                disabled={items.length === 0 || checkoutLoading}
              >
                {checkoutLoading ? '⏳ Processing…' : '✔ Checkout'}
              </button>
            </div>
          </section>
        </div>

        {/* Variant Selection Modal */}
        {showVariantModal && selectedItem && (
          <VariantSelectionModal
            item={selectedItem}
            onConfirm={handleVariantConfirm}
            onCancel={() => {
              setShowVariantModal(false);
              setSelectedItem(null);
            }}
          />
        )}
        
        {/* OpenStreetMap Picker Modal */}
        {showMapPicker && (
          <div style={styles.modalOverlay}>
            <div style={styles.mapModalContent}>
              <div style={styles.mapModalHeader}>
                <h3 style={styles.mapModalTitle}>Select Delivery Location</h3>
                <button
                  style={styles.mapCloseButton}
                  onClick={() => setShowMapPicker(false)}
                >
                  ✕
                </button>
              </div>
              <OpenStreetMapPicker
                onLocationSelect={(lat, lng, address) => {
                  setDeliveryCoordinates({ lat, lng });
                  if (address) {
                    setCustomerInfo({ ...customerInfo, address });
                  }
                  setShowMapPicker(false);
                }}
                initialPosition={deliveryCoordinates}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

const styles = {
  page: { minHeight: '100vh', background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)', fontFamily: "'Poppins', sans-serif", color: '#fff' },
  center: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px', backgroundColor: '#1a1a1a', borderBottom: '1px solid #ffc107', gap: '24px' },
  logo: { fontSize: '22px', fontFamily: "'Playfair Display', serif", color: '#ffc107', margin: 0, whiteSpace: 'nowrap' },
  nav: { display: 'flex', gap: '16px', flex: 1, justifyContent: 'center' },
  navLink: { color: '#ccc', textDecoration: 'none', fontSize: '14px', padding: '8px 12px', borderRadius: '6px' },
  logoutBtn: { padding: '8px 18px', backgroundColor: 'transparent', color: '#ffc107', border: '1px solid #ffc107', borderRadius: '6px', fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap' },
  body: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', padding: '32px', maxWidth: '1400px', margin: '0 auto' },
  menuPanel: { minWidth: 0 },
  orderPanel: { backgroundColor: '#1a1a1a', border: '1px solid #ffc107', borderRadius: '12px', padding: '24px', maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' },
  sectionTitle: { fontSize: '18px', fontFamily: "'Playfair Display', serif", color: '#ffc107', marginTop: 0, marginBottom: '16px' },
  loadingText: { color: '#aaa', fontSize: '14px' },
  emptyText: { color: '#aaa', fontSize: '14px' },
  menuGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' },
  menuCard: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '16px', backgroundColor: '#1a1a1a', border: '1px solid #ffc107', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s', color: '#fff', textAlign: 'left' },
  soldOutCard: { opacity: 0.5, backgroundColor: '#2a2a2a', border: '1px solid #666', cursor: 'not-allowed' },
  menuItemName: { fontSize: '14px', fontWeight: '600', color: '#fff', marginBottom: '4px' },
  menuItemCategory: { fontSize: '11px', color: '#888', marginBottom: '8px' },
  menuItemPrice: { fontSize: '15px', fontWeight: '700', color: '#ffc107' },
  variantBadge: { fontSize: '10px', color: '#ffc107', marginTop: '4px', backgroundColor: 'rgba(255, 193, 7, 0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255, 193, 7, 0.3)' },
  soldOutBadge: { fontSize: '10px', color: '#fff', marginTop: '4px', backgroundColor: '#d32f2f', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' },
  formGroup: { marginBottom: '16px' },
  label: { display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '6px' },
  input: { width: '100%', padding: '8px 12px', border: '1px solid #444', borderRadius: '6px', backgroundColor: '#2a2a2a', color: '#fff', fontSize: '13px', boxSizing: 'border-box', outline: 'none' },
  cartSection: { marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #2a2a2a' },
  cartTitle: { fontSize: '14px', color: '#ffc107', margin: '0 0 12px 0' },
  cartList: { listStyle: 'none', padding: 0, margin: '0 0 16px 0', maxHeight: '300px', overflowY: 'auto' },
  cartItem: { display: 'flex', flexDirection: 'column', padding: '12px 0', borderBottom: '1px solid #2a2a2a', gap: '8px' },
  cartItemName: { fontSize: '13px', color: '#fff', flex: 1, minWidth: 0, wordWrap: 'break-word', whiteSpace: 'normal' },
  cartControls: { display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 },
  qtyBtn: { width: '24px', height: '24px', backgroundColor: '#2a2a2a', color: '#ffc107', border: '1px solid #444', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: 0 },
  qtyValue: { fontSize: '13px', color: '#fff', minWidth: '20px', textAlign: 'center' },
  cartItemPrice: { fontSize: '13px', color: '#ffc107', minWidth: '52px', textAlign: 'right' },
  removeBtn: { background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '12px', padding: '2px 4px' },
  totalsSection: { marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #2a2a2a' },
  totalRow: { display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#ccc', marginBottom: '6px' },
  netAmountRow: { fontSize: '16px', fontWeight: '700', color: '#ffc107', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #ffc107' },
  changeDisplay: { marginTop: '8px', fontSize: '14px', color: '#4caf50', fontWeight: '600' },
  errorText: { color: '#f44336' },
  successMsg: { color: '#4caf50', fontSize: '13px', marginTop: '12px' },
  errorMsg: { color: '#f44336', fontSize: '13px', marginTop: '12px' },
  cartActions: { display: 'flex', gap: '10px', marginTop: '16px' },
  clearBtn: { flex: 1, padding: '10px', backgroundColor: 'transparent', color: '#ccc', border: '1px solid #555', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' },
  checkoutBtn: { flex: 2, padding: '10px', backgroundColor: '#ffc107', color: '#0a0a0a', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' },
  searchDropdown: { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#2a2a2a', border: '1px solid #ffc107', borderRadius: '6px', marginTop: '4px', maxHeight: '200px', overflowY: 'auto', zIndex: 1000 },
  searchResultItem: { padding: '12px', cursor: 'pointer', borderBottom: '1px solid #3a3a3a', transition: 'background 0.2s' },
  searchResultName: { fontSize: '14px', color: '#fff', fontWeight: '600', marginBottom: '4px' },
  searchResultDetails: { fontSize: '11px', color: '#888' },
  checkboxLabel: { display: 'flex', alignItems: 'center', fontSize: '13px', color: '#ffc107', cursor: 'pointer', padding: '8px', backgroundColor: 'rgba(255, 193, 7, 0.1)', borderRadius: '6px', border: '1px solid rgba(255, 193, 7, 0.3)' },
  categoryTabs: { display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' },
  categoryTab: { padding: '8px 16px', backgroundColor: '#2a2a2a', color: '#aaa', border: '1px solid #444', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s' },
  categoryTabActive: { backgroundColor: '#ffc107', color: '#0a0a0a', border: '1px solid #ffc107', fontWeight: '600' },
  searchContainer: { marginBottom: '16px' },
  searchInput: { width: '100%', padding: '10px 12px', border: '1px solid #444', borderRadius: '6px', backgroundColor: '#2a2a2a', color: '#fff', fontSize: '14px', boxSizing: 'border-box', outline: 'none', transition: 'border-color 0.2s' },
  variantInfo: { marginTop: '8px', width: '100%' },
  variantType: { fontSize: '10px', color: '#888', marginBottom: '2px' },
  variantTypeName: { fontWeight: '600', marginRight: '4px' },
  variantOptions: { color: '#aaa' },
  mapButton: { width: '100%', padding: '10px', backgroundColor: '#ffc107', color: '#0a0a0a', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' },
  coordinatesInfo: { marginTop: '8px', color: '#888', fontSize: '11px' },
  deliveryFeeInfo: { marginTop: '8px', padding: '8px', backgroundColor: 'rgba(255, 193, 7, 0.1)', borderRadius: '6px', border: '1px solid rgba(255, 193, 7, 0.3)', color: '#ffc107', fontSize: '13px' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 },
  mapModalContent: { backgroundColor: '#1a1a1a', borderRadius: '12px', width: '90%', maxWidth: '900px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', border: '2px solid #ffc107' },
  mapModalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #ffc107' },
  mapModalTitle: { fontSize: '18px', fontFamily: "'Playfair Display', serif", color: '#ffc107', margin: 0 },
  mapCloseButton: { padding: '8px 12px', backgroundColor: 'transparent', color: '#fff', border: '1px solid #666', borderRadius: '6px', fontSize: '16px', cursor: 'pointer', transition: 'all 0.2s' },
};
