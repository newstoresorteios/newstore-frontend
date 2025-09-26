import * as React from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  IconButton,
  Box,
  Button,
  Container,
  CssBaseline,
  Paper,
  Stack,
  TextField,
  Typography,
  ThemeProvider,
  createTheme,
} from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import AccountCircleRoundedIcon from '@mui/icons-material/AccountCircleRounded';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#67C23A' },
    secondary: { main: '#FFC107' },
    error: { main: '#D32F2F' },
    background: { default: '#0E0E0E', paper: '#121212' },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'Arial'].join(','),
  },
});

/* ===== helpers de API (com fallback para o backend real) ===== */
const RAW =
  process.env.REACT_APP_API_BASE ||
  process.env.REACT_APP_API_BASE_URL ||
  'https://newstore-backend.onrender.com';

const ROOT = String(RAW).replace(/\/+$/, '');
const API_BASE = /\/api$/i.test(ROOT) ? ROOT : `${ROOT}/api`;

// monta URL garantindo que não duplica /api
function apiUrl(path) {
  let p = path.startsWith('/') ? path : `/${path}`;
  if (API_BASE.endsWith('/api') && p.startsWith('/api/')) p = p.slice(4); // remove "/api" extra
  return `${API_BASE}${p}`;
}

async function postJson(path, body) {
  const res = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
  return data;
}

// tenta rotas comuns de registro (a 1ª deve funcionar)
async function registerRequest({ name, email, password, phone }) {
  const payload = {
    name: String(name || '').trim() || 'Cliente',
    email: String(email || '').trim().toLowerCase(),
    password,
    phone: String(phone || '').trim() || null,
  };

  const paths = ['/auth/register', '/register', '/users/register'];
  let lastErr;
  for (const p of paths) {
    try {
      return await postJson(p, payload);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('Falha ao registrar');
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = React.useState({ name: '', email: '', password: '', phone: '' });
  const [loading, setLoading] = React.useState(false);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await registerRequest(form);
      alert('Conta criada com sucesso! Agora faça login.');
      navigate('/login');
    } catch (err) {
      alert(err.message || 'Falha ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="sticky" elevation={0} sx={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={() => navigate(-1)} aria-label="Voltar">
            <ArrowBackIosNewIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1 }} />
          <IconButton color="inherit">
            <AccountCircleRoundedIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Container maxWidth="sm" sx={{ py: { xs: 4, md: 6 } }}>
        <Paper variant="outlined" sx={{ p: { xs: 3, md: 4 }, bgcolor: 'background.paper' }}>
          <Stack spacing={2}>
            <Typography variant="h4" fontWeight={800} textAlign="center">
              Criar conta
            </Typography>
            <Typography variant="body2" textAlign="center" sx={{ opacity: 0.8 }}>
              Use seus dados para acessar a área do cliente.
            </Typography>

            <Box component="form" onSubmit={handleSubmit}>
              <Stack spacing={2}>
                <TextField
                  label="Nome completo"
                  name="name"
                  value={form.name}
                  onChange={onChange}
                  fullWidth
                  required
                />
                <TextField
                  label="E-mail"
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={onChange}
                  fullWidth
                  required
                />
                <TextField
                  label="Celular"
                  name="phone"
                  value={form.phone}
                  onChange={onChange}
                  placeholder="(DDD) 9 9999-9999"
                  fullWidth
                />
                <TextField
                  label="Senha"
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={onChange}
                  fullWidth
                  required
                />

                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={loading}
                  sx={{ py: 1.2, fontWeight: 700 }}
                >
                  {loading ? 'Criando...' : 'Criar conta'}
                </Button>

                <Button component={RouterLink} to="/login" variant="text" sx={{ fontWeight: 700 }}>
                  Já tenho conta — entrar
                </Button>
              </Stack>
            </Box>
          </Stack>
        </Paper>
      </Container>
    </ThemeProvider>
  );
}
