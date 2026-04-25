'use client'

import React, { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { Button } from './ui/button'

interface LocationPickerProps {
  isOpen: boolean
  onClose: () => void
  onSelectLocation: (lat: number, lng: number, address: string) => void
}

// Dynamically import OpenStreetMapPicker to avoid SSR issues
const OpenStreetMapPicker = dynamic(() => import('./OpenStreetMapPicker'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-96 text-gray-400">Loading map...</div>
})

export function LocationPicker({ isOpen, onClose, onSelectLocation }: LocationPickerProps) {
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [address, setAddress] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const handleLocationChange = (newLat: number, newLng: number, newAddress: string) => {
    setLat(newLat)
    setLng(newLng)
    setAddress(newAddress)
  }

  const handleConfirm = () => {
    if (lat === null || lng === null) {
      alert('Please select a location on the map')
      return
    }

    onSelectLocation(lat, lng, address || `${lat}, ${lng}`)
    onClose()
  }

  // Reset when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setLat(null)
      setLng(null)
      setAddress('')
      setSearchQuery('')
    }
  }, [isOpen])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Select Delivery Location</DialogTitle>
          <DialogDescription>
            Search for your address or click on the map to pin your exact location.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {isOpen && (
            <OpenStreetMapPicker
              initialLat={lat}
              initialLng={lng}
              onLocationChange={handleLocationChange}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
            />
          )}
          {address && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm">
              <p className="text-primary font-medium">📍 Selected location:</p>
              <p className="text-gray-300 mt-1">{address}</p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>Confirm Location</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
