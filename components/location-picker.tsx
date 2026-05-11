'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { Button } from './ui/button'
import { toast } from 'sonner'
import dynamic from 'next/dynamic'

// Dynamically import OpenStreetMapPicker to avoid SSR issues
const OpenStreetMapPicker = dynamic(() => import('./OpenStreetMapPicker'), { 
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[400px] bg-muted rounded-lg">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
        <p className="text-sm text-muted-foreground">Loading map...</p>
      </div>
    </div>
  )
})

interface LocationPickerProps {
  isOpen: boolean
  onClose: () => void
  onSelectLocation: (lat: number, lng: number, address: string) => void
}

/**
 * Returns true when the address components include a sub-municipality level detail
 * (barangay, road, village, hamlet, neighbourhood, etc.)
 */
function hasBarangayLevelDetail(components: Record<string, string>): boolean {
  return !!(
    components.road ||
    components.neighbourhood ||
    components.suburb ||
    components.village ||
    components.hamlet ||
    components.quarter ||
    components.amenity ||
    components.house_number
  )
}

export function LocationPicker({ isOpen, onClose, onSelectLocation }: LocationPickerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLat, setSelectedLat] = useState<number | null>(null)
  const [selectedLng, setSelectedLng] = useState<number | null>(null)
  const [selectedAddress, setSelectedAddress] = useState('')
  const [addressComponents, setAddressComponents] = useState<Record<string, string>>({})

  const handleLocationChange = (lat: number, lng: number, address: string, components: Record<string, string> = {}) => {
    setSelectedLat(lat)
    setSelectedLng(lng)
    setSelectedAddress(address)
    setAddressComponents(components)
  }

  const resetLocationState = () => {
    setSearchQuery('')
    setSelectedLat(null)
    setSelectedLng(null)
    setSelectedAddress('')
    setAddressComponents({})
  }

  const handleConfirm = () => {
    if (selectedLat !== null && selectedLng !== null) {
      // Require a barangay/road-level address — reject generic municipality-only pins
      if (!hasBarangayLevelDetail(addressComponents)) {
        toast.error(
          "Please select a more specific location. Your address must include a barangay or road name within T'Boli, South Cotabato."
        )
        return
      }
      onSelectLocation(selectedLat, selectedLng, selectedAddress)
      onClose()
      resetLocationState()
    } else {
      toast.error('Please select a location on the map or search for an address')
    }
  }

  const handleCancel = () => {
    onClose()
    resetLocationState()
  }

  // Address specificity warning shown inline
  const addressIsTooGeneric =
    selectedLat !== null &&
    selectedLng !== null &&
    selectedAddress !== '' &&
    !hasBarangayLevelDetail(addressComponents)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Select Delivery Location</DialogTitle>
          <DialogDescription>
            Enter your delivery address or click on the map to pin your location. Search suggestions are limited to T&apos;Boli, South Cotabato.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {isOpen && (
            <OpenStreetMapPicker
              initialLat={selectedLat || undefined}
              initialLng={selectedLng || undefined}
              onLocationChange={handleLocationChange}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
            />
          )}
          {selectedAddress && (
            <div className="mt-3 p-3 rounded-lg bg-muted border">
              <p className="text-sm font-medium">Selected Location:</p>
              <p className="text-sm text-muted-foreground">{selectedAddress}</p>
            </div>
          )}
          {addressIsTooGeneric && (
            <div className="mt-2 p-3 rounded-lg border border-destructive/50 bg-destructive/10 text-sm text-destructive">
              ⚠️ This location is too generic. Please pin a specific barangay or road address within T&apos;Boli, South Cotabato to proceed.
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={addressIsTooGeneric}>Confirm Location</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
