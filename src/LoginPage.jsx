// src/LoginPage.jsx
import * as React from "react";
import { useLocation, useNavigate, Link as RouterLink } from "react-router-dom";
import {
  AppBar, Box, Button, Checkbox, Container, CssBaseline, FormControlLabel,
  IconButton, InputAdornment, Paper, Stack, TextField, ThemeProvider, Toolbar,
  Typography, createTheme, Link, Alert, Dialog, DialogTitle, DialogContent, DialogActions
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import logoNewStore from "./Logo-branca-sem-fundo-768x132.png";
import { useAuth } from "./authContext";

const theme = createTheme({
  palette: { mode: "dark", primary: { main: "#67C23A" }, background: { default: "#0E0E0E", paper: "#121212" } },
  shape: { borderRadius: 12 },
  typography: { fontFamily: ['Inter','system-ui','Segoe UI','Roboto','Arial'].join(',') }
});

const ADMIN_EMAIL = "admin@newstore.com.br";
// Base URL robusta (aceita vir com/sem /api)
const RAW_API = process.env.REACT_APP_API_BASE_URL || "/api";
const API_BASE = (
  RAW_API.endsWith("/api") ? RAW_API : `${RAW_API.replace(/\/+$/, "")}/api`
).replace(/\/+$/, "");

// Token -> Authorization (fallback)
const authHeaders = () => {
  const tk =
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("token");
  return tk ? { Authorization: `Bearer ${tk}` } : {};
};

// Gera senha aleatória (6 chars: letras e números)
function genPass(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/conta";

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [remember, setRemember] = React.useState(true);
  const [showPass, setShowPass] = React.useState(false);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  // ----- ESQUECI MINHA SENHA (modal) -----
  const [forgotOpen, setForgotOpen] = React.useState(false);
  const [forgotEmail, setForgotEmail] = React.useState("");
  const [forgotLoading, setForgotLoading] = React.useState(false);
  const [forgotError, setForgotError] = React.useState("");
  const [forgotSent, setForgotSent] = React.useState(false);
  const [sentTo, setSentTo] = React.useState("");

  const openForgot = () => {
    setForgotError("");
    setForgotSent(false);
    setSentTo("");
    setForgotEmail(email || "");
    setForgotOpen(true);
  };
  const closeForgot = () => {
    if (forgotLoading) return;
    setForgotOpen(false);
  };

  async function handleResetPassword() {
    setForgotError("");
    const e = (forgotEmail || "").trim();
    if (!/\S+@\S+\.\S+/.test(e)) {
      setForgotError("Informe um e-mail válido.");
      return;
    }
    setForgotLoading(true);
    try {
      const newPassword = genPass(6);
      // Tentamos alguns caminhos comuns — para imediatamente no primeiro 2xx
      const candidates = [
        `${API_BASE.replace(/\/api$/, "")}/auth/reset-password`,
        `${API_BASE}/auth/reset-password`,
        `${API_BASE.replace(/\/api$/, "")}/auth/forgot`,
        `${API_BASE}/auth/forgot`,
      ];

      let ok = false;
      for (const url of candidates) {
        try {
          const r = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders() },
            credentials: "include",
            body: JSON.stringify({
              email: e,
              newPassword,
              from: "administracao@newstoresorteios.com.br",
              subject: "Reset de senha - New Store Sorteios",
              message: `Sua senha foi resetada.\n\nNova Senha: ${newPassword}\n\nSe você não solicitou, ignore este e-mail.`
            }),
          });
          if (r.ok) { ok = true; break; }
        } catch { /* tenta o próximo caminho */ }
      }

      if (!ok) {
        setForgotError("Não foi possível solicitar o reset agora. Tente novamente em instantes.");
        return;
      }

      setSentTo(e);
      setForgotSent(true);
    } finally {
      setForgotLoading(false);
    }
  }
  // ----------------------------------------

  // LOGIN
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!/\S+@\S+\.\S+/.test(email)) { setError("Informe um e-mail válido."); return; }
    if (password.length < 6)        { setError("A senha deve ter pelo menos 6 caracteres."); return; }

    try {
      setLoading(true);

      // faz login (o hook grava cookie e storage)
      await login({ email, password, remember });

      // tenta descobrir quem é o usuário logado
      let user = null;
      try {
        const r = await fetch(`${API_BASE}/me`, {
          method: "GET",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          credentials: "include",
        });
        if (r.ok) {
          const body = await r.json();
          user = body?.user || body || null;
          if (user) localStorage.setItem("me", JSON.stringify(user));
        }
      } catch {}

      const isAdmin =
        !!user?.is_admin || (user?.email || email).trim().toLowerCase() === ADMIN_EMAIL;

      navigate(isAdmin ? "/admin" : from, { replace: true });
    } catch (err) {
      setError(err.message || "Falha ao entrar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="sticky" elevation={0} sx={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <Toolbar sx={{ position: "relative", minHeight: 64 }}>
          <IconButton edge="start" color="inherit" onClick={() => navigate(-1)} aria-label="Voltar">
            <ArrowBackIosNewRoundedIcon />
          </IconButton>
          <Box
            component={RouterLink}
            to="/"
            sx={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", display: "flex", alignItems: "center" }}
          >
            <Box component="img" src={logoNewStore} alt="NEW STORE" sx={{ height: 40, objectFit: "contain" }} />
          </Box>
        </Toolbar>
      </AppBar>

      <Container maxWidth="sm" sx={{ py: { xs: 4, md: 8 } }}>
        <Paper sx={{ p: { xs: 3, md: 4 }, borderRadius: 3, bgcolor: "background.paper" }} elevation={0} variant="outlined">
          <Stack spacing={2} component="form" onSubmit={handleSubmit}>
            <Typography variant="h5" fontWeight={800}>Entrar</Typography>
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              Use seu e-mail e senha para acessar sua área.
            </Typography>

            {error && <Alert severity="error">{error}</Alert>}

            <TextField
              label="E-mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              required
              autoComplete="email"
            />
            <TextField
              label="Senha"
              type={showPass ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              required
              autoComplete="current-password"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPass(s => !s)} edge="end" aria-label="mostrar/ocultar senha">
                      {showPass ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />

            <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap">
              <FormControlLabel
                control={<Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)} />}
                label="Manter-me conectado"
              />
              <Link component="button" type="button" onClick={openForgot} underline="hover" sx={{ fontSize: 14, opacity: 0.9 }}>
                Esqueci minha senha
              </Link>
            </Stack>

            <Button type="submit" variant="contained" color="primary" size="large" disabled={loading} sx={{ py: 1.2, fontWeight: 700 }}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>

            <Button component={RouterLink} to="/cadastro" variant="text" sx={{ fontWeight: 700, mt: 1 }}>
              Criar conta
            </Button>

            <Typography variant="caption" sx={{ opacity: 0.7, mt: 1 }}>
              Dica (mock): qualquer e-mail válido e senha com 6+ caracteres funcionam.
              Para o admin use: admin@newstore.com.br
            </Typography>
          </Stack>
        </Paper>
      </Container>

      {/* Modal: Esqueci minha senha */}
      <Dialog open={forgotOpen} onClose={closeForgot} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 900 }}>
          {forgotSent ? "E-mail enviado" : "Resetar senha"}
        </DialogTitle>

        <DialogContent sx={{ pt: 1 }}>
          {!forgotSent ? (
            <>
              {forgotError && <Alert severity="error" sx={{ mb: 2 }}>{forgotError}</Alert>}
              <TextField
                label="Informe seu e-mail"
                type="email"
                fullWidth
                autoFocus
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
              />
            </>
          ) : (
            <Alert severity="success">
              E-mail enviado para <strong>{sentTo}</strong>.
            </Alert>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          {!forgotSent ? (
            <>
              <Button onClick={closeForgot} disabled={forgotLoading}>Cancelar</Button>
              <Button
                onClick={handleResetPassword}
                variant="contained"
                color="primary"
                disabled={forgotLoading}
              >
                {forgotLoading ? "Enviando..." : "Resetar senha"}
              </Button>
            </>
          ) : (
            <Button onClick={closeForgot} variant="contained" color="success">OK</Button>
          )}
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  );
}
