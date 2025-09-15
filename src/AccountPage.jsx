// src/AccountPage.jsx
import * as React from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import logoNewStore from './Logo-branca-sem-fundo-768x132.png';
import { SelectionContext } from './selectionContext';
import { useAuth } from './authContext';
import {
  AppBar, Box, Button, Chip, Container, CssBaseline, IconButton, Menu, MenuItem,
  Divider, Paper, Stack, ThemeProvider, Toolbar, Typography, createTheme,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, LinearProgress,
} from '@mui/material';
import ArrowBackIosNewRoundedIcon from '@mui/icons-material/ArrowBackIosNewRounded';
import AccountCircleRoundedIcon from '@mui/icons-material/AccountCircleRounded';

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
  typography: { fontFamily: ['Inter','system-ui','Segoe UI','Roboto','Arial'].join(',') },
});

const pad2 = (n) => n.toString().padStart(2, '0');

// 🔧 base de API normalizada
const RAW_BASE = process.env.REACT_APP_API_BASE_URL || '/api';
const API_BASE = RAW_BASE.replace(/\/+$/, '');
const apiJoin = (path) => {
  let p = path;
  if (!p.startsWith('/')) p = `/${p}`;
  if (API_BASE.endsWith('/api') && p.startsWith('/api/')) p = p.slice(4);
  return `${API_BASE}${p}`;
};

// 🔐 token opcional + cookies
const authHeaders = () => {
  const tk =
    localStorage.getItem('token') ||
    localStorage.getItem('access_token') ||
    sessionStorage.getItem('token');
  return tk ? { Authorization: `Bearer ${tk}` } : {};
};

async function getJSON(fullUrlOrPath) {
  const url = /^https?:\/\//.test(fullUrlOrPath) ? fullUrlOrPath : apiJoin(fullUrlOrPath);
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    credentials: 'include',
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

// ---------------------- Chips (inalterado) ----------------------
const PayChip = ({ status }) => {
  const st = String(status || '').toLowerCase();
  if (st === 'approved' || st === 'paid' || st === 'pago') {
    return <Chip label="PAGO" sx={{ bgcolor: 'success.main', color: '#fff', fontWeight: 800, borderRadius: 999, px: 1.5 }} />;
  }
  return <Chip label="PENDENTE" sx={{ bgcolor: 'warning.main', color: '#000', fontWeight: 800, borderRadius: 999, px: 1.5 }} />;
};

const ResultChip = ({ result }) => {
  const r = String(result || '').toLowerCase();
  if (r.includes('contempla') || r.includes('win')) {
    return <Chip label="CONTEMPLADO" sx={{ bgcolor: 'success.main', color: '#fff', fontWeight: 800, borderRadius: 999, px: 1.5 }} />;
  }
  if (r.includes('nao') || r.includes('não') || r.includes('n_contempla')) {
    return <Chip label="NÃO CONTEMPLADO" sx={{ bgcolor: 'error.main', color: '#fff', fontWeight: 800, borderRadius: 999, px: 1.5 }} />;
  }
  if (r.includes('closed') || r.includes('fechado')) {
    return <Chip label="FECHADO" sx={{ bgcolor: 'secondary.main', color: '#000', fontWeight: 800, borderRadius: 999, px: 1.5 }} />;
  }
  return <Chip label="ABERTO" sx={{ bgcolor: 'primary.main', color: '#0E0E0E', fontWeight: 800, borderRadius: 999, px: 1.5 }} />;
};

// -------------------- Tabela (inalterado) -----------------------
function buildRows(payPayload, drawsMap, availableSet) {
  const list = Array.isArray(payPayload)
    ? payPayload
    : payPayload?.payments || payPayload?.items || [];

  const rows = [];
  for (const p of list) {
    const drawId = p.draw_id ?? p.drawId ?? p.sorteio_id ?? p.raffle_id ?? null;
    const numbers = Array.isArray(p.numbers) ? p.numbers : [];
    const payStatus = p.status || p.paymentStatus || 'pending';
    const when = p.paid_at || p.created_at || p.updated_at || null;

    const drawInfo = drawsMap?.get?.(Number(drawId)) || drawsMap?.[Number(drawId)] || {};
    let result = drawInfo.status || drawInfo.result || '';
    if (!result) result = 'aberto';

    for (const n of numbers) {
      if (availableSet && availableSet.has(Number(n)) && String(payStatus).toLowerCase() !== 'approved') continue;
      rows.push({
        sorteio: drawId != null ? String(drawId) : '--',
        numero: Number(n),
        dia: when ? new Date(when).toLocaleDateString('pt-BR') : '--/--/----',
        pagamento: payStatus,
        resultado: result,
      });
    }
  }

  return rows.sort((a, b) => {
    const ap = String(a.pagamento).toLowerCase() === 'pending';
    const bp = String(b.pagamento).toLowerCase() === 'pending';
    if (ap && !bp) return -1;
    if (!ap && bp) return 1;
    return 0;
  });
}

// ------------------------------- COMPONENTE ---------------------------------
const ADMIN_EMAIL = 'admin@newstore.com.br'; // ✅ usado para detectar admin

export default function AccountPage() {
  const navigate = useNavigate();
  const { selecionados } = React.useContext(SelectionContext);
  const { logout, isAuthenticated, user: ctxUser } = useAuth();

  const [menuEl, setMenuEl] = React.useState(null);
  const menuOpen = Boolean(menuEl);
  const handleOpenMenu = (e) => setMenuEl(e.currentTarget);
  const handleCloseMenu = () => setMenuEl(null);
  const doLogout = () => { handleCloseMenu(); logout(); navigate('/'); };

  const [loading, setLoading] = React.useState(true);
  const [user, setUser] = React.useState(ctxUser || null);
  const [rows, setRows] = React.useState([]);
  const [valorAcumulado, setValorAcumulado] = React.useState(0);
  const [cupom, setCupom] = React.useState('CUPOMAQUI');
  const [validade, setValidade] = React.useState('28/10/25');

  const storedMe = React.useMemo(() => {
    try { return JSON.parse(localStorage.getItem('me') || 'null'); }
    catch { return null; }
  }, []);

  React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
        let me = ctxUser || storedMe || null;
        try {
          const meResp = await getJSON('/api/me');
          me = meResp?.user || meResp || me;
        } catch {}

        if (alive) {
          setUser(me || null);
          try { if (me) localStorage.setItem('me', JSON.stringify(me)); } catch {}
        }

        const pay = await getJSON('/api/payments/me');

        let drawsMap = new Map();
        try {
          const draws = await getJSON('/api/draws');
          const arr = Array.isArray(draws) ? draws : (draws?.draws || draws?.items || []);
          drawsMap = new Map(arr.map(d => [Number(d.id ?? d.draw_id), { status: d.status ?? d.result ?? '' }]));
        } catch {}

        let availableSet = new Set();
        try {
          const nums = await getJSON('/api/numbers');
          for (const it of nums?.numbers || []) {
            if (String(it.status).toLowerCase() === 'available') availableSet.add(Number(it.n));
          }
        } catch {}

        if (alive && pay) {
          const tableRows = buildRows(pay, drawsMap, availableSet);
          setRows(tableRows);

          const backendTotal =
            pay.total || pay.valor || pay.amount || (Array.isArray(pay) ? null : pay?.summary?.total);
          if (backendTotal != null) {
            setValorAcumulado(Number(backendTotal));
          } else {
            const cents = (pay.payments || []).reduce((acc, p) => {
              const ok = String(p.status).toLowerCase() === 'approved';
              return ok ? acc + Number(p.amount_cents || 0) : acc;
            }, 0);
            setValorAcumulado((cents || 0) / 100);
          }

          const maybeCoupon = pay.coupon || pay.cupom || pay.discountCode || pay.codigo;
          const maybeDue = pay.validity || pay.validade || pay.expiresAt || pay.expiraEm || null;
          if (maybeCoupon) setCupom(String(maybeCoupon).toUpperCase());
          if (maybeDue) {
            const d = new Date(maybeDue);
            if (!isNaN(d)) setValidade(d.toLocaleDateString('pt-BR'));
          }
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [ctxUser, storedMe]);

  const u = user || {};
  const headingName =
    u.name || u.fullName || u.nome || u.displayName || u.username || u.email || 'NOME DO CLIENTE';
  const cardEmail = u.email || (u.username?.includes?.('@') ? u.username : headingName);

  const posicoes = (selecionados?.length ? selecionados : ['05','12','27','33','44','59'])
    .slice(0, 6).map(pad2);

  // ✅ DETECÇÃO DE ADMIN (para exibir link de dashboard)
  const isAdminUser = !!(
    u?.is_admin === true ||
    u?.role === 'admin' ||
    (u?.email && String(u.email).toLowerCase() === ADMIN_EMAIL)
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="sticky" elevation={0} sx={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Toolbar sx={{ position: 'relative', minHeight: 64 }}>
          <IconButton edge="start" color="inherit" onClick={() => navigate(-1)} aria-label="Voltar">
            <ArrowBackIosNewRoundedIcon />
          </IconButton>
          <Box component={RouterLink} to="/"
            sx={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', display: 'flex', alignItems: 'center' }}>
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
                {/* ✅ ADICIONADO: link do Painel Admin quando o usuário é admin */}
                {isAdminUser && (
                  <MenuItem onClick={() => { handleCloseMenu(); navigate('/admin'); }}>
                    Painel Admin
                  </MenuItem>
                )}
                {isAdminUser && <Divider />}

                <MenuItem onClick={() => { handleCloseMenu(); navigate('/conta'); }}>
                  Área do cliente
                </MenuItem>
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
            sx={{ fontWeight: 900, letterSpacing: 1, textTransform: 'uppercase',
              display: { xs: 'none', md: 'block' }, opacity: 0.9 }}
          >
            {headingName}
          </Typography>

          {/* Cartão visual */}
          <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
            <Paper elevation={0} sx={{
              width: { xs: 'min(92vw, 420px)', sm: 'min(88vw, 500px)', md: '560px' },
              aspectRatio: '1.586 / 1', borderRadius: 5, position: 'relative', overflow: 'hidden',
              p: { xs: 1.5, sm: 2, md: 2.2 }, bgcolor: '#181818', border: '1px solid rgba(255,255,255,0.08)',
              backgroundImage: `
                radial-gradient(70% 120% at 35% 65%, rgba(255,255,255,0.20), transparent 60%),
                radial-gradient(60% 120% at 80% 20%, rgba(255,255,255,0.10), transparent 60%),
                radial-gradient(100% 140% at -10% 120%, rgba(0,0,0,0.45), transparent 60%)
              `,
              backgroundBlendMode: 'screen, lighten, normal',
            }}>
              <Box sx={{
                pointerEvents: 'none', position: 'absolute', inset: 0, opacity: 0.08,
                backgroundImage:
                  'radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), radial-gradient(rgba(255,255,255,0.35) 1px, transparent 1px)',
                backgroundSize: '3px 3px, 5px 5px', backgroundPosition: '0 0, 10px 5px',
              }} />

              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1} sx={{ position: 'relative', height: '100%' }}>
                <Stack spacing={0.8} flex={1} minWidth={0}>
                  <Box>
                    <Typography variant="caption" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', letterSpacing: 1, opacity: 0.85, display: 'block' }}>
                      PRÊMIO: VOUCHER DE R$ 5000,00 EM COMPRAS NO SITE
                    </Typography>
                    <Typography variant="caption" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', letterSpacing: 1, opacity: 0.85, display: 'block' }}>
                      CARTÃO PRESENTE
                    </Typography>
                  </Box>

                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 'auto' }}>
                    <Box component="img" src={logoNewStore} alt="NS" sx={{ height: 18, opacity: 0.9 }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 900, letterSpacing: 2, textTransform: 'uppercase', lineHeight: 1.1 }}>
                      {cardEmail}
                    </Typography>
                  </Stack>

                  <Stack spacing={0.1} sx={{ mt: 'auto' }}>
                    <Typography variant="caption" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', letterSpacing: 1, opacity: 0.75 }}>
                      VÁLIDO ATÉ
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 800 }}>
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
                    {valorAcumulado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </Typography>
                </Stack>
              </Stack>
            </Paper>
          </Box>

          {/* Tabela */}
          <Paper variant="outlined" sx={{ p: { xs: 1, md: 2 } }}>
            {loading ? (
              <Box sx={{ px: 2, py: 1 }}><LinearProgress /></Box>
            ) : (
              <TableContainer>
                <Table size="medium" sx={{ minWidth: 560 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800 }}>SORTEIO</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>NÚMERO</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>DIA</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>PAGAMENTO</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>RESULTADO</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.length === 0 && (
                      <TableRow><TableCell colSpan={5} sx={{ color: '#bbb' }}>Nenhuma participação encontrada.</TableCell></TableRow>
                    )}
                    {rows.map((row, idx) => (
                      <TableRow key={`${row.sorteio}-${row.numero}-${idx}`} hover>
                        <TableCell sx={{ width: 120, fontWeight: 700 }}>{String(row.sorteio || '--')}</TableCell>
                        <TableCell sx={{ width: 120, fontWeight: 700 }}>{pad2(row.numero)}</TableCell>
                        <TableCell sx={{ width: 180 }}>{row.dia}</TableCell>
                        <TableCell><PayChip status={row.pagamento} /></TableCell>
                        <TableCell><ResultChip result={row.resultado} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            <Stack direction="row" justifyContent="flex-end" gap={1.5} sx={{ mt: 2 }}>
              <Button component="a" href="http://newstorerj.com.br/" target="_blank" rel="noopener" variant="contained" color="success">
                Resgatar cupom
              </Button>
              <Button variant="text" onClick={doLogout}>Sair</Button>
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </ThemeProvider>
  );
}
