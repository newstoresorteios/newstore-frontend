// src/LojaPage.jsx
//
// Loja de Prêmios — catálogo público (/loja).
//
// Lê exclusivamente o catálogo curado do backend NewStore (PostgreSQL).
// Nunca consulta a Tray: a página continua funcionando mesmo com a Tray fora do ar.
//
// Neste protótipo NÃO existe resgate: nada de debitar saldo, criar pedido
// ou reservar estoque.

import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Container,
  Divider,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import ImageNotSupportedRoundedIcon from "@mui/icons-material/ImageNotSupportedRounded";
import VerifiedUserRoundedIcon from "@mui/icons-material/VerifiedUserRounded";
import LocalShippingRoundedIcon from "@mui/icons-material/LocalShippingRounded";
import RedeemRoundedIcon from "@mui/icons-material/RedeemRounded";

import { listPublicProducts, describeApiError } from "./services/rewardStore";
import StoreProfileHeader from "./components/rewardStore/StoreProfileHeader";
import LojaShell, { useStoreWallet } from "./components/rewardStore/LojaShell";
import { useAuth } from "./authContext";


export function formatNsCredits(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const hasFraction = Math.abs(n % 1) > 1e-9;
  return n.toLocaleString("pt-BR", { minimumFractionDigits: hasFraction ? 2 : 0, maximumFractionDigits: 2 });
}

/** Placeholder local: usado apenas quando a Tray realmente não tem imagem. */
function ImagePlaceholder() {
  return (
    <Box
      sx={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "rgba(255,255,255,0.04)",
        color: "rgba(255,255,255,0.25)",
      }}
    >
      <ImageNotSupportedRoundedIcon sx={{ fontSize: 48 }} />
    </Box>
  );
}

/** Imagem em proporção fixa, para os cards ficarem alinhados independente do produto. */
function ProductImage({ src, alt, ratio = "78%" }) {
  const [failed, setFailed] = React.useState(false);
  return (
    <Box sx={{ position: "relative", width: "100%", pt: ratio, bgcolor: "#fff", overflow: "hidden" }}>
      {!src || failed ? (
        <ImagePlaceholder />
      ) : (
        <Box
          component="img"
          src={src}
          alt={alt || ""}
          loading="lazy"
          onError={() => setFailed(true)}
          sx={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            p: 2,
            transition: "transform 220ms ease",
          }}
        />
      )}
    </Box>
  );
}

export function AvailabilityChip({ isAvailable }) {
  return isAvailable ? (
    <Chip
      size="small"
      label="DISPONÍVEL"
      sx={{ bgcolor: "primary.main", color: "#0E0E0E", fontWeight: 800, letterSpacing: 0.4 }}
    />
  ) : (
    <Chip
      size="small"
      label="INDISPONÍVEL"
      sx={{
        bgcolor: "rgba(255,255,255,0.12)",
        color: "rgba(255,255,255,0.78)",
        fontWeight: 800,
        letterSpacing: 0.4,
      }}
    />
  );
}

function ProductCard({ product, onOpen }) {
  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderRadius: 3,
        borderColor: "rgba(255,255,255,0.10)",
        bgcolor: "background.paper",
        overflow: "hidden",
        opacity: product.is_available ? 1 : 0.75,
        transition: "transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
        "&:hover": {
          transform: "translateY(-4px)",
          borderColor: "rgba(103,194,58,0.55)",
          boxShadow: "0 18px 38px rgba(0,0,0,0.45)",
        },
        "&:hover img": { transform: "scale(1.04)" },
      }}
    >
      <CardActionArea onClick={() => onOpen(product)} sx={{ flex: 1, display: "block" }}>
        <Box sx={{ position: "relative" }}>
          <ProductImage src={product.image_url} alt={product.name} />
          <Box sx={{ position: "absolute", top: 12, left: 12 }}>
            <AvailabilityChip isAvailable={product.is_available} />
          </Box>
          {product.has_variation && (
            <Chip
              size="small"
              label="Variações"
              sx={{
                position: "absolute",
                top: 12,
                right: 12,
                fontWeight: 700,
                bgcolor: "rgba(0,0,0,0.65)",
                color: "#fff",
              }}
            />
          )}
        </Box>

        <CardContent sx={{ pb: 1.5 }}>
          <Stack spacing={1}>
            {(product.brand || product.reference) && (
              <Typography
                variant="caption"
                sx={{ color: "rgba(255,255,255,0.5)", letterSpacing: 1, fontWeight: 700 }}
              >
                {[product.brand, product.reference].filter(Boolean).join(" · ").toUpperCase()}
              </Typography>
            )}

            <Typography
              sx={{
                fontWeight: 900,
                fontSize: 17,
                lineHeight: 1.3,
                minHeight: 44,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {product.name || `Produto ${product.tray_product_id}`}
            </Typography>

            {product.description_small && (
              <Typography
                variant="body2"
                sx={{
                  color: "rgba(255,255,255,0.6)",
                  minHeight: 40,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {product.description_small}
              </Typography>
            )}

            <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />

            <Stack spacing={0.25}>
              <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)", fontWeight: 700 }}>
                VALOR EM NSCRÉDITOS
              </Typography>
              <Typography sx={{ fontWeight: 900, fontSize: 26, color: "secondary.main", lineHeight: 1.15 }}>
                {formatNsCredits(product.nscredits_price)}
              </Typography>
            </Stack>
          </Stack>
        </CardContent>
      </CardActionArea>

      <Box sx={{ px: 2, pb: 2 }}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => onOpen(product)}
          sx={{
            bgcolor: "primary.main",
            color: "#0E0E0E",
            fontWeight: 900,
            borderRadius: 999,
            py: 1.1,
            letterSpacing: 0.5,
            "&:hover": { bgcolor: "#7CFF6B" },
          }}
        >
          VISUALIZAR
        </Button>
      </Box>
    </Card>
  );
}

function ProductSkeleton() {
  return (
    <Card variant="outlined" sx={{ borderRadius: 3, borderColor: "rgba(255,255,255,0.08)" }}>
      <Skeleton variant="rectangular" sx={{ pt: "78%" }} />
      <CardContent>
        <Stack spacing={1}>
          <Skeleton width="40%" height={14} />
          <Skeleton width="90%" height={22} />
          <Skeleton width="70%" height={18} />
          <Skeleton width="50%" height={32} />
        </Stack>
      </CardContent>
    </Card>
  );
}

const BENEFITS = [
  {
    icon: VerifiedUserRoundedIcon,
    title: "100% Seguro",
    text: "Prêmios selecionados e enviados pela New Store Relógios.",
  },
  {
    icon: LocalShippingRoundedIcon,
    title: "Entrega Garantida",
    text: "Acompanhamento do envio até a entrega do seu prêmio.",
  },
  {
    icon: RedeemRoundedIcon,
    title: "NSCréditos",
    text: "Seus NSCréditos valem prêmios reais da nossa vitrine.",
  },
];

function BenefitsSection() {
  return (
    <Box
      sx={{
        display: "grid",
        gap: { xs: 2, md: 3 },
        gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" },
      }}
    >
      {BENEFITS.map(({ icon: Icon, title, text }) => (
        <Paper
          key={title}
          variant="outlined"
          sx={{
            p: { xs: 2, md: 3 },
            borderRadius: 3,
            borderColor: "rgba(255,255,255,0.08)",
            textAlign: "center",
          }}
        >
          <Stack spacing={1} alignItems="center">
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "rgba(103,194,58,0.12)",
                color: "primary.main",
              }}
            >
              <Icon />
            </Box>
            <Typography sx={{ fontWeight: 900, fontSize: 17 }}>{title}</Typography>
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.6)" }}>
              {text}
            </Typography>
          </Stack>
        </Paper>
      ))}
    </Box>
  );
}

function LojaConteudo() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState("");
  const [paging, setPaging] = React.useState(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await listPublicProducts();
      setItems(Array.isArray(payload?.items) ? payload.items : []);
      setPaging(payload?.paging || null);
    } catch (e) {
      setItems([]);
      setPaging(null);
      setError(describeApiError(e, "Não foi possível carregar a loja agora."));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = React.useCallback(async () => {
    if (!paging || paging.page >= paging.pages) return;
    setLoadingMore(true);
    try {
      const payload = await listPublicProducts({ page: paging.page + 1, limit: paging.limit });
      setItems((current) => [...current, ...(Array.isArray(payload?.items) ? payload.items : [])]);
      setPaging(payload?.paging || null);
    } catch (e) {
      setError(describeApiError(e, "Não foi possível carregar mais prêmios agora."));
    } finally {
      setLoadingMore(false);
    }
  }, [paging]);

  React.useEffect(() => {
    load();
  }, [load]);

  const hasMore = Boolean(paging && paging.page < paging.pages);

  // A carteira e o carrinho vivem no LojaShell.
  const wallet = useStoreWallet();

  return (
        <Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 } }}>
          <Stack spacing={{ xs: 3, md: 4 }}>
            <StoreProfileHeader
              user={user}
              loading={authLoading}
              wallet={wallet}
            />

            <Stack spacing={1}>
              <Typography
                sx={{
                  fontWeight: 900,
                  fontSize: { xs: 30, md: 44 },
                  lineHeight: 1.1,
                  background: "linear-gradient(90deg, #67C23A, #FFC107)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Loja de Prêmios
              </Typography>
              <Typography sx={{ color: "rgba(255,255,255,0.68)", fontSize: { xs: 15, md: 17 }, maxWidth: 640 }}>
                Prêmios selecionados pela New Store para você trocar por NSCréditos.
              </Typography>
            </Stack>

            {error && (
              <Alert
                severity="error"
                action={
                  <Button color="inherit" size="small" onClick={load}>
                    Tentar de novo
                  </Button>
                }
              >
                {error}
              </Alert>
            )}

            {loading ? (
              <Box
                sx={{
                  display: "grid",
                  gap: { xs: 2, md: 3 },
                  gridTemplateColumns: {
                    xs: "1fr",
                    sm: "repeat(2, minmax(0, 1fr))",
                    md: "repeat(3, minmax(0, 1fr))",
                  },
                }}
              >
                {[0, 1, 2].map((k) => (
                  <ProductSkeleton key={k} />
                ))}
              </Box>
            ) : items.length === 0 && !error ? (
              <Paper
                variant="outlined"
                sx={{ p: { xs: 4, md: 6 }, borderRadius: 3, textAlign: "center", borderColor: "rgba(255,255,255,0.08)" }}
              >
                <Stack spacing={1} alignItems="center">
                  <RedeemRoundedIcon sx={{ fontSize: 48, color: "rgba(255,255,255,0.25)" }} />
                  <Typography sx={{ fontWeight: 900, fontSize: 20 }}>
                    Nenhum prêmio disponível no momento.
                  </Typography>
                  <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.6)" }}>
                    Novos produtos aparecem aqui assim que forem publicados.
                  </Typography>
                </Stack>
              </Paper>
            ) : (
              <Box
                sx={{
                  display: "grid",
                  gap: { xs: 2, md: 3 },
                  gridTemplateColumns: {
                    xs: "1fr",
                    sm: "repeat(2, minmax(0, 1fr))",
                    md: "repeat(3, minmax(0, 1fr))",
                  },
                }}
              >
                {items.map((product) => (
                  <ProductCard
                    key={product.tray_product_id}
                    product={product}
                    onOpen={(p) => navigate(`/loja/produto/${p.tray_product_id}`)}
                  />
                ))}
              </Box>
            )}

            {hasMore && (
              <Stack alignItems="center">
                <Button
                  variant="outlined"
                  onClick={loadMore}
                  disabled={loadingMore}
                  sx={{ borderRadius: 999, px: 4, fontWeight: 800 }}
                >
                  {loadingMore ? "CARREGANDO…" : "CARREGAR MAIS"}
                </Button>
              </Stack>
            )}

            <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />

            <BenefitsSection />
          </Stack>
        </Container>

  );
}

export default function LojaPage() {
  return (
    <LojaShell>
      <LojaConteudo />
    </LojaShell>
  );
}
