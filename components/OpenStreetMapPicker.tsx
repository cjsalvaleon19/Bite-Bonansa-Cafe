import React, { useState, useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useMapEvents, useMap } from 'react-leaflet';
import type { Map as LeafletMap, Icon as LeafletIcon, DragEndEvent } from 'leaflet';

// Dynamically import Leaflet components to avoid SSR issues
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
) as any;
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
) as any;
const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
) as any;

// Store coordinates - Bite Bonansa Cafe
const STORE_LOCATION = {
  lat: 6.2178483,
  lng: 124.8221226
};

// Component to handle map clicks
function MapClickHandler({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Component to update map center without remounting
function MapCenterUpdater({ center }: { center: { lat: number; lng: number } | null }) {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.setView([center.lat, center.lng], map.getZoom());
    }
  }, [center, map]);
  
  return null;
}

// Component to handle marker dragging
function DraggableMarker({ position, onDragEnd }: { position: { lat: number; lng: number }; onDragEnd: (lat: number, lng: number) => void }) {
  const [markerPosition, setMarkerPosition] = useState(position);
  const markerRef = useRef<any>(null);

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

interface SearchResult {
  lat: string;
  lon: string;
  display_name: string;
}

interface OpenStreetMapPickerProps {
  initialLat?: number;
  initialLng?: number;
  onLocationChange: (lat: number, lng: number, address: string) => void;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
}

export default function OpenStreetMapPicker({ 
  initialLat, 
  initialLng, 
  onLocationChange,
  searchQuery = '',
  onSearchQueryChange 
}: OpenStreetMapPickerProps) {
  const [position, setPosition] = useState({
    lat: initialLat || STORE_LOCATION.lat,
    lng: initialLng || STORE_LOCATION.lng
  });
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [mapCenter, setMapCenter] = useState(position);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Nominatim search function
  const searchLocation = async (query: string) => {
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
  const reverseGeocode = async (lat: number, lng: number) => {
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

  const handleLocationSelect = async (lat: number, lng: number) => {
    setPosition({ lat, lng });
    setMapCenter({ lat, lng });
    
    const address = await reverseGeocode(lat, lng);
    onLocationChange(lat, lng, address);
  };

  const handleSearchResultClick = (result: SearchResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    handleLocationSelect(lat, lng);
    setSearchResults([]);
    if (onSearchQueryChange) {
      onSearchQueryChange(result.display_name);
    }
  };

  return (
    <div className="relative">
      {/* Search Input */}
      <div className="mb-3 relative">
        <input
          type="text"
          value={searchQuery || ''}
          onChange={(e) => onSearchQueryChange && onSearchQueryChange(e.target.value)}
          placeholder="Search for your address..."
          className="w-full px-4 py-3 rounded-lg border border-border bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {searching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            Searching...
          </div>
        )}
        
        {/* Search Results Dropdown */}
        {searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto z-50">
            {searchResults.map((result, index) => (
              <div
                key={index}
                onClick={() => handleSearchResultClick(result)}
                className="px-4 py-3 cursor-pointer border-b border-border last:border-0 hover:bg-primary/10 transition-colors"
              >
                <span className="text-foreground">📍 {result.display_name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Helper Text */}
      <p className="text-sm text-muted-foreground mb-3">
        Search for your address or click on the map to pin your exact location
      </p>

      {/* Map Container */}
      <div className="h-[400px] w-full rounded-lg overflow-hidden border border-border">
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
