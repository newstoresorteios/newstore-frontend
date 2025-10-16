// src/AdminOpenDrawBuyers.jsx
import * as React from "react";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import {
  AppBar, Box, Button, Chip, Container, CssBaseline, Divider, IconButton,
  Paper, Stack, Tab, Tabs, TextField, ThemeProvider, Toolbar, Typography, createTheme,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow
} from "@mui/material";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import AccountCircleRoundedIcon from "@mui/icons-material/AccountCircleRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import logoNewStore from "./Logo-branca-sem-fundo-768x132.png";
import { useAuth } from "./authContext";

/* ---------- tema ---------- */
const theme = createTheme({
  palette: { mode: "dark", primary: { main: "#2E7D32" }, background: { default: "#0E0E0E", paper: "#121212" } },
  shape: { borderRadius: 16 },
  typography: { fontFamily: ["Inter", "system-ui", "Segoe UI", "Roboto", "Arial"].join(",") },
});

/* ---------- helpers de API (iguais ao AdminDashboard) ---------- */
const RAW_BASE =
  process.env.REACT_APP_API_BASE_URL ||
  process.env.REACT_APP_API_BASE ||
  "/api";
const API_BASE = String(RAW_BASE).replace(/\/+$/, "");

const apiJoin = (path) => {
  let p = path.startsWith("/") ? path : `/${path}`;
  const baseHasApi = /\/api\/?$/.test(API_BASE);
  if (baseHasApi && p.startsWith("/api/")) p = p.slice(4);
  if (!baseHasApi && !p.startsWith("/api/")) p = `/api${p}`;
  return `${API_BASE}${p}`;
};

const authHeaders = () => {
  const tk =
    localStorage.getItem("ns_auth_token") ||
    sessionStorage.getItem("ns_auth_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("token");
  return tk
    ? { Authorization: `Bearer ${String(tk).replace(/^Bearer\s+/i, "").replace(/^["']|["']$/g, "")}` }
    : {};
};

async function getJSON(path) {
  const r = await fetch(apiJoin(path), { headers: { "Content-Type": "application/json", ...authHeaders() }, credentials: "omit", cache: "no-store" });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

/* ---------- util ---------- */
const pad2 = (n) => String(n).padStart(2, "0");
const palette = [
  "#59d98e","#5bb6ff","#ffb74d","#e57373","#ba68c8","#4db6ac","#7986cb",
  "#aed581","#90a4ae","#f06292","#9575cd","#4fc3f7","#81c784","#ff8a65",
];
const buyerColor = (idx) => palette[idx % palette.length];
const esc = (s) =>
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

/* ----- helpers de imagem (logo opcional) ----- */
async function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
async function preloadAsDataURL(src) {
  const res = await fetch(src, { cache: "no-store" });
  const blob = await res.blob();
  return blobToDataURL(blob);
}

/* ----- helpers de canvas (formas arredondadas) ----- */
function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
function fillRounded(ctx, x, y, w, h, r, fill) {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}
function strokeRounded(ctx, x, y, w, h, r, stroke, lw = 2) {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.lineWidth = lw;
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

/* ----- word wrap simples ----- */
function wrapText(ctx, text, maxWidth) {
  const words = text.split(/\s+/g);
  const lines = [];
  let line = "";
  for (let i = 0; i < words.length; i++) {
    const test = line ? line + " " + words[i] : words[i];
    if (ctx.measureText(test).width <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = words[i];
    }
  }
  if (line) lines.push(line);
  return lines;
}

export default function AdminOpenDrawBuyers() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [tab, setTab] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [drawId, setDrawId] = React.useState(null);
  const [sold, setSold] = React.useState(0);
  const [remaining, setRemaining] = React.useState(0);
  const [buyers, setBuyers] = React.useState([]);      // [{user_id, name, email, numbers[], count, total_cents}]
  const [numbers, setNumbers] = React.useState([]);    // [{n, user_id, name, email}]
  const [query, setQuery] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await getJSON("/admin/dashboard/open-buyers");
      setDrawId(r.draw_id ?? null);
      setSold(r.sold ?? 0);
      setRemaining(r.remaining ?? Math.max(0, 100 - Number(r.sold || 0)));
      setBuyers(Array.isArray(r.buyers) ? r.buyers : []);
      setNumbers(Array.isArray(r.numbers) ? r.numbers : []);
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  // Map de user_id -> idx/color
  const idToIdx = React.useMemo(() => {
    const ids = buyers.map(b => b.user_id);
    const map = new Map();
    let k = 0;
    ids.forEach(id => { if (!map.has(id)) { map.set(id, k++); } });
    return map;
  }, [buyers]);

  const filteredBuyers = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return buyers;
    return buyers.filter(b =>
      String(b.name || "").toLowerCase().includes(q) ||
      String(b.email || "").toLowerCase().includes(q) ||
      (Array.isArray(b.numbers) && b.numbers.some(n => pad2(n).includes(q)))
    );
  }, [buyers, query]);

  const exportCSV = () => {
    const rows = [];
    rows.push(["draw_id","user_id","name","email","count","numbers","total_cents"]);
    buyers.forEach(b => {
      rows.push([
        drawId,
        b.user_id,
        (b.name || "").replaceAll(","," "),
        (b.email || "").replaceAll(","," "),
        b.count,
        (b.numbers || []).map(pad2).join(" "),
        b.total_cents || 0
      ]);
    });
    const csv = rows.map(r => r.map(v => `"${String(v ?? "").replaceAll('"','""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sorteio_${drawId}_compradores.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /** ---------- EXPORT 1: PNG 1080x1920 (Grade) ---------- */
  const exportPNGMobile = async () => {
    if (loading) {
      alert("Aguarde carregar os dados do sorteio antes de exportar.");
      return;
    }

    const W = 1080, H = 1920;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");

    // Fundo
    ctx.fillStyle = "#0E0E0E";
    ctx.fillRect(0, 0, W, H);

    const Mx = 36, My = 48;
    let y = My;

    // Logo
    try {
      const dataURL = await preloadAsDataURL(logoNewStore);
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataURL; });
      const h = 72;
      const scale = h / img.height;
      const w = img.width * scale;
      ctx.drawImage(img, Mx, y, w, h);
    } catch {}
    y += 72 + 12;

    // Título
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "900 44px Inter, system-ui, Segoe UI, Roboto, Arial";
    ctx.textBaseline = "top";
    ctx.fillText("Sorteio Ativo — Grade 00–99", Mx, y);
    y += 44 + 16;

    // Metadados
    const metaGap = 24;
    const metaLabels = ["Nº Sorteio", "Vendidos", "Restantes"];
    const metaValues = [
      String(drawId ?? "-"),
      String(sold ?? 0),
      String(Math.max(0, remaining ?? (100 - (sold || 0)))),
    ];
    const colW = 280;

    for (let i = 0; i < 3; i++) {
      const x = Mx + i * (colW + metaGap);
      ctx.globalAlpha = 0.75;
      ctx.font = "700 24px Inter, system-ui, Segoe UI, Roboto, Arial";
      ctx.fillText(metaLabels[i], x, y);
      ctx.globalAlpha = 1;
      ctx.font = "900 36px Inter, system-ui, Segoe UI, Roboto, Arial";
      ctx.fillText(metaValues[i], x, y + 28);
    }
    y += 36 + 28 + 28;

    // Grade 10x10
    const gap = 10;
    const footerH = 28 + 12 + 8;
    const availH = H - y - footerH - My;
    const availW = W - Mx * 2;

    const cellW = (availW - gap * 9) / 10;
    const cellHMax = (availH - gap * 9) / 10;
    const cell = Math.min(cellW, cellHMax);
    const gridW = cell * 10 + gap * 9;
    const startX = Mx + (availW - gridW) / 2;
    const startY = y;

    // Mapa número → dono
    const ownByNum = new Map();
    numbers.forEach((x) => {
      const nNum = Number(x.n);
      const idx  = idToIdx.get(x.user_id) ?? 0;
      ownByNum.set(nNum, { idx, owner: x });
    });

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let i = 0; i < 100; i++) {
      const r = Math.floor(i / 10);
      const c = i % 10;
      const x = startX + c * (cell + gap);
      const yy = startY + r * (cell + gap);

      const info = ownByNum.get(i);
      if (info) {
        fillRounded(ctx, x, yy, cell, cell, 16, buyerColor(info.idx));
        ctx.fillStyle = "#000000";
      } else {
        strokeRounded(ctx, x, yy, cell, cell, 16, "rgba(255,255,255,0.18)", 2);
        ctx.fillStyle = "#FFFFFF";
      }

      ctx.font = `${Math.round(cell * 0.36)}px Inter, system-ui, Segoe UI, Roboto, Arial`;
      ctx.fillText(pad2(i), x + cell / 2, yy + cell / 2);
    }

    // Footer
    const footY = startY + 10 * (cell + gap) + 16;
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "22px Inter, system-ui, Segoe UI, Roboto, Arial";
    ctx.textAlign = "left";
    ctx.fillText(`Gerado pela administração • ${new Date().toLocaleString("pt-BR")}`, Mx, footY);
    ctx.textAlign = "right";
    ctx.fillText("newstore", W - Mx, footY);
    ctx.globalAlpha = 1;

    const dataUrl = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `sorteio_${drawId}_grade_1080x1920.png`;
    a.click();
  };

  /** ---------- EXPORT 2: PNG 1080x1920 (Lista de nomes e números) ---------- */
  const exportPNGListMobile = async () => {
    if (loading) {
      alert("Aguarde carregar os dados do sorteio antes de exportar.");
      return;
    }

    const W = 1080, H = 1920;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");

    // Fundo
    ctx.fillStyle = "#0E0E0E";
    ctx.fillRect(0, 0, W, H);

    const Mx = 36, My = 48;
    let y = My;

    // Logo
    try {
      const dataURL = await preloadAsDataURL(logoNewStore);
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataURL; });
      const h = 72;
      const scale = h / img.height;
      const w = img.width * scale;
      ctx.drawImage(img, Mx, y, w, h);
    } catch {}
    y += 72 + 12;

    // Título
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "900 44px Inter, system-ui, Segoe UI, Roboto, Arial";
    ctx.textBaseline = "top";
    ctx.fillText("Sorteio Ativo — Lista de Compradores", Mx, y);
    y += 44 + 14;

    // Metadados
    const metaGap = 24;
    const metaLabels = ["Nº Sorteio", "Vendidos", "Restantes"];
    const metaValues = [
      String(drawId ?? "-"),
      String(sold ?? 0),
      String(Math.max(0, remaining ?? (100 - (sold || 0)))),
    ];
    const colW = 280;
    for (let i = 0; i < 3; i++) {
      const x = Mx + i * (colW + metaGap);
      ctx.globalAlpha = 0.75;
      ctx.font = "700 24px Inter, system-ui, Segoe UI, Roboto, Arial";
      ctx.fillText(metaLabels[i], x, y);
      ctx.globalAlpha = 1;
      ctx.font = "900 36px Inter, system-ui, Segoe UI, Roboto, Arial";
      ctx.fillText(metaValues[i], x, y + 28);
    }
    y += 36 + 28 + 18;

    // Área para os cards em duas colunas
    const gapCol = 24;
    const contentTop = y;
    const contentBottom = H - 80; // reserva para footer
    const contentHeight = contentBottom - contentTop;
    const colWidth = Math.floor((W - Mx * 2 - gapCol) / 2);
    const colX = [Mx, Mx + colWidth + gapCol];
    let colY = [contentTop, contentTop];

    // Ordena por nome (opcional p/ divulgação)
    const data = [...buyers].sort((a, b) =>
      String(a.name || a.email || "").localeCompare(String(b.name || b.email || ""), "pt-BR", { sensitivity: "base" })
    );

    // Desenha cada comprador como um "card"
    ctx.textBaseline = "top";

    let overflowCount = 0;
    data.forEach((b) => {
      const idx = idToIdx.get(b.user_id) ?? 0;
      const chip = buyerColor(idx);
      const name = String(b.name || b.email || "(sem nome)");
      const qtd = Number(b.count || (b.numbers?.length ?? 0)) || 0;
      const numbersList = (b.numbers || []).map(pad2).join(", ");

      // Estimativa de altura do card com wrap
      ctx.font = "800 30px Inter, system-ui, Segoe UI, Roboto, Arial";
      const nameH = 34;

      ctx.font = "700 24px Inter, system-ui, Segoe UI, Roboto, Arial";
      const qtdText = `Qtd: ${qtd}`;
      const qtdH = 26;

      ctx.font = "400 26px Inter, system-ui, Segoe UI, Roboto, Arial";
      const lines = wrapText(ctx, numbersList || "—", colWidth - 24 - 8); // padding 12+12
      const lineH = 30;
      const numsH = lines.length * lineH;

      const cardPad = 12;
      const cardH = cardPad + nameH + 6 + qtdH + 8 + numsH + cardPad;

      // escolhe coluna com menor Y
      const k = colY[0] <= colY[1] ? 0 : 1;
      const x = colX[k];
      const nextY = colY[k] + cardH + 14;

      // checa overflow
      if (nextY > contentTop + contentHeight) {
        overflowCount++;
        return;
      }

      // Card
      fillRounded(ctx, x, colY[k], colWidth, cardH, 16, "#141414");
      strokeRounded(ctx, x, colY[k], colWidth, cardH, 16, "rgba(255,255,255,0.10)", 2);

      // Chip
      const chipSize = 18;
      fillRounded(ctx, x + cardPad, colY[k] + cardPad + 6, chipSize, chipSize, 8, chip);

      // Nome
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "800 30px Inter, system-ui, Segoe UI, Roboto, Arial";
      ctx.fillText(
        name,
        x + cardPad + chipSize + 8,
        colY[k] + cardPad
      );

      // Qtd
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "700 24px Inter, system-ui, Segoe UI, Roboto, Arial";
      ctx.fillText(qtdText, x + cardPad, colY[k] + cardPad + nameH + 6);

      // Números (wrap)
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "400 26px Inter, system-ui, Segoe UI, Roboto, Arial";
      const numbersYStart = colY[k] + cardPad + nameH + 6 + qtdH + 8;
      lines.forEach((ln, i) => {
        ctx.fillText(ln, x + cardPad, numbersYStart + i * lineH);
      });

      colY[k] = nextY;
    });

    // Se overflow, mensagem no rodapé
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "left";
    ctx.font = "22px Inter, system-ui, Segoe UI, Roboto, Arial";
    let footerTextLeft = `Gerado pela administração • ${new Date().toLocaleString("pt-BR")}`;
    if (overflowCount > 0) {
      footerTextLeft += ` • … e mais ${overflowCount} comprador(es)`;
    }
    ctx.fillText(footerTextLeft, Mx, H - 48);

    ctx.textAlign = "right";
    ctx.fillText("newstore", W - Mx, H - 48);

    const dataUrl = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `sorteio_${drawId}_lista_1080x1920.png`;
    a.click();
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

      <AppBar position="sticky" elevation={0} sx={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <Toolbar sx={{ position: "relative", minHeight: 64 }}>
          <IconButton edge="start" color="inherit" onClick={() => navigate("/admin")} aria-label="Voltar">
            <ArrowBackIosNewRoundedIcon />
          </IconButton>

          <Box component={RouterLink} to="/admin"
            sx={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}>
            <Box component="img" src={logoNewStore} alt="NEW STORE" sx={{ height: 40 }} />
          </Box>

          <IconButton color="inherit" sx={{ ml: "auto" }}>
            <AccountCircleRoundedIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
        <Stack spacing={2.5}>
          <Typography sx={{ fontWeight: 900, fontSize: { xs: 22, md: 28 } }}>
            Sorteio Ativo — Compradores
          </Typography>

          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 4 }}>
            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
              <Stack sx={{ mr: 3 }}>
                <Typography sx={{ opacity: .7, fontWeight: 700 }}>Nº Sorteio</Typography>
                <Typography variant="h5" sx={{ fontWeight: 900 }}>{loading ? "…" : (drawId ?? "-")}</Typography>
              </Stack>
              <Stack sx={{ mr: 3 }}>
                <Typography sx={{ opacity: .7, fontWeight: 700 }}>Vendidos (aprovados)</Typography>
                <Typography variant="h5" sx={{ fontWeight: 900 }}>{loading ? "…" : sold}</Typography>
              </Stack>
              <Stack sx={{ mr: 3 }}>
                <Typography sx={{ opacity: .7, fontWeight: 700 }}>Restantes</Typography>
                <Typography variant="h5" sx={{ fontWeight: 900 }}>{loading ? "…" : remaining}</Typography>
              </Stack>

              <Box sx={{ flex: 1 }} />

              <TextField
                size="small"
                placeholder="Buscar por nome, e-mail ou número…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                sx={{ minWidth: { xs: "100%", sm: 280 } }}
              />

              <Button startIcon={<DownloadRoundedIcon />} onClick={exportCSV} variant="outlined">
                Exportar CSV
              </Button>
              <Button startIcon={<DownloadRoundedIcon />} onClick={exportPNGMobile} variant="contained">
                Exportar PNG (Grade 1080×1920)
              </Button>
              <Button startIcon={<DownloadRoundedIcon />} onClick={exportPNGListMobile} variant="contained" color="primary">
                Exportar PNG (Lista 1080×1920)
              </Button>
            </Stack>

            <Divider sx={{ my: 2.5 }} />

            <Tabs value={tab} onChange={(_, v) => setTab(v)} textColor="primary" indicatorColor="primary">
              <Tab label="Por comprador" />
              <Tab label="Por número (00–99)" />
            </Tabs>

            {/* --- Tab 1: Compradores --- */}
            {tab === 0 && (
              <Box sx={{ mt: 2 }}>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 800 }}>Comprador</TableCell>
                        <TableCell sx={{ fontWeight: 800 }}>Qtd</TableCell>
                        <TableCell sx={{ fontWeight: 800 }}>Números</TableCell>
                        <TableCell sx={{ fontWeight: 800 }}>Valor (R$)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredBuyers.length === 0 && (
                        <TableRow><TableCell colSpan={5} sx={{ color: "#bbb" }}>Nenhum comprador.</TableCell></TableRow>
                      )}
                      {filteredBuyers.map((b, i) => (
                        <TableRow key={b.user_id || i}>
                          <TableCell sx={{ fontWeight: 700 }}>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Chip size="small" label={pad2(i+1)} sx={{ bgcolor: buyerColor(idToIdx.get(b.user_id) ?? i), color: "#000", fontWeight: 800 }} />
                              <span>{b.name || "(sem nome)"}</span>
                            </Stack>
                          </TableCell>

                          <TableCell>{b.count || 0}</TableCell>
                          <TableCell sx={{ maxWidth: 520, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {(b.numbers || []).map(pad2).join(", ")}
                          </TableCell>
                          <TableCell>
                            {((b.total_cents || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}

            {/* --- Tab 2: Grade 00–99 --- */}
            {tab === 1 && (
              <Box sx={{ mt: 2 }}>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "repeat(10, 1fr)", md: "repeat(20, 1fr)" },
                    gap: .6,
                  }}
                >
                  {Array.from({ length: 100 }, (_, n) => {
                    const owner = numbers.find(x => Number(x.n) === n);
                    const idx   = owner ? (idToIdx.get(owner.user_id) ?? 0) : 0;
                    const bg    = owner ? buyerColor(idx) : "transparent";
                    const bd    = owner ? "none" : "1px solid rgba(255,255,255,.18)";
                    const fg    = owner ? "#000" : "inherit";
                    const title = owner ? `${pad2(n)} • ${owner.name || owner.email || "Comprador"}` : pad2(n);
                    return (
                      <Box
                        key={n}
                        title={title}
                        sx={{
                          userSelect: "none",
                          textAlign: "center",
                          py: .8,
                          borderRadius: 1.5,
                          fontWeight: 800,
                          letterSpacing: .5,
                          fontSize: 12,
                          border: bd,
                          bgcolor: bg,
                          color: fg,
                        }}
                      >
                        {pad2(n)}
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            )}
          </Paper>
        </Stack>
      </Container>
    </ThemeProvider>
  );
}
