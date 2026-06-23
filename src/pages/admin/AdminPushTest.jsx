import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  AppBar,
  Box,
  Button,
  Chip,
  Container,
  CssBaseline,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ThemeProvider,
  Toolbar,
  Typography,
  createTheme,
} from "@mui/material";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import {
  getAdminPushTestStatus,
  parsePushError,
  sendAdminTestPush,
} from "../../services/pushNotifications";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#2E7D32" },
    background: { default: "#0E0E0E", paper: "#121212" },
    warning: { main: "#B58900" },
    success: { main: "#67C23A" },
    error: { main: "#E57373" },
  },
  shape: { borderRadius: 16 },
  typography: { fontFamily: ["Inter", "system-ui", "Segoe UI", "Roboto", "Arial"].join(",") },
});

function fmtDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString("pt-BR");
}

function asList(data, keys = []) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  for (const k of keys) {
    if (Array.isArray(data[k])) return data[k];
  }
  return [];
}

function looksLikeIdList(value) {
  const s = String(value || "").trim();
  if (!s) return false;
  return /[,;\s]/.test(s) || /^\[/.test(s);
}

export default function AdminPushTest() {
  const nav = useNavigate();
  const [status, setStatus] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [loadError, setLoadError] = React.useState(null);
  const [sendError, setSendError] = React.useState(null);
  const [sendResult, setSendResult] = React.useState(null);

  const [userId, setUserId] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [category, setCategory] = React.useState("operational");

  const loadStatus = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getAdminPushTestStatus();
      setStatus(data);
    } catch (err) {
      setLoadError(parsePushError(err));
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const testMode = Boolean(status?.test_mode ?? status?.testMode);
  const productionEnabled = Boolean(
    status?.production_enabled ?? status?.productionEnabled ?? status?.push_enabled
  );

  const allowedUsers = asList(status, [
    "allowed_test_user_ids",
    "allowedTestUserIds",
    "allowed_user_ids",
    "allowedUserIds",
  ]);

  const dispatches = asList(status, [
    "recent_dispatches",
    "recentDispatches",
    "dispatches",
    "last_dispatches",
  ]);

  const errors = asList(status, ["recent_errors", "recentErrors", "errors", "last_errors"]);

  const activeSubscriptions =
    status?.active_subscriptions_count ??
    status?.activeSubscriptionsCount ??
    status?.subscriptions_count ??
    status?.total_subscriptions ??
    "—";

  const handleSend = async () => {
    setSendError(null);
    setSendResult(null);

    const uid = String(userId || "").trim();
    if (!uid) {
      setSendError("O user_id do usuário de teste é obrigatório.");
      return;
    }
    if (looksLikeIdList(uid)) {
      setSendError("Envio individual apenas: não use lista de IDs.");
      return;
    }
    if (!title.trim()) {
      setSendError("O título é obrigatório.");
      return;
    }
    if (title.trim().length > 80) {
      setSendError("O título deve ter no máximo 80 caracteres.");
      return;
    }
    if (!body.trim()) {
      setSendError("A mensagem é obrigatória.");
      return;
    }
    if (body.trim().length > 180) {
      setSendError("A mensagem deve ter no máximo 180 caracteres.");
      return;
    }

    setSending(true);
    try {
      const result = await sendAdminTestPush({
        user_id: uid,
        title: title.trim(),
        body: body.trim(),
        url: url.trim() || undefined,
        category,
      });
      setSendResult(result);
      await loadStatus();
    } catch (err) {
      setSendError(parsePushError(err));
    } finally {
      setSending(false);
    }
  };

  const sent = sendResult?.sent ?? sendResult?.summary?.sent;
  const failed = sendResult?.failed ?? sendResult?.summary?.failed;
  const skipped = sendResult?.skipped ?? sendResult?.summary?.skipped;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="sticky" elevation={0} sx={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <Toolbar sx={{ minHeight: 64 }}>
          <IconButton edge="start" color="inherit" onClick={() => nav("/admin")} aria-label="Voltar">
            <ArrowBackIosNewRoundedIcon />
          </IconButton>
          <Typography sx={{ fontWeight: 900, ml: 1, flex: 1 }}>Teste de Push</Typography>
          <IconButton color="inherit" onClick={loadStatus} disabled={loading} aria-label="Recarregar">
            <RefreshRoundedIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ py: 3 }}>
        <Stack spacing={3}>
          <Box>
            <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="h5" sx={{ fontWeight: 900 }}>
                Teste de Push
              </Typography>
              {testMode && (
                <Chip label="Modo teste ativo" color="warning" size="small" sx={{ fontWeight: 800 }} />
              )}
            </Stack>
            <Typography sx={{ opacity: 0.75 }}>
              Esta tela envia apenas Push de teste individual. Envio em massa está bloqueado enquanto o modo teste
              estiver ativo.
            </Typography>
            <Typography sx={{ opacity: 0.75, mt: 0.5 }}>
              Este canal não usa Brevo, WhatsApp ou número de telefone.
            </Typography>
          </Box>

          {loadError && (
            <Alert severity="error">{loadError}</Alert>
          )}

          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 2 }}>
              Status do sistema
            </Typography>
            {loading && !status ? (
              <Typography sx={{ opacity: 0.7 }}>Carregando…</Typography>
            ) : (
              <Stack spacing={1}>
                <Typography variant="body2">
                  <strong>Modo atual:</strong> {testMode ? "teste" : "produção"}
                </Typography>
                <Typography variant="body2">
                  <strong>Produção habilitada:</strong> {productionEnabled ? "sim" : "não"}
                </Typography>
                <Typography variant="body2">
                  <strong>Total de subscriptions ativas:</strong> {activeSubscriptions}
                </Typography>
                <Typography variant="body2">
                  <strong>Usuários permitidos para teste:</strong>{"
                  "}
                  {allowedUsers.length
                    ? allowedUsers.join(", ")
                    : status?.allowed_test_user_ids != null
                      ? String(status.allowed_test_user_ids)
                      : "—"}
                </Typography>
              </Stack>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 2 }}>
              Enviar Push de teste individual
            </Typography>

            <Stack spacing={2}>
              <TextField
                label="user_id do usuário de teste"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                fullWidth
                required
                helperText="Apenas um usuário. Listas e audiência não são permitidas."
              />
              <TextField
                label="Título"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                fullWidth
                required
                inputProps={{ maxLength: 80 }}
                helperText={`${title.length}/80 caracteres`}
              />
              <TextField
                label="Mensagem curta"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                fullWidth
                required
                multiline
                minRows={2}
                inputProps={{ maxLength: 180 }}
                helperText={`${body.length}/180 caracteres`}
              />
              <TextField
                label="URL opcional"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                fullWidth
                placeholder="/conta"
              />
              <FormControl fullWidth>
                <InputLabel id="push-category-label">Categoria</InputLabel>
                <Select
                  labelId="push-category-label"
                  label="Categoria"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <MenuItem value="operational">operational</MenuItem>
                  <MenuItem value="marketing">marketing</MenuItem>
                </Select>
              </FormControl>

              <Button
                variant="contained"
                color="success"
                onClick={handleSend}
                disabled={sending}
                sx={{ alignSelf: "flex-start" }}
              >
                {sending ? "Enviando…" : "Enviar Push de teste"}
              </Button>
            </Stack>

            {sendError && (
              <Alert severity="error" sx={{ mt: 2 }}>{sendError}</Alert>
            )}

            {sendResult && (
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  Enviados: {sent ?? "—"}, falhas: {failed ?? "—"}, ignorados: {skipped ?? "—"}
                </Typography>
                {sendResult?.error && (
                  <Typography variant="body2" color="error.main" sx={{ mt: 0.5 }}>
                    {sendResult.error}
                  </Typography>
                )}
              </Alert>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 2 }}>
              Últimos dispatches de push
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Data</TableCell>
                    <TableCell>Usuário</TableCell>
                    <TableCell>Título</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {dispatches.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} sx={{ opacity: 0.7 }}>Nenhum dispatch recente.</TableCell>
                    </TableRow>
                  )}
                  {dispatches.map((row, idx) => (
                    <TableRow key={row?.id ?? idx}>
                      <TableCell>{fmtDate(row?.created_at ?? row?.createdAt ?? row?.at)}</TableCell>
                      <TableCell>{row?.user_id ?? row?.userId ?? "—"}</TableCell>
                      <TableCell>{row?.title ?? row?.body ?? "—"}</TableCell>
                      <TableCell>{row?.status ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 2 }}>
              Últimos erros
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Data</TableCell>
                    <TableCell>Usuário</TableCell>
                    <TableCell>Erro</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {errors.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} sx={{ opacity: 0.7 }}>Nenhum erro recente.</TableCell>
                    </TableRow>
                  )}
                  {errors.map((row, idx) => (
                    <TableRow key={row?.id ?? idx}>
                      <TableCell>{fmtDate(row?.created_at ?? row?.createdAt ?? row?.at)}</TableCell>
                      <TableCell>{row?.user_id ?? row?.userId ?? "—"}</TableCell>
                      <TableCell>{row?.error ?? row?.message ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Stack>
      </Container>
    </ThemeProvider>
  );
}
