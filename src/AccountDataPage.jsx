// src/AccountDataPage.jsx
import * as React from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import logoNewStore from "./Logo-branca-sem-fundo-768x132 - Copia.png";
import { useAuth } from "./authContext";
import { apiJoin, authHeaders, getJSON } from "./lib/api";
import {
  Alert,
  AppBar,
  Box,
  Button,
  Container,
  CssBaseline,
  IconButton,
  LinearProgress,
  Menu,
  MenuItem,
  Divider,
  Paper,
  Stack,
  TextField,
  ThemeProvider,
  Toolbar,
  Typography,
  createTheme,
} from "@mui/material";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import AccountCircleRoundedIcon from "@mui/icons-material/AccountCircleRounded";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#67C23A" },
    secondary: { main: "#FFC107" },
    error: { main: "#D32F2F" },
    background: { default: "#0E0E0E", paper: "#121212" },
    success: { main: "#7CFF6B" },
    warning: { main: "#B58900" },
  },
  shape: { borderRadius: 12 },
  typography: { fontFamily: ["Inter", "system-ui", "Segoe UI", "Roboto", "Arial"].join(",") },
});

function phoneDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function isValidCustomerPhone(value) {
  const digits = phoneDigits(value);
  if (digits.length === 10 || digits.length === 11) return true;
  return (digits.length === 12 || digits.length === 13) && digits.startsWith("55");
}

function getUserPhone(user) {
  return String(user?.phone || user?.telefone || user?.phone_number || "").trim();
}

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("me") || "null");
  } catch {
    return null;
  }
}

export default function AccountDataPage() {
  const navigate = useNavigate();
  const { logout, user: ctxUser } = useAuth();
  const [menuEl, setMenuEl] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);
  const [user, setUser] = React.useState(ctxUser || readStoredUser());
  const [phoneEditing, setPhoneEditing] = React.useState(false);
  const [phoneInput, setPhoneInput] = React.useState("");
  const [phoneSaving, setPhoneSaving] = React.useState(false);
  const [phoneStatus, setPhoneStatus] = React.useState(null);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const data = await getJSON("/me");
        const nextUser = data?.user || data || null;
        if (!alive) return;
        setUser(nextUser);
        setPhoneInput(getUserPhone(nextUser));
        try { if (nextUser) localStorage.setItem("me", JSON.stringify(nextUser)); } catch {}
      } catch {
        if (alive) setLoadError(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  React.useEffect(() => {
    if (!phoneEditing) setPhoneInput(getUserPhone(user));
  }, [phoneEditing, user]);

  const accountName = user?.name || user?.fullName || user?.nome || user?.displayName || user?.username || "Não informado";
  const accountEmail = user?.email || "Não informado";
  const accountPhone = getUserPhone(user);
  const accountPhoneText = accountPhone || "Não informado";

  const doLogout = () => {
    setMenuEl(null);
    logout();
    navigate("/");
  };

  async function handleSavePhone() {
    const phone = phoneDigits(phoneInput);
    setPhoneStatus(null);

    if (!isValidCustomerPhone(phone)) {
      setPhoneStatus({ type: "error", message: "Informe um telefone válido." });
      return;
    }

    try {
      setPhoneSaving(true);
      const r = await fetch(apiJoin("/me/phone"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "include",
        body: JSON.stringify({ phone }),
      });
      const data = await r.json().catch(() => ({}));

      if (!r.ok || data?.ok === false) {
        setPhoneStatus({ type: "error", message: "Informe um telefone válido." });
        return;
      }

      const nextUser = { ...(user || {}), ...(data?.user || {}), phone: data?.user?.phone || phone };
      setUser(nextUser);
      setPhoneInput(getUserPhone(nextUser));
      setPhoneEditing(false);
      setPhoneStatus({ type: "success", message: "Telefone atualizado com sucesso." });
      try { localStorage.setItem("me", JSON.stringify(nextUser)); } catch {}
      try { localStorage.removeItem("push_permission_prompt_dismissed_until"); } catch {}
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("push-permission-prompt:recheck"));
      }
    } catch {
      setPhoneStatus({ type: "error", message: "Não foi possível salvar o telefone. Tente novamente." });
    } finally {
      setPhoneSaving(false);
    }
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="sticky" elevation={0} sx={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <Toolbar sx={{ position: "relative", minHeight: { xs: 56, md: 64 }, px: { xs: 1, sm: 2 } }}>
          <IconButton edge="start" color="inherit" onClick={() => navigate("/conta")} aria-label="Voltar">
            <ArrowBackIosNewRoundedIcon />
          </IconButton>
          <Box
            component={RouterLink}
            to="/"
            sx={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              display: "flex",
              alignItems: "center",
            }}
          >
            <Box component="img" src={logoNewStore} alt="NEW STORE" sx={{ height: { xs: 42, sm: 58, md: 62 }, objectFit: "contain" }} />
          </Box>
          <IconButton color="inherit" sx={{ ml: "auto" }} onClick={(e) => setMenuEl(e.currentTarget)}>
            <AccountCircleRoundedIcon />
          </IconButton>
          <Menu
            anchorEl={menuEl}
            open={Boolean(menuEl)}
            onClose={() => setMenuEl(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
          >
            <MenuItem onClick={() => { setMenuEl(null); navigate("/conta"); }}>Área do cliente</MenuItem>
            <Divider />
            <MenuItem onClick={doLogout}>Sair</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ py: { xs: 2.5, md: 5 } }}>
        <Stack spacing={2.5}>
          <Box>
            <Typography variant="h5" fontWeight={900}>Meus dados</Typography>
            <Typography variant="body2" sx={{ opacity: 0.78, mt: 0.5 }}>
              Confira suas informações cadastradas.
            </Typography>
          </Box>

          <Button variant="text" onClick={() => navigate("/conta")} sx={{ alignSelf: "flex-start", px: 0 }}>
            Voltar para Área do Cliente
          </Button>

          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
            {loading ? (
              <Stack spacing={1.5}>
                <Typography>Carregando seus dados...</Typography>
                <LinearProgress />
              </Stack>
            ) : loadError ? (
              <Alert severity="error" variant="outlined">Não foi possível carregar seus dados.</Alert>
            ) : (
              <Stack spacing={2.25}>
                <Stack spacing={0.75}>
                  <Typography variant="body2" sx={{ opacity: 0.75 }}>Nome</Typography>
                  <Typography fontWeight={800}>{accountName}</Typography>
                  <Typography variant="caption" sx={{ opacity: 0.62 }}>Somente leitura</Typography>
                </Stack>

                <Stack spacing={0.75}>
                  <Typography variant="body2" sx={{ opacity: 0.75 }}>E-mail</Typography>
                  <Typography fontWeight={800} sx={{ wordBreak: "break-word" }}>{accountEmail}</Typography>
                  <Typography variant="caption" sx={{ opacity: 0.62 }}>Somente leitura</Typography>
                </Stack>

                <Stack spacing={1.5}>
                  <Typography variant="body2" sx={{ opacity: 0.75 }}>Telefone</Typography>
                  {phoneEditing ? (
                    <Stack spacing={1.5} sx={{ maxWidth: 420 }}>
                      <TextField
                        label="Telefone"
                        type="tel"
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(e.target.value)}
                        disabled={phoneSaving}
                        fullWidth
                        inputProps={{ inputMode: "tel", maxLength: 20 }}
                      />
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                        <Button variant="contained" color="success" onClick={handleSavePhone} disabled={phoneSaving}>
                          {phoneSaving ? "Salvando..." : "Salvar"}
                        </Button>
                        <Button
                          variant="text"
                          onClick={() => {
                            setPhoneEditing(false);
                            setPhoneInput(accountPhone);
                            setPhoneStatus(null);
                          }}
                          disabled={phoneSaving}
                        >
                          Cancelar
                        </Button>
                      </Stack>
                    </Stack>
                  ) : (
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "flex-start", sm: "center" }}>
                      <Typography fontWeight={800}>{accountPhoneText}</Typography>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => {
                          setPhoneInput(accountPhone);
                          setPhoneStatus(null);
                          setPhoneEditing(true);
                        }}
                      >
                        {accountPhone ? "Editar telefone" : "Adicionar telefone"}
                      </Button>
                    </Stack>
                  )}
                </Stack>

                {phoneStatus && (
                  <Alert severity={phoneStatus.type} variant="outlined" sx={{ maxWidth: 520 }}>
                    {phoneStatus.message}
                  </Alert>
                )}
              </Stack>
            )}
          </Paper>
        </Stack>
      </Container>
    </ThemeProvider>
  );
}