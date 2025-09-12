// src/NewStorePage.jsx
import * as React from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import logoNewStore from './Logo-branca-sem-fundo-768x132.png';
import { SelectionContext } from './selectionContext';
import PixModal from './PixModal';
import { createPixPayment, checkPixStatus } from './services/pix';
import { useAuth } from './authContext';

import {
  AppBar, Box, Button, Chip, Container, CssBaseline, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, IconButton, Link, Menu, MenuItem,
  Paper, Stack, ThemeProvider, Toolbar, Typography, createTheme,
} from '@mui/material';
import AccountCircleRoundedIcon from '@mui/icons-material/AccountCircleRounded';

import imgCardExemplo from './cartaoilustrativoTexto-do-seu-paragrafo-6-1024x1024.png';
import imgTabelaUtilizacao from './Tabela-para-utilizacao-do-3-1024x1024.png';
import imgAcumulo1 from './1-2-1-1024x512.png';
import imgAcumulo2 from './2-1-1-1024x512.png';

// ======= Config =======
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#67C23A' },
    secondary: { main: '#FFC107' },
    error: { main: '#D32F2F' },
    background: { default: '#0E0E0E', paper: '#121212' },
    success: { main: '#59b15f' },
  },
  shape: { borderRadius: 12 },
  typography: { fontFamily: ['Inter','system-ui','Segoe UI','Roboto','Arial'].join(',') },
});

const pad2 = (n) => n.toString().padStart(2, '0');
const RESULTADOS_LOTERIAS = 'https://asloterias.com.br/todos-resultados-loteria-federal';
const PRICE = Number(process.env.REACT_APP_PIX_PRICE) || 55;

// Base do backend (aceita as 2 vars)
const API_BASE = (
  process.env.REACT_APP_API_BASE_URL ||
  process.env.REACT_APP_API_BASE ||
  'https://newstore-backend.onrender.com'
).replace(/\/+$/, '');

// ======= Auth helpers (mesmos do pix.js) =======
function sanitizeToken(t) {
  if (!t) return '';
  let s = String(t).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1, -1);
  if (/^Bearer\s+/i.test(s)) s = s.replace(/^Bearer\s+/i, '').trim();
  return s.replace(/\s+/g, '');
}

function getAuthToken() {
  try {
    const keys = ['ns_auth_token','authToken','token','jwt','access_token'];
    let raw = '';
    for (const k of keys) {
      raw = localStorage.getItem(k) || sessionStorage.getItem(k) || '';
      if (raw) break;
    }
    if (!raw) {
      const m = document.cookie.match(/(?:^|;\s*)(token|jwt)=([^;]+)/i);
      if (m) raw = decodeURIComponent(m[2]);
    }
    return sanitizeToken(raw);
  } catch { return ''; }
}

// ======= API helpers =======
async function reserveNumbers(numbers) {
  if (!API_BASE) throw new Error('API base não configurada');
  const token = getAuthToken();
  const r = await fetch(`${API_BASE}/api/reservations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify({ numbers }),
  });

  if (r.status === 409) {
    const j = await r.json().catch(() => ({}));
    const conflitantes = j?.conflicts || j?.n || [];
    throw new Error(`Alguns números ficaram indisponíveis: ${
      Array.isArray(conflitantes) ? conflitantes.join(', ') : conflitantes
    }`);
  }
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    const msg = j?.error || 'reserve_failed';
    throw new Error(`Falha ao reservar: ${msg}`);
  }
  return r.json(); // { reservationId, drawId, expiresAt, numbers }
}

// Carrega números do backend: GET /api/numbers  → { drawId, numbers:[{n,status}] }
async function fetchReservedFromBackend() {
  if (!API_BASE) return { confirmed: [], pending: [] };
  try {
    const res = await fetch(`${API_BASE}/api/numbers`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return { confirmed: [], pending: [] };
    const j = await res.json();
    const confirmed = [];
    const pending = [];
    for (const it of j?.numbers || []) {
      if (String(it.status) === 'sold') confirmed.push(Number(it.n));
      if (String(it.status) === 'reserved') pending.push(Number(it.n));
    }
    return {
      confirmed: Array.from(new Set(confirmed)),
      pending: Array.from(new Set(pending)),
    };
  } catch {
    return { confirmed: [], pending: [] };
  }
}

// ======= Componente =======
export default function NewStorePage({
  reservados: reservadosProp = [],
  indisponiveis: indisponiveisProp = [],
  onIrParaPagamento,
  groupUrl = 'https://chat.whatsapp.com/LoHdJ8887Ku4RTsHgFQ102',
}) {
  const navigate = useNavigate();
  const { selecionados, setSelecionados, limparSelecao } = React.useContext(SelectionContext);
  const { isAuthenticated, logout } = useAuth();

  // Estado vindo do backend
  const [confirmedPaid, setConfirmedPaid] = React.useState(
    Array.isArray(indisponiveisProp) ? indisponiveisProp.map(Number) : []
  );
  const [pendingReserved, setPendingReserved] = React.useState(
    Array.isArray(reservadosProp) ? reservadosProp.map(Number) : []
  );

  const reservadosSet    = React.useMemo(() => new Set(pendingReserved.map(Number)), [pendingReserved]);
  const indisponiveisSet = React.useMemo(() => new Set(confirmedPaid.map(Number)), [confirmedPaid]);

  React.useEffect(() => {
    let active = true;
    async function load() {
      const { confirmed, pending } = await fetchReservedFromBackend();
      if (!active) return;
      setConfirmedPaid(confirmed);
      setPendingReserved(pending);
    }
    load();
    const id = setInterval(load, 15000);
    return () => { active = false; clearInterval(id); };
  }, []);

  // ===== UX / menu =====
  const [menuEl, setMenuEl] = React.useState(null);
  const menuOpen = Boolean(menuEl);
  const handleOpenMenu = (e) => setMenuEl(e.currentTarget);
  const handleCloseMenu = () => setMenuEl(null);
  const goConta = () => { handleCloseMenu(); navigate('/conta'); };
  const goLogin = () => { handleCloseMenu(); navigate('/login'); };
  const doLogout = () => { handleCloseMenu(); logout(); navigate('/'); };

  // ===== Modais =====
  const [open, setOpen] = React.useState(false);
  const handleAbrirConfirmacao = () => setOpen(true);
  const handleFechar = () => setOpen(false);

  const [pixOpen, setPixOpen] = React.useState(false);
  const [pixLoading, setPixLoading] = React.useState(false);
  const [pixData, setPixData] = React.useState(null);
  const [pixAmount, setPixAmount] = React.useState(0);

  // ===== Ir para pagamento =====
  const handleIrPagamento = async () => {
    setOpen(false);
    if (!isAuthenticated) {
      navigate('/login', { replace: false, state: { from: '/', wantPay: true } });
      return;
    }

    try {
      // 1) Reserva
      const { reservationId } = await reserveNumbers(selecionados);
      const amount = selecionados.length * PRICE;

      // 2) Abre modal e chama criação do PIX no backend
      setPixAmount(amount);
      setPixOpen(true);
      setPixLoading(true);

      const data = await createPixPayment({
        orderId: String(Date.now()),
        amount,
        numbers: selecionados,
        reservationId, // evita recriar reserva
      });

      setPixData(data);
    } catch (e) {
      alert(e.message || 'Falha ao iniciar pagamento.');
      setPixOpen(false);
    } finally {
      setPixLoading(false);
    }
  };

  // ===== Grid helpers =====
  const isReservado     = (n) => reservadosSet.has(n);
  const isIndisponivel  = (n) => indisponiveisSet.has(n);
  const isSelecionado   = (n) => selecionados.includes(n);

  const handleClickNumero = (n) => {
    if (isIndisponivel(n) || isReservado(n)) return;
    setSelecionados((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  };

  const getCellSx = (n) => {
    if (isIndisponivel(n)) {
      return {
        border: '2px solid', borderColor: 'error.main',
        bgcolor: 'rgba(211,47,47,0.15)', color: 'grey.300', cursor: 'not-allowed', opacity: 0.85,
      };
    }
    if (isReservado(n)) {
      return {
        border: '2px dashed', borderColor: 'secondary.main',
        bgcolor: 'rgba(255,193,7,0.08)', color: 'secondary.main',
        cursor: 'not-allowed', boxShadow: 'inset 0 0 0 2px rgba(255,193,7,0.15)',
      };
    }
    if (isSelecionado(n)) {
      return {
        border: '2px solid', borderColor: 'secondary.main',
        bgcolor: 'rgba(255,193,7,0.18)', boxShadow: '0 0 0 2px rgba(255,193,7,0.15)',
      };
    }
    return {
      border: '2px solid rgba(255,255,255,0.08)',
      bgcolor: 'primary.main', color: '#0E0E0E',
      '&:hover': { filter: 'brightness(0.95)' }, transition: 'filter 120ms ease',
    };
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

      {/* Topo */}
      <AppBar position="sticky" elevation={0} sx={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Toolbar sx={{ position: 'relative', minHeight: 64 }}>
          <IconButton edge="start" color="inherit" />
          <Button component={RouterLink} to="/cadastro" variant="text" sx={{ fontWeight: 700, mt: 1 }}>
            Criar conta
          </Button>

          <Box component={RouterLink} to="/"
            sx={{ position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)', display:'flex', alignItems:'center' }}>
            <Box component="img" src={logoNewStore} alt="NEW STORE" sx={{ height: 40, objectFit: 'contain' }} />
          </Box>

          <IconButton color="inherit" sx={{ ml: 'auto' }} onClick={handleOpenMenu}>
            <AccountCircleRoundedIcon />
          </IconButton>
          <Menu anchorEl={menuEl} open={menuOpen} onClose={handleCloseMenu}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
            {isAuthenticated ? (
              <>
                <MenuItem onClick={goConta}>Área do cliente</MenuItem>
                <Divider />
                <MenuItem onClick={doLogout}>Sair</MenuItem>
              </>
            ) : (
              <MenuItem onClick={goLogin}>Entrar</MenuItem>
            )}
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Conteúdo */}
      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
        <Stack spacing={4}>
          {/* Boas-vindas */}
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
            <Stack spacing={2}>
              <Typography variant="h3" fontWeight={900}>
                Bem-vindos ao Sorteio da <Box component="span" sx={{ opacity: 0.85 }}>New Store</Box> Relógios!
              </Typography>
              <Typography variant="h6" sx={{ opacity: 0.9 }}>
                O único sorteio que permite receber <strong>100% do valor</strong> de volta em todas as participações…
              </Typography>
            </Stack>
          </Paper>

          {/* Cartela */}
          <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 3 }, bgcolor: 'background.paper' }}>
            <Stack direction={{ xs:'column', md:'row' }} spacing={1.5} alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
              <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
                <Chip size="small" label="DISPONÍVEL" sx={{ bgcolor:'primary.main', color:'#0E0E0E', fontWeight:700 }} />
                <Chip size="small" label={`RESERVADO • ${reservadosSet.size}`}
                      sx={{ bgcolor:'rgba(255,193,7,0.08)', border:'1px dashed', borderColor:'secondary.main', color:'secondary.main', fontWeight:700 }} />
                <Chip size="small" label={`INDISPONÍVEL • ${indisponiveisSet.size}`}
                      sx={{ bgcolor:'rgba(211,47,47,0.18)', border:'1px solid', borderColor:'error.main', color:'error.main', fontWeight:700 }} />
                {!!selecionados.length && (
                  <Typography variant="body2" sx={{ ml: .5, opacity: .8 }}>• {selecionados.length} selecionado(s)</Typography>
                )}
              </Stack>

              <Stack direction="row" spacing={1.5}>
                <Button variant="outlined" color="inherit" disabled={!selecionados.length} onClick={limparSelecao}>
                  LIMPAR SELEÇÃO
                </Button>
                <Button variant="contained" color="success" disabled={!selecionados.length} onClick={handleAbrirConfirmacao}>
                  CONTINUAR
                </Button>
              </Stack>
            </Stack>

            <Box sx={{ width:{ xs:'calc(100vw - 32px)', sm:'calc(100vw - 64px)', md:'100%' }, maxWidth:640, aspectRatio:'1 / 1', mx:'auto' }}>
              <Box sx={{
                display:'grid', gridTemplateColumns:'repeat(10, minmax(0, 1fr))',
                gridTemplateRows:'repeat(10, minmax(0, 1fr))', gap:{ xs:1, md:1.2 }, height:'100%', width:'100%'
              }}>
                {Array.from({ length: 100 }).map((_, idx) => (
                  <Box key={idx} onClick={() => handleClickNumero(idx)}
                       sx={{
                         ...getCellSx(idx), borderRadius: 1.2, userSelect:'none',
                         cursor: (isIndisponivel(idx) || isReservado(idx)) ? 'not-allowed' : 'pointer',
                         aspectRatio:'1 / 1', display:'flex', alignItems:'center', justifyContent:'center',
                         fontWeight:800, fontVariantNumeric:'tabular-nums',
                       }}>
                    {pad2(idx)}
                  </Box>
                ))}
              </Box>
            </Box>
          </Paper>

          {/* (demais seções mantidas) */}
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
            <Stack spacing={1.5}>
              <Typography sx={{ color: '#ff6b6b', fontWeight: 800, letterSpacing: 0.5 }}>
                imagem ilustrativa do cartão presente
              </Typography>
              <Box component="img" src={imgCardExemplo} alt="Cartão presente - exemplo"
                   sx={{ width:'100%', maxWidth:800, mx:'auto', display:'block', borderRadius:2 }} />
              <Typography variant="body2" sx={{ opacity: 0.85 }}>
                Os cartões são <strong>acumulativos</strong>, permitindo somar até <strong>R$ 4.200</strong>…
              </Typography>
            </Stack>
          </Paper>

          {/* …demais papeis/infos omitidos por brevidade… */}

          {/* Convite grupo */}
          <Paper variant="outlined" sx={{ p: { xs: 3, md: 4 }, textAlign:'center',
            bgcolor:'rgba(103, 194, 58, 0.05)', borderColor:'primary.main' }}>
            <Typography variant="h4" fontWeight={900} sx={{ mb: 1 }}>
              Clique no link abaixo e faça parte do <br /> grupo do sorteio!
            </Typography>
            <Typography sx={{ opacity: .85, mb: 2 }}>
              Lá você acompanha novidades, abertura de novas rodadas e avisos importantes.
            </Typography>
            <Button component="a" href={groupUrl} target="_blank" rel="noopener" size="large"
                    variant="contained" color="success" sx={{ px: 4, py: 1.5, fontWeight: 800, letterSpacing: .5 }}>
              SIM, EU QUERO PARTICIPAR!
            </Button>
          </Paper>
        </Stack>
      </Container>

      {/* Modal de confirmação */}
      <Dialog open={open} onClose={handleFechar} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontSize: 22, fontWeight: 800, textAlign: 'center' }}>
          Confirme sua seleção
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'center' }}>
          {selecionados.length ? (
            <>
              <Typography variant="body2" sx={{ opacity: 0.85, mb: 1 }}>
                Você selecionou {selecionados.length} {selecionados.length === 1 ? 'número' : 'números'}:
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: 1, mb: 1 }}>
                {selecionados.slice().sort((a,b)=>a-b).map(pad2).join(', ')}
              </Typography>
              <Typography variant="body1" sx={{ mt: .5, mb: 1 }}>
                Total: <strong>R$ {(selecionados.length * PRICE).toFixed(2)}</strong>
              </Typography>
              <Typography variant="caption" sx={{ opacity: .7 }}>
                Você pode voltar e ajustar a seleção, se quiser.
              </Typography>
            </>
          ) : (
            <Typography variant="body2" sx={{ opacity: .8 }}>
              Nenhum número selecionado.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1.2, flexWrap:'wrap', flexDirection:{ xs:'column', sm:'row' }, '& > *': { flex:1 } }}>
          <Button variant="outlined" onClick={handleFechar} sx={{ py: 1.2, fontWeight: 700 }}>
            SELECIONAR MAIS NÚMEROS
          </Button>
          <Button variant="outlined" color="error"
                  onClick={() => { limparSelecao(); setOpen(false); }}
                  disabled={!selecionados.length} sx={{ py: 1.2, fontWeight: 700 }}>
            LIMPAR SELEÇÃO
          </Button>
          <Button variant="contained" color="success" onClick={handleIrPagamento}
                  disabled={!selecionados.length} sx={{ py: 1.2, fontWeight: 700 }}>
            IR PARA PAGAMENTO
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal do PIX */}
      <PixModal
        open={pixOpen}
        onClose={() => setPixOpen(false)}
        loading={pixLoading}
        data={pixData}
        amount={pixAmount}
        onCopy={() => { if (pixData) navigator.clipboard.writeText(pixData.copy_paste_code || pixData.qr_code || ''); }}
        onRefresh={async () => {
          if (!pixData?.paymentId) { setPixOpen(false); return; }
          try {
            const st = await checkPixStatus(pixData.paymentId);
            if (st.status === 'approved') {
              alert('Pagamento aprovado!');
              setPixOpen(false);
            } else {
              alert(`Status: ${st.status || 'pendente'}`);
            }
          } catch {
            alert('Não foi possível consultar o status agora.');
          }
        }}
      />
    </ThemeProvider>
  );
}
