'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { Button } from './ui/button'
import { toast } from 'sonner'
import dynamic from 'next/dynamic'

// Dynamically import OpenStreetMapPicker to avoid SSR issues
const OpenStreetMapPicker = dynamic(() => import('./OpenStreetMapPicker'), { ssr: false })

interface LocationPickerProps {
  isOpen: boolean
  onClose: () => void
  onSelectLocation: (lat: number, lng: number, address: string) => void
}

export function LocationPicker({ isOpen, onClose, onSelectLocation }: LocationPickerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLat, setSelectedLat] = useState<number | null>(null)
  const [selectedLng, setSelectedLng] = useState<number | null>(null)
  const [selectedAddress, setSelectedAddress] = useState('')

  const handleLocationChange = (lat: number, lng: number, address: string) => {
    setSelectedLat(lat)
    setSelectedLng(lng)
    setSelectedAddress(address)
  }

  const resetLocationState = () => {
    setSearchQuery('')
    setSelectedLat(null)
    setSelectedLng(null)
    setSelectedAddress('')
  }

  const handleConfirm = () => {
    if (selectedLat !== null && selectedLng !== null) {
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Select Delivery Location</DialogTitle>
          <DialogDescription>
            Enter your delivery address or click on the map to pin your location.
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
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>Confirm Location</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
