// src/components/rewardStore/LojaShell.jsx
//
// Casca compartilhada da Loja de Prêmios: tema, header com carrinho,
// drawer do carrinho e estado da carteira.
//
// Usada por /loja e /loja/produto/:id para as duas páginas terem o mesmo
// header e o mesmo carrinho sem duplicar lógica.

import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  AppBar,
  Badge,
  Box,
  createTheme,
  CssBaseline,
  IconButton,
  ThemeProvider,
  Toolbar,
  Typography,
} from "@mui/material";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import ShoppingCartRoundedIcon from "@mui/icons-material/ShoppingCartRounded";

import { getMyNsCredits } from "../../services/nscredits";
import { useAuth } from "../../authContext";
import { CartProvider, useCart } from "./CartContext";
import CartDrawer from "./CartDrawer";

export const lojaTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#67C23A" },
    secondary: { main: "#FFC107" },
    error: { main: "#D32F2F" },
    warning: { main: "#FFB300" },
    background: { default: "#0E0E0E", paper: "#121212" },
    success: { main: "#59b15f" },
  },
  shape: { borderRadius: 16 },
  typography: {
    fontFamily: ["Inter", "system-ui", "Segoe UI", "Roboto", "Arial"].join(","),
    button: { textTransform: "none", fontWeight: 800 },
  },
});

/** Carteira do cliente com os três estados factuais (carregando / saldo / erro). */
const WalletCtx = React.createContext({ balance: null, loading: false, error: false, onRetry: () => {} });

export function useStoreWallet() {
  return React.useContext(WalletCtx);
}

function ShellChrome({ children, onBack }) {
  const navigate = useNavigate();
  const { count } = useCart();
  const { user } = useAuth();
  const wallet = useStoreWallet();
  const [cartOpen, setCartOpen] = React.useState(false);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", overflowX: "hidden" }}>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{ bgcolor: "#0A0A0A", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <Toolbar sx={{ gap: 1 }}>
          <IconButton edge="start" onClick={onBack || (() => navigate("/"))} aria-label="Voltar">
            <ArrowBackIosNewRoundedIcon fontSize="small" />
          </IconButton>
          <Typography sx={{ fontWeight: 900, flex: 1, letterSpacing: 0.5 }}>NEW STORE</Typography>

          {user && (
            <IconButton onClick={() => setCartOpen(true)} aria-label={`Carrinho com ${count} item(ns)`}>
              <Badge badgeContent={count} color="primary" overlap="circular">
                <ShoppingCartRoundedIcon />
              </Badge>
            </IconButton>
          )}
        </Toolbar>
      </AppBar>

      {children}

      {user && <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} walletBalance={wallet.balance} />}
    </Box>
  );
}

export default function LojaShell({ children, onBack }) {
  const { user, loading: authLoading } = useAuth();

  const [wallet, setWallet] = React.useState({ balance: null, loading: false, error: false });

  const loadWallet = React.useCallback(async () => {
    setWallet({ balance: null, loading: true, error: false });
    try {
      const payload = await getMyNsCredits();
      setWallet({ balance: Number(payload?.wallet?.balance ?? 0), loading: false, error: false });
    } catch {
      // Erro NUNCA vira saldo 0.
      setWallet({ balance: null, loading: false, error: true });
    }
  }, []);

  React.useEffect(() => {
    if (authLoading || !user) return;
    loadWallet();
  }, [authLoading, user, loadWallet]);

  const walletValue = React.useMemo(() => ({ ...wallet, onRetry: loadWallet }), [wallet, loadWallet]);

  return (
    <ThemeProvider theme={lojaTheme}>
      <CssBaseline />
      <WalletCtx.Provider value={walletValue}>
        <CartProvider enabled={Boolean(user)}>
          <ShellChrome onBack={onBack}>{children}</ShellChrome>
        </CartProvider>
      </WalletCtx.Provider>
    </ThemeProvider>
  );
}
