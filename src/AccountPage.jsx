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

// util
const pad2 = (n) => String(n).padStart(2, "0");
const ADMIN_EMAIL = "admin@newstore.com.br";

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
    } catch (e) {
      // 404/401/bad_json -> tenta o próximo
    }
  }
  return { data: null, from: null };
}

// normaliza payloads diferentes para um único formato
function normalizeToEntries(payPayload, reservationsPayload) {
  // payments: [{ draw_id, numbers:[...], status, paid_at }]
  if (payPayload) {
    const list = Array.isArray(payPayload)
      ? payPayload
      : payPayload.payments || payPayload.items || [];
    return list.flatMap(p => {
      const drawId = p.draw_id ?? p.drawId ?? p.sorteio_id ?? null;
      const numbers = Array.isArray(p.numbers) ? p.numbers : [];
      const payStatus = p.status || p.paymentStatus || "pending";
      const when = p.paid_at || p.created_at || p.updated_at || null;
      return numbers.map(n => ({ draw_id: drawId, number: Number(n), status: payStatus, when }));
    });
  }

  // reservations: { reservations:[{ draw_id, n, status, created_at, paid_at }]}
  if (reservationsPayload) {
    const list = reservationsPayload.reservations || reservationsPayload.items || [];
    return list.map(r => ({
      draw_id: r.draw_id ?? r.sorteio_id ?? null,
      number: r.n ?? r.number ?? r.numero,
      status: (String(r.status || "").toLowerCase() === "sold") ? "approved" : "pending",
      when: r.paid_at || r.created_at || r.updated_at || null,
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

  const handleOpenMenu = (e) => setMenuEl(e.currentTarget);
  const handleCloseMenu = () => setMenuEl(null);
  const doLogout = () => { handleCloseMenu(); logout(); navigate("/"); };

  const storedMe = React.useMemo(() => {
    try { return JSON.parse(localStorage.getItem("me") || "null"); } catch { return null; }
  }, []);

  React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
        // 1) carrega /me
        let me = ctxUser || storedMe || null;
        try {
          const meResp = await getJSON("/me");
          me = meResp?.user || meResp || me;
        } catch {}
        if (alive) {
          setUser(me || null);
          try { if (me) localStorage.setItem("me", JSON.stringify(me)); } catch {}
        }

        // 2) pagamentos OU reservas (fallback)
        const { data: pay, from } = await tryManyJson(["/payments/me", "/me/reservations", "/reservations/me"]);

        // 3) draws (map status)
        let drawsMap = new Map();
        try {
          const draws = await getJSON("/draws");
          const arr = Array.isArray(draws) ? draws : (draws.draws || draws.items || []);
          drawsMap = new Map(arr.map(d => [Number(d.id ?? d.draw_id), (d.status ?? d.result ?? "")]));
        } catch {}

        // 4) normaliza tabela
        if (alive && pay) {
          const entries = normalizeToEntries(
            from === "/payments/me" ? pay : null,
            from !== "/payments/me" ? pay : null
          );

          // status do sorteio
          const tableRows = entries.map(e => ({
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

          // total acumulado
          let totalCents = 0;
          if (from === "/payments/me") {
            const list = Array.isArray(pay) ? pay : (pay.payments || []);
            totalCents = list.reduce((acc, p) =>
              String(p.status).toLowerCase() === "approved" ? acc + Number(p.amount_cents || 0) : acc, 0);
          } else {
            // reservas não têm valor -> deixa 0 (ou some depois do sync de cupom)
            totalCents = 0;
          }
          setValorAcumulado((totalCents || 0) / 100);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [ctxUser, storedMe]);

  // sincroniza cupom (idempotente)
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
      } catch {
        // ignora
      } finally {
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

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="sticky" elevation={0} sx={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <Toolbar sx={{ position: "relative", minHeight: 64 }}>
          <IconButton edge="start" color="inherit" onClick={() => navigate(-1)} aria-label="Voltar">
            <ArrowBackIosNewRoundedIcon />
          </IconButton>
          <Box component={RouterLink} to="/"
            sx={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", display: "flex", alignItems: "center" }}>
            <Box component="img" src={logoNewStore} alt="NEW STORE" sx={{ height: 40, objectFit: "contain" }} />
          </Box>
          <IconButton color="inherit" sx={{ ml: "auto" }} onClick={e => setMenuEl(e.currentTarget)}>
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

      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
        <Stack spacing={3}>
          <Typography
            variant="h5"
            sx={{ fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", opacity: 0.9, textAlign: { xs: "center", md: "left" } }}
          >
            {headingName}
          </Typography>

          {/* Cartão */}
          <Box sx={{ width: "100%", display: "flex", justifyContent: "center" }}>
            <Paper elevation={0} sx={{
              width: { xs: "min(92vw, 420px)", sm: "min(88vw, 520px)", md: 560 },
              aspectRatio: "1.586 / 1",
              borderRadius: 5, position: "relative", overflow: "hidden",
              p: { xs: 1.5, sm: 2, md: 2.2 }, bgcolor: "#181818",
              border: "1px solid rgba(255,255,255,0.08)",
              backgroundImage: `
                radial-gradient(70% 120% at 35% 65%, rgba(255,255,255,0.20), transparent 60%),
                radial-gradient(60% 120% at 80% 20%, rgba(255,255,255,0.10), transparent 60%),
                radial-gradient(100% 140% at -10% 120%, rgba(0,0,0,0.45), transparent 60%)
              `,
              backgroundBlendMode: "screen, lighten, normal",
            }}>
              <Box sx={{
                pointerEvents: "none", position: "absolute", inset: 0, opacity: 0.08,
                backgroundImage:
                  "radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), radial-gradient(rgba(255,255,255,0.35) 1px, transparent 1px)",
                backgroundSize: "3px 3px, 5px 5px", backgroundPosition: "0 0, 10px 5px",
              }} />
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1} sx={{ position: "relative", height: "100%" }}>
                <Stack spacing={0.8} flex={1} minWidth={0}>
                  <Typography variant="caption" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', letterSpacing: 1, opacity: 0.85 }}>
                    CARTÃO PRESENTE
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: "auto" }}>
                    <Box component="img" src={logoNewStore} alt="NS" sx={{ height: 18, opacity: 0.9 }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 900, letterSpacing: 2, textTransform: "uppercase", lineHeight: 1.1 }}>
                      {cardEmail}
                    </Typography>
                  </Stack>
                  <Stack spacing={0.1} sx={{ mt: "auto" }}>
                    <Typography variant="caption" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', letterSpacing: 1, opacity: 0.75 }}>
                      VÁLIDO ATÉ
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 800 }}>{validade}</Typography>
                  </Stack>
                </Stack>
                <Stack spacing={0.4} alignItems="flex-end" sx={{ ml: 1 }}>
                  <Typography variant="caption" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', letterSpacing: 1, opacity: 0.85 }}>
                    CÓDIGO DE DESCONTO:
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 900, letterSpacing: 2, whiteSpace: "nowrap" }}>
                    {couponCode}
                  </Typography>
                  <Typography variant="caption" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', letterSpacing: 1, opacity: 0.9, color: "#9AE6B4", textAlign: "right" }}>
                    VALOR ACUMULADO:
                  </Typography>
                  <Typography sx={{ fontWeight: 900, color: "#9AE6B4" }}>
                    {valorAcumulado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </Typography>
                  {syncing && <Typography variant="caption" sx={{ opacity: 0.7 }}>atualizando cupom…</Typography>}
                </Stack>
              </Stack>
            </Paper>
          </Box>

          {/* Tabela responsiva (scroll no mobile) */}
          <Paper variant="outlined" sx={{ p: { xs: 1, md: 2 } }}>
            {loading ? (
              <Box sx={{ px: 2, py: 1 }}><LinearProgress /></Box>
            ) : (
              <TableContainer sx={{ width: "100%", overflowX: "auto" }}>
                <Table size="medium" sx={{ minWidth: 560 }}>
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
                        <TableCell sx={{ width: 120, fontWeight: 700 }}>{String(row.sorteio || "--")}</TableCell>
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
