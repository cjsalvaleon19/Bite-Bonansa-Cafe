import React, { useEffect, useRef, useState } from 'react';

/**
 * LocationPicker Component
 * 
 * Allows users to search for and pin their delivery location using Google Maps.
 * Returns the selected address, latitude, and longitude.
 */
export default function LocationPicker({ 
  onLocationSelect, 
  initialAddress = '', 
  apiKey 
}) {
  const mapRef = useRef(null);
  const searchInputRef = useRef(null);
  const markerRef = useRef(null);
  const [map, setMap] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState('');

  // Default location: Bite Bonansa Cafe store
  const defaultCenter = { lat: 6.2178483, lng: 124.8221226 };

  useEffect(() => {
    // Check if Google Maps API is already loaded
    if (window.google && window.google.maps) {
      setIsLoaded(true);
      return;
    }

    // Load Google Maps API
    if (!apiKey) {
      setError('Google Maps API key is not configured. Please contact support.');
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setIsLoaded(true);
    };
    script.onerror = () => {
      setError('Failed to load Google Maps. Please refresh the page.');
    };
    
    document.head.appendChild(script);

    return () => {
      // Cleanup script on unmount
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [apiKey]);

  useEffect(() => {
    if (!isLoaded || !mapRef.current || map) return;

    // Initialize map
    const googleMap = new window.google.maps.Map(mapRef.current, {
      center: defaultCenter,
      zoom: 15,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });

    setMap(googleMap);

    // Add click listener to map for placing marker
    googleMap.addListener('click', (event) => {
      placeMarker(event.latLng, googleMap);
    });
  }, [isLoaded, map]);

  useEffect(() => {
    if (!map || !searchInputRef.current) return;

    // Initialize autocomplete for search input
    const autocomplete = new window.google.maps.places.Autocomplete(
      searchInputRef.current,
      {
        componentRestrictions: { country: 'ph' }, // Restrict to Philippines
        fields: ['address_components', 'geometry', 'formatted_address', 'name'],
      }
    );

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();

      if (!place.geometry || !place.geometry.location) {
        setError('No details available for the selected location.');
        return;
      }

      // Move map to selected location
      map.setCenter(place.geometry.location);
      map.setZoom(17);

      // Place marker at selected location
      placeMarker(place.geometry.location, map, place.formatted_address || place.name);
    });
  }, [map]);

  const placeMarker = (location, googleMap, address = null) => {
    // Remove existing marker if any
    if (markerRef.current) {
      markerRef.current.setMap(null);
    }

    // Create new marker
    const marker = new window.google.maps.Marker({
      position: location,
      map: googleMap,
      draggable: true,
      animation: window.google.maps.Animation.DROP,
    });

    markerRef.current = marker;

    // Add drag listener to update location
    marker.addListener('dragend', (event) => {
      updateLocation(event.latLng);
    });

    // Update location
    updateLocation(location, address);
  };

  const updateLocation = (latLng, providedAddress = null) => {
    const lat = latLng.lat();
    const lng = latLng.lng();

    if (providedAddress) {
      // Use provided address
      const location = {
        address: providedAddress,
        latitude: lat,
        longitude: lng,
      };
      setSelectedLocation(location);
      if (onLocationSelect) {
        onLocationSelect(location);
      }
    } else {
      // Reverse geocode to get address
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: latLng }, (results, status) => {
        if (status === 'OK' && results[0]) {
          const location = {
            address: results[0].formatted_address,
            latitude: lat,
            longitude: lng,
          };
          setSelectedLocation(location);
          if (onLocationSelect) {
            onLocationSelect(location);
          }
        } else {
          setError('Failed to get address for the selected location.');
        }
      });
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }

    setError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = new window.google.maps.LatLng(
          position.coords.latitude,
          position.coords.longitude
        );
        map.setCenter(location);
        map.setZoom(17);
        placeMarker(location, map);
      },
      (error) => {
        setError('Unable to retrieve your location. Please search for your address.');
        console.error('Geolocation error:', error);
      }
    );
  };

  if (error) {
    return (
      <div style={styles.errorContainer}>
        <p style={styles.errorText}>⚠️ {error}</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div style={styles.loadingContainer}>
        <p style={styles.loadingText}>🗺️ Loading map...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.searchContainer}>
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search for your delivery address..."
          style={styles.searchInput}
          defaultValue={initialAddress}
        />
        <button
          type="button"
          style={styles.currentLocationBtn}
          onClick={handleUseCurrentLocation}
        >
          📍 Use Current Location
        </button>
      </div>

      <div ref={mapRef} style={styles.map} />

      {selectedLocation && (
        <div style={styles.selectedAddress}>
          <p style={styles.addressLabel}>Selected Address:</p>
          <p style={styles.addressText}>{selectedLocation.address}</p>
          <p style={styles.coordsText}>
            📍 {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
          </p>
        </div>
      )}

      <p style={styles.helperText}>
        💡 Click on the map or drag the marker to select your exact delivery location
      </p>
    </div>
  );
}

const styles = {
  container: {
    width: '100%',
  },
  searchContainer: {
    display: 'flex',
    gap: '10px',
    marginBottom: '15px',
    flexWrap: 'wrap',
  },
  searchInput: {
    flex: 1,
    minWidth: '200px',
    padding: '12px',
    fontSize: '14px',
    borderRadius: '6px',
    border: '1px solid #ffc107',
    backgroundColor: '#2a2a2a',
    color: '#fff',
    fontFamily: "'Poppins', sans-serif",
  },
  currentLocationBtn: {
    padding: '12px 20px',
    backgroundColor: '#ffc107',
    color: '#0a0a0a',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: "'Poppins', sans-serif",
    whiteSpace: 'nowrap',
  },
  map: {
    width: '100%',
    height: '400px',
    borderRadius: '8px',
    marginBottom: '15px',
  },
  selectedAddress: {
    padding: '15px',
    backgroundColor: '#2a2a2a',
    borderRadius: '8px',
    marginBottom: '15px',
    border: '1px solid #ffc107',
  },
  addressLabel: {
    fontSize: '12px',
    color: '#ffc107',
    margin: '0 0 5px 0',
    fontWeight: '600',
  },
  addressText: {
    fontSize: '14px',
    color: '#fff',
    margin: '0 0 8px 0',
  },
  coordsText: {
    fontSize: '12px',
    color: '#999',
    margin: 0,
  },
  helperText: {
    fontSize: '12px',
    color: '#999',
    margin: '10px 0 0 0',
    fontStyle: 'italic',
  },
  loadingContainer: {
    padding: '40px',
    textAlign: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: '8px',
  },
  loadingText: {
    color: '#ffc107',
    fontSize: '16px',
    margin: 0,
  },
  errorContainer: {
    padding: '20px',
    backgroundColor: '#3a2020',
    borderRadius: '8px',
    border: '1px solid #ff4444',
  },
  errorText: {
    color: '#ff6666',
    fontSize: '14px',
    margin: 0,
  },
};
