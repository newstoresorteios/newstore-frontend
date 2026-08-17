// src/LojaProdutoPage.jsx
//
// Detalhe do produto da Loja de Prêmios — /loja/produto/:trayProductId
//
// As variações vêm do snapshot local (rápido para renderizar). Antes de
// adicionar ao carrinho o BACKEND revalida tudo na Tray — o snapshot nunca
// é suficiente para uma ação.
//
// Adicionar ao carrinho NÃO reserva estoque e NÃO debita NSCréditos.

import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  IconButton,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";
import ImageNotSupportedRoundedIcon from "@mui/icons-material/ImageNotSupportedRounded";

import { formatNsCredits } from "./services/nscredits";
import {
  getPublicProduct,
  isVariantSelectable,
  variantLabel,
  describeCartError,
  isAuthError,
} from "./services/rewardCart";
import { useCart } from "./components/rewardStore/CartContext";
import LojaShell from "./components/rewardStore/LojaShell";
import { useAuth } from "./authContext";

function Gallery({ images, alt }) {
  const list = Array.isArray(images) && images.length ? images : [null];
  const [index, setIndex] = React.useState(0);
  const [failed, setFailed] = React.useState({});
  const current = list[Math.min(index, list.length - 1)];

  return (
    <Stack spacing={1.5}>
      <Box
        sx={{
          position: "relative",
          width: "100%",
          pt: "78%",
          bgcolor: current && !failed[index] ? "#fff" : "rgba(255,255,255,0.04)",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        {current && !failed[index] ? (
          <Box
            component="img"
            src={current}
            alt={alt || ""}
            onError={() => setFailed((f) => ({ ...f, [index]: true }))}
            sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", p: 2 }}
          />
        ) : (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "rgba(255,255,255,0.25)",
            }}
          >
            <ImageNotSupportedRoundedIcon sx={{ fontSize: 56 }} />
          </Box>
        )}
      </Box>

      {list.length > 1 && (
        <Stack direction="row" spacing={1} sx={{ overflowX: "auto", pb: 0.5 }}>
          {list.map((src, i) => (
            <Box
              key={src || i}
              onClick={() => setIndex(i)}
              role="button"
              aria-label={`Imagem ${i + 1}`}
              sx={{
                width: 64,
                height: 64,
                flex: "0 0 64px",
                borderRadius: 1.5,
                overflow: "hidden",
                cursor: "pointer",
                bgcolor: "#fff",
                border: i === index ? "2px solid" : "1px solid rgba(255,255,255,0.12)",
                borderColor: i === index ? "primary.main" : "rgba(255,255,255,0.12)",
              }}
            >
              {src && (
                <Box component="img" src={src} alt="" sx={{ width: "100%", height: "100%", objectFit: "contain" }} />
              )}
            </Box>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function ProdutoConteudo() {
  const { trayProductId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { addItem, busy } = useCart();

  const [product, setProduct] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [variantId, setVariantId] = React.useState(null);
  const [quantity, setQuantity] = React.useState(1);
  const [feedback, setFeedback] = React.useState(null);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    getPublicProduct(trayProductId)
      .then((payload) => {
        if (alive) setProduct(payload?.item || null);
      })
      .catch((e) => {
        if (alive) setError(describeCartError(e, "Produto não encontrado na Loja de Prêmios."));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [trayProductId]);

  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const hasVariation = product?.has_variation === true;
  // Nunca selecionamos a primeira opção silenciosamente.
  const needsVariant = hasVariation && !variantId;
  const canAdd = Boolean(product?.is_available) && !needsVariant && !busy;

  async function handleAdd() {
    setFeedback(null);

    if (!user) {
      // Usa o fluxo de autenticação existente, guardando o retorno.
      navigate("/login", { state: { from: { pathname: `/loja/produto/${trayProductId}` } } });
      return;
    }

    try {
      await addItem({
        rewardProductId: product.reward_product_id,
        trayVariantId: variantId,
        quantity,
      });
      setFeedback({ severity: "success", message: "Produto adicionado ao carrinho." });
    } catch (e) {
      if (isAuthError(e)) {
        navigate("/login", { state: { from: { pathname: `/loja/produto/${trayProductId}` } } });
        return;
      }
      setFeedback({ severity: "error", message: describeCartError(e, "Não foi possível adicionar ao carrinho.") });
    }
  }

  if (loading || authLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Stack alignItems="center">
          <CircularProgress />
        </Stack>
      </Container>
    );
  }

  if (error || !product) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Button startIcon={<ArrowBackIosNewRoundedIcon />} onClick={() => navigate("/loja")} sx={{ mb: 2 }}>
          Voltar para a loja
        </Button>
        <Alert severity="error">{error || "Produto não encontrado."}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 4 } }}>
      <Button startIcon={<ArrowBackIosNewRoundedIcon />} onClick={() => navigate("/loja")} sx={{ mb: 2 }}>
        Voltar para a loja
      </Button>

      <Stack direction={{ xs: "column", md: "row" }} spacing={{ xs: 3, md: 5 }} alignItems="flex-start">
        <Box sx={{ width: { xs: "100%", md: "48%" }, flexShrink: 0 }}>
          <Gallery images={product.images?.length ? product.images : [product.image_url]} alt={product.name} />
        </Box>

        <Stack spacing={2} sx={{ flex: 1, minWidth: 0, width: "100%" }}>
          <Stack spacing={0.5}>
            {(product.brand || product.reference) && (
              <Typography variant="caption" sx={{ opacity: 0.55, letterSpacing: 1, fontWeight: 700 }}>
                {[product.brand, product.reference].filter(Boolean).join(" · ").toUpperCase()}
              </Typography>
            )}
            <Typography sx={{ fontWeight: 900, fontSize: { xs: 24, md: 32 }, lineHeight: 1.2 }}>
              {product.name}
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Chip
              size="small"
              label={product.is_available ? "DISPONÍVEL" : "INDISPONÍVEL"}
              sx={
                product.is_available
                  ? { bgcolor: "primary.main", color: "#0E0E0E", fontWeight: 800 }
                  : { bgcolor: "rgba(255,255,255,0.12)", fontWeight: 800 }
              }
            />
            {product.availability_text && (
              <Typography variant="body2" sx={{ opacity: 0.65 }}>
                {product.availability_text}
              </Typography>
            )}
          </Stack>

          <Stack spacing={0.25}>
            <Typography variant="caption" sx={{ opacity: 0.55, fontWeight: 700 }}>
              VALOR EM NSCRÉDITOS
            </Typography>
            <Typography sx={{ fontWeight: 900, fontSize: { xs: 30, md: 38 }, color: "secondary.main" }}>
              {formatNsCredits(product.nscredits_price)}
            </Typography>
          </Stack>

          {product.description_small && (
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              {product.description_small}
            </Typography>
          )}

          <Divider />

          {hasVariation && (
            <Stack spacing={1}>
              <Typography sx={{ fontWeight: 800 }}>Escolha uma opção</Typography>

              {variants.length === 0 ? (
                <Alert severity="warning" variant="outlined">
                  As opções deste produto não estão disponíveis no momento.
                </Alert>
              ) : (
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {variants.map((v) => {
                    const selectable = isVariantSelectable(v);
                    const selected = variantId === String(v.variant_id);
                    return (
                      <Paper
                        key={v.variant_id}
                        variant="outlined"
                        role="button"
                        aria-label={variantLabel(v)}
                        aria-disabled={!selectable}
                        onClick={() => selectable && setVariantId(String(v.variant_id))}
                        sx={{
                          px: 2,
                          py: 1,
                          borderRadius: 2,
                          cursor: selectable ? "pointer" : "not-allowed",
                          opacity: selectable ? 1 : 0.45,
                          borderColor: selected ? "primary.main" : "rgba(255,255,255,0.14)",
                          borderWidth: selected ? 2 : 1,
                        }}
                      >
                        <Typography sx={{ fontWeight: 800, fontSize: 14 }}>{variantLabel(v)}</Typography>
                        <Typography variant="caption" sx={{ opacity: 0.7 }}>
                          {selectable ? "Disponível" : "Indisponível"}
                        </Typography>
                      </Paper>
                    );
                  })}
                </Stack>
              )}

              {needsVariant && (
                <Typography variant="caption" sx={{ color: "warning.main" }}>
                  Escolha uma opção antes de adicionar ao carrinho.
                </Typography>
              )}
            </Stack>
          )}

          <Stack spacing={1}>
            <Typography sx={{ fontWeight: 800 }}>Quantidade</Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <IconButton
                aria-label="Diminuir quantidade"
                disabled={quantity <= 1}
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              >
                <RemoveRoundedIcon />
              </IconButton>
              <Typography sx={{ fontWeight: 900, fontSize: 20, minWidth: 32, textAlign: "center" }}>
                {quantity}
              </Typography>
              <IconButton aria-label="Aumentar quantidade" onClick={() => setQuantity((q) => q + 1)}>
                <AddRoundedIcon />
              </IconButton>
            </Stack>
          </Stack>

          {feedback && <Alert severity={feedback.severity}>{feedback.message}</Alert>}

          <Button
            variant="contained"
            size="large"
            disabled={!canAdd}
            startIcon={busy ? <CircularProgress size={18} /> : null}
            onClick={handleAdd}
            sx={{ bgcolor: "primary.main", color: "#0E0E0E", fontWeight: 900, borderRadius: 999, py: 1.3 }}
          >
            {product.is_available ? "ADICIONAR AO CARRINHO" : "INDISPONÍVEL"}
          </Button>

          <Typography variant="caption" sx={{ opacity: 0.5 }}>
            Adicionar ao carrinho não reserva o produto. A disponibilidade é confirmada no resgate.
          </Typography>
        </Stack>
      </Stack>
    </Container>
  );
}

export default function LojaProdutoPage() {
  return (
    <LojaShell>
      <ProdutoConteudo />
    </LojaShell>
  );
}
