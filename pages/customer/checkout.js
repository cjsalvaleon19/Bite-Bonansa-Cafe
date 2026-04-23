import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Script from 'next/script';
import { supabase } from '../../utils/supabaseClient';

// Store coordinates - Bite Bonansa Cafe
const STORE_LOCATION = {
  lat: 6.2178483,
  lng: 124.8221226
};

// Delivery fee constants
const BASE_DELIVERY_FEE = 30.00;

export default function Checkout() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState('');
  
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const autocompleteRef = useRef(null);
  const searchInputRef = useRef(null);
  
  const [formData, setFormData] = useState({
    deliveryAddress: '',
    contactNumber: '',
    paymentMethod: 'cash',
    gcashReference: '',
    specialRequest: '',
    latitude: null,
    longitude: null
  });

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
          .select('role, full_name, phone, address')
          .eq('id', session.user.id)
          .maybeSingle();

        if (!mounted) return;

        if (userError) {
          console.error('[Checkout] Failed to fetch user data:', userError.message);
          setLoading(false);
          return;
        }

        const role = userData?.role || 'customer';

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

        // Pre-fill form with user data
        setFormData(prev => ({
          ...prev,
          deliveryAddress: userData?.address || '',
          contactNumber: userData?.phone || ''
        }));

        // Load cart from localStorage
        const savedCart = localStorage.getItem('cart');
        if (savedCart) {
          try {
            const parsedCart = JSON.parse(savedCart);
            setCart(parsedCart);
          } catch (err) {
            console.error('Failed to parse saved cart:', err);
            // Clear corrupted cart data
            localStorage.removeItem('cart');
            setError('Your saved cart data was corrupted and has been cleared. Please add items again.');
            // Redirect to order portal after brief delay
            setTimeout(() => {
              router.replace('/customer/order-portal').catch(console.error);
            }, 3000);
            return;
          }
        } else {
          // No cart items, redirect to order portal
          router.replace('/customer/order-portal').catch(console.error);
          return;
        }

        setLoading(false);
      } catch (err) {
        console.error('[Checkout] Session check failed:', err?.message ?? err);
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

  const calculateSubtotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const calculateVAT = (subtotal) => {
    return 0; // VAT disabled as per requirements
  };

  // Calculate delivery fee estimate (will be accurate when coordinates are selected)
  const calculateDeliveryFee = () => {
    if (!formData.latitude || !formData.longitude) {
      return 'Select location';
    }
    
    // Calculate distance using Haversine formula
    const R = 6371; // Earth's radius in km
    const dLat = (formData.latitude - STORE_LOCATION.lat) * Math.PI / 180;
    const dLng = (formData.longitude - STORE_LOCATION.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(STORE_LOCATION.lat * Math.PI / 180) * Math.cos(formData.latitude * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distanceKm = R * c;
    const distanceMeters = Math.round(distanceKm * 1000);

    // Calculate fee based on distance tiers
    let additionalFee = 0.00;

    if (distanceMeters <= 1000) {
      additionalFee = 0;
    } else if (distanceMeters <= 1500) {
      additionalFee = 5.00;
    } else if (distanceMeters <= 2000) {
      additionalFee = 10.00;
    } else if (distanceMeters <= 2500) {
      additionalFee = 15.00;
    } else if (distanceMeters <= 3000) {
      additionalFee = 20.00;
    } else if (distanceMeters <= 3500) {
      additionalFee = 24.00;
    } else if (distanceMeters <= 4000) {
      additionalFee = 28.00;
    } else if (distanceMeters <= 4500) {
      additionalFee = 32.00;
    } else if (distanceMeters <= 5000) {
      additionalFee = 36.00;
    } else if (distanceMeters <= 5500) {
      additionalFee = 40.00;
    } else if (distanceMeters <= 6000) {
      additionalFee = 44.00;
    } else if (distanceMeters <= 6500) {
      additionalFee = 47.00;
    } else if (distanceMeters <= 7000) {
      additionalFee = 50.00;
    } else if (distanceMeters <= 7500) {
      additionalFee = 53.00;
    } else if (distanceMeters <= 8000) {
      additionalFee = 56.00;
    } else if (distanceMeters <= 8500) {
      additionalFee = 59.00;
    } else if (distanceMeters <= 9000) {
      additionalFee = 62.00;
    } else if (distanceMeters <= 9500) {
      additionalFee = 65.00;
    } else {
      additionalFee = 68.00; // Capped
    }

    return BASE_DELIVERY_FEE + additionalFee;
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const vat = calculateVAT(subtotal);
    const deliveryFee = calculateDeliveryFee();
    
    if (typeof deliveryFee === 'string') {
      return subtotal + vat; // Don't include delivery if not calculated
    }
    
    return subtotal + vat + deliveryFee;
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  // Initialize Google Maps
  const initializeMap = () => {
    if (!mapRef.current || !window.google) {
      setMapError('Google Maps failed to load. Please check your API key configuration.');
      return;
    }

    try {
    const center = formData.latitude && formData.longitude 
      ? { lat: formData.latitude, lng: formData.longitude }
      : STORE_LOCATION;

    // Create map
    const map = new window.google.maps.Map(mapRef.current, {
      center: center,
      zoom: 15,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });

    mapInstanceRef.current = map;

    // Add marker
    const marker = new window.google.maps.Marker({
      position: center,
      map: map,
      draggable: true,
      title: 'Delivery Location'
    });

    markerRef.current = marker;

    // Update location when marker is dragged
    marker.addListener('dragend', () => {
      const position = marker.getPosition();
      updateLocation(position.lat(), position.lng());
    });

    // Update location when map is clicked
    map.addListener('click', (e) => {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      marker.setPosition(e.latLng);
      updateLocation(lat, lng);
    });

    // Initialize autocomplete
    if (searchInputRef.current) {
      const autocomplete = new window.google.maps.places.Autocomplete(
        searchInputRef.current,
        {
          componentRestrictions: { country: 'ph' },
          fields: ['formatted_address', 'geometry', 'name']
        }
      );

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        
        if (!place.geometry || !place.geometry.location) {
          setError('No details available for the selected location');
          return;
        }

        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const address = place.formatted_address || place.name;

        // Update map and marker
        map.setCenter({ lat, lng });
        marker.setPosition({ lat, lng });

        // Update form
        updateLocation(lat, lng, address);
      });

      autocompleteRef.current = autocomplete;
    }

    setMapLoaded(true);
    } catch (err) {
      console.error('Error initializing Google Maps:', err);
      setMapError('Failed to initialize map. Please refresh the page.');
    }
  };

  // Update location with reverse geocoding
  const updateLocation = async (lat, lng, addressOverride = null) => {
    setFormData(prev => ({
      ...prev,
      latitude: lat,
      longitude: lng,
      deliveryAddress: addressOverride || prev.deliveryAddress
    }));

    // If no address provided, do reverse geocoding
    if (!addressOverride && window.google) {
      const geocoder = new window.google.maps.Geocoder();
      try {
        const response = await geocoder.geocode({ location: { lat, lng } });
        if (response.results && response.results[0]) {
          const address = response.results[0].formatted_address;
          setFormData(prev => ({
            ...prev,
            deliveryAddress: address
          }));
        }
      } catch (err) {
        console.error('Reverse geocoding failed:', err);
      }
    }
  };

  const handleSubmitOrder = async () => {
    setError('');

    // Validation
    if (!formData.deliveryAddress.trim()) {
      setError('Please provide a delivery address');
      return;
    }

    if (!formData.latitude || !formData.longitude) {
      setError('Please select your delivery location on the map');
      return;
    }

    if (!formData.contactNumber.trim()) {
      setError('Please provide a contact number');
      return;
    }

    if (formData.paymentMethod === 'gcash' && !formData.gcashReference.trim()) {
      setError('Please provide GCash reference number');
      return;
    }

    if (cart.length === 0) {
      setError('Your cart is empty');
      return;
    }

    setSubmitting(true);

    try {
      const subtotal = calculateSubtotal();
      const vat = calculateVAT(subtotal);
      
      // Calculate delivery fee from coordinates using Supabase function
      const { data: deliveryFeeData, error: feeError } = await supabase
        .rpc('calculate_delivery_fee_from_store', {
          customer_latitude: formData.latitude,
          customer_longitude: formData.longitude
        });

      if (feeError) {
        console.error('Error calculating delivery fee:', feeError);
        throw new Error('Failed to calculate delivery fee');
      }

      const deliveryFee = parseFloat(deliveryFeeData) || BASE_DELIVERY_FEE; // Default to base fee if calculation fails
      const total = subtotal + vat + deliveryFee;

      // Prepare order data
      const orderData = {
        customer_id: user.id,
        items: cart.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          // Include variant information if present
          variants: item.selectedVariants ? Object.values(item.selectedVariants).map(v => v.optionName).join(', ') : null,
          variant_description: item.variantDescription || null
        })),
        delivery_address: formData.deliveryAddress.trim(),
        delivery_latitude: formData.latitude,
        delivery_longitude: formData.longitude,
        delivery_fee: deliveryFee,
        subtotal: subtotal,
        vat_amount: vat,
        total_amount: total,
        payment_method: formData.paymentMethod,
        gcash_reference: formData.paymentMethod === 'gcash' ? formData.gcashReference.trim() : null,
        special_request: formData.specialRequest.trim() || null,
        status: 'order_in_queue',
        order_mode: 'delivery',
        contact_number: formData.contactNumber.trim()
      };

      const { error: insertError } = await supabase
        .from('orders')
        .insert(orderData);

      if (insertError) throw insertError;

      // Clear cart from localStorage
      localStorage.removeItem('cart');

      // Show success message
      setSuccessMessage('Order placed successfully! Redirecting to order tracking...');
      
      // Redirect after a short delay to allow user to see success message
      setTimeout(() => {
        router.replace('/customer/order-tracking').catch(console.error);
      }, 2000);
    } catch (err) {
      console.error('[Checkout] Failed to submit order:', err);
      setError(err.message || 'Failed to place order. Please try again.');
    } finally {
      setSubmitting(false);
    }
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

  const subtotal = calculateSubtotal();
  const vat = calculateVAT(subtotal);
  const deliveryFee = calculateDeliveryFee();
  const total = calculateTotal();

  return (
    <>
      <Head>
        <title>Checkout - Bite Bonansa Cafe</title>
        <meta name="description" content="Complete your order" />
      </Head>
      
      {/* Load Google Maps API */}
      {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? (
        <Script
          src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`}
          onLoad={initializeMap}
          onError={() => setMapError('Failed to load Google Maps. Please check your API key.')}
          strategy="lazyOnload"
        />
      ) : (
        <Script
          onReady={() => setMapError('Google Maps API key is not configured. Please add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your .env.local file.')}
          strategy="lazyOnload"
        />
      )}
      
      <div style={styles.page}>
        <header style={styles.header}>
          <button style={styles.backBtn} onClick={() => router.push('/customer/order-portal')}>
            ← Back to Menu
          </button>
          <h1 style={styles.logo}>🛒 Checkout</h1>
          <span style={styles.placeholder}></span>
        </header>

        <main style={styles.main}>
          <div style={styles.container}>
            {/* Order Summary */}
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Order Summary</h2>
              <div style={styles.orderItems}>
                {cart.map((item, index) => {
                  const itemKey = item.cartItemId || `${item.id}_${index}`;
                  return (
                    <div key={itemKey} style={styles.orderItem}>
                      <div style={styles.itemInfo}>
                        <div>
                          <span style={styles.itemName}>{item.name}</span>
                          {item.variantDescription && (
                            <span style={styles.variantDesc}> ({item.variantDescription})</span>
                          )}
                        </div>
                        <span style={styles.itemQuantity}>x{item.quantity}</span>
                      </div>
                      <span style={styles.itemPrice}>₱{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>

              {/* Payment Details */}
              <div style={styles.paymentDetails}>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Subtotal:</span>
                  <span style={styles.detailValue}>₱{subtotal.toFixed(2)}</span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>VAT (12%):</span>
                  <span style={styles.detailValue}>₱{vat.toFixed(2)}</span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Delivery Fee:</span>
                  <span style={styles.detailValue}>
                    {typeof deliveryFee === 'number' ? `₱${deliveryFee.toFixed(2)}` : deliveryFee}
                  </span>
                </div>
                <div style={{...styles.detailRow, ...styles.totalRow}}>
                  <span style={styles.totalLabel}>Total:</span>
                  <span style={styles.totalValue}>₱{total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Delivery Information */}
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Delivery Information</h2>
              
              {/* Google Maps Location Search */}
              <div style={styles.formGroup}>
                <label style={styles.label}>Search Location</label>
                <input
                  ref={searchInputRef}
                  type="text"
                  style={styles.input}
                  placeholder="Search for your address..."
                />
                <p style={styles.helperText}>
                  Search for your address or click on the map to pin your exact location
                </p>
              </div>

              {/* Google Maps */}
              <div style={styles.formGroup}>
                {mapError ? (
                  <div style={styles.errorMessage}>{mapError}</div>
                ) : (
                  <div 
                    ref={mapRef} 
                    style={styles.map}
                    id="google-map"
                  ></div>
                )}
              </div>
              
              <div style={styles.formGroup}>
                <label style={styles.label}>Delivery Address *</label>
                <textarea
                  style={styles.textarea}
                  value={formData.deliveryAddress}
                  onChange={(e) => handleInputChange('deliveryAddress', e.target.value)}
                  placeholder="Your delivery address will appear here (or type manually)"
                  rows={3}
                />
                {formData.latitude && formData.longitude && (
                  <p style={styles.helperText}>
                    📍 Location: {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
                  </p>
                )}
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Contact Number *</label>
                <input
                  type="text"
                  style={styles.input}
                  value={formData.contactNumber}
                  onChange={(e) => handleInputChange('contactNumber', e.target.value)}
                  placeholder="Enter your contact number"
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Special Request (Optional)</label>
                <textarea
                  style={styles.textarea}
                  value={formData.specialRequest}
                  onChange={(e) => handleInputChange('specialRequest', e.target.value)}
                  placeholder="Any special instructions for your order?"
                  rows={2}
                />
              </div>
            </div>

            {/* Payment Method */}
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Payment Method</h2>
              
              <div style={styles.paymentMethods}>
                <label style={styles.radioLabel}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="cash"
                    checked={formData.paymentMethod === 'cash'}
                    onChange={(e) => handleInputChange('paymentMethod', e.target.value)}
                    style={styles.radio}
                  />
                  <span style={styles.radioText}>💵 Cash on Delivery</span>
                </label>

                <label style={styles.radioLabel}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="gcash"
                    checked={formData.paymentMethod === 'gcash'}
                    onChange={(e) => handleInputChange('paymentMethod', e.target.value)}
                    style={styles.radio}
                  />
                  <span style={styles.radioText}>📱 GCash</span>
                </label>
              </div>

              {formData.paymentMethod === 'gcash' && (
                <div style={styles.formGroup}>
                  <label style={styles.label}>GCash Reference Number *</label>
                  <input
                    type="text"
                    style={styles.input}
                    value={formData.gcashReference}
                    onChange={(e) => handleInputChange('gcashReference', e.target.value)}
                    placeholder="Enter GCash reference number"
                  />
                  <p style={styles.helperText}>
                    Please transfer the payment to our GCash number and enter the reference number above.
                  </p>
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div style={styles.errorMessage}>{error}</div>
            )}

            {/* Success Message */}
            {successMessage && (
              <div style={styles.successMessage}>{successMessage}</div>
            )}

            {/* Submit Button */}
            <button
              style={styles.submitBtn}
              onClick={handleSubmitOrder}
              disabled={submitting || successMessage}
            >
              {submitting ? 'Placing Order...' : 'Place Order'}
            </button>
          </div>
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
  },
  logo: {
    fontSize: '22px',
    fontFamily: "'Playfair Display', serif",
    color: '#ffc107',
    margin: 0,
    flex: 1,
    textAlign: 'center',
  },
  backBtn: {
    padding: '8px 18px',
    backgroundColor: 'transparent',
    color: '#ffc107',
    border: '1px solid #ffc107',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
  },
  placeholder: {
    width: '100px',
  },
  main: {
    padding: '40px 32px',
    maxWidth: '800px',
    margin: '0 auto',
  },
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  section: {
    backgroundColor: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '12px',
    padding: '24px',
  },
  sectionTitle: {
    fontSize: '20px',
    fontFamily: "'Playfair Display', serif",
    color: '#ffc107',
    marginTop: 0,
    marginBottom: '20px',
  },
  orderItems: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '20px',
  },
  orderItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 0',
    borderBottom: '1px solid #2a2a2a',
  },
  itemInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flex: 1,
  },
  itemName: {
    fontSize: '14px',
    color: '#fff',
    lineHeight: '1.4',
  },
  variantDesc: {
    display: 'block',
    fontSize: '11px',
    color: '#999',
    marginTop: '2px',
  },
  itemQuantity: {
    fontSize: '14px',
    color: '#999',
  },
  itemPrice: {
    fontSize: '14px',
    color: '#ffc107',
    fontWeight: '600',
  },
  paymentDetails: {
    borderTop: '2px solid #ffc107',
    paddingTop: '16px',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
  },
  detailLabel: {
    fontSize: '14px',
    color: '#ccc',
  },
  detailValue: {
    fontSize: '14px',
    color: '#fff',
  },
  totalRow: {
    borderTop: '1px solid #444',
    marginTop: '8px',
    paddingTop: '16px',
  },
  totalLabel: {
    fontSize: '16px',
    color: '#fff',
    fontWeight: '600',
  },
  totalValue: {
    fontSize: '18px',
    color: '#ffc107',
    fontWeight: '700',
  },
  formGroup: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    color: '#ccc',
    marginBottom: '8px',
    fontWeight: '600',
  },
  input: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#0a0a0a',
    color: '#fff',
    border: '1px solid #444',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: "'Poppins', sans-serif",
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#0a0a0a',
    color: '#fff',
    border: '1px solid #444',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: "'Poppins', sans-serif",
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  helperText: {
    fontSize: '12px',
    color: '#999',
    marginTop: '4px',
    fontStyle: 'italic',
  },
  map: {
    width: '100%',
    height: '400px',
    borderRadius: '8px',
    border: '1px solid #444',
    backgroundColor: '#2a2a2a',
  },
  paymentMethods: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    marginBottom: '16px',
  },
  radioLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    cursor: 'pointer',
    padding: '12px',
    backgroundColor: '#0a0a0a',
    border: '1px solid #444',
    borderRadius: '8px',
    transition: 'all 0.2s',
  },
  radio: {
    cursor: 'pointer',
    accentColor: '#ffc107',
  },
  radioText: {
    fontSize: '16px',
    color: '#fff',
  },
  errorMessage: {
    padding: '16px',
    backgroundColor: '#f443361a',
    color: '#f44336',
    borderRadius: '8px',
    fontSize: '14px',
    textAlign: 'center',
    border: '1px solid #f44336',
  },
  successMessage: {
    padding: '16px',
    backgroundColor: '#4caf501a',
    color: '#4caf50',
    borderRadius: '8px',
    fontSize: '14px',
    textAlign: 'center',
    border: '1px solid #4caf50',
    fontWeight: '600',
  },
  submitBtn: {
    width: '100%',
    padding: '16px',
    backgroundColor: '#ffc107',
    color: '#0a0a0a',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
    transition: 'all 0.2s',
  },
};
