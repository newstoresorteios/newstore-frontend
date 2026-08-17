// src/components/rewardStore/PublishedProductsTab.jsx
//
// Aba PUBLICADOS do módulo LOJA DE PRÊMIOS NS.
// Mostra o que está na /loja e permite alterar NSCréditos, ordem de exibição,
// despublicar e sincronizar.
//
// DESPUBLICAR é uma operação 100% local: grava is_published = false na NewStore
// e NÃO remove, apaga ou altera o produto na Tray.

import * as React from "react";
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SyncRoundedIcon from "@mui/icons-material/SyncRounded";

import { adminPanelPaperSx, newStoreAdminColors } from "../../adminTheme";
import {
  listPublishedProducts,
  patchProduct,
  syncProducts,
  parseNsCreditsInput,
  describeApiError,
} from "../../services/rewardStore";
import { NsCreditsField, Thumb, formatBRL, formatDateTime, formatNsCredits } from "./shared";

const STATUS_FILTERS = [
  ["todos", "Todos"],
  ["publicados", "Publicados"],
  ["despublicados", "Despublicados"],
  ["indisponiveis", "Indisponíveis na Tray"],
];

export default function PublishedProductsTab({ onNotify, reloadToken }) {
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [busyId, setBusyId] = React.useState("");
  const [edits, setEdits] = React.useState({});
  const [orderEdits, setOrderEdits] = React.useState({});
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("todos");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await listPublishedProducts({ page: 1, limit: 200 });
      setItems(Array.isArray(payload?.items) ? payload.items : []);
    } catch (e) {
      setItems([]);
      setError(describeApiError(e, "Não foi possível carregar os produtos publicados."));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load, reloadToken]);

  function replaceItem(item) {
    setItems((current) => current.map((it) => (it.tray_product_id === item.tray_product_id ? item : it)));
  }

  async function savePrice(item) {
    // Sem edição, salva o valor que está visível no campo — não `undefined`.
    const raw = edits[item.tray_product_id] ?? String(item.nscredits_price);
    const parsed = parseNsCreditsInput(raw);
    if (parsed === null) {
      onNotify("NSCréditos deve ser um inteiro maior que zero.", "warning");
      return;
    }
    setBusyId(item.tray_product_id);
    try {
      const out = await patchProduct(item.tray_product_id, { nscredits_price: parsed });
      if (out?.item) replaceItem(out.item);
      setEdits((current) => ({ ...current, [item.tray_product_id]: undefined }));
      onNotify("NSCréditos atualizado.", "success");
    } catch (e) {
      onNotify(describeApiError(e, "Não foi possível atualizar os NSCréditos."), "error");
    } finally {
      setBusyId("");
    }
  }

  async function saveOrder(item) {
    const raw = orderEdits[item.tray_product_id] ?? String(item.display_order ?? 0);
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0) {
      onNotify("A ordem de exibição deve ser um inteiro maior ou igual a zero.", "warning");
      return;
    }
    setBusyId(item.tray_product_id);
    try {
      const out = await patchProduct(item.tray_product_id, { display_order: n });
      if (out?.item) replaceItem(out.item);
      setOrderEdits((current) => ({ ...current, [item.tray_product_id]: undefined }));
      onNotify("Ordem de exibição atualizada.", "success");
    } catch (e) {
      onNotify(describeApiError(e, "Não foi possível atualizar a ordem."), "error");
    } finally {
      setBusyId("");
    }
  }

  async function togglePublished(item) {
    setBusyId(item.tray_product_id);
    try {
      const out = await patchProduct(item.tray_product_id, { is_published: !item.is_published });
      if (out?.item) replaceItem(out.item);
      onNotify(
        item.is_published
          ? "Produto despublicado da loja. Ele continua existindo normalmente na Tray."
          : "Produto publicado na loja.",
        "success"
      );
    } catch (e) {
      onNotify(describeApiError(e, "Não foi possível alterar a publicação."), "error");
    } finally {
      setBusyId("");
    }
  }

  async function syncOne(item) {
    setBusyId(item.tray_product_id);
    try {
      const out = await syncProducts([item.tray_product_id]);
      const result = out?.results?.[0];
      if (result?.ok && result.item) {
        replaceItem(result.item);
        onNotify("Snapshot atualizado a partir da Tray.", "success");
      } else {
        onNotify(
          describeApiError(new Error(`${result?.error || "sync_failed"}:502`), "Falha ao sincronizar."),
          "error"
        );
      }
    } catch (e) {
      onNotify(describeApiError(e, "Não foi possível sincronizar."), "error");
    } finally {
      setBusyId("");
    }
  }

  async function syncAll() {
    setLoading(true);
    try {
      const out = await syncProducts();
      onNotify(`Sincronização concluída: ${out?.succeeded ?? 0} ok, ${out?.failed ?? 0} com falha.`, "info");
      await load();
    } catch (e) {
      onNotify(describeApiError(e, "Não foi possível sincronizar com a Tray."), "error");
    } finally {
      setLoading(false);
    }
  }

  const term = q.trim().toLowerCase();
  const visible = items.filter((item) => {
    if (status === "publicados" && !item.is_published) return false;
    if (status === "despublicados" && item.is_published) return false;
    if (status === "indisponiveis" && item.is_available) return false;
    if (!term) return true;
    return [item.name, item.reference, item.brand, item.tray_product_id]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(term));
  });

  return (
    <>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.5}
        sx={{ mb: 2 }}
        alignItems={{ md: "center" }}
      >
        <TextField
          size="small"
          fullWidth
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar entre os produtos publicados"
          sx={{ flex: 1, minWidth: 0 }}
        />
        <TextField
          size="small"
          select
          label="Situação"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          sx={{ minWidth: 210 }}
        >
          {STATUS_FILTERS.map(([value, label]) => (
            <MenuItem key={value} value={value}>
              {label}
            </MenuItem>
          ))}
        </TextField>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={load} disabled={loading} startIcon={<RefreshRoundedIcon />}>
            Recarregar
          </Button>
          <Button variant="outlined" onClick={syncAll} disabled={loading} startIcon={<SyncRoundedIcon />}>
            Sincronizar publicados
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Stack alignItems="center" sx={{ py: 6 }}>
          <CircularProgress />
        </Stack>
      ) : items.length === 0 && !error ? (
        <Alert severity="info" variant="outlined">
          Nenhum produto publicado ainda. Selecione produtos na aba “Produtos Tray”.
        </Alert>
      ) : visible.length === 0 ? (
        <Alert severity="info" variant="outlined">
          Nenhum produto corresponde à busca.
        </Alert>
      ) : (
        <Stack spacing={1.5}>
          {visible.map((item) => {
            const busy = busyId === item.tray_product_id;
            const editValue = edits[item.tray_product_id];
            const orderValue = orderEdits[item.tray_product_id];
            return (
              <Paper key={item.tray_product_id} variant="outlined" sx={{ p: 2, ...adminPanelPaperSx }}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <Thumb src={item.image_url} alt={item.name} size={72} />

                  <Stack spacing={0.75} sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 900 }}>
                      {item.name || `Produto ${item.tray_product_id}`}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "rgba(245,247,245,0.6)" }}>
                      Tray #{item.tray_product_id} · {item.reference || "sem referência"} ·{" "}
                      {item.brand || "sem marca"}
                    </Typography>

                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Chip
                        size="small"
                        label={`${formatNsCredits(item.nscredits_price)} NSCréditos`}
                        sx={{ fontWeight: 900, bgcolor: newStoreAdminColors.greenStrong, color: "#061006" }}
                      />
                      <Chip
                        size="small"
                        label={item.is_published ? "Publicado" : "Despublicado"}
                        color={item.is_published ? "success" : "default"}
                        sx={{ fontWeight: 800 }}
                      />
                      <Chip
                        size="small"
                        variant="outlined"
                        label={`Tray: ${item.is_available ? "disponível" : "indisponível"}`}
                      />
                      <Chip size="small" variant="outlined" label={`Estoque factual: ${item.stock ?? "—"}`} />
                      {item.has_variation && (
                        <Chip size="small" variant="outlined" label={`${item.variants?.length || 0} variações`} />
                      )}
                    </Stack>

                    <Typography variant="caption" sx={{ color: "rgba(245,247,245,0.45)" }}>
                      Preço Tray (referência): {formatBRL(item.tray_price_snapshot)} · Última sincronização:{" "}
                      {formatDateTime(item.last_synced_at)}
                    </Typography>
                  </Stack>

                  <Stack spacing={1} sx={{ minWidth: { sm: 250 } }}>
                    <Stack direction="row" spacing={1}>
                      <NsCreditsField
                        value={editValue ?? String(item.nscredits_price)}
                        onChange={(v) => setEdits((c) => ({ ...c, [item.tray_product_id]: v }))}
                        disabled={busy}
                      />
                      <Button size="small" variant="contained" onClick={() => savePrice(item)} disabled={busy}>
                        Salvar
                      </Button>
                    </Stack>

                    <Stack direction="row" spacing={1}>
                      <TextField
                        size="small"
                        value={orderValue ?? String(item.display_order ?? 0)}
                        onChange={(e) =>
                          setOrderEdits((c) => ({
                            ...c,
                            [item.tray_product_id]: e.target.value.replace(/[^\d]/g, ""),
                          }))
                        }
                        disabled={busy}
                        inputProps={{ inputMode: "numeric", "aria-label": "Ordem de exibição" }}
                        sx={{ width: 130 }}
                      />
                      <Button size="small" variant="outlined" onClick={() => saveOrder(item)} disabled={busy}>
                        Ordem
                      </Button>
                    </Stack>

                    <Stack direction="row" spacing={1}>
                      <Button size="small" variant="outlined" onClick={() => togglePublished(item)} disabled={busy}>
                        {item.is_published ? "Despublicar" : "Publicar"}
                      </Button>
                      <Button size="small" variant="outlined" onClick={() => syncOne(item)} disabled={busy}>
                        Sincronizar
                      </Button>
                    </Stack>
                  </Stack>
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      )}
    </>
  );
}
