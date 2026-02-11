import { createContext, useContext, useReducer } from "react";

const BasketContext = createContext();

function basketReducer(state, action) {
  switch (action.type) {
    case "ADD_ITEM": {
      // If switching restaurant, clear basket
      if (state.restaurantId && state.restaurantId !== action.restaurantId) {
        return {
          restaurantId: action.restaurantId,
          restaurantSlug: action.restaurantSlug,
          items: [{ ...action.item, quantity: 1 }],
        };
      }
      const existing = state.items.find((i) => i.id === action.item.id);
      if (existing) {
        return {
          ...state,
          restaurantId: action.restaurantId,
          restaurantSlug: action.restaurantSlug,
          items: state.items.map((i) =>
            i.id === action.item.id ? { ...i, quantity: i.quantity + 1 } : i
          ),
        };
      }
      return {
        ...state,
        restaurantId: action.restaurantId,
        restaurantSlug: action.restaurantSlug,
        items: [...state.items, { ...action.item, quantity: 1 }],
      };
    }
    case "REMOVE_ITEM": {
      const item = state.items.find((i) => i.id === action.itemId);
      if (!item) return state;
      if (item.quantity <= 1) {
        const items = state.items.filter((i) => i.id !== action.itemId);
        return { ...state, items, restaurantId: items.length ? state.restaurantId : null };
      }
      return {
        ...state,
        items: state.items.map((i) =>
          i.id === action.itemId ? { ...i, quantity: i.quantity - 1 } : i
        ),
      };
    }
    case "UPDATE_QUANTITY": {
      if (action.quantity <= 0) {
        const items = state.items.filter((i) => i.id !== action.itemId);
        return { ...state, items, restaurantId: items.length ? state.restaurantId : null };
      }
      return {
        ...state,
        items: state.items.map((i) =>
          i.id === action.itemId ? { ...i, quantity: action.quantity } : i
        ),
      };
    }
    case "CLEAR":
      return { restaurantId: null, restaurantSlug: null, items: [] };
    default:
      return state;
  }
}

export function BasketProvider({ children }) {
  const [basket, dispatch] = useReducer(basketReducer, {
    restaurantId: null,
    restaurantSlug: null,
    items: [],
  });

  const addItem = (item, restaurantId, restaurantSlug) =>
    dispatch({ type: "ADD_ITEM", item, restaurantId, restaurantSlug });
  const removeItem = (itemId) => dispatch({ type: "REMOVE_ITEM", itemId });
  const updateQuantity = (itemId, quantity) =>
    dispatch({ type: "UPDATE_QUANTITY", itemId, quantity });
  const clearBasket = () => dispatch({ type: "CLEAR" });

  const totalItems = basket.items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = basket.items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <BasketContext.Provider
      value={{ basket, addItem, removeItem, updateQuantity, clearBasket, totalItems, subtotal }}
    >
      {children}
    </BasketContext.Provider>
  );
}

export function useBasket() {
  const ctx = useContext(BasketContext);
  if (!ctx) throw new Error("useBasket must be used within BasketProvider");
  return ctx;
}
