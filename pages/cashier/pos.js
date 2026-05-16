import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../../utils/supabaseClient';
import useCartStore from '../../store/useCartStore';
import { useRoleGuard } from '../../utils/useRoleGuard';
import VariantSelectionModal from '../../components/VariantSelectionModal';
import NotificationBell from '../../components/NotificationBell';
import { connectPrinter, printToBluetoothPrinter } from '../../utils/bluetoothPrinter';
import { buildKitchenDepartmentOrders, getOrderItems, getOrderSlipNumber } from '../../utils/receiptDepartments';
import { addSalaryDeductionToPayroll, getPayrollEmployees, PAYROLL_STORAGE_KEY, roundToCurrency, toDateOnly } from '../../utils/payrollStorage';
import {
  DELIVERY_LOCATION_OPTIONS,
  formatDeliveryLocationAddress,
  formatDeliveryLocationLabel,
  getDeliveryLocationById,
} from '../../utils/deliveryLocations';
import { parseSettingAsBoolean } from '../../utils/cashierSettings';

const VAT_RATE = 0; // Currently disabled as per requirements

export default function CashierPOS() {
  const router = useRouter();
  const { loading: authLoading } = useRoleGuard('cashier');
  const [user, setUser] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [menuLoading, setMenuLoading] = useState(false);
  const [orderStatus, setOrderStatus] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null); // For variant selection
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [editingCartKey, setEditingCartKey] = useState(null);
  const [focusedCartItemKey, setFocusedCartItemKey] = useState(null);
  
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
  const [payrollEmployees, setPayrollEmployees] = useState([]);
  const [salaryDeductionEmployeeId, setSalaryDeductionEmployeeId] = useState('');
  const [pointsToUse, setPointsToUse] = useState(0);
  const [customerPointsBalance, setCustomerPointsBalance] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [selectedDeliveryLocationId, setSelectedDeliveryLocationId] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState([]);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [combinedPayment, setCombinedPayment] = useState(false); // For points + cash/gcash
  const [lastPrintedOrder, setLastPrintedOrder] = useState(null); // For BT re-print
  const [showChangeAmountPopup, setShowChangeAmountPopup] = useState(false);
  const [changeAmountToPrepare, setChangeAmountToPrepare] = useState(0);
  const [deliveryEnabled, setDeliveryEnabled] = useState(true);

  const { items, addItem, replaceItem, removeItem, updateQuantity, clearCart, getTotalPrice } =
    useCartStore();

  useEffect(() => {
    if (!authLoading) fetchMenu();
  }, [authLoading]);

  useEffect(() => {
    const fetchUser = async () => {
      if (!supabase) return;
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        setUser(authUser);
      } catch (err) {
        console.error('[POS] Failed to fetch user:', err?.message ?? err);
      }
    };
    if (!authLoading) fetchUser();
  }, [authLoading]);

  useEffect(() => {
    if (orderMode === 'delivery') {
      const selectedLocation = getDeliveryLocationById(selectedDeliveryLocationId);
      setDeliveryFee(selectedLocation ? selectedLocation.fee : 0);
    } else {
      setDeliveryFee(0);
      setSelectedDeliveryLocationId('');
    }
  }, [orderMode, selectedDeliveryLocationId]);

  useEffect(() => {
    const refreshPayrollEmployees = () => {
      setPayrollEmployees(getPayrollEmployees());
    };
    refreshPayrollEmployees();
    if (typeof window === 'undefined') return undefined;
    const onStorage = (event) => {
      if (event.key === PAYROLL_STORAGE_KEY) refreshPayrollEmployees();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (paymentMethod === 'salary_deduction') {
      setCombinedPayment(false);
      setPointsToUse(0);
      return;
    }
    setSalaryDeductionEmployeeId('');
  }, [paymentMethod]);

  // ── Delivery-enabled realtime sync ──────────────────────────────────────────
  const syncDeliveryEnabledSetting = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('cashier_settings')
        .select('setting_value')
        .eq('setting_key', 'delivery_enabled')
        .maybeSingle();
      if (error) throw error;
      setDeliveryEnabled(parseSettingAsBoolean(data?.setting_value, true));
    } catch (err) {
      console.error('[POS] Failed to fetch delivery setting:', err?.message ?? err);
    }
  }, []);

  // Fetch on mount and subscribe for realtime changes
  useEffect(() => {
    void syncDeliveryEnabledSetting();

    if (!supabase) return;
    const channel = supabase
      .channel('pos_delivery_setting_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cashier_settings',
          filter: 'setting_key=eq.delivery_enabled',
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            void syncDeliveryEnabledSetting();
            return;
          }
          const nextValue = payload.new?.setting_value;
          if (typeof nextValue === 'undefined') {
            void syncDeliveryEnabledSetting();
            return;
          }
          setDeliveryEnabled(parseSettingAsBoolean(nextValue, true));
        }
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [syncDeliveryEnabledSetting]);

  // Auto-switch away from delivery if it gets disabled
  useEffect(() => {
    if (!deliveryEnabled && orderMode === 'delivery') {
      setOrderMode('dine-in');
    }
  }, [deliveryEnabled, orderMode]);
  // ────────────────────────────────────────────────────────────────────────────

  const fetchMenu = useCallback(async () => {
    if (!supabase) return;
    setMenuLoading(true);
    try {
      // Fetch menu items with variants
      let { data: menuData, error: menuError } = await supabase
        .from('menu_items')
        .select(`
          id,
          name,
          price,
          base_price,
          category,
          available,
          has_variants,
          is_sold_out,
          kitchen_departments:kitchen_department_id (
            department_name,
            department_code
          )
        `)
        .eq('available', true)
        .order('category');

      // Fallback query for deployments where embedded kitchen_departments relation
      // is unavailable/misconfigured in PostgREST.
      if (menuError) {
        console.warn('[POS] Embedded kitchen department fetch failed, retrying without embed:', menuError);
        const fallback = await supabase
          .from('menu_items')
          .select('id, name, price, base_price, category, available, has_variants, is_sold_out')
          .eq('available', true)
          .order('category');
        menuData = fallback.data;
        menuError = fallback.error;
      }

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
    if (editingCartKey) {
      replaceItem(editingCartKey, itemWithVariants);
      setEditingCartKey(null);
    } else {
      addItem(itemWithVariants);
    }
    setShowVariantModal(false);
    setSelectedItem(null);
  };

  const handleEditCartItem = (item, itemKey) => {
    if (!item.variant_types || item.variant_types.length === 0) return;
    setSelectedItem(item);
    setEditingCartKey(itemKey);
    setShowVariantModal(true);
  };

  const formatVariantSummary = (variantDetails) => {
    if (!variantDetails || typeof variantDetails !== 'object') return '';
    const entries = Object.entries(variantDetails).filter(([, value]) => value);
    if (entries.length === 0) return '';
    return entries.map(([type, value]) => `${type}: ${value}`).join(' • ');
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

  const selectedPayrollEmployee = payrollEmployees.find((employee) => employee.id === salaryDeductionEmployeeId);
  const salaryDeductionMissingMatch = paymentMethod === 'salary_deduction' && !selectedPayrollEmployee;
  const selectedDeliveryLocation = getDeliveryLocationById(selectedDeliveryLocationId);
  const isDeliveryLocationMissing = orderMode === 'delivery' && !selectedDeliveryLocation;
  const isDeliveryStreetMissing = orderMode === 'delivery' && !customerInfo.address.trim();
  const isCheckoutDisabled =
    items.length === 0 ||
    checkoutLoading ||
    salaryDeductionMissingMatch ||
    isDeliveryLocationMissing ||
    isDeliveryStreetMissing;

  const handleCheckout = async () => {
    if (items.length === 0) {
      alert('Please add items to the cart');
      return;
    }
    if (orderMode === 'delivery' && !selectedDeliveryLocation) {
      alert('Please select the delivery barangay before checking out.');
      return;
    }
    if (orderMode === 'delivery' && !customerInfo.address.trim()) {
      alert('Please enter street and landmark before checking out.');
      return;
    }
    if (paymentMethod === 'salary_deduction' && !selectedPayrollEmployee) {
      alert('Please select an employee to proceed with salary deduction checkout.');
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

    const changeAmountForPopup = (paymentMethod === 'cash' || (combinedPayment && paymentMethod === 'cash'))
      ? Math.max(0, parseFloat(paymentDetails.cashTendered || 0) - remainingAmount)
      : 0;

    const printerWarmup = connectPrinter().catch((err) => {
      console.warn('[POS] Bluetooth pre-connect skipped:', err?.message ?? err);
      return null;
    });

    setCheckoutLoading(true);
    setOrderStatus(null);

    try {
      if (!supabase) throw new Error('Database not available');

      // Determine final payment method string
      let finalPaymentMethod = paymentMethod;
      if (combinedPayment) {
        finalPaymentMethod = `points+${paymentMethod}`;
      }

      const formattedDeliveryAddress = selectedDeliveryLocation
        ? [customerInfo.address?.trim(), formatDeliveryLocationAddress(selectedDeliveryLocation)]
            .filter(Boolean)
            .join(', ')
        : null;

      const orderData = {
        items: items.map((item) => ({
          id: item.id,
          name: item.name,
          price: item.finalPrice || item.price || item.base_price || 0,
          quantity: item.quantity,
          variantDetails: item.variantDetails || null,
          category: item.category || null,
          kitchen_department: item.kitchen_departments || null,
        })),
        order_mode: orderMode,
        customer_name: customerInfo.customerName,
        customer_id: customerInfo.userId || null, // Use UUID, not loyalty card ID
        contact_number: customerInfo.contactNumber || null,
        customer_phone: customerInfo.contactNumber || null, // Duplicate for rider interface compatibility
        customer_address: orderMode === 'delivery' ? formattedDeliveryAddress : null,
        customer_latitude: null,
        customer_longitude: null,
        delivery_address: orderMode === 'delivery' ? formattedDeliveryAddress : null,
        delivery_latitude: null,
        delivery_longitude: null,
        subtotal: subtotal,
        vat_amount: vatAmount,
        delivery_fee: deliveryFee,
        points_used: finalPointsUsed,
        total_amount: totalAmount,
        payment_method: finalPaymentMethod,
        cash_amount: (paymentMethod === 'cash' || combinedPayment) ? parseFloat(paymentDetails.cashTendered || 0) : 0,
        gcash_amount: (paymentMethod === 'gcash' || combinedPayment) ? remainingAmount : 0,
        gcash_reference: (paymentMethod === 'gcash' || combinedPayment) ? paymentDetails.gcashReference : null,
        accepted_at: new Date().toISOString(),
        cashier_id: user?.id || null,
        status: 'order_in_queue',
        created_at: new Date().toISOString(),
      };

      const { data: order, error } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (error) throw error;

      if (paymentMethod === 'salary_deduction') {
        const deductionAmount = roundToCurrency(remainingAmount);
        const transactionDate = toDateOnly(new Date());
        const deductionResult = addSalaryDeductionToPayroll({
          employeeId: selectedPayrollEmployee.id,
          amount: deductionAmount,
          date: transactionDate,
          orderId: order.id,
          notes: `Order #${order.order_number || order.id.slice(0, 8)}`,
        });
        if (!deductionResult.ok) {
          throw new Error('Failed to record salary deduction. Please refresh and try again.');
        }

        const { error: journalError } = await supabase.from('journal_entries').insert({
          date: transactionDate,
          description: `Salary Deduction: Order #${order.order_number || order.id.slice(0, 8)}`,
          debit_account: 'Advances to Employees',
          credit_account: 'Revenue',
          amount: deductionAmount,
          reference_id: order.id,
          reference_type: 'salary_deduction',
          name: selectedPayrollEmployee.name,
          reference: order.order_number || null,
        });
        if (journalError) {
          throw new Error(`Salary deduction journal entry failed: ${journalError.message}`);
        }
      }

      // Insert order_items
      if (order && items.length > 0) {
        const orderItems = items.map(item => {
          // Format item name with variant details if present
          return {
            order_id: order.id,
            menu_item_id: item.id,
            name: item.name,
            price: item.finalPrice || item.price || item.base_price || 0,
            quantity: item.quantity || 1,
            subtotal: (item.finalPrice || item.price || item.base_price || 0) * (item.quantity || 1),
            variant_details: item.variantDetails || null,
            kitchen_department: item.kitchen_departments?.department_name || null,
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

      // Auto Bluetooth print on checkout click (non-blocking on failure)
      await printerWarmup;
      await printPOSReceiptBluetooth(order, { silent: true });

      // Save for optional BT re-print
      setLastPrintedOrder(order);

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
      setSelectedDeliveryLocationId('');
      setPaymentMethod('cash');
      setCombinedPayment(false);
      setSalaryDeductionEmployeeId('');

      setOrderStatus('success');
      setChangeAmountToPrepare(changeAmountForPopup);
      setShowChangeAmountPopup(true);
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
    const receiptWindow = window.open('', '_blank');
    if (!receiptWindow) return;
    const receiptItems = getOrderItems(order);

    // Helper function to strip variant details from item name (for legacy data)
    const stripVariantsFromName = (name) => {
      // Remove anything in parentheses at the end of the name (e.g., "Americano (12oz Hot | Extra Shot)" -> "Americano")
      return name.replace(/\s*\([^)]*\)\s*$/, '').trim();
    };

    const cashTendered = parseFloat(order.cash_amount ?? paymentDetails.cashTendered ?? 0);
    
    // Calculate values based on the new flow
    const subtotal = order.subtotal || 0;
    const deliveryFee = order.delivery_fee || 0;
    const total = subtotal + deliveryFee;
    const pointsClaimed = order.points_used || 0;
    const netAmount = total - pointsClaimed;
    const amountTendered = (paymentMethod === 'cash' || combinedPayment) ? cashTendered : 0;
    const change = Math.max(0, amountTendered - netAmount);
    
    // Get customer loyalty ID from state (available in component closure)
    // This is the BBC-XXXXX format ID, not the UUID
    const customerLoyaltyId = customerInfo?.customerId || 'N/A';
    
    // Determine display payment method based on points usage
    let displayPaymentMethod = order.payment_method || 'N/A';
    if (pointsClaimed > 0) {
      if (pointsClaimed >= total) {
        // Fully paid by points
        displayPaymentMethod = 'Points';
      } else {
        // Partial payment with points - show the secondary payment method
        // Extract secondary method from payment_method field (e.g., "points+cash" -> "cash")
        if (order.payment_method && order.payment_method.includes('points+')) {
          displayPaymentMethod = order.payment_method.split('points+')[1];
        } else if (order.payment_method && order.payment_method.includes('+')) {
          // Handle other formats like "cash+points" -> extract non-points part
          const parts = order.payment_method.split('+');
          displayPaymentMethod = parts.find(p => p !== 'points') || order.payment_method;
        }
      }
    }

    const customerName = order.customer_name || 'Walk-in';
    const customerPhone = order.customer_phone || order.contact_number || 'N/A';
    const orderType = order.order_mode || 'N/A';
    const receiptDate = new Date(order.created_at || Date.now()).toLocaleString();
    const qrImageUrl = `${window.location.origin}/qr-code.png`;

    const normalizeVariants = (rawVariants) => {
      if (!rawVariants) return null;
      if (typeof rawVariants === 'object') return rawVariants;
      if (typeof rawVariants === 'string') {
        try {
          const parsed = JSON.parse(rawVariants);
          return parsed && typeof parsed === 'object' ? parsed : null;
        } catch {
          return null;
        }
      }
      return null;
    };

    receiptWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Receipt - ${order.order_number || order.id.slice(0, 8)}</title>
          <script>window.addEventListener('load', function() { setTimeout(function() { window.print(); }, 300); });</script>
          <style>
            @page { size: 80mm auto; margin: 0 0 1cm 0; }
            body { font-family: monospace; font-size: 12px; padding: 0 12px; margin: 0 auto; word-break: break-word; }
            @media print { button { display: none; } }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px dashed #000; padding-bottom: 10px; }
            .items { margin: 20px 0; }
            .item-line { display: grid; grid-template-columns: 1fr auto; column-gap: 8px; align-items: start; }
            .item-name { word-break: break-word; }
            .item-price { white-space: nowrap; text-align: right; }
            .variant-details { font-size: 10px; color: #666; margin-top: 2px; }
            .footer { border-top: 2px dashed #000; padding-top: 10px; margin-top: 20px; }
            .total { font-weight: bold; font-size: 14px; }
            table { width: 100%; }
            .section-title { font-weight: bold; margin: 10px 0 5px 0; text-decoration: underline; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>Bite Bonansa Cafe</h2>
            <p>Laconon-Salacafe Rd, Brgy. Poblacion, T'boli, South Cotabato</p>
            <p>Tel: 0907-200-8247</p>
            <p style="margin-top: 10px; font-weight: bold;">SALES INVOICE</p>
          </div>
          
          <div style="margin-bottom: 15px;">
            <p>Order#: ${order.order_number || order.id.slice(0, 8)}</p>
            <p>Date  : ${receiptDate}</p>
            <p>Type  : ${orderType}</p>
            <p>Name  : ${customerName}</p>
            ${customerPhone && customerPhone !== 'N/A' ? `<p>Phone : ${customerPhone}</p>` : ''}
            ${customerLoyaltyId !== 'N/A' ? `<p><strong>Customer ID:</strong> ${customerLoyaltyId}</p>` : ''}
            ${order.order_mode === 'delivery' && order.delivery_address ? `<p><strong>Street and Landmark:</strong> ${order.delivery_address}</p>` : ''}
          </div>
          
          <p class="section-title">ITEMS ORDERED</p>
          <div class="items">
            ${!receiptItems || receiptItems.length === 0 ? `
              <div style="margin-bottom: 10px;">
                <div class="item-line">
                  <span class="item-name">No items found</span>
                  <span class="item-price">₱0.00</span>
                </div>
              </div>
            ` : receiptItems.map(item => {
              const displayName = stripVariantsFromName(item.name);
              const variants = normalizeVariants(item.variantDetails || item.variant_details);
              const hasVariants = variants && Object.keys(variants).length > 0;
              
              return `
              <div style="margin-bottom: 10px;">
                <div class="item-line">
                  <span class="item-name">${displayName} x${item.quantity}</span>
                  <span class="item-price">₱${((item.price || 0) * (item.quantity || 1)).toFixed(2)}</span>
                </div>
                ${hasVariants
                  ? `<div class="variant-details">
                      (Add Ons: ${Object.entries(variants).map(([type, value]) => 
                        `${value}`
                      ).join(', ')})
                    </div>`
                  : ''
                }
              </div>
            `}).join('')}
          </div>
          
          <div class="footer">
            <table>
              <tr class="total">
                <td style="padding-top: 5px; border-top: 2px solid #000;"><strong>Subtotal:</strong></td>
                <td style="text-align: right; padding-top: 5px; border-top: 2px solid #000;">₱${subtotal.toFixed(2)}</td>
              </tr>
              ${(order.order_mode === 'delivery' || deliveryFee > 0) ? `
              <tr>
                <td><strong>Delivery Fee:</strong></td>
                <td style="text-align: right;">₱${deliveryFee.toFixed(2)}</td>
              </tr>
              ` : ''}
              <tr class="total">
                <td><strong>Total:</strong></td>
                <td style="text-align: right;">₱${total.toFixed(2)}</td>
              </tr>
              ${pointsClaimed > 0 ? `
              <tr>
                <td><strong>Points Claimed:</strong></td>
                <td style="text-align: right;">-₱${pointsClaimed.toFixed(2)}</td>
              </tr>
              ` : ''}
              <tr class="total">
                <td style="padding-top: 5px; border-top: 1px solid #000;"><strong>Net Amount:</strong></td>
                <td style="text-align: right; padding-top: 5px; border-top: 1px solid #000;">₱${netAmount.toFixed(2)}</td>
              </tr>
              <tr>
                <td><strong>Cash Tendered:</strong></td>
                <td style="text-align: right;">₱${amountTendered.toFixed(2)}</td>
              </tr>
              <tr>
                <td><strong>Change:</strong></td>
                <td style="text-align: right;">₱${change.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding-top: 8px; border-top: 1px dashed #000;"><strong>Payment:</strong></td>
                <td style="text-align: right; padding-top: 8px; border-top: 1px dashed #000;">${displayPaymentMethod}</td>
              </tr>
            </table>
          </div>
          
          ${(() => {
            // Extract only customer order notes from special_request
            // Remove GCash reference number and proof URL
            let orderNotes = order.special_request || '';
            if (orderNotes) {
              // Split by | delimiter and take only the first part (customer notes)
              orderNotes = orderNotes.split('|')[0].trim();
            }
            
            return orderNotes ? `
            <div style="margin-top: 15px;">
              <p class="section-title">SPECIAL INSTRUCTIONS</p>
              <p style="font-size: 11px;">${orderNotes}</p>
            </div>
            ` : '';
          })()}
          
          <div style="text-align: center; margin-top: 20px;">
            <p>Thank you for your order, Biter!</p>
            <p style="margin: 6px 0; font-size: 20px; font-weight: bold; letter-spacing: 1px;">Order Slip ${getOrderSlipNumber(order)}</p>
            <div style="margin-top: 12px;">
              <img src="${qrImageUrl}" alt="Scan to order online" style="width: 90px; height: 90px;" />
              <p style="margin: 4px 0; font-size: 11px; font-weight: bold; letter-spacing: 0.5px;">Scan to Order Online</p>
              <p style="margin: 2px 0; font-size: 11px; color: #333;">bitebonansacafe.com</p>
            </div>
          </div>
          <div style="text-align: center; margin-top: 20px;">
            <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px; cursor: pointer; background: #ffc107; border: none; border-radius: 4px;">
              🖨️ Print Receipt
            </button>
            <button onclick="window.close()" style="padding: 10px 20px; font-size: 16px; cursor: pointer; margin-left: 10px; background: #666; color: white; border: none; border-radius: 4px;">
              Close
            </button>
          </div>
        </body>
      </html>
    `);

    receiptWindow.document.close();
  };

  const printPOSReceiptBluetooth = async (order, options = {}) => {
    const { silent = false } = options;
    if (!order) {
      if (!silent) {
        alert('No completed order available to print.');
      }
      return;
    }
    let displayPaymentMethod = order.payment_method || 'N/A';
    const ptsClaimed = order.points_used || 0;
    const total = (order.subtotal || 0) + (order.delivery_fee || 0);
    if (ptsClaimed > 0) {
      if (ptsClaimed >= total) {
        displayPaymentMethod = 'Points';
      } else if (order.payment_method && order.payment_method.includes('points+')) {
        displayPaymentMethod = order.payment_method.split('points+')[1];
      } else if (order.payment_method && order.payment_method.includes('+')) {
        const parts = order.payment_method.split('+');
        displayPaymentMethod = parts.find(p => p !== 'points') || order.payment_method;
      }
    }
    try {
      const printerOptions = {
        cashierName: user?.full_name || user?.email || 'Cashier',
        customerLoyaltyId: customerInfo?.customerId || null,
        displayPaymentMethod,
      };
      await printToBluetoothPrinter(order, 'sales', printerOptions);
      for (const group of buildKitchenDepartmentOrders(order)) {
        await printToBluetoothPrinter(group.order, 'kitchen', {
          ...printerOptions,
          departmentName: group.name,
        });
      }
    } catch (err) {
      if (!silent) {
        alert('Bluetooth print failed: ' + (err.message || 'Unknown error'));
      } else {
        console.warn('[POS] Auto Bluetooth print failed:', err?.message ?? err);
      }
    }
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
  const handleNotificationClick = (notification) => {
    if (notification?.type === 'new_online_order') {
      router.push('/cashier/dashboard?tab=pending');
    }
  };

  return (
    <>
      <Head>
        <title>POS - Bite Bonansa Cafe</title>
      </Head>
      <div style={styles.page}>
        <header style={styles.header}>
          <h1 style={styles.logo}>☕ Bite Bonansa Cafe</h1>
          <nav style={styles.nav}>
            <Link href="/cashier/dashboard" style={styles.navLink}>Dashboard</Link>
            <Link href="/cashier/pos" style={styles.navLinkActive}>POS</Link>
            <Link href="/cashier/orders-queue" style={styles.navLink}>Order Queue</Link>
            <Link href="/cashier/eod-report" style={styles.navLink}>EOD Report</Link>
            <Link href="/cashier/settings" style={styles.navLink}>Settings</Link>
            <Link href="/cashier/profile" style={styles.navLink}>Profile</Link>
          </nav>
          <div style={styles.headerActions}>
            {user && <NotificationBell user={user} onNotificationClick={handleNotificationClick} />}
            <button style={styles.logoutBtn} onClick={async () => {
              if (supabase) await supabase.auth.signOut();
              router.replace('/login');
            }}>
              Logout
            </button>
          </div>
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
                <option value="delivery" disabled={!deliveryEnabled}>🚚 Delivery{!deliveryEnabled ? ' (Disabled)' : ''}</option>
              </select>
              {!deliveryEnabled && (
                <p style={{ marginTop: '6px', fontSize: '12px', color: '#ff9800' }}>
                  ⚠️ Delivery is currently disabled in Settings.
                </p>
              )}
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
                  <label style={styles.label}>Street and Landmark *</label>
                  <textarea
                    style={{ ...styles.input, minHeight: '60px' }}
                    placeholder="Enter street and landmark"
                    value={customerInfo.address}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, address: e.target.value })}
                    required
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Barangay *</label>
                  <select
                    style={styles.input}
                    value={selectedDeliveryLocationId}
                    onChange={(e) => setSelectedDeliveryLocationId(e.target.value)}
                    required
                  >
                    <option value="">Select barangay and landmark</option>
                    {DELIVERY_LOCATION_OPTIONS.map((location) => (
                      <option key={location.id} value={location.id}>
                        {formatDeliveryLocationLabel(location)}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div style={styles.formGroup}>
              <label style={styles.label}>Payment Method</label>
              <select style={styles.input} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option value="cash">💰 Cash</option>
                <option value="gcash">📱 GCash</option>
                <option value="points">🎁 Points</option>
                <option value="salary_deduction">🧾 Salary Deduction</option>
              </select>
            </div>

            {paymentMethod === 'salary_deduction' && (
              <div style={styles.formGroup}>
                <label style={styles.label}>Employee Name (Attendance Sheet match required)</label>
                <select
                  style={styles.input}
                  value={salaryDeductionEmployeeId}
                  onChange={(e) => setSalaryDeductionEmployeeId(e.target.value)}
                >
                  <option value="">Select employee</option>
                  {payrollEmployees.map((employee) => (
                    <option key={employee.id} value={employee.id}>{employee.name}</option>
                  ))}
                </select>
                {salaryDeductionMissingMatch && (
                  <p style={{ ...styles.errorText, marginTop: '6px' }}>
                    Checkout cannot proceed without a matching employee in Attendance Sheet.
                  </p>
                )}
              </div>
            )}

            {/* Combined Payment Option */}
            {customerPointsBalance > 0 && paymentMethod !== 'points' && paymentMethod !== 'salary_deduction' && (
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
                    // Calculate price correctly using finalPrice if available
                    const itemPrice = item.finalPrice || item.price || item.base_price || 0;
                    const totalItemPrice = itemPrice * item.quantity;
                    const itemKey = item.cartKey || item.id;
                    const variantSummary = formatVariantSummary(item.variantDetails);
                    const canEditVariants = item.variant_types && item.variant_types.length > 0;

                    return (
                      <li key={itemKey} style={styles.cartItem}>
                        <div style={styles.cartItemHeader}>
                          <button
                            type="button"
                            style={{
                              ...styles.cartItemNameBtn,
                              ...(!canEditVariants && styles.cartItemNameBtnDisabled),
                              ...(focusedCartItemKey === itemKey && styles.cartItemNameBtnFocused)
                            }}
                            disabled={!canEditVariants}
                            onClick={() => handleEditCartItem(item, itemKey)}
                            onFocus={() => setFocusedCartItemKey(itemKey)}
                            onBlur={() => setFocusedCartItemKey(null)}
                          >
                            <span style={styles.cartItemName}>{item.name}</span>
                            {variantSummary && (
                              <span style={styles.cartItemVariant}>{variantSummary}</span>
                            )}
                          </button>
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

            {orderStatus === 'success' && (
              <div style={{ marginTop: '12px' }}>
                <p style={styles.successMsg}>✅ Order placed successfully!</p>
                {lastPrintedOrder && (
                  <button
                    style={styles.btPrintBtn}
                    onClick={() => printPOSReceiptBluetooth(lastPrintedOrder)}
                  >
                    📶 BT Print Receipt
                  </button>
                )}
              </div>
            )}
            {orderStatus === 'error' && <p style={styles.errorMsg}>❌ Failed to place order</p>}

            <div style={styles.cartActions}>
              <button style={styles.clearBtn} onClick={clearCart} disabled={items.length === 0}>Clear</button>
              <button
                style={{ ...styles.checkoutBtn, opacity: isCheckoutDisabled ? 0.6 : 1 }}
                onClick={handleCheckout}
                disabled={isCheckoutDisabled}
              >
                {checkoutLoading ? '⏳ Processing…' : '✔ Checkout'}
              </button>
            </div>
          </section>
        </div>

        {showChangeAmountPopup && (
          <div style={styles.changeAmountOverlay} onClick={() => setShowChangeAmountPopup(false)}>
            <div style={styles.changeAmountPopup}>
              <p style={styles.changeAmountTitle}>Change Amount</p>
              <p style={styles.changeAmountValue}>₱{changeAmountToPrepare.toFixed(2)}</p>
              <p style={styles.changeAmountHint}>Tap anywhere to close</p>
            </div>
          </div>
        )}

        {/* Variant Selection Modal */}
        {showVariantModal && selectedItem && (
            <VariantSelectionModal
              item={selectedItem}
              onConfirm={handleVariantConfirm}
              initialSelectedVariants={editingCartKey ? selectedItem.selectedVariants : null}
              initialQuantity={editingCartKey ? selectedItem.quantity : 1}
              confirmLabel={editingCartKey ? 'Update Item' : 'Add to Cart'}
              onCancel={() => {
                setShowVariantModal(false);
                setSelectedItem(null);
                setEditingCartKey(null);
              }}
            />
          )}
      </div>
    </>
  );
}

const styles = {
  page: { minHeight: '100vh', background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)', fontFamily: "'Poppins', sans-serif", color: '#fff' },
  center: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)' },
  header: { position: 'sticky', top: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px', backgroundColor: '#1a1a1a', borderBottom: '1px solid #ffc107', gap: '24px' },
  logo: { fontSize: '22px', fontFamily: "'Playfair Display', serif", color: '#ffc107', margin: 0, whiteSpace: 'nowrap' },
  nav: { display: 'flex', gap: '16px', flex: 1, justifyContent: 'center' },
  navLink: { color: '#ccc', textDecoration: 'none', fontSize: '14px', padding: '8px 12px', borderRadius: '6px', transition: 'all 0.2s' },
  navLinkActive: { color: '#ffc107', textDecoration: 'none', fontSize: '14px', padding: '8px 12px', borderRadius: '6px', backgroundColor: 'rgba(255, 193, 7, 0.1)', border: '1px solid #ffc107' },
  headerActions: { display: 'flex', alignItems: 'center', gap: '12px' },
  logoutBtn: { padding: '8px 18px', backgroundColor: 'transparent', color: '#ffc107', border: '1px solid #ffc107', borderRadius: '6px', fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: "'Poppins', sans-serif" },
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
  cartItemHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', gap: '8px' },
  cartItemNameBtn: { background: 'none', border: '1px solid transparent', borderRadius: '6px', padding: '2px 4px', margin: 0, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: 0, transition: 'border-color 0.2s, background-color 0.2s', cursor: 'pointer' },
  cartItemNameBtnDisabled: { opacity: 0.85, cursor: 'default' },
  cartItemNameBtnFocused: { borderColor: '#ffc107', backgroundColor: 'rgba(255, 193, 7, 0.08)' },
  cartItemName: { fontSize: '13px', color: '#fff', flex: 1, minWidth: 0, wordWrap: 'break-word', whiteSpace: 'normal' },
  cartItemVariant: { fontSize: '11px', color: '#aaa', wordWrap: 'break-word', whiteSpace: 'normal' },
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
  btPrintBtn: { marginTop: '8px', width: '100%', padding: '8px', backgroundColor: 'transparent', color: '#4fc3f7', border: '1px solid #4fc3f7', borderRadius: '6px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' },
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
  mapContainer: {
    width: '100%',
    height: 'auto',
    overflow: 'visible',
    border: 'none',
    marginTop: '8px',
  },
  changeAmountOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
    padding: '16px',
  },
  changeAmountPopup: {
    width: '100%',
    maxWidth: '320px',
    backgroundColor: '#1a1a1a',
    border: '1px solid #ffc107',
    borderRadius: '12px',
    padding: '20px',
    textAlign: 'center',
  },
  changeAmountTitle: {
    margin: 0,
    color: '#ccc',
    fontSize: '13px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  changeAmountValue: {
    margin: '10px 0 0 0',
    color: '#ffc107',
    fontSize: '36px',
    fontWeight: '700',
    lineHeight: 1.1,
  },
  changeAmountHint: {
    margin: '10px 0 0 0',
    color: '#888',
    fontSize: '12px',
  },
};
