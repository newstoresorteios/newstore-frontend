// src/components/rewardStore/RedemptionsTab.jsx
//
// Aba PEDIDOS / RESGATES do módulo LOJA DE PRÊMIOS NS.
//
// Mostra os resgates REAIS (reward_redemptions) com busca, filtro de status
// factual, período e paginação feita no backend.
//
// SOMENTE LEITURA: o painel observa o resgate que a NewStore já executa e
// consulta o pedido na Tray; nunca altera resgate, saldo, ledger, estoque,
// preço, frete ou status do pedido.
//
// PII: nome e e-mail bastam para a operação. Endereço só aparece no detalhe;
// CPF nunca aparece em lugar nenhum deste painel.

import * as React from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";

import { adminPanelPaperSx } from "../../adminTheme";
import { listRedemptions, describeRedemptionAdminError } from "../../services/redemptionsAdmin";
import { isRecoverableError } from "../../services/rewardStore";
import RedemptionStatusBadge from "./RedemptionStatusBadge";
import RedemptionDetails from "./RedemptionDetails";
import { formatDateTime, formatNsCredits } from "./shared";

const PAGE_LIMIT = 20;

const EMPTY_FILTERS = { q: "", status: "", from: "", to: "" };

export default function RedemptionsTab({ isMobile, initialRedemptionId = null, onDetailClosed }) {
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");

  const [applied, setApplied] = React.useState({ ...EMPTY_FILTERS, page: 1 });
  const [items, setItems] = React.useState([]);
  const [paging, setPaging] = React.useState({ page: 1, limit: PAGE_LIMIT, total: 0, total_pages: 0 });
  const [catalog, setCatalog] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [canRetry, setCanRetry] = React.useState(false);

  const [openId, setOpenId] = React.useState(initialRedemptionId);

  React.useEffect(() => {
    if (initialRedemptionId) setOpenId(initialRedemptionId);
  }, [initialRedemptionId]);

  const load = React.useCallback(async (filters) => {
    setLoading(true);
    setError("");
    try {
      const payload = await listRedemptions({ ...filters, limit: PAGE_LIMIT });
      setItems(Array.isArray(payload?.items) ? payload.items : []);
      setPaging(payload?.paging || { page: filters.page, limit: PAGE_LIMIT, total: 0, total_pages: 0 });
      if (Array.isArray(payload?.statuses)) setCatalog(payload.statuses);
    } catch (e) {
      setItems([]);
      setError(describeRedemptionAdminError(e));
      setCanRetry(isRecoverableError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load(applied);
  }, [applied, load]);

  function submit(event) {
    event.preventDefault();
    setApplied({ q, status, from, to, page: 1 });
  }

  function clearFilters() {
    setQ("");
    setStatus("");
    setFrom("");
    setTo("");
    setApplied({ ...EMPTY_FILTERS, page: 1 });
  }

  function closeDetail() {
    setOpenId(null);
    if (onDetailClosed) onDetailClosed();
  }

  const totalPages = paging.total_pages || (paging.total ? Math.ceil(paging.total / paging.limit) : 0);
  const hasFilters = Boolean(applied.q || applied.status || applied.from || applied.to);

  return (
    <>
      <Box component="form" onSubmit={submit} sx={{ mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "center" }} flexWrap="wrap" useFlexGap>
          <TextField
            size="small"
            fullWidth
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por resgate, pedido Tray, cliente, e-mail ou ID"
            inputProps={{ "aria-label": "Buscar resgate" }}
            sx={{ flex: 2, minWidth: 240 }}
          />
          <TextField
            size="small"
            select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            label="Status"
            inputProps={{ "aria-label": "Status" }}
            sx={{ minWidth: 220 }}
          >
            <MenuItem value="">Todos</MenuItem>
            {/* Opções derivadas dos status REAIS devolvidos pelo backend. */}
            {catalog.map((s) => (
              <MenuItem key={s.status} value={s.status}>
                {s.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            label="De"
            InputLabelProps={{ shrink: true }}
            inputProps={{ "aria-label": "De" }}
            sx={{ minWidth: 160 }}
          />
          <TextField
            size="small"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            label="Até"
            InputLabelProps={{ shrink: true }}
            inputProps={{ "aria-label": "Até" }}
            sx={{ minWidth: 160 }}
          />
          <Stack direction="row" spacing={1}>
            <Button type="submit" variant="contained" disabled={loading}>
              Buscar
            </Button>
            <Button variant="outlined" onClick={() => load(applied)} disabled={loading} startIcon={<RefreshRoundedIcon />}>
              Atualizar
            </Button>
            {hasFilters && (
              <Button variant="text" onClick={clearFilters} disabled={loading}>
                Limpar
              </Button>
            )}
          </Stack>
        </Stack>
      </Box>

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            canRetry ? (
              <Button color="inherit" size="small" onClick={() => load(applied)}>
                Tentar de novo
              </Button>
            ) : null
          }
        >
          {error}
        </Alert>
      )}

      {loading ? (
        <Stack alignItems="center" sx={{ py: 6 }}>
          <CircularProgress />
        </Stack>
      ) : items.length === 0 ? (
        <Alert severity="info" variant="outlined">
          Nenhum resgate encontrado.
        </Alert>
      ) : isMobile ? (
        <Stack spacing={1}>
          {items.map((item) => (
            <Paper key={item.id} variant="outlined" sx={{ p: 1.5, ...adminPanelPaperSx }}>
              <Stack spacing={0.75}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                  <RedemptionStatusBadge status={item.status} catalog={catalog} />
                  <Typography variant="caption" sx={{ opacity: 0.6 }}>
                    {formatDateTime(item.created_at)}
                  </Typography>
                </Stack>
                <Typography sx={{ fontWeight: 800 }}>{item.user.name}</Typography>
                <Typography variant="caption" sx={{ opacity: 0.6, wordBreak: "break-all" }}>
                  {item.user.email} · ID #{item.user.id}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Chip size="small" variant="outlined" label={`${item.item_count} item(ns)`} />
                  <Chip size="small" variant="outlined" label={`${formatNsCredits(item.credits_amount)} NSCréditos`} />
                  {item.tray_order_id && <Chip size="small" variant="outlined" label={`Tray #${item.tray_order_id}`} />}
                </Stack>
                <Button size="small" variant="outlined" onClick={() => setOpenId(item.id)}>
                  Ver detalhes
                </Button>
              </Stack>
            </Paper>
          ))}
        </Stack>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ ...adminPanelPaperSx, overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 900 }}>
            <TableHead>
              <TableRow>
                <TableCell>Resgate</TableCell>
                <TableCell>Cliente</TableCell>
                <TableCell align="right">Itens</TableCell>
                <TableCell align="right">NSCréditos</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Pedido Tray</TableCell>
                <TableCell>Data</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell sx={{ maxWidth: 160 }}>
                    <Typography variant="caption" sx={{ opacity: 0.7, wordBreak: "break-all" }}>
                      {item.id}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 240 }}>
                    <Stack spacing={0.25}>
                      <Typography sx={{ fontWeight: 800, lineHeight: 1.25 }}>{item.user.name}</Typography>
                      <Typography variant="caption" sx={{ opacity: 0.55, wordBreak: "break-all" }}>
                        {item.user.email} · ID #{item.user.id}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell align="right">{item.item_count}</TableCell>
                  <TableCell align="right">{formatNsCredits(item.credits_amount)}</TableCell>
                  <TableCell>
                    <RedemptionStatusBadge status={item.status} catalog={catalog} />
                  </TableCell>
                  <TableCell>{item.tray_order_id ? `#${item.tray_order_id}` : "—"}</TableCell>
                  <TableCell>{formatDateTime(item.created_at)}</TableCell>
                  <TableCell align="right">
                    <Button size="small" variant="outlined" onClick={() => setOpenId(item.id)}>
                      Ver detalhes
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {items.length > 0 && (
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ mt: 2 }}>
          <Button
            size="small"
            variant="outlined"
            disabled={loading || applied.page <= 1}
            onClick={() => setApplied((c) => ({ ...c, page: c.page - 1 }))}
          >
            Anterior
          </Button>
          <Typography variant="body2" sx={{ color: "rgba(245,247,245,0.7)" }}>
            Página {paging.page}
            {totalPages ? ` de ${totalPages}` : ""} · {paging.total} resgates
          </Typography>
          <Button
            size="small"
            variant="outlined"
            disabled={loading || (totalPages ? applied.page >= totalPages : items.length < PAGE_LIMIT)}
            onClick={() => setApplied((c) => ({ ...c, page: c.page + 1 }))}
          >
            Próxima
          </Button>
        </Stack>
      )}

      {openId && <RedemptionDetails redemptionId={openId} catalog={catalog} onClose={closeDetail} />}
    </>
  );
}
