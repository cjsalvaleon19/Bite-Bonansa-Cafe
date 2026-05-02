import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { STORE_LOCATION } from '../utils/deliveryCalculator';

// Dynamically import Leaflet components to avoid SSR issues
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
);
const Polyline = dynamic(
  () => import('react-leaflet').then((mod) => mod.Polyline),
  { ssr: false }
);

export default function RouteMapModal({ delivery, onClose, onConfirm, loading }) {
  const [route, setRoute] = useState(null);
  const [routeLoading, setRouteLoading] = useState(true);
  const [error, setError] = useState(null);
  const [directions, setDirections] = useState([]);
  const [routeCache, setRouteCache] = useState({});
  const [customerCoords, setCustomerCoords] = useState(null);

  useEffect(() => {
    // Try to get customer location from delivery or fallback to orders
    const customerLat = delivery?.customer_latitude || delivery?.orders?.customer_latitude;
    const customerLng = delivery?.customer_longitude || delivery?.orders?.customer_longitude;
    
    if (!customerLat || !customerLng) {
      setError('Customer location coordinates not available. Please use the address-based navigation below.');
      setRouteLoading(false);
      return;
    }

    // Store coordinates in state instead of mutating delivery object
    setCustomerCoords({ lat: customerLat, lng: customerLng });
    
    fetchRoute(customerLat, customerLng);
  }, [delivery]);

  const fetchRoute = async (lat, lng) => {
    try {
      setRouteLoading(true);
      setError(null);

      const start = `${STORE_LOCATION.longitude},${STORE_LOCATION.latitude}`;
      const end = `${lng},${lat}`;
      
      // Create cache key based on coordinates
      const cacheKey = `${start}-${end}`;
      
      // Check if route is already cached
      if (routeCache[cacheKey]) {
        setRoute(routeCache[cacheKey].route);
        setDirections(routeCache[cacheKey].directions);
        setRouteLoading(false);
        return;
      }
      
      // OSRM API endpoint for route calculation
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${start};${end}?overview=full&geometries=geojson&steps=true`;
      
      const response = await fetch(osrmUrl);
      const data = await response.json();

      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const routeData = data.routes[0];
        
        // Convert route geometry to Leaflet format
        const coordinates = routeData.geometry.coordinates.map(coord => [coord[1], coord[0]]);

        // Extract turn-by-turn directions
        // Note: 'depart' and 'arrive' steps are excluded as they are implicit
        // (rider knows they start from store and arrive at customer address)
        const steps = [];
        routeData.legs.forEach(leg => {
          leg.steps.forEach(step => {
            if (step.maneuver && step.maneuver.type !== 'arrive' && step.maneuver.type !== 'depart') {
              steps.push({
                instruction: step.maneuver.modifier 
                  ? `${step.maneuver.type} ${step.maneuver.modifier}` 
                  : step.maneuver.type,
                distance: step.distance,
                name: step.name || 'unnamed road'
              });
            }
          });
        });
        
        // Cache the route for this delivery
        setRouteCache(prev => ({
          ...prev,
          [cacheKey]: { route: coordinates, directions: steps }
        }));
        
        setRoute(coordinates);
        setDirections(steps);
      } else {
        setError('Unable to calculate route');
      }
    } catch (err) {
      console.error('Route fetch error:', err);
      setError('Failed to fetch route. Please try again.');
    } finally {
      setRouteLoading(false);
    }
  };

  const formatDistance = (meters) => {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(2)} km`;
  };

  // Calculate map center (midpoint between store and customer)
  const mapCenter = customerCoords
    ? [
        (STORE_LOCATION.latitude + customerCoords.lat) / 2,
        (STORE_LOCATION.longitude + customerCoords.lng) / 2
      ]
    : [STORE_LOCATION.latitude, STORE_LOCATION.longitude];

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Delivery Route</h2>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={styles.content}>
          {/* Order Info */}
          <div style={styles.orderInfo}>
            <p><strong>Order:</strong> {delivery?.orders?.order_number || delivery?.order_id}</p>
            <p><strong>Customer:</strong> {delivery?.orders?.customer_name || delivery?.customer_name || 'N/A'}</p>
            <p><strong>Phone:</strong> {delivery?.orders?.customer_phone || delivery?.customer_phone || 'N/A'}</p>
            <p><strong>Address:</strong> {delivery?.customer_address || 'N/A'}</p>
          </div>

          {/* Map */}
          <div style={styles.mapContainer}>
            {!error && typeof window !== 'undefined' && customerCoords && (
              <MapContainer
                center={mapCenter}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                
                {/* Store Marker */}
                <Marker position={[STORE_LOCATION.latitude, STORE_LOCATION.longitude]}>
                  <Popup>
                    <strong>Start: {STORE_LOCATION.name}</strong><br />
                    {STORE_LOCATION.address}
                  </Popup>
                </Marker>

                {/* Customer Marker */}
                {customerCoords && (
                  <Marker position={[customerCoords.lat, customerCoords.lng]}>
                    <Popup>
                      <strong>Destination</strong><br />
                      {delivery.customer_address}
                    </Popup>
                  </Marker>
                )}

                {/* Route Line */}
                {route && (
                  <Polyline positions={route} color="#ffc107" weight={4} opacity={0.7} />
                )}
              </MapContainer>
            )}

            {routeLoading && !error && (
              <div style={styles.mapOverlay}>
                <p>⏳ Calculating route...</p>
              </div>
            )}

            {error && (
              <div style={styles.mapOverlay}>
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <p style={{ color: '#ffc107', marginBottom: '16px' }}>⚠️ {error}</p>
                  {delivery.customer_address ? (
                    <>
                      <p style={{ color: '#ccc', marginBottom: '16px' }}>
                        Use address-based navigation below to get directions.
                      </p>
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(STORE_LOCATION.address)}&destination=${encodeURIComponent(delivery.customer_address)}&travelmode=driving`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-block',
                          padding: '12px 24px',
                          backgroundColor: '#ff9800',
                          color: '#fff',
                          textDecoration: 'none',
                          borderRadius: '6px',
                          fontWeight: '600',
                        }}
                      >
                        🗺️ Open Google Maps Navigation
                      </a>
                    </>
                  ) : (
                    <p style={{ color: '#ccc' }}>
                      Contact customer for delivery location details.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Directions */}
          {directions.length > 0 && (
            <div style={styles.directions}>
              <h3 style={styles.directionsTitle}>Turn-by-Turn Directions</h3>
              <ol style={styles.directionsList}>
                <li>Start at {STORE_LOCATION.name}</li>
                {directions.map((step, idx) => (
                  <li key={idx}>
                    {step.instruction} on {step.name} ({formatDistance(step.distance)})
                  </li>
                ))}
                <li>Arrive at destination</li>
              </ol>
            </div>
          )}

          {/* Actions */}
          <div style={styles.actions}>
            <button style={styles.cancelBtn} onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button 
              style={styles.confirmBtn} 
              onClick={onConfirm}
              disabled={loading || routeLoading}
            >
              {loading ? '⏳ Starting...' : '🚀 Start Delivery'}
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
    border: '1px solid #ffc107',
    maxWidth: '900px',
    width: '100%',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    borderBottom: '1px solid #333',
  },
  title: {
    fontSize: '24px',
    color: '#ffc107',
    margin: 0,
    fontFamily: "'Poppins', sans-serif",
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#fff',
    fontSize: '24px',
    cursor: 'pointer',
    padding: '0',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
    transition: 'background-color 0.3s',
  },
  content: {
    padding: '20px',
  },
  orderInfo: {
    backgroundColor: '#2a2a2a',
    padding: '16px',
    borderRadius: '8px',
    marginBottom: '16px',
    color: '#ccc',
  },
  mapContainer: {
    height: '400px',
    borderRadius: '8px',
    overflow: 'hidden',
    marginBottom: '16px',
    border: '1px solid #333',
    position: 'relative',
  },
  mapOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(26, 26, 26, 0.9)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    color: '#ffc107',
    fontSize: '16px',
  },
  directions: {
    backgroundColor: '#2a2a2a',
    padding: '16px',
    borderRadius: '8px',
    marginBottom: '16px',
    maxHeight: '200px',
    overflowY: 'auto',
  },
  directionsTitle: {
    fontSize: '18px',
    color: '#ffc107',
    marginTop: 0,
    marginBottom: '12px',
  },
  directionsList: {
    margin: 0,
    paddingLeft: '20px',
    color: '#ccc',
    fontSize: '14px',
  },
  actions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    padding: '12px 24px',
    backgroundColor: '#333',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
    transition: 'background-color 0.3s',
  },
  confirmBtn: {
    padding: '12px 24px',
    backgroundColor: '#ff9800',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
    fontWeight: '600',
    transition: 'background-color 0.3s',
  },
};
