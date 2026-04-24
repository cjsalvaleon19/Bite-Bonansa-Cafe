'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'

interface LocationPickerProps {
  isOpen: boolean
  onClose: () => void
  onSelectLocation: (lat: number, lng: number, address: string) => void
}

export function LocationPicker({ isOpen, onClose, onSelectLocation }: LocationPickerProps) {
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [address, setAddress] = useState('')

  const handleConfirm = () => {
    const latitude = parseFloat(lat)
    const longitude = parseFloat(lng)

    if (isNaN(latitude) || isNaN(longitude)) {
      alert('Please enter valid coordinates')
      return
    }

    onSelectLocation(latitude, longitude, address || `${latitude}, ${longitude}`)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select Delivery Location</DialogTitle>
          <DialogDescription>
            Enter your delivery coordinates or use the map to pin your location.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              placeholder="Enter your address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lat">Latitude</Label>
              <Input
                id="lat"
                type="number"
                step="any"
                placeholder="e.g., 6.2178483"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lng">Longitude</Label>
              <Input
                id="lng"
                type="number"
                step="any"
                placeholder="e.g., 124.8221226"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
              />
            </div>
          </div>
          <div className="text-sm text-gray-600">
            <p>💡 Tip: You can get your coordinates from Google Maps:</p>
            <ol className="list-decimal list-inside mt-1 space-y-1">
              <li>Right-click your location on Google Maps</li>
              <li>Click on the coordinates at the top</li>
              <li>Paste them here</li>
            </ol>
          </div>
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
