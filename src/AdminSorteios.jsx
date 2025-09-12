// src/AdminSorteios.jsx
import * as React from "react";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import {
  AppBar, Box, Container, CssBaseline, IconButton, Menu, MenuItem, Divider,
  Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  ThemeProvider, Toolbar, Typography, createTheme
} from "@mui/material";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import AccountCircleRoundedIcon from "@mui/icons-material/AccountCircleRounded";
import logoNewStore from "./Logo-branca-sem-fundo-768x132.png";
import { useAuth } from "./authContext";
import { getDrawNumbers } from "./services/numbers";

const theme = createTheme({
  palette: { mode: "dark", background: { default: "#0E0E0E", paper: "#121212" } },
});

const pad3 = (n) => n.toString().padStart(3, "0");

const data = [
  { n: 98, abertura: "04/02/2024", fechamento: "10/02/2024", dias: 10, realizacao: "10/02/2024", vencedor: "Amanda" },
  { n: 97, abertura: "10/02/2024", fechamento: "10/02/2024", dias: 10, realizacao: "19/02/2024", vencedor: "Mateus" },
  { n: 96, abertura: "26/02/2024", fechamento: "26/02/2024", dias: 9,  realizacao: "17/02/2024", vencedor: "Julia" },
  { n: 95, abertura: "23/02/2024", fechamento: "24/02/2024", dias: 8,  realizacao: "12/02/2024", vencedor: "Diego" },
  { n: 94, abertura: "20/02/2024", fechamento: "27/12/2023", dias: 8,  realizacao: "19/02/2024", vencedor: "Caio" },
  { n: 93, abertura: "19/11/2023", fechamento: "27/12/2023", dias: 7,  realizacao: "12/02/2024", vencedor: "Fernanda" },
  { n: 92, abertura: "17/11/2023", fechamento: "26/12/2023", dias: 8,  realizacao: "19/11/2023", vencedor: "Emilly" },
  { n: 91, abertura: "16/10/2023", fechamento: "26/12/2023", dias: 9,  realizacao: "18/10/2023", vencedor: "Gustavo" },
  { n: 90, abertura: "15/10/2023", fechamento: "23/12/2023", dias: 6,  realizacao: "17/11/2023", vencedor: "Maria" },
  { n: 89, abertura: "20/12/2023", fechamento: "27/12/2023", dias: 10, realizacao: "27/12/2023", vencedor: "Ana" },
];

export default function AdminSorteios() {
    const DRAW_ID = process.env.REACT_APP_DRAW_ID || '1';
  const [nums, setNums] = React.useState([]);
  React.useEffect(() => { (async () => { try { const list = await getDrawNumbers(DRAW_ID); setNums(list);} catch(e){ console.error(e);} })(); }, [DRAW_ID]);
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
          <Box component={RouterLink} to="/admin" sx={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}>
            <Box component="img" src={logoNewStore} alt="NEW STORE" sx={{ height: 40 }} />
          </Box>
          <IconButton color="inherit" sx={{ ml: "auto" }} onClick={openMenu}>
            <AccountCircleRoundedIcon />
          </IconButton>
          <Menu anchorEl={menuEl} open={open} onClose={closeMenu}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}>
            <MenuItem onClick={goPainel}>Painel (Admin)</MenuItem>
            <Divider />
            <MenuItem onClick={doLogout}>Sair</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 6 } }}>
        <Typography align="center" sx={{ fontWeight: 900, lineHeight: 1.1, fontSize: { xs: 26, md: 48 }, mb: 3 }}>
          Lista de Sorteios
          <br /> Realizados
        </Typography>

        <Paper variant="outlined">
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table sx={{ minWidth: 920 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800 }}>Nº SORTEIO</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>DATA ABERTURA</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>DATA FECHAMENTO</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>DIAS ABERTO</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>DATA REALIZAÇÃO</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>USUÁRIO VENCEDOR</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>{nums.map((x) => (
            <TableRow key={x.n}>
              <TableCell>{x.n}</TableCell>
              <TableCell>{x.status}</TableCell>
            </TableRow>
          ))}
          
                {data.map((d) => (
                  <TableRow key={d.n} hover>
                    <TableCell>{pad3(d.n)}</TableCell>
                    <TableCell>{d.abertura}</TableCell>
                    <TableCell>{d.fechamento}</TableCell>
                    <TableCell>{d.dias}</TableCell>
                    <TableCell>{d.realizacao}</TableCell>
                    <TableCell>{d.vencedor}</TableCell>
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
