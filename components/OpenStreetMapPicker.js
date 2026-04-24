import React, { useState, useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useMapEvents, useMap } from 'react-leaflet';

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

// Store coordinates - Bite Bonansa Cafe
const STORE_LOCATION = {
  lat: 6.2178483,
  lng: 124.8221226
};

// Component to handle map clicks
function MapClickHandler({ onLocationSelect }) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Component to update map center without remounting
function MapCenterUpdater({ center }) {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.setView([center.lat, center.lng], map.getZoom());
    }
  }, [center, map]);
  
  return null;
}

// Component to handle marker dragging
function DraggableMarker({ position, onDragEnd }) {
  const [markerPosition, setMarkerPosition] = useState(position);
  const markerRef = useRef(null);

  useEffect(() => {
    setMarkerPosition(position);
  }, [position]);

  const eventHandlers = useMemo(() => ({
    dragend() {
      const marker = markerRef.current;
      if (marker != null) {
        const newPos = marker.getLatLng();
        setMarkerPosition(newPos);
        onDragEnd(newPos.lat, newPos.lng);
      }
    },
  }), [onDragEnd]);

  // Only render marker if we have Leaflet loaded
  if (typeof window === 'undefined') return null;

  const L = require('leaflet');
  const icon = useMemo(() => L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  }), [L]);

  return (
    <Marker
      draggable={true}
      eventHandlers={eventHandlers}
      position={markerPosition}
      ref={markerRef}
      icon={icon}
    />
  );
}

export default function OpenStreetMapPicker({ 
  initialLat, 
  initialLng, 
  onLocationChange,
  searchQuery,
  onSearchQueryChange 
}) {
  const [position, setPosition] = useState({
    lat: initialLat || STORE_LOCATION.lat,
    lng: initialLng || STORE_LOCATION.lng
  });
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [mapCenter, setMapCenter] = useState(position);
  const searchTimeoutRef = useRef(null);

  // Nominatim search function
  const searchLocation = async (query) => {
    if (!query || query.trim().length < 3) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=ph&limit=5`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Bite Bonansa Cafe/1.0',
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  };

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery && searchQuery.trim().length >= 3) {
      searchTimeoutRef.current = setTimeout(() => {
        searchLocation(searchQuery);
      }, 500);
    } else {
      setSearchResults([]);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Reverse geocoding to get address from coordinates
  const reverseGeocode = async (lat, lng) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Bite Bonansa Cafe/1.0',
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        return data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
    }
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  };

  const handleLocationSelect = async (lat, lng) => {
    setPosition({ lat, lng });
    setMapCenter({ lat, lng });
    
    const address = await reverseGeocode(lat, lng);
    onLocationChange(lat, lng, address);
  };

  const handleSearchResultClick = (result) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    handleLocationSelect(lat, lng);
    setSearchResults([]);
    if (onSearchQueryChange) {
      onSearchQueryChange(result.display_name);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* Search Input */}
      <div style={{ marginBottom: '10px', position: 'relative' }}>
        <input
          type="text"
          value={searchQuery || ''}
          onChange={(e) => onSearchQueryChange && onSearchQueryChange(e.target.value)}
          placeholder="Search for your address..."
          style={{
            width: '100%',
            padding: '10px',
            borderRadius: '5px',
            border: '1px solid #ccc',
            fontSize: '14px',
          }}
        />
        {searching && (
          <div style={{
            position: 'absolute',
            right: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '12px',
            color: '#666'
          }}>
            Searching...
          </div>
        )}
        
        {/* Search Results Dropdown */}
        {searchResults.length > 0 && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: '5px',
            marginTop: '2px',
            maxHeight: '200px',
            overflowY: 'auto',
            zIndex: 1000,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            {searchResults.map((result, index) => (
              <div
                key={index}
                onClick={() => handleSearchResultClick(result)}
                style={{
                  padding: '10px',
                  cursor: 'pointer',
                  borderBottom: index < searchResults.length - 1 ? '1px solid #eee' : 'none',
                  fontSize: '14px',
                  color: '#1a1a1a',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
              >
                📍 {result.display_name}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Helper Text */}
      <p style={{
        fontSize: '12px',
        color: '#666',
        marginBottom: '10px'
      }}>
        Search for your address or click on the map to pin your exact location
      </p>

      {/* Map Container */}
      <div style={{
        height: '400px',
        width: '100%',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid #ddd'
      }}>
        {typeof window !== 'undefined' && (
          <MapContainer
            center={[position.lat, position.lng]}
            zoom={15}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapCenterUpdater center={mapCenter} />
            <DraggableMarker 
              position={position} 
              onDragEnd={handleLocationSelect}
            />
            <MapClickHandler onLocationSelect={handleLocationSelect} />
          </MapContainer>
        )}
      </div>
    </div>
  );
}
