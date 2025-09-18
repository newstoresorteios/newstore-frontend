// src/AccountPage.jsx
import * as React from "react";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import logoNewStore from "./Logo-branca-sem-fundo-768x132.png";
import { SelectionContext } from "./selectionContext";
import { useAuth } from "./authContext";
import {
  AppBar, Box, Button, Chip, Container, CssBaseline, IconButton, Menu, MenuItem,
  Divider, Paper, Stack, ThemeProvider, Toolbar, Typography, createTheme,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, LinearProgress,
  // ▼ ADIÇÕES
  TextField, Alert
} from "@mui/material";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import AccountCircleRoundedIcon from "@mui/icons-material/AccountCircleRounded";
import { apiJoin, authHeaders, getJSON } from "./lib/api";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#67C23A" },
    secondary: { main: "#FFC107" },
    error: { main: "#D32F2F" },
    background: { default: "#0E0E0E", paper: "#121212" },
    success: { main: "#2E7D32" },
    warning: { main: "#B58900" },
  },
  shape: { borderRadius: 12 },
  typography: { fontFamily: ["Inter","system-ui","Segoe UI","Roboto","Arial"].join(",") },
});

const pad2 = (n) => String(n).padStart(2, "0");
const ADMIN_EMAIL = "admin@newstore.com.br";
// TTL de expiração de reserva (minutos). Ajuste por env: REACT_APP_RESERVATION_TTL_MINUTES
const TTL_MINUTES = Number(process.env.REACT_APP_RESERVATION_TTL_MINUTES || 15);

// chips
const PayChip = ({ status }) => {
  const st = String(status || "").toLowerCase();
  if (["approved","paid","pago"].includes(st)) {
    return <Chip label="PAGO" sx={{ bgcolor: "success.main", color: "#fff", fontWeight: 800, borderRadius: 999, px: 1.5 }} />;
  }
  return <Chip label="PENDENTE" sx={{ bgcolor: "warning.main", color: "#000", fontWeight: 800, borderRadius: 999, px: 1.5 }} />;
};
const ResultChip = ({ result }) => {
  const r = String(result || "").toLowerCase();
  if (r.includes("contempla") || r.includes("win")) return <Chip label="CONTEMPLADO" sx={{ bgcolor: "success.main", color: "#fff", fontWeight: 800, borderRadius: 999, px: 1.5 }} />;
  if (r.includes("não") || r.includes("nao") || r.includes("n_contempla")) return <Chip label="NÃO CONTEMPLADO" sx={{ bgcolor: "error.main", color: "#fff", fontWeight: 800, borderRadius: 999, px: 1.5 }} />;
  if (r.includes("closed") || r.includes("fechado")) return <Chip label="FECHADO" sx={{ bgcolor: "secondary.main", color: "#000", fontWeight: 800, borderRadius: 999, px: 1.5 }} />;
  return <Chip label="ABERTO" sx={{ bgcolor: "primary.main", color: "#0E0E0E", fontWeight: 800, borderRadius: 999, px: 1.5 }} />;
};

// tenta uma lista de endpoints e retorna o primeiro que responder 2xx com JSON
async function tryManyJson(paths) {
  for (const p of paths) {
    try {
      const data = await getJSON(p);
      return { data, from: p };
    } catch {}
  }
  return { data: null, from: null };
}

// ▼ ADIÇÃO: POST em uma lista de endpoints, parando no primeiro 2xx
async function tryManyPost(paths, body) {
  for (const p of paths) {
    try {
      const r = await fetch(apiJoin(p), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "include",
        body: JSON.stringify(body || {}),
      });
      if (r.ok) return await r.json().catch(() => ({}));
    } catch {}
  }
  throw new Error("save_failed");
}

// normaliza payloads diferentes para um único formato
function normalizeToEntries(payPayload, reservationsPayload) {
  // payments: [{ draw_id, numbers:[...], status, paid_at, amount_cents }]
  if (payPayload) {
    const list = Array.isArray(payPayload)
      ? payPayload
      : payPayload.payments || payPayload.items || [];
    return list.flatMap(p => {
      const drawId = p.draw_id ?? p.drawId ?? p.sorteio_id ?? null;
      const numbers = Array.isArray(p.numbers) ? p.numbers : [];
      const payStatus = p.status || p.paymentStatus || "pending";
      const when = p.paid_at || p.created_at || p.updated_at || null;
      return numbers.map(n => ({
        draw_id: drawId,
        number: Number(n),
        status: payStatus,
        when,
        expires_at: p.expires_at || p.expire_at || null,
      }));
    });
  }

  // reservations: { reservations:[{ draw_id, n, status, created_at, paid_at, reserved_until/expires_at }] }
  if (reservationsPayload) {
    const list = reservationsPayload.reservations || reservationsPayload.items || [];
    return list.map(r => ({
      draw_id: r.draw_id ?? r.sorteio_id ?? null,
      number: r.n ?? r.number ?? r.numero,
      status: (String(r.status || "").toLowerCase() === "sold") ? "approved" : "pending",
      when: r.paid_at || r.created_at || r.updated_at || null,
      expires_at: r.reserved_until || r.expires_at || r.expire_at || null,
    }));
  }

  return [];
}

export default function AccountPage() {
  const navigate = useNavigate();
  const { selecionados } = React.useContext(SelectionContext);
  const { logout, user: ctxUser } = useAuth();

  const [menuEl, setMenuEl] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [user, setUser] = React.useState(ctxUser || null);
  const [rows, setRows] = React.useState([]);
  const [valorAcumulado, setValorAcumulado] = React.useState(0);
  const [cupom, setCupom] = React.useState("CUPOMAQUI");
  const [validade] = React.useState("28/10/25");
  const [syncing, setSyncing] = React.useState(false);

  // ▼ ADIÇÃO: estado das configurações (apenas admin)
  const [cfgLoading, setCfgLoading] = React.useState(false);
  const [cfgSaved, setCfgSaved] = React.useState(null); // null | "ok" | "err"
  const [cfg, setCfg] = React.useState({
    banner_title: "",
    max_numbers_per_selection: 5,
  });

  const isLoggedIn = !!(user?.email || user?.id);
  const logoTo = isLoggedIn ? "/conta" : "/";

  const doLogout = () => { setMenuEl(null); logout(); navigate("/"); };
  const storedMe = React.useMemo(() => {
    try { return JSON.parse(localStorage.getItem("me") || "null"); } catch { return null; }
  }, []);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // /me
        let me = ctxUser || storedMe || null;
        try {
          const meResp = await getJSON("/me");
          me = meResp?.user || meResp || me;
        } catch {}
        if (alive) {
          setUser(me || null);
          try { if (me) localStorage.setItem("me", JSON.stringify(me)); } catch {}
        }

        // pagamentos OU reservas (prefira ativos)
        const { data: pay, from } = await tryManyJson([
          "/payments/me",
          "/me/reservations?active=1",
          "/reservations/me?active=1",
          "/me/reservations",
          "/reservations/me",
        ]);

        // draws (status)
        let drawsMap = new Map();
        try {
          const draws = await getJSON("/draws");
          const arr = Array.isArray(draws) ? draws : (draws.draws || draws.items || []);
          drawsMap = new Map(arr.map(d => [Number(d.id ?? d.draw_id), (d.status ?? d.result ?? "")]));
        } catch {}

        if (alive && pay) {
          const entries = normalizeToEntries(
            from === "/payments/me" ? pay : null,
            from !== "/payments/me" ? pay : null
          );

          // —— filtro: remover reservas expiradas ——
          const now = Date.now();
          const ttlMs = TTL_MINUTES * 60 * 1000;
          const filtered = entries.filter(e => {
            const st = String(e.status || "").toLowerCase();
            // Pagos/histórico sempre aparecem
            if (["approved","paid","pago"].includes(st)) return true;

            // Pendentes expiram por campo explícito…
            if (e.expires_at) {
              const expMs = new Date(e.expires_at).getTime();
              if (!isNaN(expMs)) return expMs > now;
            }
            // …ou por TTL contado a partir de 'when'
            if (e.when) {
              const whenMs = new Date(e.when).getTime();
              if (!isNaN(whenMs)) return (whenMs + ttlMs) > now;
            }
            // Sem data → mantém (para não esconder algo válido por erro de payload)
            return true;
          });

          // monta linhas
          const tableRows = filtered.map(e => ({
            sorteio: e.draw_id != null ? String(e.draw_id) : "--",
            numero: Number(e.number),
            dia: e.when ? new Date(e.when).toLocaleDateString("pt-BR") : "--/--/----",
            pagamento: e.status,
            resultado: drawsMap.get(Number(e.draw_id)) || "aberto",
          }));

          // pendentes primeiro
          tableRows.sort((a, b) => {
            const ap = String(a.pagamento).toLowerCase() === "pending";
            const bp = String(b.pagamento).toLowerCase() === "pending";
            if (ap && !bp) return -1;
            if (!ap && bp) return 1;
            return 0;
          });

          setRows(tableRows);

          // total acumulado (apenas payments aprovados)
          let totalCents = 0;
          if (from === "/payments/me") {
            const list = Array.isArray(pay) ? pay : (pay.payments || []);
            totalCents = list.reduce((acc, p) =>
              String(p.status).toLowerCase() === "approved" ? acc + Number(p.amount_cents || 0) : acc, 0);
          }
          setValorAcumulado((totalCents || 0) / 100);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [ctxUser, storedMe]);

  // ▼ ADIÇÃO: carregar config (banner_title e max_numbers_per_selection)
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const j = await getJSON("/config");
        const banner = typeof j?.banner_title === "string" ? j.banner_title : "";
        const maxSel = Number(j?.max_numbers_per_selection ?? j?.max_select ?? 5);
        if (alive) setCfg({
          banner_title: banner,
          max_numbers_per_selection: Number.isFinite(maxSel) && maxSel > 0 ? maxSel : 5,
        });
      } catch {
        /* silencioso */
      }
    })();
    return () => { alive = false; };
  }, []);

  // sincroniza cupom
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setSyncing(true);
        const r = await fetch(apiJoin("/coupons/mine"), { headers: { ...authHeaders() }, credentials: "include" });
        const mine = r.ok ? await r.json() : null;

        const uiCents = Math.round((Number(valorAcumulado) || 0) * 100);
        const srvCents = Number(mine?.cents || 0);

        if (!mine?.code || uiCents !== srvCents) {
          const s = await fetch(apiJoin("/coupons/sync"), {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders() },
            credentials: "include",
            body: JSON.stringify({}),
          });
          const synced = s.ok ? await s.json() : null;
          if (alive && synced?.code) setCupom(synced.code);
          else if (alive && mine?.code) setCupom(mine.code);
        } else if (alive && mine?.code) {
          setCupom(mine.code);
        }
      } catch {} finally {
        if (alive) setSyncing(false);
      }
    })();
    return () => { alive = false; };
  }, [valorAcumulado]);

  const u = user || {};
  const headingName =
    u.name || u.fullName || u.nome || u.displayName || u.username || u.email || "NOME DO CLIENTE";
  const cardEmail = u.email || (u.username?.includes?.("@") ? u.username : headingName);
  const couponCode = u?.coupon_code || cupom || "CUPOMAQUI";
  const isAdminUser = !!(u?.is_admin || u?.role === "admin" || (u?.email && u.email.toLowerCase() === ADMIN_EMAIL));

  // ▼ ADIÇÃO: salvar config
  async function handleSaveConfig() {
    try {
      setCfgLoading(true);
      setCfgSaved(null);
      const payload = {
        banner_title: String(cfg.banner_title || "").slice(0, 240),
        max_numbers_per_selection: Math.max(1, Number(cfg.max_numbers_per_selection || 1)),
      };
      await tryManyPost(
        ["/config", "/admin/config", "/config/update"],
        payload
      );
      setCfgSaved("ok");
    } catch {
      setCfgSaved("err");
    } finally {
      setCfgLoading(false);
      setTimeout(() => setCfgSaved(null), 4000);
    }
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="sticky" elevation={0} sx={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <Toolbar sx={{ position: "relative", minHeight: { xs: 56, md: 64 }, px: { xs: 1, sm: 2 } }}>
          <IconButton edge="start" color="inherit" onClick={() => navigate(-1)} aria-label="Voltar">
            <ArrowBackIosNewRoundedIcon />
          </IconButton>
          <Box
              component={RouterLink}
              to="/"
              sx={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                display: "flex",
                alignItems: "center",
              }}
            >
              <Box component="img" src={logoNewStore} alt="NEW STORE" sx={{ height: { xs: 28, sm: 36, md: 40 }, objectFit: "contain" }} />
            </Box>
          <IconButton color="inherit" sx={{ ml: "auto" }} onClick={(e) => setMenuEl(e.currentTarget)}>
            <AccountCircleRoundedIcon />
          </IconButton>
          <Menu
            anchorEl={menuEl}
            open={Boolean(menuEl)}
            onClose={() => setMenuEl(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
          >
            {isAdminUser && <MenuItem onClick={() => { setMenuEl(null); navigate("/admin"); }}>Painel Admin</MenuItem>}
            {isAdminUser && <Divider />}
            <MenuItem onClick={() => { setMenuEl(null); navigate("/conta"); }}>Área do cliente</MenuItem>
            <Divider />
            <MenuItem onClick={doLogout}>Sair</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: { xs: 2.5, md: 5 } }}>
        <Stack spacing={2.5}>
          <Typography
            sx={{
              fontWeight: 900, letterSpacing: 0.5, textTransform: "uppercase", opacity: 0.9,
              textAlign: { xs: "center", md: "left" }, fontSize: { xs: 18, sm: 20, md: 22 }, lineHeight: 1.2, wordBreak: "break-word",
            }}
          >
            {headingName}
          </Typography>

          {/* ▼ ADIÇÃO: Configurações do sorteio (apenas admin) */}
          {isAdminUser && (
            <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
              <Stack spacing={2}>
                <Typography variant="h6" fontWeight={900}>Configurações do sorteio</Typography>

                <TextField
                  label="Título do banner (página principal)"
                  value={cfg.banner_title}
                  onChange={(e) => setCfg(s => ({ ...s, banner_title: e.target.value }))}
                  fullWidth
                  inputProps={{ maxLength: 240 }}
                />

                <TextField
                  label="Máx. de números por seleção"
                  type="number"
                  value={cfg.max_numbers_per_selection}
                  onChange={(e) =>
                    setCfg(s => ({ ...s, max_numbers_per_selection: Math.max(1, Number(e.target.value || 1)) }))
                  }
                  inputProps={{ min: 1, step: 1 }}
                  sx={{ maxWidth: 260 }}
                />

                <Stack direction="row" spacing={1.5}>
                  <Button
                    variant="contained"
                    color="success"
                    onClick={handleSaveConfig}
                    disabled={cfgLoading}
                  >
                    {cfgLoading ? "Salvando…" : "Salvar configurações"}
                  </Button>
                </Stack>

                {cfgSaved === "ok" && (
                  <Alert severity="success" variant="outlined">Configurações salvas com sucesso.</Alert>
                )}
                {cfgSaved === "err" && (
                  <Alert severity="error" variant="outlined">Não foi possível salvar. Tente novamente.</Alert>
                )}
              </Stack>
            </Paper>
          )}

          {/* Cartão */}
          <Box sx={{ width: "100%", display: "flex", justifyContent: "center" }}>
            <Paper
              elevation={0}
              sx={{
                width: { xs: "min(94vw, 420px)", sm: "min(88vw, 520px)", md: 560 },
                aspectRatio: "1.586 / 1",
                borderRadius: 5, position: "relative", overflow: "hidden",
                p: { xs: 1.25, sm: 2, md: 2.2 }, bgcolor: "#181818",
                border: "1px solid rgba(255,255,255,0.08)",
                backgroundImage: `
                  radial-gradient(70% 120% at 35% 65%, rgba(255,255,255,0.20), transparent 60%),
                  radial-gradient(60% 120% at 80% 20%, rgba(255,255,255,0.10), transparent 60%),
                  radial-gradient(100% 140% at -10% 120%, rgba(0,0,0,0.45), transparent 60%)
                `,
                backgroundBlendMode: "screen, lighten, normal",
              }}
            >
              <Box sx={{
                pointerEvents: "none", position: "absolute", inset: 0, opacity: 0.08,
                backgroundImage:
                  "radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), radial-gradient(rgba(255,255,255,0.35) 1px, transparent 1px)",
                backgroundSize: "3px 3px, 5px 5px", backgroundPosition: "0 0, 10px 5px",
              }} />
              <Stack
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                alignItems={{ xs: "stretch", sm: "flex-start" }}
                gap={1}
                sx={{ position: "relative", height: "100%" }}
              >
                <Stack spacing={0.8} flex={1} minWidth={0}>
                  <Typography variant="caption" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', letterSpacing: 1, opacity: 0.85 }}>
                    CARTÃO PRESENTE
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: "auto", minWidth: 0 }}>
                    <Box component="img" src={logoNewStore} alt="NS" sx={{ height: 16, opacity: 0.9 }} />
                    <Typography
                      sx={{
                        fontWeight: 900, letterSpacing: { xs: 1, sm: 2 }, textTransform: "uppercase", lineHeight: 1.1,
                        fontSize: { xs: 12, sm: 14, md: 16 }, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%",
                      }}
                    >
                      {cardEmail}
                    </Typography>
                  </Stack>
                  <Stack spacing={0.1} sx={{ mt: "auto" }}>
                    <Typography variant="caption" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', letterSpacing: 1, opacity: 0.75 }}>
                      VÁLIDO ATÉ
                    </Typography>
                    <Typography sx={{ fontWeight: 800, fontSize: { xs: 12, sm: 13 } }}>{validade}</Typography>
                  </Stack>
                </Stack>

                <Stack spacing={0.4} alignItems={{ xs: "flex-start", sm: "flex-end" }} sx={{ ml: { sm: 1 }, mt: { xs: 1, sm: 0 } }}>
                  <Typography variant="caption" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', letterSpacing: 1, opacity: 0.85 }}>
                    CÓDIGO DE DESCONTO:
                  </Typography>
                  <Typography
                    sx={{
                      fontWeight: 900, letterSpacing: { xs: 0.5, sm: 2 }, wordBreak: "break-all", overflowWrap: "anywhere",
                      maxWidth: { xs: "100%", sm: 260 }, fontSize: { xs: 14, sm: 18 }, lineHeight: 1.2, textAlign: { xs: "left", sm: "right" },
                    }}
                  >
                    {couponCode}
                  </Typography>
                  <Typography variant="caption" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', letterSpacing: 1, opacity: 0.9, color: "#9AE6B4", textAlign: { xs: "left", sm: "right" } }}>
                    VALOR ACUMULADO:
                  </Typography>
                  <Typography sx={{ fontWeight: 900, color: "#9AE6B4", fontSize: { xs: 16, sm: 18 } }}>
                    {valorAcumulado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </Typography>
                  {syncing && <Typography variant="caption" sx={{ opacity: 0.7 }}>atualizando cupom…</Typography>}
                </Stack>
              </Stack>
            </Paper>
          </Box>

          {/* Tabela */}
          <Paper variant="outlined" sx={{ p: { xs: 1, md: 2 } }}>
            {loading ? (
              <Box sx={{ px: 2, py: 1 }}><LinearProgress /></Box>
            ) : (
              <TableContainer sx={{ width: "100%", overflowX: "auto" }}>
                <Table size="small" sx={{ minWidth: { xs: 0, sm: 560 } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>SORTEIO</TableCell>
                      <TableCell sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>NÚMERO</TableCell>
                      <TableCell sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>DIA</TableCell>
                      <TableCell sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>PAGAMENTO</TableCell>
                      <TableCell sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>RESULTADO</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.length === 0 && (
                      <TableRow><TableCell colSpan={5} sx={{ color: "#bbb" }}>Nenhuma participação encontrada.</TableCell></TableRow>
                    )}
                    {rows.map((row, idx) => (
                      <TableRow key={`${row.sorteio}-${row.numero}-${idx}`} hover>
                        <TableCell sx={{ width: 100, fontWeight: 700 }}>{String(row.sorteio || "--")}</TableCell>
                        <TableCell sx={{ width: 90, fontWeight: 700 }}>{pad2(row.numero)}</TableCell>
                        <TableCell sx={{ width: 140 }}>{row.dia}</TableCell>
                        <TableCell><PayChip status={row.pagamento} /></TableCell>
                        <TableCell><ResultChip result={row.resultado} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="flex-end" alignItems={{ xs: "stretch", sm: "center" }} gap={1.5} sx={{ mt: 2 }}>
              <Button component="a" href="http://newstorerj.com.br/" target="_blank" rel="noopener" variant="contained" color="success" fullWidth sx={{ maxWidth: { sm: 220 } }}>
                Resgatar cupom
              </Button>
              <Button variant="text" onClick={doLogout} fullWidth sx={{ maxWidth: { sm: 120 } }}>
                Sair
              </Button>
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </ThemeProvider>
  );
}
