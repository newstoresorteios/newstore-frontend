// src/LoginPage.jsx
import * as React from "react";
import { useLocation, useNavigate, Link as RouterLink } from "react-router-dom";
import {
  AppBar, Box, Button, Checkbox, Container, CssBaseline, FormControlLabel,
  IconButton, InputAdornment, Paper, Stack, TextField, ThemeProvider, Toolbar,
  Typography, createTheme, Link, Alert
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

const API_BASE = (process.env.REACT_APP_API_BASE_URL || "/api").replace(/\/+$/, "");
const authHeaders = () => {
  const tk =
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("token");
  return tk ? { Authorization: `Bearer ${tk}` } : {};
};

// fallback por e-mail caso /api/me não traga is_admin por algum motivo
const ADMIN_EMAIL_FALLBACK = "admin@newstore.com.br";

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/conta";

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [remember, setRemember] = React.useState(true);
  const [showPass, setShowPass] = React.useState(false);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  // Se o contexto já disser que é admin, redireciona automaticamente
  React.useEffect(() => {
    if (user?.is_admin) {
      navigate("/admin", { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!/\S+@\S+\.\S+/.test(email)) { setError("Informe um e-mail válido."); return; }
    if (password.length < 6) { setError("A senha deve ter pelo menos 6 caracteres."); return; }

    try {
      setLoading(true);
      await login({ email, password, remember }); // não faz navigate aqui

      // Confirma no backend quem é o usuário logado
      let isAdmin = false;
      try {
        const r = await fetch(`${API_BASE}/me`, {
          method: "GET",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          credentials: "include",
        });
        if (r.ok) {
          const me = await r.json();
          isAdmin = !!me?.user?.is_admin;
        }
      } catch {}

      if (!isAdmin && email.toLowerCase() === ADMIN_EMAIL_FALLBACK) {
        isAdmin = true;
      }

      if (isAdmin) {
        // força o redirect para evitar que qualquer guard anterior sobreponha
        navigate("/admin", { replace: true });
      } else {
        navigate(from, { replace: true });
      }
    } catch (err) {
      setError(err?.message || "Falha ao entrar.");
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
              <Link href="#" underline="hover" sx={{ fontSize: 14, opacity: 0.9 }}>
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
    </ThemeProvider>
  );
}
