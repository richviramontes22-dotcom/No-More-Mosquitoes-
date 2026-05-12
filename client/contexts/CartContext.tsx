import React, { createContext, useContext, useState, useEffect } from "react";
import { CatalogItem } from "@/hooks/dashboard/useCatalogItems";

/**
 * Cart item type - represents a product/service in the cart
 */
export interface CartItemEntry extends CatalogItem {
  quantity: number;
  addedAt: string;
  propertyId?: string; // For services that require property selection
  cartPrice?: number; // Effective price in cents for cart calculations
}

/**
 * Calculate the effective cart price for an item in cents
 * Handles fixed, free, range, and consultation price types
 */
function getCartPrice(item: CatalogItem): number {
  // Fixed price items
  if (item.priceType === "fixed" && item.priceCents !== null) {
    return item.priceCents;
  }

  // Free items
  if (item.priceType === "free") {
    return 0;
  }

  // Range price items - use minimum price or 0
  if (item.priceType === "range" && item.minPriceCents !== null) {
    return item.minPriceCents;
  }

  // Consultation items or unknown price type - treat as free/quote items (0)
  return 0;
}

/**
 * Cart context type
 */
interface CartContextType {
  items: CartItemEntry[];
  itemCount: number;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  addItem: (item: CatalogItem, quantity?: number, propertyId?: string) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  updatePropertyId: (itemId: string, propertyId: string) => void;
  clearCart: () => void;
  persistCart: () => void;
}

/**
 * Create the context with default values
 */
const CartContext = createContext<CartContextType | undefined>(undefined);

/**
 * Provider component
 */
export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItemEntry[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem("marketplace_cart");
      if (savedCart) {
        const parsedCart = JSON.parse(savedCart);
        setItems(Array.isArray(parsedCart) ? parsedCart : []);
      }
    } catch (error) {
      console.error("[CartContext] Failed to load cart from localStorage:", error);
    }
    setIsHydrated(true);
  }, []);

  // Persist cart to localStorage whenever it changes
  useEffect(() => {
    if (isHydrated) {
      try {
        localStorage.setItem("marketplace_cart", JSON.stringify(items));
      } catch (error) {
        console.error("[CartContext] Failed to persist cart to localStorage:", error);
      }
    }
  }, [items, isHydrated]);

  // Calculate totals using the effective cart price
  const subtotalCents = items.reduce((sum, item) => {
    const price = item.cartPrice ?? getCartPrice(item);
    return sum + (price * item.quantity);
  }, 0);
  // Assuming 7.75% tax for California (can be made dynamic later)
  const taxCents = Math.round(subtotalCents * 0.0775);
  const totalCents = subtotalCents + taxCents;

  const addItem = (item: CatalogItem, quantity: number = 1, propertyId?: string) => {
    setItems((prevItems) => {
      // Check if item already exists
      const existingIndex = prevItems.findIndex((cartItem) => cartItem.id === item.id);

      if (existingIndex >= 0) {
        // Item exists, increase quantity
        const updated = [...prevItems];
        updated[existingIndex].quantity += quantity;
        return updated;
      } else {
        // New item, add to cart
        const cartPrice = getCartPrice(item);
        return [
          ...prevItems,
          {
            ...item,
            quantity,
            addedAt: new Date().toISOString(),
            propertyId,
            cartPrice,
          },
        ];
      }
    });
  };

  const removeItem = (itemId: string) => {
    setItems((prevItems) => prevItems.filter((item) => item.id !== itemId));
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(itemId);
      return;
    }

    setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === itemId ? { ...item, quantity } : item
      )
    );
  };

  const updatePropertyId = (itemId: string, propertyId: string) => {
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === itemId ? { ...item, propertyId } : item
      )
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const persistCart = () => {
    try {
      localStorage.setItem("marketplace_cart", JSON.stringify(items));
    } catch (error) {
      console.error("[CartContext] Failed to persist cart:", error);
    }
  };

  const value: CartContextType = {
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotalCents,
    taxCents,
    totalCents,
    addItem,
    removeItem,
    updateQuantity,
    updatePropertyId,
    clearCart,
    persistCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

/**
 * Hook to use the cart context
 */
export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};
