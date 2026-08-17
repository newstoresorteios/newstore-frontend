// src/components/rewardStore/CartContext.jsx
//
// Estado do carrinho na UI.
//
// A AUTORIDADE é o backend: toda mutação devolve o carrinho recalculado pelo
// servidor e substituímos o estado local por ele. Nada é calculado no cliente
// nem guardado em localStorage como fonte de verdade.

import * as React from "react";
import {
  getCart as apiGetCart,
  addCartItem as apiAddItem,
  updateCartItem as apiUpdateItem,
  removeCartItem as apiRemoveItem,
  clearCart as apiClearCart,
  validateCart as apiValidateCart,
  cartBadgeCount,
  isAuthError,
} from "../../services/rewardCart";

const EMPTY_CART = { id: null, items: [], totals: { items: 0, units: 0, nscredits: 0 } };

const CartCtx = React.createContext(null);

export function CartProvider({ children, enabled = true }) {
  const [cart, setCart] = React.useState(EMPTY_CART);
  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [validation, setValidation] = React.useState(null);

  const refresh = React.useCallback(async () => {
    if (!enabled) {
      setCart(EMPTY_CART);
      return;
    }
    setLoading(true);
    try {
      const payload = await apiGetCart();
      setCart(payload?.cart || EMPTY_CART);
      setError("");
    } catch (e) {
      // Visitante não tem carrinho — isso não é erro de tela.
      if (!isAuthError(e)) setError("Não foi possível carregar seu carrinho.");
      setCart(EMPTY_CART);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  /** Toda mutação: bloqueia concorrência e adota o carrinho devolvido pelo servidor. */
  const mutate = React.useCallback(async (fn) => {
    setBusy(true);
    try {
      const payload = await fn();
      if (payload?.cart) setCart(payload.cart);
      // Qualquer alteração invalida a validação anterior.
      setValidation(null);
      return payload;
    } finally {
      setBusy(false);
    }
  }, []);

  const addItem = React.useCallback(
    (input) => mutate(() => apiAddItem(input)),
    [mutate]
  );
  const updateItem = React.useCallback(
    (itemId, quantity) => mutate(() => apiUpdateItem(itemId, quantity)),
    [mutate]
  );
  const removeItem = React.useCallback((itemId) => mutate(() => apiRemoveItem(itemId)), [mutate]);
  const clear = React.useCallback(() => mutate(() => apiClearCart()), [mutate]);

  const validate = React.useCallback(async () => {
    setBusy(true);
    try {
      const out = await apiValidateCart();
      setValidation(out);
      return out;
    } finally {
      setBusy(false);
    }
  }, []);

  const value = React.useMemo(
    () => ({
      cart,
      count: cartBadgeCount(cart),
      loading,
      busy,
      error,
      validation,
      refresh,
      addItem,
      updateItem,
      removeItem,
      clear,
      validate,
      clearValidation: () => setValidation(null),
    }),
    [cart, loading, busy, error, validation, refresh, addItem, updateItem, removeItem, clear, validate]
  );

  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

export function useCart() {
  const ctx = React.useContext(CartCtx);
  if (!ctx) throw new Error("useCart precisa estar dentro de CartProvider");
  return ctx;
}

export { EMPTY_CART };
