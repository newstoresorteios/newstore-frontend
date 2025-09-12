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

// Link externo
const RESULTADOS_LOTERIAS =
  'https://asloterias.com.br/todos-resultados-loteria-federal';

// PREÇO por número (ENV ou 55)
const PRICE = Number(process.env.REACT_APP_PIX_PRICE) || 55;

// Base do backend
const API_BASE = (process.env.REACT_APP_API_BASE || '').replace(/\/+$/, '');

// ==== Helpers de API (token + reserva) ====
function getAuthToken() {
  return (
    localStorage.getItem('token') ||
    localStorage.getItem('access_token') ||
    localStorage.getItem('jwt') ||
    ''
  );
}

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
    throw new Error(
      `Alguns números ficaram indisponíveis: ${
        Array.isArray(conflitantes) ? conflitantes.join(', ') : conflitantes
      }`
    );
  }
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    const msg =
      j?.error === 'no_open_draw'
        ? 'Não há um sorteio aberto no momento.'
        : j?.error || 'reserve_failed';
    throw new Error(`Falha ao reservar: ${msg}`);
  }
  return r.json(); // { reservationId, drawId, expiresAt, numbers }
}

// Normaliza qualquer resposta do backend para { confirmed: number[], pending: number[] }
function normalizeNumbersPayload(json) {
  if (!json || typeof json !== 'object') return { confirmed: [], pending: [] };

  if (Array.isArray(json.confirmed) || Array.isArray(json.pending)) {
    return {
      confirmed: (json.confirmed || []).map(Number),
      pending: (json.pending || []).map(Number),
    };
  }
  if (Array.isArray(json.paid) || Array.isArray(json.reserved)) {
    return {
      confirmed: (json.paid || []).map(Number),
      pending: (json.reserved || []).map(Number),
    };
  }
  if (json.reserved && (Array.isArray(json.reserved.confirmed) || Array.isArray(json.reserved.pending))) {
    return {
      confirmed: (json.reserved.confirmed || []).map(Number),
      pending: (json.reserved.pending || []).map(Number),
    };
  }
  if (json.numbers) {
    const n = json.numbers;
    return {
      confirmed: (n.confirmed || n.paid || []).map(Number),
      pending: (n.pending || n.reserved || []).map(Number),
    };
  }
  return { confirmed: [], pending: [] };
}

// Busca os números no backend com alguns endpoints comuns
async function fetchReservedFromBackend(authToken) {
  if (!API_BASE) return { confirmed: [], pending: [] };

  const headers = { 'Content-Type': 'application/json' };
  const token = authToken || getAuthToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const endpoints = [
    `${API_BASE}/api/numbers/status`,
    `${API_BASE}/numbers/status`,
    `${API_BASE}/draws/current/numbers`,
    `${API_BASE}/numbers`,
  ];

  for (const url of endpoints) {
    try {
      const r = await fetch(url, { headers, credentials: 'include' });
      if (!r.ok) continue;
      const j = await r.json();
      return normalizeNumbersPayload(j);
    } catch {
      // tenta o próximo
    }
  }
  return { confirmed: [], pending: [] };
}

export default function NewStorePage({
  reservados: reservadosProp = [],
  indisponiveis: indisponiveisProp = [],
  onIrParaPagamento,
  groupUrl = 'https://chat.whatsapp.com/LoHdJ8887Ku4RTsHgFQ102',
}) {
  const navigate = useNavigate();
  const { selecionados, setSelecionados, limparSelecao } = React.useContext(SelectionContext);
  const { isAuthenticated, logout } = useAuth();

  // ================== Estados de backend ==================
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
      setConfirmedPaid(Array.from(new Set((confirmed || []).map(Number))));
      setPendingReserved(Array.from(new Set((pending || []).map(Number))));
    }
    load();
    const id = setInterval(load, 15000);
    return () => { active = false; clearInterval(id); };
  }, []);

  // ================== Menu/UX ==================
  const [menuEl, setMenuEl] = React.useState(null);
  const menuOpen = Boolean(menuEl);
  const handleOpenMenu = (e) => setMenuEl(e.currentTarget);
  const handleCloseMenu = () => setMenuEl(null);
  const goConta = () => { handleCloseMenu(); navigate('/conta'); };
  const goLogin = () => { handleCloseMenu(); navigate('/login'); };
  const doLogout = () => { handleCloseMenu(); logout(); navigate('/'); };

  // modal de confirmação
  const [open, setOpen] = React.useState(false);
  const handleAbrirConfirmacao = () => setOpen(true);
  const handleFechar = () => setOpen(false);

  // PIX modal
  const [pixOpen, setPixOpen] = React.useState(false);
  const [pixLoading, setPixLoading] = React.useState(false);
  const [pixData, setPixData] = React.useState(null);
  const [pixAmount, setPixAmount] = React.useState(0);

  // >>> Alterado: cria reserva antes de gerar o PIX
  const handleIrPagamento = async () => {
    setOpen(false);
    if (!isAuthenticated) {
      navigate('/login', { replace: false, state: { from: '/', wantPay: true } });
      return;
    }

    try {
      // 1) Cria/valida a reserva
      const { reservationId } = await reserveNumbers(selecionados);
      const amount = selecionados.length * PRICE;

      // 2) Abre modal e chama o backend do PIX
      setPixAmount(amount);
      setPixOpen(true);
      setPixLoading(true);

      const data = await createPixPayment({
        orderId: String(Date.now()),
        amount,
        numbers: selecionados,
        reservationId, // importante
      });

      setPixData(data);
    } catch (e) {
      alert(e.message || 'Falha ao iniciar pagamento.');
      setPixOpen(false);
    } finally {
      setPixLoading(false);
    }
  };

  // ===== Cartela: regras de clique/estilo =====
  const isReservado = (n) => reservadosSet.has(n);       // pendente
  const isIndisponivel = (n) => indisponiveisSet.has(n); // confirmado/pago
  const isSelecionado = (n) => selecionados.includes(n);

  const handleClickNumero = (n) => {
    if (isIndisponivel(n) || isReservado(n)) return; // bloqueia
    setSelecionados((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
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
    if (isReservado(n)) {
      return {
        border: '2px dashed',
        borderColor: 'secondary.main',
        bgcolor: 'rgba(255,193,7,0.08)',
        color: 'secondary.main',
        cursor: 'not-allowed',
        boxShadow: 'inset 0 0 0 2px rgba(255,193,7,0.15)',
      };
    }
    if (isSelecionado(n)) {
      return {
        border: '2px solid',
        borderColor: 'secondary.main',
        bgcolor: 'rgba(255,193,7,0.18)',
        boxShadow: '0 0 0 2px rgba(255,193,7,0.15)',
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
          {/* Texto de boas-vindas */}
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

          {/* Cartela */}
          <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 3 }, bgcolor: 'background.paper' }}>
            {/* Ações e legenda */}
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1.5}
              alignItems="center"
              justifyContent="space-between"
              sx={{ mb: 2 }}
            >
              <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
                <Chip size="small" label="DISPONÍVEL" sx={{ bgcolor: 'primary.main', color: '#0E0E0E', fontWeight: 700 }} />
                <Chip
                  size="small"
                  label={`RESERVADO • ${reservadosSet.size}`}
                  sx={{ bgcolor: 'rgba(255,193,7,0.08)', border: '1px dashed', borderColor: 'secondary.main', color: 'secondary.main', fontWeight: 700 }}
                />
                <Chip
                  size="small"
                  label={`INDISPONÍVEL • ${indisponiveisSet.size}`}
                  sx={{ bgcolor: 'rgba(211,47,47,0.18)', border: '1px solid', borderColor: 'error.main', color: 'error.main', fontWeight: 700 }}
                />
                {!!selecionados.length && (
                  <Typography variant="body2" sx={{ ml: 0.5, opacity: 0.8 }}>
                    • {selecionados.length} selecionado(s)
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
            <Box
              sx={{
                width: { xs: 'calc(100vw - 32px)', sm: 'calc(100vw - 64px)', md: '100%' },
                maxWidth: 640,
                aspectRatio: '1 / 1',
                mx: 'auto',
              }}
            >
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
                      cursor: (isIndisponivel(idx) || isReservado(idx)) ? 'not-allowed' : 'pointer',
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
          {/* Fim Cartela */}

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
              <Typography variant="h6" fontWeight={800}>
                Informações do sorteio
              </Typography>
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

          {/* Convite para o grupo */}
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
                Você selecionou {selecionados.length}{' '}
                {selecionados.length === 1 ? 'número' : 'números'}:
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: 1, mb: 1 }}>
                {selecionados.slice().sort((a, b) => a - b).map(pad2).join(', ')}
              </Typography>

              <Typography variant="body1" sx={{ mt: 0.5, mb: 1 }}>
                Total: <strong>R$ {(selecionados.length * PRICE).toFixed(2)}</strong>
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

      <PixModal
        open={pixOpen}
        onClose={() => setPixOpen(false)}
        loading={pixLoading}
        data={pixData}
        amount={pixAmount}
        onCopy={() => { if (pixData) { navigator.clipboard.writeText(pixData.copy_paste_code || pixData.qr_code || ''); } }}
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
          } catch (e) {
            alert('Não foi possível consultar o status agora.');
          }
        }}
      />
    </ThemeProvider>
  );
}
