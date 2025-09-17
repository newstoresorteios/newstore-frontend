// src/NewStorePage.jsx
import * as React from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import logoNewStore from './Logo-branca-sem-fundo-768x132.png';
import { SelectionContext } from './selectionContext';
import PixModal from './PixModal';
import { createPixPayment, checkPixStatus } from './services/pix';
import { useAuth } from './authContext';

import {
  AppBar,
  Box,
  Button,
  Chip,
  Container,
  CssBaseline,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Link,
  Menu,
  MenuItem,
  Paper,
  Stack,
  ThemeProvider,
  Toolbar,
  Typography,
  createTheme,
} from '@mui/material';
import AccountCircleRoundedIcon from '@mui/icons-material/AccountCircleRounded';

// Imagens locais
import imgCardExemplo from './cartaoilustrativoTexto-do-seu-paragrafo-6-1024x1024.png';
import imgTabelaUtilizacao from './Tabela-para-utilizacao-do-3-1024x1024.png';
import imgAcumulo1 from './1-2-1-1024x512.png';
import imgAcumulo2 from './2-1-1-1024x512.png';

// Tema
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
  typography: {
    fontFamily: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'Arial'].join(','),
  },
});

// Helpers
const pad2 = (n) => n.toString().padStart(2, '0');
const MAX_SELECT = Number(process.env.REACT_APP_MAX_NUMBERS_PER_USER || 20);

// Link externo
const RESULTADOS_LOTERIAS =
  'https://asloterias.com.br/todos-resultados-loteria-federal';

// Mocks
const MOCK_RESERVADOS = [];
const MOCK_INDISPONIVEIS = [];

// Base do backend
const API_BASE = (
  process.env.REACT_APP_API_BASE_URL ||
  process.env.REACT_APP_API_BASE ||
  'https://newstore-backend.onrender.com'
).replace(/\/+$/, '');

// ===== Helpers de auth + reserva =====
function sanitizeToken(t) {
  if (!t) return '';
  let s = String(t).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1, -1);
  if (/^Bearer\s+/i.test(s)) s = s.replace(/^Bearer\s+/i, '').trim();
  return s.replace(/\s+/g, '');
}
function getAuthToken() {
  try {
    const keys = ['ns_auth_token', 'authToken', 'token', 'jwt', 'access_token'];
    for (const k of keys) {
      const raw = localStorage.getItem(k) || sessionStorage.getItem(k);
      if (raw) return sanitizeToken(raw);
    }
    return '';
  } catch {
    return '';
  }
}

// === reserva com tratamento de limite atingido ===
async function reserveNumbers(numbers) {
  const token = getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const r = await fetch(`${API_BASE}/api/reservations`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({ numbers }),
  });

  if (r.status === 409) {
    const j = await r.json().catch(() => ({}));

    // limite do backend
    if (j?.code === 'max_numbers_reached' || j?.error === 'max_numbers_reached') {
      const err = new Error('max_numbers_reached');
      err.code = 'max_numbers_reached';
      err.payload = j?.payload; // { current, max }
      throw err;
    }

    // conflitos de números
    const c = j?.conflicts || j?.n || [];
    throw new Error(
      Array.isArray(c) && c.length
        ? `Alguns números ficaram indisponíveis: ${c.join(', ')}`
        : (j?.error || 'Falha ao reservar')
    );
  }

  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j?.error || 'Falha ao reservar');
  }

  return r.json(); // { reservationId, drawId, expiresAt, numbers }
}

// Checagem do limite no backend (tenta sem header; se 401, re-tenta com Authorization)
async function checkUserPurchaseLimit({ addCount = 1, drawId } = {}) {
  const qs = new URLSearchParams();
  qs.set('add', String(addCount));
  if (drawId != null) qs.set('draw_id', String(drawId));

  // 1ª tentativa: sem headers (evita preflight)
  let res = await fetch(`${API_BASE}/api/purchase-limit/check?${qs}`, {
    credentials: 'include',
    cache: 'no-store',
  });

  // 2ª tentativa (se precisar auth por header)
  if (res.status === 401) {
    const token = getAuthToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    res = await fetch(`${API_BASE}/api/purchase-limit/check?${qs}`, {
      credentials: 'include',
      cache: 'no-store',
      headers,
    });
  }

  if (res.status === 401) throw new Error('unauthorized');
  if (!res.ok) throw new Error(`limit_check_${res.status}`);

  const j = await res.json().catch(() => ({}));
  const blocked = !!(j?.blocked ?? j?.limitReached ?? j?.reached ?? j?.exceeded);
  const current = j?.current ?? j?.cnt ?? j?.count;
  const max = j?.max ?? j?.limit ?? j?.MAX;
  return { blocked, current, max };
}

export default function NewStorePage({
  reservados = MOCK_RESERVADOS,
  indisponiveis = MOCK_INDISPONIVEIS,
  onIrParaPagamento,
  groupUrl = 'https://chat.whatsapp.com/GdosYmyW2Jj1mDXNDTFt6F',
}) {
  const navigate = useNavigate();
  const { selecionados, setSelecionados, limparSelecao } = React.useContext(SelectionContext);
  const { user, token, logout } = useAuth();
  const isAuthenticated = !!(user?.email || user?.id || token);

  const logoTo = isAuthenticated ? "/conta" : "/";

  // Estados vindos do backend
  const [srvReservados, setSrvReservados] = React.useState([]);
  const [srvIndisponiveis, setSrvIndisponiveis] = React.useState([]);

  // Preço dinâmico
  const FALLBACK_PRICE = Number(process.env.REACT_APP_PIX_PRICE) || 55;
  const [unitPrice, setUnitPrice] = React.useState(FALLBACK_PRICE);

  // Draw atual (se o backend expuser)
  const [currentDrawId, setCurrentDrawId] = React.useState(null);

  // Busca preço e tenta extrair draw id
  React.useEffect(() => {
    let alive = true;

    async function fetchJSON(path) {
      const res = await fetch(`${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    }

    (async () => {
      const candidates = [
        '/api/summary',
        '/summary',
        '/api/dashboard/summary',
        '/dashboard/summary',
        '/api/draws/current',
        '/draws/current',
      ];

      for (const p of candidates) {
        try {
          const j = await fetchJSON(p);

          const cents =
            j?.price_cents ??
            j?.priceCents ??
            j?.current?.price_cents ??
            j?.current_draw?.price_cents ??
            (Array.isArray(j?.draws) ? j.draws[0]?.price_cents : undefined);

          const reaisRaw = j?.price ?? j?.preco;
          const reais = cents != null ? Number(cents) / 100 : Number(reaisRaw);

          if (Number.isFinite(reais) && reais > 0 && alive) setUnitPrice(reais);

          const did =
            j?.draw_id ?? j?.id ?? j?.current?.id ??
            j?.current_draw?.id ??
            (Array.isArray(j?.draws) ? j.draws[0]?.id : undefined);

          if (did != null && alive) setCurrentDrawId(did);
          return;
        } catch {}
      }
      // fica no fallback se nada respondeu
    })();

    return () => { alive = false; };
  }, []);

  // Polling leve de /api/numbers
  React.useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const res = await fetch(`${API_BASE}/api/numbers`, {
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          cache: 'no-store',
        });
        if (!res.ok) return;
        const j = await res.json();
        const reserv = [];
        const indis  = [];
        for (const it of j?.numbers || []) {
          const st = String(it.status || '').toLowerCase();
          if (st === 'reserved') reserv.push(Number(it.n));
          if (st === 'taken' || st === 'sold') indis.push(Number(it.n));
        }
        if (!alive) return;
        setSrvReservados(Array.from(new Set(reserv)));
        setSrvIndisponiveis(Array.from(new Set(indis)));
      } catch {}
    }

    load();
    const id = setInterval(load, 15000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const reservadosAll = React.useMemo(
    () => Array.from(new Set([...(reservados || []), ...srvReservados])),
    [reservados, srvReservados]
  );
  const indisponiveisAll = React.useMemo(
    () => Array.from(new Set([...(indisponiveis || []), ...srvIndisponiveis])),
    [indisponiveis, srvIndisponiveis]
  );

  // menu avatar
  const [menuEl, setMenuEl] = React.useState(null);
  const menuOpen = Boolean(menuEl);
  const handleOpenMenu = (e) => setMenuEl(e.currentTarget);
  const handleCloseMenu = () => setMenuEl(null);
  const goConta = () => { handleCloseMenu(); navigate('/conta'); };
  const goLogin = () => { handleCloseMenu(); navigate('/login'); };
  const doLogout = () => { handleCloseMenu(); logout(); navigate('/'); };

  // modal (confirmação)
  const [open, setOpen] = React.useState(false);
  const handleAbrirConfirmacao = () => setOpen(true);
  const handleFechar = () => setOpen(false);

  // PIX modal
  const [pixOpen, setPixOpen] = React.useState(false);
  const [pixLoading, setPixLoading] = React.useState(false);
  const [pixData, setPixData] = React.useState(null);
  const [pixAmount, setPixAmount] = React.useState(0);

  // sucesso PIX
  const [pixApproved, setPixApproved] = React.useState(false);
  const handlePixApproved = React.useCallback(() => {
    setPixApproved(true);
    setPixOpen(false);
    setPixLoading(false);
  }, []);

  // === Modal de limite ===
  const [limitOpen, setLimitOpen] = React.useState(false);
  const [limitInfo, setLimitInfo] = React.useState({ type: 'purchase', current: undefined, max: undefined });
  const openLimitModal = (info) => { setLimitInfo(info || { type: 'purchase' }); setLimitOpen(true); };

  // Pré-checar limite assim que tiver usuário e draw
  React.useEffect(() => {
    let cancelled = false;
    if (!isAuthenticated || currentDrawId == null) return;

    (async () => {
      try {
        const { blocked, current, max } = await checkUserPurchaseLimit({
          addCount: 0,             // só status atual
          drawId: currentDrawId,
        });
        if (!cancelled && blocked) {
          openLimitModal({ type: 'purchase', current, max });
        }
      } catch {
        // falha de rede não bloqueia
      }
    })();

    return () => { cancelled = true; };
  }, [isAuthenticated, currentDrawId]);

  // Seleção com teto (front)
  const isReservado = (n) => reservadosAll.includes(n);
  const isIndisponivel = (n) => indisponiveisAll.includes(n);
  const isSelecionado = (n) => selecionados.includes(n);
  const handleClickNumero = (n) => {
    if (isIndisponivel(n)) return;
    setSelecionados((prev) => {
      const already = prev.includes(n);
      if (already) return prev.filter((x) => x !== n);
      if (prev.length >= MAX_SELECT) {
        openLimitModal({ type: 'selection', current: MAX_SELECT, max: MAX_SELECT });
        return prev;
      }
      return [...prev, n];
    });
  };
  const getCellSx = (n) => {
    if (isIndisponivel(n)) {
      return {
        border: '2px solid',
        borderColor: 'error.main',
        bgcolor: 'rgba(211,47,47,0.15)',
        color: 'grey.300',
        cursor: 'not-allowed',
        opacity: 0.85,
      };
    }
    if (isSelecionado(n) || isReservado(n)) {
      return {
        border: '2px solid',
        borderColor: 'secondary.main',
        bgcolor: 'rgba(255,193,7,0.12)',
      };
    }
    return {
      border: '2px solid rgba(255,255,255,0.08)',
      bgcolor: 'primary.main',
      color: '#0E0E0E',
      '&:hover': { filter: 'brightness(0.95)' },
      transition: 'filter 120ms ease',
    };
  };

  // Ir para pagamento (com checagens)
  const handleIrPagamento = async () => {
    setOpen(false);

    // precisa estar logado
    if (!isAuthenticated) {
      navigate('/login', { replace: false, state: { from: '/', wantPay: true } });
      return;
    }

    // CHECAGEM #1: status atual do usuário (sem somar seleção)
    try {
      const pre = await checkUserPurchaseLimit({
        addCount: 0,
        drawId: currentDrawId,
      });
      if (pre.blocked) {
        openLimitModal({ type: 'purchase', current: pre.current, max: pre.max });
        return;
      }
    } catch (e) {
      console.warn('[limit-check pre] falhou, seguindo:', e);
    }

    // CHECAGEM #2: com a seleção atual
    try {
      const addCount = selecionados.length || 1;
      const { blocked, current, max } = await checkUserPurchaseLimit({
        addCount,
        drawId: currentDrawId,
      });
      if (blocked) {
        openLimitModal({ type: 'purchase', current, max });
        return;
      }
    } catch (e) {
      console.warn('[limit-check add] falhou, seguindo:', e);
    }

    // fluxo normal de pagamento
    const amount = selecionados.length * unitPrice;
    setPixAmount(amount);
    setPixOpen(true);
    setPixLoading(true);
    setPixApproved(false);

    try {
      const { reservationId } = await reserveNumbers(selecionados);

      const data = await createPixPayment({
        orderId: String(Date.now()),
        amount,
        numbers: selecionados,
        reservationId,
      });

      setPixData(data);
    } catch (e) {
      if (e?.code === 'max_numbers_reached') {
        openLimitModal({
          type: 'purchase',
          current: e?.payload?.current,
          max: e?.payload?.max,
        });
      } else {
        alert(e.message || 'Falha ao gerar PIX');
      }
      setPixOpen(false);
    } finally {
      setPixLoading(false);
    }
  };

  // Polling de status PIX
  React.useEffect(() => {
    if (!pixOpen || !pixData?.paymentId || pixApproved) return;
    const id = setInterval(async () => {
      try {
        const st = await checkPixStatus(pixData.paymentId);
        if (st?.status === 'approved') handlePixApproved();
      } catch {}
    }, 3500);
    return () => clearInterval(id);
  }, [pixOpen, pixData, pixApproved, handlePixApproved]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

      {/* Topo */}
      <AppBar position="sticky" elevation={0} sx={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Toolbar sx={{ position: 'relative', minHeight: 64 }}>
          <IconButton edge="start" color="inherit">{/* espaçamento */}</IconButton>

          <Button component={RouterLink} to="/cadastro" variant="text" sx={{ fontWeight: 700, mt: 1 }}>
            Criar conta
          </Button>

          <Box
            component={RouterLink}
            to={logoTo}
            onClick={(e) => { e.preventDefault(); navigate(logoTo); }}
            sx={{ position:'absolute', left:'50%', top:'50%', transform:'translate(-50%, -50%)', display:'flex', alignItems:'center' }}
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
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
            <Stack spacing={2}>
              <Typography variant="h3" fontWeight={900}>
                Bem-vindos ao Sorteio da <Box component="span" sx={{ opacity: 0.85 }}>New Store</Box> Relógios!
              </Typography>
              <Typography variant="h6" sx={{ opacity: 0.9 }}>
                O único sorteio que permite receber <strong>100% do valor</strong> de volta em todas as participações. Além de
                concorrer ao prêmio, você tem a <strong>vantagem de não perder o valor investido</strong> — o valor vira um
                <strong> cupom de desconto</strong> para usar no site (validade de até <strong>6 meses</strong>).
              </Typography>
            </Stack>
          </Paper>

          {/* === CARTELA === */}
          <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 3 }, bgcolor: 'background.paper' }}>
            {/* Ações e legenda */}
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
              <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
                <Chip size="small" label="DISPONÍVEL" sx={{ bgcolor: 'primary.main', color: '#0E0E0E', fontWeight: 700 }} />
                <Chip size="small" label="RESERVADO" sx={{ bgcolor: 'rgba(255,193,7,0.18)', border: '1px solid', borderColor: 'secondary.main', color: 'secondary.main', fontWeight: 700 }} />
                <Chip size="small" label="INDISPONÍVEL" sx={{ bgcolor: 'rgba(211,47,47,0.18)', border: '1px solid', borderColor: 'error.main', color: 'error.main', fontWeight: 700 }} />
                {!!selecionados.length && (
                  <Typography variant="body2" sx={{ ml: 0.5, opacity: 0.8 }}>
                    • {selecionados.length} selecionado(s) (máx. {MAX_SELECT})
                  </Typography>
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

            {/* Grid 10x10 */}
            <Box sx={{ width: { xs: 'calc(100vw - 32px)', sm: 'calc(100vw - 64px)', md: '100%' }, maxWidth: 640, aspectRatio: '1 / 1', mx: 'auto' }}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(10, minmax(0, 1fr))',
                  gridTemplateRows: 'repeat(10, minmax(0, 1fr))',
                  gap: { xs: 1, md: 1.2 },
                  height: '100%',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                {Array.from({ length: 100 }).map((_, idx) => (
                  <Box
                    key={idx}
                    onClick={() => handleClickNumero(idx)}
                    sx={{
                      ...getCellSx(idx),
                      borderRadius: 1.2,
                      userSelect: 'none',
                      cursor: isIndisponivel(idx) ? 'not-allowed' : 'pointer',
                      aspectRatio: '1 / 1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {pad2(idx)}
                  </Box>
                ))}
              </Box>
            </Box>
          </Paper>
          {/* === FIM CARTELA === */}

          {/* Demais seções */}
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
            <Stack spacing={1.5}>
              <Typography sx={{ color: '#ff6b6b', fontWeight: 800, letterSpacing: 0.5 }}>
                imagem ilustrativa do cartão presente
              </Typography>
              <Box
                component="img"
                src={imgCardExemplo}
                alt="Cartão presente - exemplo"
                sx={{ width: '100%', maxWidth: 800, mx: 'auto', display: 'block', borderRadius: 2 }}
              />
              <Typography variant="body2" sx={{ opacity: 0.85 }}>
                Os cartões são <strong>acumulativos</strong>, permitindo somar até <strong>R$ 4.200</strong> em um único cartão.
              </Typography>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
            <Stack spacing={1.2}>
              <Typography variant="h6" fontWeight={800}>Informações do sorteio</Typography>
              <Typography variant="body1">• A posição só é considerada <strong>confirmada</strong> após a compensação do pagamento pelo número reservado.</Typography>
              <Typography variant="body1">• O sorteio é realizado <strong>após a venda de todos os cartões</strong>.</Typography>
              <Typography variant="body1">
                • O resultado utiliza a <strong>Lotomania</strong> — veja em{' '}
                <Link href={RESULTADOS_LOTERIAS} target="_blank" rel="noopener">Resultados das loterias</Link>.
              </Typography>
              <Typography variant="body1">• O <strong>ganhador</strong> é aquele que tirar o <strong>último número</strong> sorteado da Lotomania.</Typography>
              <Typography variant="body1">• Custos de entrega por conta do vencedor; envio a partir do RJ.</Typography>
              <Typography variant="body1">• Duração máxima do sorteio: <strong>7 dias</strong>.</Typography>
              <Typography variant="body1">• O <strong>Cartão Presente não é cumulativo</strong> com o prêmio do sorteio.</Typography>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
            <Stack spacing={2}>
              <Typography variant="h5" fontWeight={900}>
                Regras para utilização dos <Box component="span" sx={{ opacity: 0.85 }}>cartões presente</Box>
              </Typography>
              <Stack component="ul" sx={{ pl: 3, m: 0 }} spacing={1}>
                <Typography component="li">Uso apenas no site da New Store.</Typography>
                <Typography component="li">Não é possível comprar outro cartão-presente com cartão-presente.</Typography>
                <Typography component="li">Não há conversão em dinheiro.</Typography>
                <Typography component="li">Utilização em <strong>uma única compra</strong> (pode dividir em vários cartões).</Typography>
                <Typography component="li">Validade: <strong>6 meses</strong>.</Typography>
                <Typography component="li">Sem responsabilidade por extravio/furto/perda/validade expirada.</Typography>
                <Typography component="li">Considerar o <strong>valor cheio do produto</strong> (tabela abaixo).</Typography>
                <Typography component="li">Não soma com outros cupons.</Typography>
              </Stack>
              <Box
                component="img"
                src={imgTabelaUtilizacao}
                alt="Tabela para utilização do cartão presente"
                sx={{ width: '100%', maxWidth: 900, mx: 'auto', display: 'block', borderRadius: 2, mt: 1 }}
              />
              <Typography align="center" sx={{ mt: 1.5, fontWeight: 700, letterSpacing: 1 }}>
                CONSIDERAR O VALOR CHEIO DO PRODUTO
              </Typography>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
            <Stack spacing={1.5}>
              <Typography>
                Dica: ao <strong>juntar cartões</strong>, a validade passa a ser a do cartão <strong>mais recente</strong>.
              </Typography>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center" sx={{ mt: 1 }}>
                <Box component="img" src={imgAcumulo1} alt="Exemplo de acúmulo 1" sx={{ width: '100%', maxWidth: 560, borderRadius: 2 }} />
                <Box component="img" src={imgAcumulo2} alt="Exemplo de acúmulo 2" sx={{ width: '100%', maxWidth: 560, borderRadius: 2 }} />
              </Stack>
            </Stack>
          </Paper>

          {/* Convite grupo */}
          <Paper
            variant="outlined"
            sx={{
              p: { xs: 3, md: 4 },
              textAlign: 'center',
              bgcolor: 'rgba(103, 194, 58, 0.05)',
              borderColor: 'primary.main',
            }}
          >
            <Typography variant="h4" fontWeight={900} sx={{ mb: 1 }}>
              Clique no link abaixo e faça parte do <br /> grupo do sorteio!
            </Typography>
            <Typography sx={{ opacity: 0.85, mb: 2 }}>
              Lá você acompanha novidades, abertura de novas rodadas e avisos importantes.
            </Typography>
            <Button
              component="a"
              href={groupUrl}
              target="_blank"
              rel="noopener"
              size="large"
              variant="contained"
              color="success"
              sx={{ px: 4, py: 1.5, fontWeight: 800, letterSpacing: 0.5 }}
            >
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
                {selecionados.slice().sort((a, b) => a - b).map(pad2).join(', ')}
              </Typography>
              <Typography variant="body1" sx={{ mt: 0.5, mb: 1 }}>
                Total: <strong>R$ {(selecionados.length * unitPrice).toFixed(2)}</strong>
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                Você pode voltar e ajustar a seleção, se quiser.
              </Typography>
            </>
          ) : (
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              Nenhum número selecionado.
            </Typography>
          )}
        </DialogContent>
        <DialogActions
          sx={{
            px: 3, pb: 3, gap: 1.2,
            flexWrap: 'wrap',
            flexDirection: { xs: 'column', sm: 'row' },
            '& > *': { flex: 1 },
          }}
        >
          <Button variant="outlined" onClick={handleFechar} sx={{ py: 1.2, fontWeight: 700 }}>
            SELECIONAR MAIS NÚMEROS
          </Button>
          <Button
            variant="outlined"
            color="error"
            onClick={() => { limparSelecao(); setOpen(false); }}
            disabled={!selecionados.length}
            sx={{ py: 1.2, fontWeight: 700 }}
          >
            LIMPAR SELEÇÃO
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleIrPagamento}
            disabled={!selecionados.length}
            sx={{ py: 1.2, fontWeight: 700 }}
          >
            IR PARA PAGAMENTO
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal PIX (QR) */}
      <PixModal
        open={pixOpen}
        onClose={() => { setPixOpen(false); setPixApproved(false); }}
        loading={pixLoading}
        data={pixData}
        amount={pixAmount}
        onCopy={() => { if (pixData) { navigator.clipboard.writeText(pixData.copy_paste_code || pixData.qr_code || ''); } }}
        onRefresh={async () => {
          if (!pixData?.paymentId) { setPixOpen(false); return; }
          try {
            const st = await checkPixStatus(pixData.paymentId);
            if (st.status === 'approved') {
              handlePixApproved();
            } else {
              alert(`Status: ${st.status || 'pendente'}`);
            }
          } catch (e) {
            alert('Não foi possível consultar o status agora.');
          }
        }}
      />

      {/* Modal de sucesso do PIX */}
      <Dialog
        open={pixApproved}
        onClose={() => setPixApproved(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontSize: 22, fontWeight: 900, textAlign: 'center' }}>
          Pagamento confirmado! 🎉
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
            Seus números foram reservados.
          </Typography>
          <Typography sx={{ opacity: 0.9 }}>
            Boa sorte! Você pode acompanhar tudo na <strong>Área do cliente</strong>.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            fullWidth
            variant="contained"
            color="success"
            onClick={() => setPixApproved(false)}
            sx={{ py: 1.2, fontWeight: 800 }}
          >
            OK
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal: limite atingido */}
      <Dialog
        open={limitOpen}
        onClose={() => setLimitOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontSize: 20, fontWeight: 900, textAlign: 'center' }}>
          {limitInfo?.type === 'selection'
            ? 'Você pode selecionar no máximo 20 números'
            : 'Numero máximo de compras por usuario atingido'}
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'center' }}>
          <Typography sx={{ opacity: 0.9 }}>
            {limitInfo?.type === 'selection'
              ? 'Para continuar, remova um número antes de adicionar outro.'
              : 'Você já alcançou o limite de números neste sorteio.'}
          </Typography>
          {(Number.isFinite(limitInfo?.current) || Number.isFinite(limitInfo?.max)) && (
            <Typography sx={{ mt: 1, fontWeight: 700 }}>
              ({limitInfo?.current ?? '-'} de {limitInfo?.max ?? '-'})
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button fullWidth variant="contained" onClick={() => setLimitOpen(false)} sx={{ py: 1.1, fontWeight: 800 }}>
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  );
}
