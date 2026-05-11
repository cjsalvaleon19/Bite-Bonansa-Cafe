import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../../utils/supabaseClient';
import { useRoleGuard } from '../../utils/useRoleGuard';
import NotificationBell from '../../components/NotificationBell';
import { calculateSalesBreakdown, calculateAdjustmentDeductions, UNACCEPTED_ORDER_STATUSES } from '../../utils/salesCalculations';
import { printToBluetoothPrinter } from '../../utils/bluetoothPrinter';
import { buildKitchenDepartmentOrders, formatOrderModeLabel, formatOrderSlipItemDetails, getOrderItems, getOrderSlipNumber } from '../../utils/receiptDepartments';

export default function EndOfDayReport() {
  const router = useRouter();
  const { loading: authLoading } = useRoleGuard('cashier');
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [salesAdjustments, setSalesAdjustments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const refreshTimerRef = useRef(null);

  useEffect(() => {
    if (!authLoading) {
      fetchUser();
      fetchOrders();
      fetchAdjustments();

      // Auto-refresh when orders change (e.g. receipt printed from POS).
      // Debounce rapid events to avoid excessive refetches.
      const subscription = supabase
        ?.channel('eod_orders_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
          clearTimeout(refreshTimerRef.current);
          refreshTimerRef.current = setTimeout(() => fetchOrders(), 500);
        })
        .subscribe();

      return () => {
        clearTimeout(refreshTimerRef.current);
        subscription?.unsubscribe();
      };
    }
  }, [authLoading, selectedDate]);

  const fetchUser = async () => {
    if (!supabase) return;
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUser(authUser);
    } catch (err) {
      console.error('[EODReport] Failed to fetch user:', err?.message ?? err);
    }
  };

  const fetchAdjustments = async () => {
    if (!supabase) return;
    try {
      const startDate = new Date(selectedDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(selectedDate);
      endDate.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('cash_drawer_transactions')
        .select('amount, adjustment_reason, payment_adjustment_type')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .eq('transaction_type', 'adjustment');

      if (error) throw error;

      setSalesAdjustments(data || []);
    } catch (err) {
      console.error('[EODReport] Failed to fetch adjustments:', err?.message ?? err);
    }
  };

  const fetchOrders = async () => {
    if (!supabase) return;

    try {
      const startDate = new Date(selectedDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(selectedDate);
      endDate.setHours(23, 59, 59, 999);

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
            variant_details,
            kitchen_department
          ),
          users:customer_id (
            customer_id,
            phone
          )
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .not('status', 'in', `(${UNACCEPTED_ORDER_STATUSES.join(',')})`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setOrders(data || []);
    } catch (err) {
      console.error('[EODReport] Failed to fetch orders:', err?.message ?? err);
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewReceipt = (order) => {
    // Create a modal-like preview window
    const previewWindow = window.open('', '_blank');
    if (!previewWindow) return;

    const orderItems = getOrderItems(order);
    const qrImageUrl = `${window.location.origin}/qr-code.png`;
    
    // Calculate values based on the new flow
    const subtotal = order.subtotal || 0;
    const deliveryFee = order.delivery_fee || 0;
    const total = subtotal + deliveryFee;
    const pointsClaimed = order.points_used || 0;
    const netAmount = total - pointsClaimed;
    const amountTendered = order.cash_amount || 0;
    const change = Math.max(0, amountTendered - netAmount);
    
    // Get customer loyalty ID
    const customerLoyaltyId = order.users && order.users.customer_id ? order.users.customer_id : 'N/A';
    
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

    const previewPhone = (order.users && order.users.phone) || order.customer_phone || order.contact_number || '';

    previewWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Receipt Preview - #${order.order_number || order.id.slice(0, 8)}</title>
          <style>
            body { font-family: monospace; font-size: 12px; padding: 20px; background: #f5f5f5; }
            .receipt { max-width: 300px; margin: 0 auto; background: white; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px dashed #000; padding-bottom: 10px; }
            .items { margin: 20px 0; }
            .item { display: flex; justify-content: space-between; margin: 5px 0; }
            .footer { border-top: 2px dashed #000; padding-top: 10px; margin-top: 20px; }
            .total { font-weight: bold; font-size: 14px; }
            .actions { text-align: center; margin-top: 20px; padding: 20px; background: #f9f9f9; }
            .btn { padding: 10px 20px; margin: 5px; cursor: pointer; font-size: 14px; border: none; border-radius: 4px; }
            .print-btn { background: #ffc107; color: #000; font-weight: bold; }
            .close-btn { background: #ccc; color: #000; }
            .variant-details { padding-left: 10px; color: #666; font-size: 10px; }
            .section-title { font-weight: bold; margin: 10px 0 5px 0; }
            table { width: 100%; }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="header">
              <h2>Bite Bonansa Cafe</h2>
              <p>Laconon-Salacafe Rd, Brgy. Poblacion, T'boli, South Cotabato</p>
              <p>Tel: 0907-200-8247</p>
              <p style="margin-top: 10px; font-weight: bold;">SALES INVOICE</p>
            </div>
            
            <div style="margin-bottom: 15px;">
              <p>Order#: ${order.order_number || order.id.slice(0, 8)}</p>
              <p>Date  : ${new Date(order.created_at).toLocaleString()}</p>
              <p>Type  : ${order.order_mode || 'N/A'}</p>
              <p>Name  : ${order.customer_name || 'Walk-in'}</p>
              ${previewPhone ? `<p>Phone : ${previewPhone}</p>` : ''}
              ${customerLoyaltyId !== 'N/A' ? `<p><strong>Customer ID:</strong> ${customerLoyaltyId}</p>` : ''}
              ${order.delivery_address && order.order_mode === 'delivery' ? `<p><strong>Delivery Address:</strong> ${order.delivery_address}</p>` : ''}
            </div>
            
            <p class="section-title">ITEMS ORDERED</p>
            <div class="items">
              ${orderItems.map(item => {
                // Strip variant details from name (for legacy data)
                const displayName = item.name.replace(/\s*\([^)]*\)\s*$/, '').trim();
                const variants = item.variant_details;
                const hasVariants = variants && typeof variants === 'object' && Object.keys(variants).length > 0;
                
                return `
                <div class="item" style="margin-bottom: 10px;">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
                    <span>${displayName} x${item.quantity}</span>
                    <span>₱${((item.price || 0) * (item.quantity || 1)).toFixed(2)}</span>
                  </div>
                  ${hasVariants 
                    ? `<div class="variant-details">
                        (Add Ons: ${Object.entries(variants).map(([type, value]) => `${value}`).join(', ')})
                      </div>`
                    : ''
                  }
                </div>
              `}).join('')}
            </div>
            
            <div class="footer">
              <table>
                <tr>
                  <td><strong>Subtotal:</strong></td>
                  <td style="text-align: right;">₱${subtotal.toFixed(2)}</td>
                </tr>
                ${order.order_mode === 'delivery' ? `
                <tr>
                  <td><strong>Delivery Fee:</strong></td>
                  <td style="text-align: right;">₱${deliveryFee.toFixed(2)}</td>
                </tr>
                ` : ''}
                <tr class="total">
                  <td style="padding-top: 5px; border-top: 2px solid #000;"><strong>Total:</strong></td>
                  <td style="text-align: right; padding-top: 5px; border-top: 2px solid #000;">₱${total.toFixed(2)}</td>
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
                ${amountTendered > 0 ? `
                <tr>
                  <td><strong>Cash Tendered:</strong></td>
                  <td style="text-align: right;">₱${amountTendered.toFixed(2)}</td>
                </tr>
                <tr>
                  <td><strong>Change:</strong></td>
                  <td style="text-align: right;">₱${change.toFixed(2)}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding-top: 8px; border-top: 1px dashed #000;"><strong>Payment:</strong></td>
                  <td style="text-align: right; padding-top: 8px; border-top: 1px dashed #000;">${displayPaymentMethod}</td>
                </tr>
              </table>
            </div>
            
            ${(() => {
              // Extract only customer order notes from special_request
              // Remove GCash reference number and proof URL
              let orderNotes = order.special_instructions || order.special_request || '';
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
              <div style="margin-top: 12px;">
                <img src="${qrImageUrl}" alt="Scan to order online" style="width: 90px; height: 90px;" />
                <p style="margin: 4px 0; font-size: 11px; font-weight: bold; letter-spacing: 0.5px;">Scan to Order Online</p>
                <p style="margin: 2px 0; font-size: 11px; color: #333;">bitebonansacafe.com</p>
                <p style="margin: 4px 0; font-size: 12px; font-weight: bold;">Slip#: ${getOrderSlipNumber(order)}</p>
              </div>
            </div>
          </div>
          <div class="actions">
            <button class="btn print-btn" onclick="window.print()">🖨️ Print Receipt</button>
            <button class="btn close-btn" onclick="window.close()">Close</button>
          </div>
        </body>
      </html>
    `);

    previewWindow.document.close();
  };

  const printOrderSlip = (order, departmentName = '') => {
    const slipWindow = window.open('', '_blank');
    if (!slipWindow) return;

    const orderItems = getOrderItems(order);
    const modeLabel = formatOrderModeLabel(order.order_mode);

    slipWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Order Slip #${getOrderSlipNumber(order)}</title>
          <script>window.addEventListener('load', function() { setTimeout(function() { window.print(); }, 300); });</script>
          <style>
            @page { size: 80mm auto; margin: 0 0 1cm 0; }
            body { font-family: monospace; font-size: 10.5px; line-height: 1.3; padding: 20px 20px 0; margin: 0; }
            .section { margin: 12px 0; }
            table { width: 100%; border-collapse: collapse; }
            @media print { button { display: none; } }
          </style>
        </head>
        <body>
          <div class="section" style="text-align: center;">
            <p style="font-size: 15px; font-weight: bold;">ORDER SLIP</p>
            ${departmentName ? `<p style="font-size: 18px; font-weight: bold;">${departmentName}</p>` : ''}
          </div>
          <div class="section">
            <p style="font-size: 20px; font-weight: bold;">OS #${getOrderSlipNumber(order)}</p>
            <p style="font-size: 20px; font-weight: bold;">${modeLabel}</p>
          </div>
          <div class="section">
            <table>
              <thead>
                <tr>
                  <th style="text-align: left; padding: 4px 0; border-bottom: 2px solid #000;">Item</th>
                  <th style="text-align: right; padding: 4px 0; border-bottom: 2px solid #000;">Qty</th>
                </tr>
              </thead>
              <tbody>
                ${orderItems.map((item) => {
                  const { mainLine, subvariantLines } = formatOrderSlipItemDetails(item);
                  const subvariantHtml = subvariantLines
                    .map((line) => `<div style="font-size: 20px; padding-top: 2px; padding-left: 10px;">${line}</div>`)
                    .join('');
                  return `
                    <tr>
                      <td style="padding: 4px 0;">
                        <div style="font-size: 20px;">${mainLine}</div>
                        ${subvariantHtml}
                      </td>
                      <td style="padding: 4px 0; font-size: 21px; text-align: right;">${item.quantity || 1}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
          <div style="text-align: center; margin-top: 20px;">
            <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px; cursor: pointer; background: #ffc107; border: none; border-radius: 4px;">
              🖨️ Print Slip
            </button>
            <button onclick="window.close()" style="padding: 10px 20px; font-size: 16px; cursor: pointer; margin-left: 10px; background: #666; color: white; border: none; border-radius: 4px;">
              Close
            </button>
          </div>
        </body>
      </html>
    `);

    slipWindow.document.close();
  };

  const printKitchenOrderSlips = async (order) => {
    const kitchenOrders = buildKitchenDepartmentOrders(order);
    for (let i = 0; i < kitchenOrders.length; i++) {
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      printOrderSlip(kitchenOrders[i].order, kitchenOrders[i].name);
    }
  };

  const handlePrintReceipt = async (order) => {
    // Create a simple receipt print window
    const receiptWindow = window.open('', '_blank');
    if (!receiptWindow) return;

    const orderItems = getOrderItems(order);
    const qrImageUrl = `${window.location.origin}/qr-code.png`;
    
    // Calculate values based on the new flow
    const subtotal = order.subtotal || 0;
    const deliveryFee = order.delivery_fee || 0;
    const total = subtotal + deliveryFee;
    const pointsClaimed = order.points_used || 0;
    const netAmount = total - pointsClaimed;
    const amountTendered = order.cash_amount || 0;
    const change = Math.max(0, amountTendered - netAmount);
    
    // Get customer loyalty ID
    const customerLoyaltyId = order.users && order.users.customer_id ? order.users.customer_id : 'N/A';
    
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

    const receiptPhone = (order.users && order.users.phone) || order.customer_phone || order.contact_number || '';

    receiptWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Receipt #${order.order_number || order.id.slice(0, 8)}</title>
          <script>window.addEventListener('load', function() { setTimeout(function() { window.print(); }, 300); });</script>
          <style>
            @page { size: 80mm auto; margin: 0 0 1cm 0; }
            body { font-family: monospace; font-size: 12px; padding: 20px 20px 0; margin: 0; word-break: break-word; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px dashed #000; padding-bottom: 10px; }
            .items { margin: 20px 0; }
            .item { display: flex; justify-content: space-between; margin: 5px 0; }
            .footer { border-top: 2px dashed #000; padding-top: 10px; margin-top: 20px; }
            .total { font-weight: bold; font-size: 14px; }
            .variant-details { padding-left: 10px; color: #666; font-size: 10px; }
            .section-title { font-weight: bold; margin: 10px 0 5px 0; }
            table { width: 100%; }
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
            <p>Date  : ${new Date(order.created_at).toLocaleString()}</p>
            <p>Type  : ${order.order_mode || 'N/A'}</p>
            <p>Name  : ${order.customer_name || 'Walk-in'}</p>
            ${receiptPhone ? `<p>Phone : ${receiptPhone}</p>` : ''}
            ${customerLoyaltyId !== 'N/A' ? `<p><strong>Customer ID:</strong> ${customerLoyaltyId}</p>` : ''}
            ${order.delivery_address && order.order_mode === 'delivery' ? `<p><strong>Delivery Address:</strong> ${order.delivery_address}</p>` : ''}
          </div>
          
          <p class="section-title">ITEMS ORDERED</p>
          <div class="items">
            ${orderItems.map(item => {
              // Strip variant details from name (for legacy data)
              const displayName = item.name.replace(/\s*\([^)]*\)\s*$/, '').trim();
              const variants = (() => {
                if (item.variant_details && typeof item.variant_details === 'object') return item.variant_details;
                if (item.variantDetails && typeof item.variantDetails === 'object') return item.variantDetails;
                if (typeof item.variant_details === 'string') {
                  try { return JSON.parse(item.variant_details); } catch { return null; }
                }
                if (typeof item.variantDetails === 'string') {
                  try { return JSON.parse(item.variantDetails); } catch { return null; }
                }
                return null;
              })();
              const hasVariants = variants && typeof variants === 'object' && Object.keys(variants).length > 0;
              
              return `
              <div class="item" style="margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
                  <span>${displayName} x${item.quantity}</span>
                  <span>₱${((item.price || 0) * (item.quantity || 1)).toFixed(2)}</span>
                </div>
                ${hasVariants 
                  ? `<div class="variant-details">
                      (Add Ons: ${Object.entries(variants).map(([type, value]) => `${value}`).join(', ')})
                    </div>`
                  : ''
                }
              </div>
            `}).join('')}
          </div>
          
          <div class="footer">
            <table>
              <tr>
                <td><strong>Subtotal:</strong></td>
                <td style="text-align: right;">₱${subtotal.toFixed(2)}</td>
              </tr>
              ${order.order_mode === 'delivery' ? `
              <tr>
                <td><strong>Delivery Fee:</strong></td>
                <td style="text-align: right;">₱${deliveryFee.toFixed(2)}</td>
              </tr>
              ` : ''}
              <tr class="total">
                <td style="padding-top: 5px; border-top: 2px solid #000;"><strong>Total:</strong></td>
                <td style="text-align: right; padding-top: 5px; border-top: 2px solid #000;">₱${total.toFixed(2)}</td>
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
              ${amountTendered > 0 ? `
              <tr>
                <td><strong>Cash Tendered:</strong></td>
                <td style="text-align: right;">₱${amountTendered.toFixed(2)}</td>
              </tr>
              <tr>
                <td><strong>Change:</strong></td>
                <td style="text-align: right;">₱${change.toFixed(2)}</td>
              </tr>
              ` : ''}
              <tr>
                <td style="padding-top: 8px; border-top: 1px dashed #000;"><strong>Payment:</strong></td>
                <td style="text-align: right; padding-top: 8px; border-top: 1px dashed #000;">${displayPaymentMethod}</td>
              </tr>
            </table>
          </div>
          
          ${(() => {
            // Extract only customer order notes from special_request
            // Remove GCash reference number and proof URL
            let orderNotes = order.special_instructions || order.special_request || '';
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
            <div style="margin-top: 12px;">
              <img src="${qrImageUrl}" alt="Scan to order online" style="width: 90px; height: 90px;" />
              <p style="margin: 4px 0; font-size: 11px; font-weight: bold; letter-spacing: 0.5px;">Scan to Order Online</p>
              <p style="margin: 2px 0; font-size: 11px; color: #333;">bitebonansacafe.com</p>
              <p style="margin: 4px 0; font-size: 12px; font-weight: bold;">Slip#: ${getOrderSlipNumber(order)}</p>
            </div>
          </div>
        </body>
      </html>
    `);

    receiptWindow.document.close();

    await printKitchenOrderSlips(order);
  };

  const handleBtPrintReceipt = async (order) => {
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
      await printToBluetoothPrinter(order, 'sales', {
        customerLoyaltyId: order.users?.customer_id || null,
        displayPaymentMethod,
        omitFooterMeta: true,
      });
      for (const group of buildKitchenDepartmentOrders(order)) {
        await printToBluetoothPrinter(group.order, 'kitchen', {
          departmentName: group.name,
        });
      }
    } catch (err) {
      alert('Bluetooth print failed: ' + (err.message || 'Unknown error'));
    }
  };

  // Use utility function for sales calculations
  const { totalSales: baseTotalSales, cashSales: totalCash, gcashSales: totalGcash, pointsSales: totalPoints } = calculateSalesBreakdown(orders);
  const totalSales = baseTotalSales - calculateAdjustmentDeductions(salesAdjustments);

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
        <title>End of Day Report - Bite Bonansa Cafe</title>
        <meta name="description" content="Daily sales report and receipts" />
      </Head>
      <div style={styles.page}>
        <header style={styles.header}>
          <h1 style={styles.logo}>☕ Bite Bonansa Cafe</h1>
          <nav style={styles.nav}>
            <Link href="/cashier/dashboard" style={styles.navLink}>Dashboard</Link>
            <Link href="/cashier/pos" style={styles.navLink}>POS</Link>
            <Link href="/cashier/orders-queue" style={styles.navLink}>Order Queue</Link>
            <Link href="/cashier/eod-report" style={styles.navLinkActive}>EOD Report</Link>
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
          <h2 style={styles.title}>📊 End of Day Report</h2>

          {/* Date Selector */}
          <div style={styles.dateSelector}>
            <label style={styles.dateLabel}>Select Date:</label>
            <input
              type="date"
              style={styles.dateInput}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>

          {/* Summary Cards */}
          <div style={styles.summaryGrid}>
            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Total Sales</div>
              <div style={styles.summaryValue}>₱{totalSales.toFixed(2)}</div>
            </div>
            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Cash Sales</div>
              <div style={styles.summaryValue}>₱{totalCash.toFixed(2)}</div>
            </div>
            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>GCash Sales</div>
              <div style={styles.summaryValue}>₱{totalGcash.toFixed(2)}</div>
            </div>
            <div style={styles.summaryCard}>
              <div style={styles.summaryLabel}>Points Redeemed</div>
              <div style={styles.summaryValue}>₱{totalPoints.toFixed(2)}</div>
            </div>
          </div>

          {/* Orders Table */}
          {orders.length === 0 ? (
            <div style={styles.emptyState}>
              <p style={styles.emptyIcon}>📭</p>
              <p style={styles.emptyText}>No orders for this date</p>
            </div>
          ) : (
            <div style={styles.tableContainer}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeader}>
                    <th style={styles.th}>Receipt #</th>
                    <th style={styles.th}>Date & Time</th>
                    <th style={styles.th}>Customer</th>
                    <th style={styles.th}>Mode</th>
                    <th style={styles.th}>Payment</th>
                    <th style={styles.th}>Subtotal</th>
                    <th style={styles.th}>Delivery Fee</th>
                    <th style={styles.th}>Points</th>
                    <th style={styles.th}>Total</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} style={styles.tableRow}>
                      <td style={styles.td}>
                        <strong>#{order.order_number || order.id.slice(0, 8)}</strong>
                      </td>
                      <td style={styles.td}>
                        {new Date(order.created_at).toLocaleString()}
                      </td>
                      <td style={styles.td}>
                        <div style={styles.customerCell}>
                          <div>{order.customer_name || 'Walk-in'}</div>
                          <div style={styles.customerIdText}>
                            {order.customer_id ? `ID: ${order.customer_id}` : ''}
                          </div>
                        </div>
                      </td>
                      <td style={styles.td}>
                        {order.order_mode || 'N/A'}
                      </td>
                      <td style={styles.td}>
                        {order.payment_method || 'N/A'}
                      </td>
                      <td style={styles.td}>
                        ₱{parseFloat(order.subtotal || 0).toFixed(2)}
                      </td>
                      <td style={styles.td}>
                        ₱{parseFloat(order.delivery_fee || 0).toFixed(2)}
                      </td>
                      <td style={styles.td}>
                        ₱{parseFloat(order.points_used || 0).toFixed(2)}
                      </td>
                      <td style={styles.td}>
                        <strong>₱{parseFloat(order.total_amount || 0).toFixed(2)}</strong>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.actionButtons}>
                          <button
                            style={styles.previewBtn}
                            onClick={() => handlePreviewReceipt(order)}
                          >
                            👁️
                          </button>
                          <button
                            style={styles.printBtn}
                            onClick={() => handleBtPrintReceipt(order)}
                          >
                            🖨️
                          </button>
                          <button
                            style={styles.btPrintBtn}
                            onClick={() => handleBtPrintReceipt(order)}
                            title="Print to Goojprt Z80C via Bluetooth"
                          >
                            📶
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
    maxWidth: '1400px',
    margin: '0 auto',
  },
  title: {
    fontSize: '32px',
    fontFamily: "'Playfair Display', serif",
    color: '#ffc107',
    marginBottom: '32px',
    textAlign: 'center',
  },
  dateSelector: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    marginBottom: '32px',
  },
  dateLabel: {
    fontSize: '14px',
    color: '#ccc',
  },
  dateInput: {
    padding: '8px 12px',
    backgroundColor: '#2a2a2a',
    color: '#fff',
    border: '1px solid #ffc107',
    borderRadius: '6px',
    fontSize: '14px',
    outline: 'none',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '20px',
    marginBottom: '40px',
  },
  summaryCard: {
    backgroundColor: '#1a1a1a',
    border: '1px solid #ffc107',
    borderRadius: '12px',
    padding: '20px',
    textAlign: 'center',
  },
  summaryLabel: {
    fontSize: '14px',
    color: '#ccc',
    marginBottom: '8px',
  },
  summaryValue: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#ffc107',
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
  tableContainer: {
    backgroundColor: '#1a1a1a',
    border: '1px solid #ffc107',
    borderRadius: '12px',
    padding: '20px',
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  tableHeader: {
    borderBottom: '2px solid #ffc107',
  },
  th: {
    padding: '12px',
    textAlign: 'left',
    fontSize: '12px',
    color: '#ffc107',
    fontWeight: '600',
    whiteSpace: 'nowrap',
  },
  tableRow: {
    borderBottom: '1px solid #2a2a2a',
  },
  td: {
    padding: '12px',
    fontSize: '13px',
    color: '#ccc',
    whiteSpace: 'nowrap',
  },
  printBtn: {
    padding: '6px 12px',
    backgroundColor: '#ffc107',
    color: '#0a0a0a',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: '600',
  },
  customerCell: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  customerIdText: {
    fontSize: '10px',
    color: '#888',
  },
  actionButtons: {
    display: 'flex',
    gap: '4px',
  },
  previewBtn: {
    padding: '6px 10px',
    backgroundColor: '#2196f3',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: '600',
  },
  btPrintBtn: {
    padding: '6px 10px',
    backgroundColor: 'transparent',
    color: '#4fc3f7',
    border: '1px solid #4fc3f7',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: '600',
  },
};
