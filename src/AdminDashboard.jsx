// src/AdminDashboard.jsx
import * as React from "react";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import {
  AppBar,
  Box,
  ButtonBase,
  Container,
  CssBaseline,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Stack,
  ThemeProvider,
  Toolbar,
  Typography,
  createTheme,
} from "@mui/material";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import AccountCircleRoundedIcon from "@mui/icons-material/AccountCircleRounded";
import logoNewStore from "./Logo-branca-sem-fundo-768x132.png";
import { useAuth } from "./authContext";
import { adminListReservations } from "./services/admin";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#2E7D32" },
    background: { default: "#0E0E0E", paper: "#121212" },
    warning: { main: "#B58900" },
  },
  shape: { borderRadius: 16 },
  typography: { fontFamily: ["Inter","system-ui","Segoe UI","Roboto","Arial"].join(",") },
});

function BigCard({ children, color, outlined = false, onClick }) {
  return (
    <ButtonBase onClick={onClick} sx={{ width: "100%" }}>
      <Paper
        elevation={0}
        sx={{
          width: "100%",
          p: { xs: 3, md: 4 },
          borderRadius: 4,
          bgcolor: outlined ? "transparent" : color,
          border: outlined ? "1px solid rgba(255,255,255,0.16)" : "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: { xs: 120, md: 140 },
          transition: "transform 120ms ease, filter 120ms ease",
          "&:hover": { transform: "translateY(-2px)", filter: "brightness(1.02)" },
          textAlign: "center",
        }}
      >
        <Typography
          sx={{
            fontWeight: 900,
            letterSpacing: 2,
            fontSize: { xs: 18, md: 28 },
            lineHeight: 1.25,
            color: outlined ? "rgba(255,255,255,0.85)" : "#fff",
            textTransform: "uppercase",
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          }}
        >
          {children}
        </Typography>
      </Paper>
    </ButtonBase>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [menuEl, setMenuEl] = React.useState(null);
  const menuOpen = Boolean(menuEl);
  const openMenu = (e) => setMenuEl(e.currentTarget);
  const closeMenu = () => setMenuEl(null);
  const goPainel = () => { closeMenu(); navigate("/admin"); };
  const doLogout = () => { closeMenu(); logout(); navigate("/"); };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

      <AppBar position="sticky" elevation={0} sx={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <Toolbar sx={{ position: "relative", minHeight: 64 }}>
          {/* “Voltar” mantém no dashboard */}
          <IconButton edge="start" color="inherit" onClick={() => navigate("/admin")} aria-label="Voltar">
            <ArrowBackIosNewRoundedIcon />
          </IconButton>

          {/* Logo central leva para /admin */}
          <Box
            component={RouterLink}
            to="/admin"
            sx={{
              position: "absolute",
              left: "50%", top: "50%",
              transform: "translate(-50%, -50%)",
              display: "flex", alignItems: "center",
            }}
          >
            <Box component="img" src={logoNewStore} alt="NEW STORE" sx={{ height: 40, objectFit: "contain" }} />
          </Box>

          <IconButton color="inherit" sx={{ ml: "auto" }} onClick={openMenu} aria-label="Menu do usuário">
            <AccountCircleRoundedIcon />
          </IconButton>
          <Menu
            anchorEl={menuEl}
            open={menuOpen}
            onClose={closeMenu}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
          >
            <MenuItem onClick={goPainel}>Painel (Admin)</MenuItem>
            <Divider />
            <MenuItem onClick={doLogout}>Sair</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ py: { xs: 4, md: 8 } }}>
        <Stack spacing={4} alignItems="center">
          <Typography sx={{ fontWeight: 900, textAlign: "center", lineHeight: 1.1, fontSize: { xs: 28, md: 56 } }}>
            Painel de Controlo
            <br /> dos Sorteios
          </Typography>

          <Stack spacing={3} sx={{ width: "100%" }}>
            <BigCard outlined onClick={() => navigate("/admin/sorteios")}>
              LISTA DE SORTEIOS
              <br /> REALIZADOS
            </BigCard>

            <BigCard color="primary.main" onClick={() => navigate("/admin/clientes")}>
              LISTA DE CLIENTES
              <br /> COM SALDO ATIVO
            </BigCard>

            <BigCard color="warning.main" onClick={() => navigate("/admin/vencedores")}>
              LISTA DE VENCEDORES
              <br /> DOS SORTEIOS
            </BigCard>
          </Stack>
        </Stack>
      </Container>
    </ThemeProvider>
  );
}
