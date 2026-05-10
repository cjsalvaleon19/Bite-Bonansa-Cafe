import { create } from 'zustand';

const useCartStore = create((set, get) => ({
  items: [],

  addItem: (item) =>
    set((state) => {
      // Create a unique cart key based on item ID and variant details
      const cartKey = item.cartKey || item.id;
      const existing = state.items.find((i) => (i.cartKey || i.id) === cartKey);
      
      if (existing) {
        return {
          items: state.items.map((i) =>
            (i.cartKey || i.id) === cartKey ? { ...i, quantity: i.quantity + (item.quantity || 1) } : i
          ),
        };
      }
      return { items: [...state.items, { ...item, cartKey, quantity: item.quantity || 1 }] };
    }),

  removeItem: (id) =>
    set((state) => ({ items: state.items.filter((i) => (i.cartKey || i.id) !== id) })),

  replaceItem: (oldId, item) =>
    set((state) => {
      const newCartKey = item.cartKey || item.id;
      const baseItems = state.items.filter((i) => (i.cartKey || i.id) !== oldId);
      const existingIndex = baseItems.findIndex((i) => (i.cartKey || i.id) === newCartKey);
      const nextQuantity = Math.max(1, Number(item.quantity) || 1);

      if (existingIndex >= 0) {
        const existing = baseItems[existingIndex];
        baseItems[existingIndex] = {
          ...existing,
          quantity: existing.quantity + nextQuantity,
        };
        return { items: baseItems };
      }

      return { items: [...baseItems, { ...item, cartKey: newCartKey, quantity: nextQuantity }] };
    }),

  updateQuantity: (id, quantity) =>
    set((state) => ({
      items:
        quantity <= 0
          ? state.items.filter((i) => (i.cartKey || i.id) !== id)
          : state.items.map((i) => ((i.cartKey || i.id) === id ? { ...i, quantity } : i)),
    })),

  clearCart: () => set({ items: [] }),

  getTotalItems: () =>
    get().items.reduce((sum, i) => sum + i.quantity, 0),

  getTotalPrice: () =>
    get().items.reduce((sum, i) => {
      const itemPrice = i.finalPrice || i.price || i.base_price || 0;
      return sum + itemPrice * i.quantity;
    }, 0),
}));

export default useCartStore;
