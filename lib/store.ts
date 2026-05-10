import { useState, useEffect } from 'react'
import { supabase } from './supabase/client'

export const PH_TIMEZONE = 'Asia/Manila'
export const SUNDAY_CLOSURE_MESSAGE = 'Bite Bonansa Cafe is closed every Sunday (PH Time). Ordering is unavailable today.'

// Store location constants
export const STORE_LOCATION = {
  name: 'Bite Bonanza',
  address: "Laconon-Salacafe Rd, Brgy. Poblacion, T'boli, South Cotabato",
  latitude: 6.2178483,
  longitude: 124.8221226,
}

// Currency formatter
export function formatCurrency(amount: number): string {
  return `₱${amount.toFixed(2)}`
}

// Distance formatter
export function formatDistance(meters: number): string {
  return meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(2)} km`
}

export function isSundayInManila(date: Date = new Date()): boolean {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: PH_TIMEZONE,
    weekday: 'long',
  }).format(date) === 'Sunday'
}

// Haversine formula to calculate distance between two coordinates
function getDistanceBetweenCoordinates(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371 // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1000) // Convert to meters
}

// Calculate delivery fee based on distance
function calculateDeliveryFeeFromDistance(distanceInMeters: number): number {
  const baseFee = 30

  // Tiered pricing based on distance ranges
  if (distanceInMeters <= 1000) return baseFee // ₱30
  else if (distanceInMeters <= 1500) return baseFee + 5 // ₱35
  else if (distanceInMeters <= 2000) return baseFee + 10 // ₱40
  else if (distanceInMeters <= 2500) return baseFee + 15 // ₱45
  else if (distanceInMeters <= 3000) return baseFee + 20 // ₱50
  else if (distanceInMeters <= 3500) return baseFee + 24 // ₱54
  else if (distanceInMeters <= 4000) return baseFee + 28 // ₱58
  else if (distanceInMeters <= 4500) return baseFee + 32 // ₱62
  else if (distanceInMeters <= 5000) return baseFee + 36 // ₱66
  else if (distanceInMeters <= 5500) return baseFee + 40 // ₱70
  else if (distanceInMeters <= 6000) return baseFee + 44 // ₱74
  else if (distanceInMeters <= 6500) return baseFee + 47 // ₱77
  else if (distanceInMeters <= 7000) return baseFee + 50 // ₱80
  else if (distanceInMeters <= 7500) return baseFee + 53 // ₱83
  else if (distanceInMeters <= 8000) return baseFee + 56 // ₱86
  else if (distanceInMeters <= 8500) return baseFee + 59 // ₱89
  else if (distanceInMeters <= 9000) return baseFee + 62 // ₱92
  else if (distanceInMeters <= 9500) return baseFee + 65 // ₱95
  else return baseFee + 68 // ₱98 - Capped at 10km+
}

// Calculate delivery fee with distance and out-of-range check
export function calculateDeliveryFee(
  lat: number | null,
  lng: number | null
): { fee: number; distance: number | null; outOfRange: boolean } {
  if (lat === null || lng === null) {
    return { fee: 0, distance: null, outOfRange: false }
  }

  const distance = getDistanceBetweenCoordinates(
    STORE_LOCATION.latitude,
    STORE_LOCATION.longitude,
    lat,
    lng
  )

  const MAX_DELIVERY_DISTANCE = 10000 // 10 km in meters
  const outOfRange = distance > MAX_DELIVERY_DISTANCE

  const fee = outOfRange ? 0 : calculateDeliveryFeeFromDistance(distance)

  return { fee, distance, outOfRange }
}

// Auth hook
export function useAuth() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return { user, loading }
}
