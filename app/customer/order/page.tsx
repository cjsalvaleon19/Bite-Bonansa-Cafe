'use client'

import { useState, useEffect } from 'react'
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  MapPin,
  Truck,
  Banknote,
  ShoppingBag,
  Gift,
  CheckCircle2,
  Smartphone,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { formatCurrency, useAuth, calculateDeliveryFee, formatDistance } from '@/lib/store'
import { supabase } from '@/lib/supabase/client'
import { LocationPicker } from '@/components/location-picker'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import type { MenuItem, MenuItemAddon, PaymentMethod } from '@/lib/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CartItem {
  id: string
  comboKey: string
  menuItemId: string
  menuItem: MenuItem
  quantity: number
  basePrice: number
  addonPrice: number
  price: number
  selectedVariety?: string
  selectedSize?: string
  selectedAddons: MenuItemAddon[]
}

const GCASH_OWNER = {
  name: 'Catherine Jean Arclita',
  number: '09514915138',
}

function calcEarnedPoints(subtotal: number): number {
  const rate = subtotal <= 500 ? 0.002 : 0.0035
  return Math.floor(subtotal * rate)
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CustomerOrderPage() {
  const { user } = useAuth()
  const router = useRouter()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [cart, setCart] = useState<CartItem[]>([])
  const [deliveryAddress, setDeliveryAddress] = useState(user?.address || '')
  const [deliveryLat, setDeliveryLat] = useState<number | null>(null)
  const [deliveryLng, setDeliveryLng] = useState<number | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('gcash')
  const [orderNotes, setOrderNotes] = useState('')
  const [cashTendered, setCashTendered] = useState('')
  const [gcashRef, setGcashRef] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showGcashDialog, setShowGcashDialog] = useState(false)
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [dbCategories, setDbCategories] = useState<{ id: string; name: string }[]>([])
  const [orderType, setOrderType] = useState<'delivery' | 'pickup'>('delivery')
  const [showItemDialog, setShowItemDialog] = useState(false)
  const [dialogItem, setDialogItem] = useState<MenuItem | null>(null)

  useEffect(() => {
    async function loadMenu() {
      const [{ data: items }, { data: cats }] = await Promise.all([
        supabase
          .from('menu_items')
          .select('*, category:categories(id, name)')
          .eq('available', true)
          .order('name'),
        supabase.from('categories').select('*').order('sort_order'),
      ])
      if (items) {
        setMenuItems(
          items.map((item: any) => ({
            id: item.id,
            name: item.name,
            description: item.description || '',
            price: item.price,
            category: item.category?.name || '',
            available: item.available,
            preparationTime: item.preparation_time || 0,
            varieties: Array.isArray(item.varieties)
              ? item.varieties.map((v: any) => (typeof v === 'string' ? v : v?.name ?? String(v)))
              : [],
            sizes: item.sizes || [],
            addons: item.addons || [],
            kitchenDepartment: item.kitchen_department || '',
          }))
        )
      }
      if (cats) setDbCategories(cats)
    }
    loadMenu()
  }, [])

  const filteredItems = menuItems.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description ?? '').toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory =
      selectedCategory === 'all' || item.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const openItemDialog = (item: MenuItem) => {
    const hasOptions =
      (item.varieties && item.varieties.length > 0) ||
      (item.sizes && item.sizes.length > 0) ||
      (item.addons && item.addons.length > 0)
    if (hasOptions) {
      setDialogItem(item)
      setShowItemDialog(true)
    } else {
      addToCartWithCustomizations(item, '', '', [], 1)
    }
  }

  const addToCartWithCustomizations = (
    item: MenuItem,
    variety: string,
    sizeName: string,
    addons: MenuItemAddon[],
    quantity: number
  ) => {
    const sizeObj = (item.sizes as any[])?.find((s: any) => s.name === sizeName)
    const basePrice = sizeObj?.price ?? item.price
    const addonPrice = addons.reduce((sum, a) => sum + a.price, 0)
    const unitPrice = basePrice + addonPrice
    const comboKey = `${item.id}|${variety}|${sizeName}|${addons.map(a => a.name).sort().join(',')}`

    setCart(prev => {
      const existing = prev.find(c => c.comboKey === comboKey)
      if (existing) {
        return prev.map(c =>
          c.comboKey === comboKey
            ? { ...c, quantity: c.quantity + quantity, price: (c.quantity + quantity) * unitPrice }
            : c
        )
      }
      return [...prev, {
        id: String(Date.now()),
        comboKey,
        menuItemId: item.id,
        menuItem: item,
        quantity,
        basePrice,
        addonPrice,
        price: unitPrice * quantity,
        selectedVariety: variety || undefined,
        selectedSize: sizeName || undefined,
        selectedAddons: addons,
      }]
    })
    toast.success(`Added ${item.name} to cart`)
  }

  const updateQuantity = (itemId: string, delta: number) => {
    setCart(
      cart.map((item) => {
        if (item.id === itemId) {
          const newQuantity = item.quantity + delta
          if (newQuantity <= 0) return null
          const unitPrice = item.basePrice + item.addonPrice
          return { ...item, quantity: newQuantity, price: newQuantity * unitPrice }
        }
        return item
      }).filter(Boolean) as CartItem[]
    )
  }

  const removeFromCart = (itemId: string) => {
    setCart(cart.filter((item) => item.id !== itemId))
  }

  const subtotal = cart.reduce((sum, item) => sum + item.price, 0)
  const { fee: deliveryFee, distance: deliveryDistance, outOfRange: deliveryOutOfRange } =
    calculateDeliveryFee(deliveryLat, deliveryLng)
  const appliedDeliveryFee = orderType === 'delivery' ? deliveryFee : 0
  const total = subtotal + appliedDeliveryFee
  const earnedPoints = calcEarnedPoints(subtotal)

  const handlePlaceOrder = async () => {
    if (orderType === 'delivery' && !deliveryAddress.trim()) {
      toast.error('Please enter a delivery address')
      return
    }
    if (orderType === 'delivery' && deliveryOutOfRange) {
      toast.error('Your location is outside our delivery area (max 10 km).')
      return
    }
    if (paymentMethod === 'cash') {
      const cashAmount = parseFloat(cashTendered)
      if (isNaN(cashAmount) || cashAmount < total) {
        toast.error('Please enter a valid cash amount that covers the total')
        return
      }
    }
    if (paymentMethod === 'gcash') {
      setShowGcashDialog(true)
      return
    }
    await submitOrder()
  }

  const submitOrder = async () => {
    setIsSubmitting(true)
    setShowGcashDialog(false)
    try {
      const isDelivery = orderType === 'delivery'
      let notesStr = orderNotes
      if (paymentMethod === 'cash' && cashTendered) {
        notesStr += ` | Cash tendered: ${formatCurrency(parseFloat(cashTendered))}`
      }
      if (paymentMethod === 'gcash' && gcashRef) {
        notesStr += ` | GCash ref: ${gcashRef}`
      }
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: user?.id,
          customer_name: user?.name || 'Customer',
          customer_phone: user?.phone || '',
          customer_address: isDelivery ? deliveryAddress : null,
          delivery_lat: isDelivery ? deliveryLat : null,
          delivery_lng: isDelivery ? deliveryLng : null,
          status: 'pending',
          order_type: isDelivery ? 'delivery' : 'takeout',
          payment_method: paymentMethod,
          payment_status: paymentMethod === 'gcash' ? 'paid' : 'pending',
          subtotal,
          delivery_fee: isDelivery ? appliedDeliveryFee : 0,
          discount: 0,
          total,
          notes: notesStr.trim(),
        } as any)
        .select()
        .single()
      if (orderError) throw new Error(orderError.message)
      const orderItems = cart.map((item) => {
        const parts: string[] = []
        if (item.selectedVariety) parts.push(item.selectedVariety)
        if (item.selectedSize) parts.push(item.selectedSize)
        if (item.selectedAddons.length > 0) parts.push(item.selectedAddons.map(a => a.name).join(', '))
        const displayName = parts.length > 0
          ? `${item.menuItem.name} (${parts.join(' | ')})`
          : item.menuItem.name
        return {
          order_id: (order as any).id,
          menu_item_id: item.menuItemId,
          name: displayName,
          price: item.basePrice + item.addonPrice,
          quantity: item.quantity,
          subtotal: item.price,
        }
      })
      const { error: itemsError } = await supabase.from('order_items').insert(orderItems as any)
      if (itemsError) throw new Error(itemsError.message)
      toast.success(`Order ${(order as any).order_number} placed successfully!`, {
        description: 'You can track your order in the Track Orders page.',
      })
      setCart([])
      setOrderNotes('')
      setCashTendered('')
      setGcashRef('')
      router.push('/customer/track')
    } catch (error) {
      console.error('Failed to place order:', error)
      toast.error('Failed to place order. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLocationSelect = (address: string, lat: number, lng: number) => {
    setDeliveryAddress(address)
    setDeliveryLat(lat)
    setDeliveryLng(lng)
    const { fee, distance, outOfRange } = calculateDeliveryFee(lat, lng)
    if (outOfRange) {
      toast.error('Your location is outside our delivery area (max 10 km).')
    } else {
      toast.success(`Location pinned! Delivery fee: ${formatCurrency(fee)} (${formatDistance(distance ?? 0)})`)
    }
  }

  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div className="min-h-screen bg-black space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Order Now</h1>
          <p className="text-muted-foreground">Browse our menu and place your order</p>
        </div>

        <Sheet>
          <SheetTrigger className="relative inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 md:hidden">
            <ShoppingCart className="mr-2 h-5 w-5" />
            Cart
            {cartItemCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground">
                {cartItemCount}
              </span>
            )}
          </SheetTrigger>
          <SheetContent className="flex w-full flex-col sm:max-w-lg">
            <SheetHeader>
              <SheetTitle>Your Cart</SheetTitle>
              <SheetDescription>Review your order before checkout</SheetDescription>
            </SheetHeader>
            <CartContent
              cart={cart}
              updateQuantity={updateQuantity}
              removeFromCart={removeFromCart}
              subtotal={subtotal}
              deliveryFee={appliedDeliveryFee}
              deliveryDistance={deliveryDistance}
              deliveryOutOfRange={deliveryOutOfRange}
              total={total}
              earnedPoints={earnedPoints}
              deliveryAddress={deliveryAddress}
              setDeliveryAddress={setDeliveryAddress}
              openLocationPicker={() => setShowLocationPicker(true)}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              orderNotes={orderNotes}
              setOrderNotes={setOrderNotes}
              cashTendered={cashTendered}
              setCashTendered={setCashTendered}
              handlePlaceOrder={handlePlaceOrder}
              isSubmitting={isSubmitting}
              orderType={orderType}
            />
          </SheetContent>
        </Sheet>
      </div>

      <div className="flex gap-2 rounded-lg border bg-muted/30 p-1 w-fit">
        <Button
          variant={orderType === 'delivery' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setOrderType('delivery')}
          className="gap-2"
        >
          <Truck className="h-4 w-4" />
          Delivery
        </Button>
        <Button
          variant={orderType === 'pickup' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setOrderType('pickup')}
          className="gap-2"
        >
          <ShoppingBag className="h-4 w-4" />
          Pick-up
        </Button>
      </div>

      {orderType === 'pickup' && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary">
          <strong>Pick-up order</strong> — Come to the cafe to collect your order. No delivery fee will be charged.
        </div>
      )}

      <div className="flex gap-6">
        <div className="flex-1 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search menu items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
            <TabsList className="flex-wrap">
              <TabsTrigger value="all">All</TabsTrigger>
              {dbCategories.map((category) => (
                <TabsTrigger key={category.id} value={category.name}>
                  {category.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item) => {
              const varieties = (item.varieties as unknown as string[]) ?? []
              const sizes = (item.sizes as any[]) ?? []
              const addons = (item.addons as any[]) ?? []
              const hasVarieties = varieties.length > 0
              const hasSizes = sizes.length > 0
              const hasAddons = addons.length > 0
              const hasOptions = hasVarieties || hasSizes || hasAddons

              const minSizePrice = hasSizes
                ? Math.min(...sizes.map((s: any) => s.price))
                : null
              const priceLabel = minSizePrice !== null
                ? `from ${formatCurrency(minSizePrice)}`
                : formatCurrency(item.price)

              return (
                <Card
                  key={item.id}
                  className="overflow-hidden cursor-pointer transition-all hover:border-primary/50 hover:shadow-md"
                  onClick={() => openItemDialog(item)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold leading-snug">{item.name}</h3>
                      <span className="text-base font-bold text-primary whitespace-nowrap">{priceLabel}</span>
                    </div>

                    {item.description && (
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                        {item.description}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap gap-1">
                      {hasVarieties && varieties.slice(0, 3).map((v: string) => (
                        <span
                          key={v}
                          className="inline-block rounded-full border border-primary/30 px-2 py-0.5 text-[11px] text-primary/80"
                        >
                          {v}
                        </span>
                      ))}
                      {hasVarieties && varieties.length > 3 && (
                        <span className="inline-block rounded-full border border-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                          +{varieties.length - 3} more
                        </span>
                      )}
                      {hasSizes && sizes.map((s: any) => (
                        <span
                          key={s.name}
                          className="inline-block rounded-full border border-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                        >
                          {s.name}
                        </span>
                      ))}
                    </div>

                    {hasAddons && (
                      <p className="mt-1 text-[11px] text-muted-foreground">+ Add-ons available</p>
                    )}

                    <div className="mt-3">
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation()
                          openItemDialog(item)
                        }}
                      >
                        <Plus className="mr-1 h-4 w-4" />
                        {hasOptions ? 'Select Options' : 'Add to Cart'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        <div className="hidden w-96 md:block">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Your Cart
                {cartItemCount > 0 && (
                  <Badge variant="secondary">{cartItemCount}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CartContent
                cart={cart}
                updateQuantity={updateQuantity}
                removeFromCart={removeFromCart}
                subtotal={subtotal}
                deliveryFee={appliedDeliveryFee}
                deliveryDistance={deliveryDistance}
                deliveryOutOfRange={deliveryOutOfRange}
                total={total}
                earnedPoints={earnedPoints}
                deliveryAddress={deliveryAddress}
                setDeliveryAddress={setDeliveryAddress}
                openLocationPicker={() => setShowLocationPicker(true)}
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
                orderNotes={orderNotes}
                setOrderNotes={setOrderNotes}
                cashTendered={cashTendered}
                setCashTendered={setCashTendered}
                handlePlaceOrder={handlePlaceOrder}
                isSubmitting={isSubmitting}
                orderType={orderType}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <ItemCustomizationDialog
        item={dialogItem}
        open={showItemDialog}
        onClose={() => setShowItemDialog(false)}
        onAddToCart={addToCartWithCustomizations}
      />

      {showLocationPicker && (
        <LocationPicker
          isOpen={showLocationPicker}
          onClose={() => setShowLocationPicker(false)}
          onSelectLocation={(lat: number, lng: number, address: string) => {
            handleLocationSelect(address, lat, lng)
          }}
        />
      )}

      <GCashDialog
        open={showGcashDialog}
        onOpenChange={setShowGcashDialog}
        total={total}
        gcashRef={gcashRef}
        setGcashRef={setGcashRef}
        onConfirm={submitOrder}
        isSubmitting={isSubmitting}
      />
    </div>
  )
}

// ─── Item Customization Dialog ────────────────────────────────────────────────

interface ItemCustomizationDialogProps {
  item: MenuItem | null
  open: boolean
  onClose: () => void
  onAddToCart: (
    item: MenuItem,
    variety: string,
    sizeName: string,
    addons: MenuItemAddon[],
    quantity: number
  ) => void
}

function ItemCustomizationDialog({ item, open, onClose, onAddToCart }: ItemCustomizationDialogProps) {
  const [selectedVariety, setSelectedVariety] = useState('')
  const [selectedSize, setSelectedSize] = useState<{ name: string; price: number } | null>(null)
  const [selectedAddons, setSelectedAddons] = useState<MenuItemAddon[]>([])
  const [quantity, setQuantity] = useState(1)

  useEffect(() => {
    if (item) {
      setSelectedVariety('')
      setSelectedSize(null)
      setSelectedAddons([])
      setQuantity(1)
    }
  }, [item])

  // Clear size selection if switching to Hot variety with incompatible size
  useEffect(() => {
    if (selectedVariety === 'Hot' && selectedSize && (selectedSize.name === '16oz' || selectedSize.name === '22oz')) {
      setSelectedSize(null)
    }
  }, [selectedVariety, selectedSize])

  if (!item) return null

  const varieties = (item.varieties as unknown as string[]) ?? []
  const sizes = (item.sizes as any[]) ?? []
  const addons = (item.addons as MenuItemAddon[]) ?? []

  const basePrice = selectedSize?.price ?? item.price
  const addonTotal = selectedAddons.reduce((sum, a) => sum + a.price, 0)
  const lineTotal = (basePrice + addonTotal) * quantity

  const toggleAddon = (addon: MenuItemAddon) => {
    setSelectedAddons(prev =>
      prev.find(a => a.name === addon.name)
        ? prev.filter(a => a.name !== addon.name)
        : [...prev, addon]
    )
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item.name}</DialogTitle>
          {item.description && (
            <DialogDescription>{item.description}</DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-5 py-2">
          {varieties.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">
                Variety <span className="text-destructive">*</span>
              </Label>
              <RadioGroup value={selectedVariety} onValueChange={setSelectedVariety} className="space-y-1">
                {varieties.map((v: string) => (
                  <div key={v} className="flex items-center gap-2">
                    <RadioGroupItem value={v} id={`variety-${v}`} />
                    <Label htmlFor={`variety-${v}`} className="cursor-pointer font-normal">{v}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}

          {sizes.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">
                Size <span className="text-destructive">*</span>
              </Label>
              <RadioGroup
                value={selectedSize?.name || ''}
                onValueChange={(name) => setSelectedSize(sizes.find((x: any) => x.name === name) || null)}
                className="space-y-1"
              >
                {sizes.map((s: any) => {
                  // Disable 16oz and 22oz when Hot variety is selected
                  const isDisabled = selectedVariety === 'Hot' && (s.name === '16oz' || s.name === '22oz')
                  return (
                    <div key={s.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <RadioGroupItem 
                          value={s.name} 
                          id={`size-${s.name}`} 
                          disabled={isDisabled}
                          className={isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
                        />
                        <Label 
                          htmlFor={`size-${s.name}`} 
                          className={isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer font-normal'}
                        >
                          {s.name}
                        </Label>
                      </div>
                      <span className={`text-sm ${isDisabled ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
                        {formatCurrency(s.price)}
                      </span>
                    </div>
                  )
                })}
              </RadioGroup>
            </div>
          )}

          {addons.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">
                Add-ons <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <div className="space-y-1.5">
                {addons.map((addon: MenuItemAddon) => (
                  <div key={addon.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`addon-${addon.name}`}
                        checked={selectedAddons.some(a => a.name === addon.name)}
                        onChange={() => toggleAddon(addon)}
                      />
                      <Label htmlFor={`addon-${addon.name}`} className="cursor-pointer font-normal">
                        {addon.name}
                      </Label>
                    </div>
                    {addon.price > 0 && (
                      <span className="text-sm text-muted-foreground">+{formatCurrency(addon.price)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <Label className="text-sm font-semibold">Quantity</Label>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" className="h-8 w-8" onClick={() => setQuantity(Math.max(1, quantity - 1))}>
                <Minus className="h-3 w-3" />
              </Button>
              <span className="w-8 text-center font-semibold">{quantity}</span>
              <Button variant="outline" size="sm" className="h-8 w-8" onClick={() => setQuantity(quantity + 1)}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-2 flex-col gap-2">
          {varieties.length > 0 && !selectedVariety && (
            <p className="w-full text-center text-xs text-destructive">Please select a variety to continue.</p>
          )}
          {sizes.length > 0 && !selectedSize && (
            <p className="w-full text-center text-xs text-destructive">Please select a size to continue.</p>
          )}
          <div className="flex w-full items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-xl font-bold text-primary">{formatCurrency(lineTotal)}</p>
            </div>
            <Button
              className="flex-1"
              disabled={
                (varieties.length > 0 && !selectedVariety) ||
                (sizes.length > 0 && !selectedSize)
              }
              onClick={() => {
                onAddToCart(item, selectedVariety, selectedSize?.name || '', selectedAddons, quantity)
                onClose()
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add to Cart
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── GCash Dialog ─────────────────────────────────────────────────────────────

interface GCashDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  total: number
  gcashRef: string
  setGcashRef: (ref: string) => void
  onConfirm: () => void
  isSubmitting: boolean
}

function GCashDialog({ open, onOpenChange, total, gcashRef, setGcashRef, onConfirm, isSubmitting }: GCashDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>GCash Payment</DialogTitle>
          <DialogDescription>Send the exact amount then enter your reference number below</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg bg-blue-50 p-4 text-center">
            <p className="text-sm text-muted-foreground">Send to GCash number:</p>
            <p className="text-2xl font-bold text-blue-600">{GCASH_OWNER.number}</p>
            <p className="font-medium">{GCASH_OWNER.name}</p>
          </div>
          <div className="rounded-lg bg-muted p-4 text-center">
            <p className="text-sm text-muted-foreground">Amount to send:</p>
            <p className="text-3xl font-bold text-primary">{formatCurrency(total)}</p>
          </div>
          <Button variant="outline" className="w-full" onClick={() => window.open('https://app.gcash.com', '_blank')}>
            <Smartphone className="mr-2 h-4 w-4" />
            Open GCash App
          </Button>
          <div className="space-y-2">
            <Label htmlFor="gcashRef" className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              GCash Reference Number
            </Label>
            <Input
              id="gcashRef"
              placeholder="Enter reference number after sending payment"
              value={gcashRef}
              onChange={(e) => setGcashRef(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Found in your GCash transaction history after payment is sent.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button className="flex-1" onClick={onConfirm} disabled={isSubmitting || !gcashRef.trim()}>
              {isSubmitting ? 'Processing...' : 'Confirm Payment'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Cart Content ─────────────────────────────────────────────────────────────

interface CartContentProps {
  cart: CartItem[]
  updateQuantity: (itemId: string, delta: number) => void
  removeFromCart: (itemId: string) => void
  subtotal: number
  deliveryFee: number
  deliveryDistance: number | null
  deliveryOutOfRange?: boolean
  total: number
  earnedPoints: number
  deliveryAddress: string
  setDeliveryAddress: (address: string) => void
  openLocationPicker: () => void
  paymentMethod: PaymentMethod
  setPaymentMethod: (method: PaymentMethod) => void
  orderNotes: string
  setOrderNotes: (notes: string) => void
  cashTendered: string
  setCashTendered: (amount: string) => void
  handlePlaceOrder: () => void
  isSubmitting: boolean
  orderType?: 'delivery' | 'pickup'
}

function CartContent({
  cart, updateQuantity, removeFromCart, subtotal, deliveryFee, deliveryDistance,
  deliveryOutOfRange = false, total, earnedPoints, deliveryAddress, setDeliveryAddress,
  openLocationPicker, paymentMethod, setPaymentMethod, orderNotes, setOrderNotes,
  cashTendered, setCashTendered, handlePlaceOrder, isSubmitting, orderType = 'delivery',
}: CartContentProps) {
  const change = paymentMethod === 'cash' && cashTendered ? parseFloat(cashTendered) - total : 0

  if (cart.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
        <ShoppingCart className="mb-2 h-12 w-12 opacity-50" />
        <p>Your cart is empty</p>
        <p className="text-sm">Add items from the menu to get started</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <ScrollArea className="flex-1 pr-4">
        <div className="space-y-3">
          {cart.map((item) => (
            <div key={item.id} className="rounded-lg border p-2 space-y-1">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium line-clamp-1">{item.menuItem.name}</p>
                  {(item.selectedVariety || item.selectedSize || item.selectedAddons.length > 0) && (
                    <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
                      {item.selectedVariety && <p>Variety: {item.selectedVariety}</p>}
                      {item.selectedSize && <p>Size: {item.selectedSize}</p>}
                      {item.selectedAddons.length > 0 && (
                        <p>Add-ons: {item.selectedAddons.map(a => a.name).join(', ')}</p>
                      )}
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">{formatCurrency(item.basePrice + item.addonPrice)} each</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="outline" size="sm" className="h-7 w-7" onClick={() => updateQuantity(item.id, -1)}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-8 text-center font-medium">{item.quantity}</span>
                  <Button variant="outline" size="sm" className="h-7 w-7" onClick={() => updateQuantity(item.id, 1)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 text-destructive" onClick={() => removeFromCart(item.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <p className="text-right text-sm font-semibold">{formatCurrency(item.price)}</p>
            </div>
          ))}
        </div>

        <Separator className="my-4" />

        {orderType === 'delivery' && (
          <div className="space-y-2">
            <Label htmlFor="address" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Delivery Address
            </Label>
            <Textarea
              id="address"
              placeholder="Enter your delivery address"
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              className="resize-none"
              rows={2}
            />
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={openLocationPicker}>
              <MapPin className="mr-2 h-4 w-4" />
              Search &amp; Pin Location on Map
            </Button>
            {deliveryOutOfRange && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <strong>Outside delivery area.</strong> More than 10 km from our store.
              </div>
            )}
          </div>
        )}

        {orderType === 'pickup' && (
          <div className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
            📍 <strong>Pick-up at:</strong> Bite Bonansa Cafe, T&apos;boli, South Cotabato
          </div>
        )}

        <div className="mt-4 space-y-3">
          <Label className="font-semibold">Payment Method</Label>
          <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)} className="flex gap-4">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="gcash" id="gcash" />
              <Label htmlFor="gcash">GCash</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="cash" id="cash" />
              <Label htmlFor="cash">
                {orderType === 'delivery' ? 'Cash on Delivery' : 'Cash'}
              </Label>
            </div>
          </RadioGroup>
          <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
            <span className="flex items-center gap-1.5 text-amber-700">
              <Gift className="h-4 w-4" />
              Points you&apos;ll earn
            </span>
            <span className="font-bold text-amber-700">+{earnedPoints} pts</span>
          </div>
        </div>

        {paymentMethod === 'cash' && (
          <div className="mt-4 space-y-2">
            <Label htmlFor="cashTendered" className="flex items-center gap-2">
              <Banknote className="h-4 w-4" />
              Cash to be Tendered
            </Label>
            <Input
              id="cashTendered"
              type="number"
              placeholder="Enter amount you will pay"
              value={cashTendered}
              onChange={(e) => setCashTendered(e.target.value)}
              min={total}
            />
            {cashTendered && parseFloat(cashTendered) >= total && (
              <p className="text-sm text-green-600">Change: {formatCurrency(change)}</p>
            )}
            {cashTendered && parseFloat(cashTendered) < total && (
              <p className="text-sm text-red-600">Amount must be at least {formatCurrency(total)}</p>
            )}
          </div>
        )}

        <div className="mt-4 space-y-2">
          <Label htmlFor="notes">Order Notes (Optional)</Label>
          <Textarea
            id="notes"
            placeholder="Any special instructions?"
            value={orderNotes}
            onChange={(e) => setOrderNotes(e.target.value)}
            className="resize-none"
            rows={2}
          />
        </div>
      </ScrollArea>

      <div className="mt-4 space-y-2 border-t pt-4">
        <div className="flex justify-between text-sm">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        {orderType === 'delivery' && (
          <div className="flex justify-between text-sm">
            <div className="flex flex-col">
              <span className="flex items-center gap-1">
                <Truck className="h-3 w-3" />
                Delivery Fee
              </span>
              {deliveryDistance !== null && (
                <span className="text-xs text-muted-foreground">
                  Distance: {formatDistance(deliveryDistance)}
                </span>
              )}
            </div>
            <span>{formatCurrency(deliveryFee)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>VAT</span>
          <span>₱0.00</span>
        </div>
        <Separator />
        <div className="flex justify-between text-xl font-bold">
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>

      <Button
        className="mt-4 w-full"
        size="lg"
        onClick={handlePlaceOrder}
        disabled={
          isSubmitting ||
          (orderType === 'delivery' && !deliveryAddress.trim()) ||
          (orderType === 'delivery' && deliveryOutOfRange) ||
          (paymentMethod === 'cash' && (!cashTendered || parseFloat(cashTendered) < total))
        }
      >
        {isSubmitting ? 'Placing Order...' : 'Place Order'}
      </Button>
    </div>
  )
}
