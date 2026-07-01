import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert, AppBar, Box, Button, Chip, CircularProgress, Container, CssBaseline,
  IconButton, MenuItem, Paper, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, ThemeProvider, Toolbar,
  Typography,
} from "@mui/material";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import PauseCircleOutlineRoundedIcon from "@mui/icons-material/PauseCircleOutlineRounded";
import PlayCircleOutlineRoundedIcon from "@mui/icons-material/PlayCircleOutlineRounded";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import { adminPanelPaperSx, createNewStoreAdminTheme, newStoreAdminColors } from "./adminTheme";
import {
  listAdminCaptives,
  updateAdminCaptiveAuthorizationMode,
  updateAdminCaptiveParticipation,
} from "./services/adminCaptives";

const theme = createNewStoreAdminTheme();
const FILTERS = [
  ["todos", "Todos"],
  ["ativos", "Participando"],
  ["pausados", "Pausados"],
  ["com_whatsapp", "Com WhatsApp"],
  ["sem_whatsapp", "Sem WhatsApp"],
  ["com_cartao", "Com cartão"],
  ["sem_cartao", "Sem cartão"],
];

function StatusChip({ label, tone = "neutral" }) {
  const sx = {
    success: { color: "#061006", bgcolor: newStoreAdminColors.greenStrong },
    neutral: { color: "#F5F7F5", bgcolor: "rgba(255,255,255,0.12)" },
    warning: { color: "#141006", bgcolor: "#D6A100" },
    error: { color: "#fff", bgcolor: "#9F2F2D" },
  }[tone];
  return <Chip size="small" label={label} sx={{ fontWeight: 900, ...sx }} />;
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function LastRun({ row }) {
  const status = row?.last_run_status;
  if (!status) return <StatusChip label="Sem histórico" />;
  if (status === "approved") return <StatusChip label="Última tentativa aprovada" tone="success" />;
  if (status === "failed") return <StatusChip label="Última tentativa falhou" tone="error" />;
  if (status === "ignored") return <StatusChip label="Última tentativa ignorada" tone="warning" />;
  return <StatusChip label={status === "pending" ? "Última tentativa pendente" : status} />;
}

export default function AdminCaptivesPage() {
  const navigate = useNavigate();
  const [items, setItems] = React.useState([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pageSize] = React.useState(50);
  const [q, setQ] = React.useState("");
  const [debouncedQ, setDebouncedQ] = React.useState("");
  const [status, setStatus] = React.useState("todos");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [rowError, setRowError] = React.useState("");
  const [updatingId, setUpdatingId] = React.useState("");

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQ(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await listAdminCaptives({ q: debouncedQ, status, page, pageSize });
      setItems(Array.isArray(payload?.items) ? payload.items : []);
      setTotal(Number(payload?.total || 0));
    } catch {
      setItems([]);
      setTotal(0);
      setError("Não foi possível carregar os números cativos.");
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, status, page, pageSize]);

  React.useEffect(() => { load(); }, [load]);

  async function toggleParticipation(row) {
    setUpdatingId(`${row.id}:participation`);
    setRowError("");
    try {
      const payload = await updateAdminCaptiveParticipation(row.id, !row.participation_active);
      if (payload?.item?.id) {
        setItems((current) => current.map((item) => (
          String(item.id) === String(payload.item.id) ? payload.item : item
        )));
      } else {
        await load();
      }
    } catch {
      setRowError("Não foi possível atualizar a participação.");
    } finally {
      setUpdatingId("");
    }
  }

  async function toggleAuthorizationMode(row) {
    const nextMode = row.authorization_mode !== true;
    setUpdatingId(`${row.id}:authorization-mode`);
    setRowError("");
    try {
      const payload = await updateAdminCaptiveAuthorizationMode(row.id, nextMode);
      if (payload?.item?.id) {
        setItems((current) => current.map((item) => (
          String(item.id) === String(payload.item.id) ? payload.item : item
        )));
      } else {
        await load();
      }
    } catch {
      setRowError("Não foi possível atualizar o modo de cobrança.");
    } finally {
      setUpdatingId("");
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const empty = !loading && !error && items.length === 0;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="sticky" elevation={0}>
        <Toolbar sx={{ minHeight: 64 }}>
          <IconButton edge="start" color="inherit" onClick={() => navigate("/admin")} aria-label="Voltar">
            <ArrowBackIosNewRoundedIcon />
          </IconButton>
          <Typography sx={{ ml: 1, fontWeight: 900 }}>CATIVOS</Typography>
          <Box sx={{ flex: 1 }} />
          <Button startIcon={<RefreshRoundedIcon />} onClick={load} variant="outlined" size="small">
            Atualizar
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: { xs: 3, md: 4 } }}>
        <Stack spacing={2.5}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 900 }}>Números Cativos</Typography>
            <Typography sx={{ color: "text.secondary", mt: 0.5 }}>
              Controle de participação dos clientes com números cativos.
            </Typography>
          </Box>

          <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, ...adminPanelPaperSx }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ xs: "stretch", md: "center" }}>
              <TextField label="Busca" value={q} onChange={(e) => setQ(e.target.value)} size="small" sx={{ minWidth: { md: 360 } }} />
              <TextField
                select
                label="Filtro"
                value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                size="small"
                sx={{ minWidth: { md: 220 } }}
              >
                {FILTERS.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
              </TextField>
              <Box sx={{ flex: 1 }} />
              <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 800 }}>
                {total} registro{total === 1 ? "" : "s"}
              </Typography>
            </Stack>
          </Paper>

          {error && <Alert severity="error">{error}</Alert>}
          {rowError && <Alert severity="warning">{rowError}</Alert>}

          <Paper variant="outlined" sx={{ ...adminPanelPaperSx, overflow: "hidden" }}>
            {loading ? (
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ p: 3 }}>
                <CircularProgress size={22} />
                <Typography sx={{ color: "text.secondary" }}>Carregando</Typography>
              </Stack>
            ) : empty ? (
              <Typography sx={{ p: 3, color: "text.secondary" }}>Nenhum número cativo encontrado.</Typography>
            ) : (
              <TableContainer>
                <Table size="small" sx={{ minWidth: 1180 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Cliente</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Telefone</TableCell>
                      <TableCell>Número Cativo</TableCell>
                      <TableCell>Participação</TableCell>
                      <TableCell>Modo de Cobrança</TableCell>
                      <TableCell>Autopay/Cartão</TableCell>
                      <TableCell>WhatsApp</TableCell>
                      <TableCell>Última tentativa</TableCell>
                      <TableCell align="right">Ações</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((row) => {
                      const participationUpdating = updatingId === `${row.id}:participation`;
                      const modeUpdating = updatingId === `${row.id}:authorization-mode`;
                      const requiresPreauth = row.authorization_mode === true || row.requires_preauth === true;
                      return (
                        <TableRow key={row.id} hover>
                          <TableCell sx={{ fontWeight: 800 }}>{row.user_name || "-"}</TableCell>
                          <TableCell>{row.user_email || "-"}</TableCell>
                          <TableCell>{row.user_phone_masked || "-"}</TableCell>
                          <TableCell sx={{ fontWeight: 900 }}>{row.captive_number_label || row.captive_number}</TableCell>
                          <TableCell>
                            {row.participation_active ? <StatusChip label="Participando" tone="success" /> : <StatusChip label="Pausado" tone="error" />}
                          </TableCell>
                          <TableCell>
                            {requiresPreauth
                              ? <StatusChip label={row.authorization_mode_label || "Pré-autorização"} tone="warning" />
                              : <StatusChip label={row.authorization_mode_label || "Automático"} tone="neutral" />}
                          </TableCell>
                          <TableCell>
                            {row.card_status === "configured" ? <StatusChip label="Cartão configurado" tone="success" /> : <StatusChip label="Sem cartão" tone="warning" />}
                          </TableCell>
                          <TableCell>
                            {row.whatsapp_consent_status === "granted" ? <StatusChip label="WhatsApp autorizado" tone="success" /> : <StatusChip label="WhatsApp não autorizado" tone="warning" />}
                          </TableCell>
                          <TableCell>
                            <Stack spacing={0.5}>
                              <LastRun row={row} />
                              {row.last_run_at && <Typography variant="caption" sx={{ color: "text.secondary" }}>{formatDate(row.last_run_at)}</Typography>}
                            </Stack>
                          </TableCell>
                          <TableCell align="right">
                            <Stack direction={{ xs: "column", lg: "row" }} spacing={1} justifyContent="flex-end">
                              <Button
                                variant={row.participation_active ? "outlined" : "contained"}
                                color={row.participation_active ? "error" : "primary"}
                                size="small"
                                startIcon={participationUpdating ? <CircularProgress color="inherit" size={16} /> : row.participation_active ? <PauseCircleOutlineRoundedIcon /> : <PlayCircleOutlineRoundedIcon />}
                                disabled={participationUpdating || modeUpdating}
                                onClick={() => toggleParticipation(row)}
                                sx={{ whiteSpace: "nowrap" }}
                              >
                                {row.participation_active ? "Pausar participação" : "Ativar participação"}
                              </Button>
                              <Button
                                variant={requiresPreauth ? "outlined" : "contained"}
                                color={requiresPreauth ? "inherit" : "success"}
                                size="small"
                                startIcon={modeUpdating ? <CircularProgress color="inherit" size={16} /> : <SwapHorizRoundedIcon />}
                                disabled={participationUpdating || modeUpdating}
                                onClick={() => toggleAuthorizationMode(row)}
                                sx={{ whiteSpace: "nowrap" }}
                              >
                                {requiresPreauth ? "Voltar automático" : "Usar pré-autorização"}
                              </Button>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>

          <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
            <Button variant="outlined" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>Anterior</Button>
            <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 800 }}>
              Página {page} de {totalPages}
            </Typography>
            <Button variant="outlined" disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)}>Próxima</Button>
          </Stack>
        </Stack>
      </Container>
    </ThemeProvider>
  );
}
