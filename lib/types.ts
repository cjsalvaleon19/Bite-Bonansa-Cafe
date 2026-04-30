export interface MenuItem {
  id: string
  name: string
  description?: string
  price: number
  category: string
  available: boolean
  preparationTime?: number
  varieties?: MenuItemVariety[]
  sizes?: MenuItemSize[]
  addons?: MenuItemAddon[]
  kitchenDepartment?: string
  // New variant system fields
  has_variants?: boolean
  variant_types?: VariantType[]
}

export interface VariantType {
  id: string
  variant_type_name: string
  is_required: boolean
  allow_multiple: boolean
  display_order: number
  options?: VariantOption[]
}

export interface VariantOption {
  id: string
  option_name: string
  price_modifier: number
  available: boolean
  display_order: number
}

export interface MenuItemVariety {
  name: string
  price: number
}

export interface MenuItemSize {
  name: string
  price: number
}

export interface MenuItemAddon {
  name: string
  price: number
}

/**
 * Payment method types supported by the system.
 * - 'gcash': Payment via GCash only
 * - 'cash': Payment via cash only
 * - 'points': Payment using loyalty points only
 * - 'points+gcash': Partial payment with points, remainder paid via GCash
 * - 'points+cash': Partial payment with points, remainder paid via cash
 * 
 * Note: Combined methods (points+X) are explicitly defined rather than using
 * template literals to ensure only valid combinations are allowed. Only points
 * can be combined with other payment methods for partial payments.
 */
export type PaymentMethod = 'gcash' | 'cash' | 'points' | 'points+gcash' | 'points+cash'
