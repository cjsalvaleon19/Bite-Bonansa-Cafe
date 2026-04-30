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

export type PaymentMethod = 'gcash' | 'cash' | 'points' | 'points+gcash' | 'points+cash'
