// src/components/rewardStore/TrayProductsTab.jsx
//
// Aba PRODUTOS TRAY do módulo LOJA DE PRÊMIOS NS.
// Alimenta a /loja: lista o catálogo real da Tray (via backend NewStore),
// o admin marca produtos, informa NSCréditos e publica.
//
// Nesta etapa o catálogo Tray é consultado somente para leitura.

import * as React from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
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
  Tooltip,
  Typography,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";

import { adminPanelPaperSx } from "../../adminTheme";
import {
  listTrayProducts,
  listTrayBrands,
  publishProducts,
  getTrayProduct,
  parseNsCreditsInput,
  describeApiError,
  isRecoverableError,
} from "../../services/rewardStore";
import { AvailabilityCell, NsCreditsField, Thumb, formatBRL } from "./shared";

const PAGE_LIMIT = 20;

const SEARCH_FIELDS = [
  ["auto", "Automático"],
  ["name", "Nome"],
  ["reference", "Referência"],
  ["id", "ID Tray"],
  ["brand", "Marca"],
];

const AVAILABILITY_FILTERS = [
  ["", "Todas"],
  ["1", "Disponíveis na Tray"],
  ["0", "Indisponíveis na Tray"],
];

export default function TrayProductsTab({ isMobile, onNotify, onPublished }) {
  const [items, setItems] = React.useState([]);
  const [paging, setPaging] = React.useState({ page: 1, limit: PAGE_LIMIT, total: null });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [canRetry, setCanRetry] = React.useState(false);

  const [q, setQ] = React.useState("");
  const [qField, setQField] = React.useState("auto");
  const [available, setAvailable] = React.useState("");
  const [brand, setBrand] = React.useState("");
  const [brands, setBrands] = React.useState([]);
  const [page, setPage] = React.useState(1);

  // Filtros efetivamente aplicados. A busca só dispara no submit ou no botão —
  // nunca a cada tecla, para não estourar o rate limit da Tray.
  const [applied, setApplied] = React.useState({ q: "", qField: "auto", available: "", brand: "", page: 1 });

  const [selected, setSelected] = React.useState({});
  const [prices, setPrices] = React.useState({});
  const [priceErrors, setPriceErrors] = React.useState({});
  const [publishing, setPublishing] = React.useState(false);
  const [detail, setDetail] = React.useState(null);
  const [detailLoading, setDetailLoading] = React.useState(false);

  const load = React.useCallback(async (filters) => {
    setLoading(true);
    setError("");
    setCanRetry(false);
    try {
      const payload = await listTrayProducts({ ...filters, limit: PAGE_LIMIT });
      setItems(Array.isArray(payload?.items) ? payload.items : []);
      setPaging(payload?.paging || { page: filters.page, limit: PAGE_LIMIT, total: null });
    } catch (e) {
      setItems([]);
      setError(describeApiError(e, "Não foi possível carregar o catálogo da Tray."));
      setCanRetry(isRecoverableError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // Carrega uma única vez por combinação de filtros aplicados.
  React.useEffect(() => {
    load(applied);
  }, [applied, load]);

  // Marcas: uma única chamada por sessão da página.
  React.useEffect(() => {
    let alive = true;
    listTrayBrands()
      .then((payload) => {
        if (alive) setBrands(Array.isArray(payload?.items) ? payload.items : []);
      })
      .catch(() => {
        // Filtro de marca é opcional: sem ele a página continua utilizável.
        if (alive) setBrands([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  function applyFilters(nextPage = 1) {
    setPage(nextPage);
    setApplied({ q, qField, available, brand, page: nextPage });
  }

  function goToPage(nextPage) {
    setPage(nextPage);
    setApplied((current) => ({ ...current, page: nextPage }));
  }

  const selectedIds = Object.keys(selected).filter((id) => selected[id]);

  function toggle(id) {
    setSelected((current) => ({ ...current, [id]: !current[id] }));
  }

  function setPrice(id, value) {
    setPrices((current) => ({ ...current, [id]: value }));
    setPriceErrors((current) => ({ ...current, [id]: false }));
  }

  async function handlePublish() {
    if (selectedIds.length === 0) {
      onNotify("Selecione ao menos um produto.", "warning");
      return;
    }

    const errors = {};
    const payload = [];
    selectedIds.forEach((id) => {
      const parsed = parseNsCreditsInput(prices[id]);
      if (parsed === null) errors[id] = true;
      else payload.push({ tray_product_id: id, nscredits_price: parsed });
    });

    setPriceErrors(errors);
    if (Object.keys(errors).length > 0) {
      onNotify("Informe NSCréditos (inteiro maior que zero) para todos os selecionados.", "warning");
      return;
    }

    setPublishing(true);
    try {
      const out = await publishProducts(payload);
      onNotify(`${out?.published ?? payload.length} produto(s) publicado(s) na loja.`, "success");
      setSelected({});
      setPrices({});
      await load(applied);
      if (onPublished) onPublished();
    } catch (e) {
      onNotify(describeApiError(e, "Não foi possível publicar os produtos."), "error");
    } finally {
      setPublishing(false);
    }
  }

  async function openDetail(product) {
    setDetail({ ...product, variants: [] });
    setDetailLoading(true);
    try {
      const payload = await getTrayProduct(product.tray_product_id);
      if (payload?.item) setDetail(payload.item);
    } catch (e) {
      onNotify(describeApiError(e, "Não foi possível carregar o detalhe do produto."), "error");
    } finally {
      setDetailLoading(false);
    }
  }

  const totalPages =
    paging?.total != null && paging?.limit ? Math.max(1, Math.ceil(paging.total / paging.limit)) : null;

  const rows = items.map((product) => {
    const id = product.tray_product_id;
    const reward = product.reward;
    return {
      id,
      product,
      reward,
      checked: Boolean(selected[id]),
      price: prices[id] ?? (reward ? String(reward.nscredits_price) : ""),
      priceError: Boolean(priceErrors[id]),
    };
  });

  return (
    <>
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          applyFilters(1);
        }}
        sx={{ mb: 2 }}
      >
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "center" }}>
          <TextField
            size="small"
            fullWidth
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar produto por nome, referência, ID ou marca"
            sx={{ flex: 2, minWidth: 0 }}
          />
          <TextField
            size="small"
            select
            value={qField}
            onChange={(e) => setQField(e.target.value)}
            label="Buscar por"
            sx={{ minWidth: 150 }}
          >
            {SEARCH_FIELDS.map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            select
            value={available}
            onChange={(e) => setAvailable(e.target.value)}
            label="Disponibilidade"
            sx={{ minWidth: 180 }}
          >
            {AVAILABILITY_FILTERS.map(([value, label]) => (
              <MenuItem key={value || "todas"} value={value}>
                {label}
              </MenuItem>
            ))}
          </TextField>
          {brands.length > 0 && (
            <TextField
              size="small"
              select
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              label="Marca"
              sx={{ minWidth: 170 }}
            >
              <MenuItem value="">Todas</MenuItem>
              {brands.map((b) => (
                <MenuItem key={b} value={b}>
                  {b}
                </MenuItem>
              ))}
            </TextField>
          )}
          <Stack direction="row" spacing={1}>
            <Button type="submit" variant="contained" disabled={loading}>
              Buscar
            </Button>
            <Button
              variant="outlined"
              onClick={() => load(applied)}
              disabled={loading}
              startIcon={<RefreshRoundedIcon />}
            >
              Atualizar
            </Button>
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
      ) : rows.length === 0 && !error ? (
        <Alert severity="info" variant="outlined">
          Nenhum produto encontrado na Tray para esses filtros.
        </Alert>
      ) : isMobile ? (
        <Stack spacing={1.5}>
          {rows.map(({ id, product, reward, checked, price, priceError }) => (
            <Paper key={id} variant="outlined" sx={{ p: 1.5, ...adminPanelPaperSx }}>
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <Checkbox checked={checked} onChange={() => toggle(id)} sx={{ p: 0.5 }} />
                <Thumb src={product.image_url} alt={product.name} />
                <Stack spacing={0.75} sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 800, lineHeight: 1.25 }}>{product.name}</Typography>
                  <Typography variant="caption" sx={{ color: "rgba(245,247,245,0.6)" }}>
                    Tray #{id} · {product.reference || "sem referência"} · {product.brand || "sem marca"}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "rgba(245,247,245,0.6)" }}>
                    Preço Tray {formatBRL(product.tray_price)} · Estoque {product.stock ?? "—"}
                  </Typography>
                  <AvailabilityCell product={product} />
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    {product.has_variation && <Chip size="small" variant="outlined" label="Possui variações" />}
                    {reward ? (
                      <Chip
                        size="small"
                        label={reward.is_published ? "Publicado" : "Despublicado"}
                        sx={{ fontWeight: 800 }}
                        color={reward.is_published ? "success" : "default"}
                      />
                    ) : (
                      <Chip size="small" variant="outlined" label="Não publicado" />
                    )}
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <NsCreditsField
                      value={price}
                      onChange={(v) => setPrice(id, v)}
                      disabled={publishing}
                      error={priceError}
                    />
                    <Button size="small" onClick={() => openDetail(product)}>
                      Detalhe
                    </Button>
                  </Stack>
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ ...adminPanelPaperSx, overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 900 }}>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" />
                <TableCell>Foto</TableCell>
                <TableCell>Produto</TableCell>
                <TableCell>Ref. / Marca</TableCell>
                <TableCell align="right">Preço Tray</TableCell>
                <TableCell align="right">Estoque</TableCell>
                <TableCell>Disponibilidade</TableCell>
                <TableCell>Loja</TableCell>
                <TableCell>NSCréditos</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map(({ id, product, reward, checked, price, priceError }) => (
                <TableRow key={id} hover selected={checked}>
                  <TableCell padding="checkbox">
                    <Checkbox checked={checked} onChange={() => toggle(id)} />
                  </TableCell>
                  <TableCell>
                    <Thumb src={product.image_url} alt={product.name} size={48} />
                  </TableCell>
                  <TableCell sx={{ maxWidth: 280 }}>
                    <Stack spacing={0.25}>
                      <Typography sx={{ fontWeight: 800, lineHeight: 1.25 }}>{product.name}</Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="caption" sx={{ color: "rgba(245,247,245,0.55)" }}>
                          Tray #{id}
                        </Typography>
                        {product.has_variation && <Chip size="small" variant="outlined" label="Possui variações" />}
                        <Button size="small" sx={{ minWidth: 0 }} onClick={() => openDetail(product)}>
                          detalhe
                        </Button>
                      </Stack>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Stack spacing={0.25}>
                      <Typography variant="body2">{product.reference || "—"}</Typography>
                      <Typography variant="caption" sx={{ color: "rgba(245,247,245,0.55)" }}>
                        {product.brand || "—"}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Preço factual da Tray — referência administrativa, não é o custo em NSCréditos">
                      <Typography variant="body2">{formatBRL(product.tray_price)}</Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">{product.stock ?? "—"}</TableCell>
                  <TableCell>
                    <AvailabilityCell product={product} />
                  </TableCell>
                  <TableCell>
                    {reward ? (
                      <Chip
                        size="small"
                        label={reward.is_published ? "Publicado" : "Despublicado"}
                        color={reward.is_published ? "success" : "default"}
                        sx={{ fontWeight: 800 }}
                      />
                    ) : (
                      <Chip size="small" variant="outlined" label="Não publicado" />
                    )}
                  </TableCell>
                  <TableCell>
                    <NsCreditsField
                      value={price}
                      onChange={(v) => setPrice(id, v)}
                      disabled={publishing}
                      error={priceError}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        alignItems={{ sm: "center" }}
        justifyContent="space-between"
        sx={{ mt: 2 }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Button size="small" variant="outlined" disabled={loading || page <= 1} onClick={() => goToPage(page - 1)}>
            Anterior
          </Button>
          <Typography variant="body2" sx={{ color: "rgba(245,247,245,0.7)" }}>
            Página {page}
            {totalPages ? ` de ${totalPages}` : ""}
            {paging?.total != null ? ` · ${paging.total} produtos` : ""}
          </Typography>
          <Button
            size="small"
            variant="outlined"
            disabled={loading || (totalPages ? page >= totalPages : items.length < PAGE_LIMIT)}
            onClick={() => goToPage(page + 1)}
          >
            Próxima
          </Button>
        </Stack>

        <Button
          variant="contained"
          onClick={handlePublish}
          disabled={publishing || selectedIds.length === 0}
          startIcon={publishing ? <CircularProgress size={16} /> : null}
        >
          PUBLICAR SELECIONADOS{selectedIds.length ? ` (${selectedIds.length})` : ""}
        </Button>
      </Stack>

      <Dialog open={Boolean(detail)} onClose={() => setDetail(null)} maxWidth="sm" fullWidth>
        {detail && (
          <>
            <DialogTitle sx={{ pr: 6, fontWeight: 900 }}>
              {detail.name}
              <IconButton
                onClick={() => setDetail(null)}
                sx={{ position: "absolute", right: 8, top: 8 }}
                aria-label="Fechar"
              >
                <CloseRoundedIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent dividers>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={2}>
                  <Thumb src={detail.image_url} alt={detail.name} size={96} />
                  <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                    <Typography variant="body2">Tray #{detail.tray_product_id}</Typography>
                    <Typography variant="body2">Referência: {detail.reference || "—"}</Typography>
                    <Typography variant="body2">Marca: {detail.brand || "—"}</Typography>
                    <Typography variant="body2">Preço Tray: {formatBRL(detail.tray_price)}</Typography>
                    <Typography variant="body2">Estoque: {detail.stock ?? "—"}</Typography>
                    <Typography variant="body2">
                      Regra de estoque zerado: {detail.when_stock_runs_out || "—"}
                    </Typography>
                  </Stack>
                </Stack>

                {detail.has_variation && (
                  <>
                    <Divider />
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                      Variações {detailLoading ? "(carregando…)" : ""}
                    </Typography>
                    {detail.variants?.length ? (
                      <Stack spacing={0.75}>
                        {detail.variants.map((v) => (
                          <Stack
                            key={v.variant_id}
                            direction="row"
                            spacing={1}
                            justifyContent="space-between"
                            sx={{ p: 1, border: "1px solid rgba(255,255,255,0.10)", borderRadius: 1.5 }}
                          >
                            <Typography variant="body2">
                              {v.values?.length
                                ? v.values.map((x) => [x.type, x.value].filter(Boolean).join(": ")).join(" · ")
                                : v.reference || `#${v.variant_id}`}
                            </Typography>
                            <Typography variant="body2" sx={{ color: "rgba(245,247,245,0.7)" }}>
                              estoque {v.stock ?? "—"} · available {String(v.tray_available ?? "—")}
                            </Typography>
                          </Stack>
                        ))}
                      </Stack>
                    ) : (
                      !detailLoading && (
                        <Typography variant="body2" sx={{ color: "rgba(245,247,245,0.6)" }}>
                          A Tray não retornou variações para este produto.
                        </Typography>
                      )
                    )}
                  </>
                )}

                <Alert severity="info" variant="outlined">
                  Publicar na NewStore não altera estoque, preço nem disponibilidade na Tray.
                </Alert>
              </Stack>
            </DialogContent>
          </>
        )}
      </Dialog>
    </>
  );
}
