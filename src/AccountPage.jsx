// src/AccountPage.jsx
import * as React from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import logoNewStore from './Logo-branca-sem-fundo-768x132.png';
import { SelectionContext } from './selectionContext';
import { useAuth } from './authContext';
import {
  AppBar,
  Box,
  Button,
  Chip,
  Container,
  CssBaseline,
  IconButton,
  Menu,
  MenuItem,
  Divider,
  Paper,
  Stack,
  ThemeProvider,
  Toolbar,
  Typography,
  createTheme,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
} from '@mui/material';
import ArrowBackIosNewRoundedIcon from '@mui/icons-material/ArrowBackIosNewRounded';
import AccountCircleRoundedIcon from '@mui/icons-material/AccountCircleRounded';

// ======= Tema (inalterado) =======
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#67C23A' },
    secondary: { main: '#FFC107' },
    error: { main: '#D32F2F' },
    background: { default: '#0E0E0E', paper: '#121212' },
    success: { main: '#2E7D32' },
    warning: { main: '#B58900' },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'Arial'].join(','),
  },
});

const pad2 = (n) => n.toString().padStart(2, '0');
const brMoney = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const addMonths = (d, m) => { const x = new Date(d); x.setMonth(x.getMonth() + m); return x; };

// ======= helpers de API =======
const API_BASE = (process.env.REACT_APP_API_BASE_URL || '/api').replace(/\/+$/, '');

function sanitizeToken(t) {
  if (!t) return '';
  let s = String(t).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1, -1);
  if (/^Bearer\s+/i.test(s)) s = s.replace(/^Bearer\s+/i, '').trim();
  return s.replace(/\s+/g, '');
}
const authHeaders = () => {
  const sources = [
    'ns_auth_token', 'token', 'access_token', 'jwt'
  ];
  let tk = '';
  for (const k of sources) {
    tk = localStorage.getItem(k) || sessionStorage.getItem(k) || '';
    if (tk) break;
  }
  if (!tk && typeof document !== 'undefined') {
    const m = document.cookie.match(/(?:^|;\s*)(token|jwt)=([^;]+)/i);
    if (m) tk = decodeURIComponent(m[2]);
  }
  tk = sanitizeToken(tk);
  return tk ? { Authorization: `Bearer ${tk}` } : {};
};

async function getJSON(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function getFirst(paths) {
  for (const p of paths) {
    try { return await getJSON(p); } catch {}
  }
  return null;
}

// Normaliza participações -> linhas (numero, data, status) para a TABELA
function normalizeRows(payload) {
  const items = Array.isArray(payload)
    ? payload
    : payload?.payments || payload?.items || payload?.participations || payload?.orders || [];

  const rows = [];
  for (const it of items) {
    const raffle = it.raffle || it.sorteio || it.draw || it.event || it.lottery || {};
    const nums = it.numbers || it.cotas || it.tickets || it.itens || [];
    const dateRaw =
      it.drawDate || raffle.drawDate || raffle.date || it.paid_at || it.created_at || it.createdAt || it.date || null;

    const raw = String(it.status || it.paymentStatus || raffle.status || '').toLowerCase();
    let status = 'NÃO CONTEMPLADO';
    if (raw.includes('pend')) status = 'PENDENTE';
    if (raw.includes('win') || raw.includes('contempla')) status = 'CONTEMPLADO';

    (Array.isArray(nums) ? nums : [nums]).forEach((n) => {
      rows.push({
        numero: Number(n),
        data: dateRaw ? new Date(dateRaw) : null,
        status,
      });
    });
  }

  return sortPendingFirst(
    rows.map((r) => ({
      numero: r.numero,
      data: r.data ? r.data.toLocaleDateString('pt-BR') : '--/--/----',
      status: r.status,
    }))
  );
}

const StatusChip = ({ status }) => {
  if (status === 'CONTEMPLADO') {
    return (
      <Chip
        label="CONTEMPLADO"
        sx={{ bgcolor: 'success.main', color: '#fff', fontWeight: 800, borderRadius: 999, px: 1.5 }}
      />
    );
  }
  if (status === 'PENDENTE') {
    return (
      <Chip
        label="PENDENTE"
        sx={{ bgcolor: 'warning.main', color: '#000', fontWeight: 800, borderRadius: 999, px: 1.5 }}
      />
    );
  }
  return (
    <Chip
      label="NÃO CONTEMPLADO"
      sx={{ bgcolor: 'error.main', color: '#fff', fontWeight: 800, borderRadius: 999, px: 1.5 }}
    />
  );
};

const sortPendingFirst = (rows) =>
  rows.slice().sort((a, b) => {
    const aP = a.status === 'PENDENTE';
    const bP = b.status === 'PENDENTE';
    if (aP && !bP) return -1;
    if (!aP && bP) return 1;
    return 0;
  });

// ======= Componente principal =======
export default function AccountPage() {
  const navigate = useNavigate();
  const { selecionados, limparSelecao } = React.useContext(SelectionContext);
  const { logout, isAuthenticated, user: ctxUser } = useAuth();

  // menu avatar
  const [menuEl, setMenuEl] = React.useState(null);
  const menuOpen = Boolean(menuEl);
  const handleOpenMenu = (e) => setMenuEl(e.currentTarget);
  const handleCloseMenu = () => setMenuEl(null);
  const doLogout = () => { handleCloseMenu(); logout(); navigate('/'); };

  // estado de dados
  const [loading, setLoading] = React.useState(true);
  const [user, setUser] = React.useState(ctxUser || null);
  const [rows, setRows] = React.useState([]);               // linhas da tabela
  const [valorAcumulado, setValorAcumulado] = React.useState(0); // acumulado aprovado
  const [cupom, setCupom] = React.useState('CUPOMAQUI');
  const [validade, setValidade] = React.useState('--/--/----');
  const [posicoesAprovadas, setPosicoesAprovadas] = React.useState([]); // posições approved

  React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
        // Perfil (/api/me primeiro, com fallbacks)
        let me = ctxUser;
        if (!me) {
          const meData = await getFirst(['/api/me', '/me', '/auth/me', '/users/me', '/account/me']);
          if (meData) me = meData.user || meData;
        }
        if (alive) setUser(me || null);

        // Pagamentos/participações do usuário (prioriza /api/payments/me + aliases)
        const part = await getFirst([
          '/api/payments/me',
          '/api/participations/me',
          '/api/orders/me',
          '/payments/me',
          '/participations/me',
          '/orders/me',
        ]);

        // Tabela: normaliza para manter layout
        if (alive && part) setRows(normalizeRows(part));

        // ======= Métricas para o CARTÃO =======
        // Aceita shape { payments: [...] } ou array direto
        const list = Array.isArray(part?.payments) ? part.payments : Array.isArray(part) ? part : [];
        const approved = list.filter((p) => String(p.status).toLowerCase() === 'approved');

        // posições aprovadas (únicas, ordenadas)
        const pos = Array.from(
          new Set(
            approved.flatMap((p) => p.numbers || []).map(Number).filter((n) => Number.isInteger(n))
          )
        ).sort((a, b) => a - b);
        if (alive) setPosicoesAprovadas(pos);

        // total acumulado (amount_cents → BRL)
        const cents = approved.reduce((acc, p) => {
          if (p.amount_cents != null) return acc + Number(p.amount_cents || 0);
          if (p.amountCents != null) return acc + Number(p.amountCents || 0);
          if (p.amount != null) return acc + Math.round(Number(p.amount) * 100);
          return acc;
        }, 0);
        if (alive) setValorAcumulado(cents / 100);

        // validade: 6 meses após a última compra aprovada (paid_at > created_at)
        if (approved.length) {
          const last = approved
            .map((p) => new Date(p.paid_at || p.created_at || p.createdAt || Date.now()))
            .filter((d) => !Number.isNaN(+d))
            .sort((a, b) => a - b)
            .at(-1);
          const v = addMonths(last, 6);
          if (alive) setValidade(v.toLocaleDateString('pt-BR'));
        }

        // cupom se backend enviar algum código
        const maybeCoupon =
          part?.coupon || part?.cupom || part?.discountCode || part?.codigo;
        if (alive && maybeCoupon) setCupom(String(maybeCoupon).toUpperCase());
      } catch (_) {
        // silencioso para não quebrar layout
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [ctxUser]);

  // Nome exibido
  const displayName =
    user?.name || user?.fullName || user?.nome || user?.displayName || user?.username || user?.email || 'NOME DO CLIENTE';

  // Posições a exibir no cartão
  const posicoes =
    posicoesAprovadas.length
      ? posicoesAprovadas.map(pad2)
      : (selecionados.length ? selecionados.slice(0, 6).map(pad2) : ['05', '12', '27', '33', '44', '59']);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

      <AppBar position="sticky" elevation={0} sx={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Toolbar sx={{ position: 'relative', minHeight: 64 }}>
          <IconButton edge="start" color="inherit" onClick={() => navigate(-1)} aria-label="Voltar">
            <ArrowBackIosNewRoundedIcon />
          </IconButton>
          <Box
            component={RouterLink}
            to="/"
            sx={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Box component="img" src={logoNewStore} alt="NEW STORE" sx={{ height: 40, objectFit: 'contain' }} />
          </Box>

          <IconButton color="inherit" sx={{ ml: 'auto' }} onClick={handleOpenMenu}>
            <AccountCircleRoundedIcon />
          </IconButton>
          <Menu
            anchorEl={menuEl}
            open={menuOpen}
            onClose={handleCloseMenu}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            {isAuthenticated && (
              <>
                <MenuItem onClick={() => { handleCloseMenu(); navigate('/conta'); }}>Área do cliente</MenuItem>
                <Divider />
                <MenuItem onClick={doLogout}>Sair</MenuItem>
              </>
            )}
          </Menu>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
        <Stack spacing={3}>
          <Typography
            variant="h4"
            sx={{ fontWeight: 900, letterSpacing: 1, textTransform: 'uppercase', display: { xs: 'none', md: 'block' }, opacity: 0.9 }}
          >
            {displayName}
          </Typography>

          {/* Cartão */}
          <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
            <Paper
              elevation={0}
              sx={{
                width: { xs: 'min(92vw, 420px)', sm: 'min(88vw, 500px)', md: '560px' },
                aspectRatio: '1.586 / 1',
                borderRadius: 5,
                position: 'relative',
                overflow: 'hidden',
                p: { xs: 1.5, sm: 2, md: 2.2 },
                bgcolor: '#181818',
                border: '1px solid rgba(255,255,255,0.08)',
                backgroundImage: `
                  radial-gradient(70% 120% at 35% 65%, rgba(255,255,255,0.20), transparent 60%),
                  radial-gradient(60% 120% at 80% 20%, rgba(255,255,255,0.10), transparent 60%),
                  radial-gradient(100% 140% at -10% 120%, rgba(0,0,0,0.45), transparent 60%)
                `,
                backgroundBlendMode: 'screen, lighten, normal',
              }}
            >
              <Box
                sx={{
                  pointerEvents: 'none',
                  position: 'absolute',
                  inset: 0,
                  opacity: 0.08,
                  backgroundImage:
                    'radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), radial-gradient(rgba(255,255,255,0.35) 1px, transparent 1px)',
                  backgroundSize: '3px 3px, 5px 5px',
                  backgroundPosition: '0 0, 10px 5px',
                }}
              />

              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1} sx={{ position: 'relative', height: '100%' }}>
                <Stack spacing={0.8} flex={1} minWidth={0}>
                  <Box>
                    <Typography variant="caption" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', letterSpacing: 1, opacity: 0.85, display: 'block' }}>
                      {/* TEXTO AJUSTADO */}
                      PRÊMIO: VOUCHER DE R$ 5000,00 EM COMPRAS NO SITE
                    </Typography>
                    <Typography variant="caption" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', letterSpacing: 1, opacity: 0.85, display: 'block' }}>
                      CARTÃO PRESENTE
                    </Typography>
                    <Typography variant="caption" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', letterSpacing: 1, opacity: 0.85, display: 'block' }}>
                      {/* POSIÇÕES APROVADAS */}
                      POSIÇÕES: {posicoes.join(', ')}
                    </Typography>
                  </Box>

                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 'auto' }}>
                    <Box component="img" src={logoNewStore} alt="NS" sx={{ height: 18, opacity: 0.9 }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 900, letterSpacing: 2, textTransform: 'uppercase', lineHeight: 1.1 }}>
                      {displayName}
                    </Typography>
                  </Stack>

                  <Stack spacing={0.1} sx={{ mt: 'auto' }}>
                    <Typography variant="caption" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', letterSpacing: 1, opacity: 0.75 }}>
                      VÁLIDO ATÉ
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 800 }}>
                      {/* +6 MESES DA ÚLTIMA COMPRA APROVADA */}
                      {validade}
                    </Typography>
                  </Stack>
                </Stack>

                <Stack spacing={0.4} alignItems="flex-end" sx={{ ml: 1 }}>
                  <Typography variant="caption" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', letterSpacing: 1, opacity: 0.85 }}>
                    CÓDIGO DE DESCONTO:
                  </Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 900, letterSpacing: 2, lineHeight: 1 }}>
                    {cupom}
                  </Typography>
                  <Typography variant="caption" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', letterSpacing: 1, opacity: 0.9, color: '#9AE6B4', textAlign: 'right' }}>
                    VALOR ACUMULADO:
                  </Typography>
                  <Typography sx={{ fontWeight: 900, color: '#9AE6B4' }}>
                    {/* TOTAL APROVADO */}
                    {brMoney(valorAcumulado)}
                  </Typography>
                </Stack>
              </Stack>
            </Paper>
          </Box>

          {/* Tabela — mesmas 3 colunas e estilos */}
          <Paper variant="outlined" sx={{ p: { xs: 1, md: 2 } }}>
            {loading ? (
              <Box sx={{ px: 2, py: 1 }}>
                <LinearProgress />
              </Box>
            ) : (
              <TableContainer>
                <Table size="medium" sx={{ minWidth: 560 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800 }}>SORTEIO</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>DIA</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>RESULTADO</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} sx={{ color: '#bbb' }}>
                          Nenhuma participação encontrada.
                        </TableCell>
                      </TableRow>
                    )}
                    {rows.map((row, idx) => (
                      <TableRow key={`${row.numero}-${row.data}-${idx}`} hover>
                        <TableCell sx={{ width: 120, fontWeight: 700 }}>{pad2(row.numero)}</TableCell>
                        <TableCell sx={{ width: 180 }}>{row.data}</TableCell>
                        <TableCell><StatusChip status={row.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            <Stack direction="row" justifyContent="flex-end" gap={1.5} sx={{ mt: 2 }}>
              <Button variant="outlined" color="error" onClick={limparSelecao}>
                Limpar meus números
              </Button>
              <Button variant="contained" color="success" onClick={() => alert('Resgatar cupom: ' + cupom)}>
                Resgatar cupom
              </Button>
              <Button variant="text" onClick={doLogout}>
                Sair
              </Button>
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </ThemeProvider>
  );
}
