// src/AdminClientes.jsx
import * as React from "react";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import {
  AppBar,
  Box,
  Container,
  CssBaseline,
  IconButton,
  Menu,
  MenuItem,
  Divider,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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
    background: { default: "#0E0E0E", paper: "#121212" },
    success: { main: "#67C23A" },
  },
  typography: {
    fontFamily: ["Inter", "system-ui", "Segoe UI", "Roboto", "Arial"].join(","),
  },
});

const fmtBRL = (v) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(v)
  );

const rows = [
  { nome: "Gabriel Almeida", cadastro: "07/12/2023", compras: 2, total: 345, ultima: "30/03/2024", vezes: 0, dias: 174 },
  { nome: "Carla Martins",   cadastro: "22/02/2023", compras: 5, total: 229, ultima: "30/12/2024", vezes: 1, dias: 134 },
  { nome: "Felipe Pereira",   cadastro: "05/03/2024", compras: 3, total: 235, ultima: "30/02/2023", vezes: 1, dias: 1   },
  { nome: "Vanessa Souza",    cadastro: "30/12/2023", compras: 2, total: 302, ultima: "26/02/2023", vezes: 0, dias: 81  },
  { nome: "Rafael Oliveira",  cadastro: "25/02/2024", compras: 1, total: 253, ultima: "30/02/2024", vezes: 2, dias: 91  },
  { nome: "Bruna Fernandes",  cadastro: "21/08/2023", compras: 1, total: 360, ultima: "26/02/2024", vezes: 1, dias: 124 },
  { nome: "André Carvalho",   cadastro: "21/06/2023", compras: 0, total: 140, ultima: "26/06/2023", vezes: 3, dias: 174 },
];

export default function AdminClientes() {
    const [rows, setRows] = React.useState([]);
  React.useEffect(() => { (async () => { try { const list = await adminListReservations(); setRows(list); } catch(e){ console.error(e);} })(); }, []);
const navigate = useNavigate();
  const { logout } = useAuth();

  // menu avatar
  const [menuEl, setMenuEl] = React.useState(null);
  const open = Boolean(menuEl);
  const openMenu = (e) => setMenuEl(e.currentTarget);
  const closeMenu = () => setMenuEl(null);
  const goPainel = () => { closeMenu(); navigate("/admin"); };
  const doLogout = () => { closeMenu(); logout(); navigate("/"); };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="sticky" elevation={0} sx={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <Toolbar sx={{ position: "relative", minHeight: 64 }}>
          <IconButton edge="start" color="inherit" onClick={() => navigate("/admin")} aria-label="Voltar">
            <ArrowBackIosNewRoundedIcon />
          </IconButton>
          <Box
            component={RouterLink}
            to="/admin"
            sx={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
            }}
          >
            <Box component="img" src={logoNewStore} alt="NEW STORE" sx={{ height: 40 }} />
          </Box>
          <IconButton color="inherit" sx={{ ml: "auto" }} onClick={openMenu}>
            <AccountCircleRoundedIcon />
          </IconButton>
          <Menu
            anchorEl={menuEl}
            open={open}
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

      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 6 } }}>
        <Typography
          sx={{
            fontWeight: 900,
            textTransform: "uppercase",
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            fontSize: { xs: 24, md: 44 },
            mb: 2,
          }}
        >
          Lista de clientes com saldo ativo
        </Typography>

        <Paper variant="outlined" sx={{ bgcolor: "background.paper" }}>
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table sx={{ minWidth: 900 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800 }}>NOME DO CLIENTE</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>DATA DE CADASTRO</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>QUANTIDADE DE COMPRAS</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>VALOR TOTAL INVESTIDO</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>ÚLTIMA COMPRA</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>VEZES CONTEMPLADO</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>DIAS PARA EXPIRAÇÃO</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.nome} hover>
                    <TableCell>{r.nome}</TableCell>
                    <TableCell>{r.cadastro}</TableCell>
                    <TableCell>{r.compras}</TableCell>
                    <TableCell>{fmtBRL(r.total)}</TableCell>
                    <TableCell>{r.ultima}</TableCell>
                    <TableCell>{r.vezes}</TableCell>
                    <TableCell sx={{ color: "success.main", fontWeight: 800 }}>
                      {r.dias}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Container>
    </ThemeProvider>
  );
}
