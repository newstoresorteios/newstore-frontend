// src/AdminVencedores.jsx
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

const theme = createTheme({
  palette: {
    mode: "dark",
    background: { default: "#0E0E0E", paper: "#121212" },
    success: { main: "#67C23A" },
    error: { main: "#D32F2F" },
  },
});

const winners = [
  { nome: "Ana",      numero: 94, data: "19/02/2024", status: "NÃO RESGATADO", dias: 20 },
  { nome: "Mateus",   numero: 96, data: "05/03/2024", status: "RESGATADO",     dias: 5  },
  { nome: "Amanda",   numero: 98, data: "10/02/2024", status: "NÃO RESGATADO", dias: 28 },
  { nome: "Julia",    numero: 93, data: "21/12/2023", status: "RESGATADO",     dias: 80 },
  { nome: "Diego",    numero: 96, data: "05/02/2024", status: "RESGATADO",     dias: 34 },
  { nome: "Maria",    numero: 95, data: "30/12/2023", status: "NÃO RESGATADO", dias: 70 },
  { nome: "Gustavo",  numero: 97, data: "03/02/2024", status: "RESGATADO",     dias: 35 },
  { nome: "Caio",     numero: 90, data: "18/12/2023", status: "RESGATADO",     dias: 35 },
  { nome: "Caio",     numero: 89, data: "17/12/2023", status: "NÃO RESGATADO", dias: 83 },
  { nome: "Fernanda", numero: 92, data: "31/01/2024", status: "RESGATADO",     dias: 38 },
];

const pad3 = (n) => n.toString().padStart(3, "0");

export default function AdminVencedores() {
  const navigate = useNavigate();
  const { logout } = useAuth();

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
          align="center"
          sx={{
            fontWeight: 900,
            lineHeight: 1.1,
            fontSize: { xs: 26, md: 48 },
            mb: 3,
          }}
        >
          Lista de Vencedores
          <br />
          dos Sorteios
        </Typography>

        <Paper variant="outlined">
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table sx={{ minWidth: 800 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800 }}>NOME DO USUÁRIO</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Nº SORTEIO</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>DATA DO SORTEIO</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>SITUAÇÃO DO PRÊMIO</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>DIAS CONTEMPLADO</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {winners.map((w, i) => (
                  <TableRow key={`${w.nome}-${i}`} hover>
                    <TableCell>{w.nome}</TableCell>
                    <TableCell>{pad3(w.numero)}</TableCell>
                    <TableCell>{w.data}</TableCell>
                    <TableCell
                      sx={{
                        color: w.status === "RESGATADO" ? "success.main" : "error.main",
                        fontWeight: 800,
                      }}
                    >
                      {w.status}
                    </TableCell>
                    <TableCell>{w.dias}</TableCell>
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
