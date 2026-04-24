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

export type PaymentMethod = 'gcash' | 'cash' | 'points'
