// src/components/rewardStore/shared.jsx
//
// Peças reutilizadas pelas abas do módulo LOJA DE PRÊMIOS NS dentro do /admin.
// Extraídas do protótipo /loja/admin para evitar duplicação.

import * as React from "react";
import { Box, Chip, Stack, TextField, Typography } from "@mui/material";
import ImageNotSupportedRoundedIcon from "@mui/icons-material/ImageNotSupportedRounded";
import { newStoreAdminColors } from "../../adminTheme";

export function formatNsCredits(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString("pt-BR") : "—";
}

export function formatBRL(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR");
}

/** Miniatura do produto. Placeholder local só quando a Tray não tem imagem. */
export function Thumb({ src, alt, size = 56 }) {
  const [failed, setFailed] = React.useState(false);
  const boxSx = {
    width: size,
    height: size,
    flex: `0 0 ${size}px`,
    borderRadius: 1.5,
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    bgcolor: "rgba(255,255,255,0.05)",
    color: "rgba(255,255,255,0.28)",
  };

  if (!src || failed) {
    return (
      <Box sx={boxSx} data-testid="thumb-placeholder">
        <ImageNotSupportedRoundedIcon fontSize="small" />
      </Box>
    );
  }
  return (
    <Box sx={{ ...boxSx, bgcolor: "#fff" }}>
      <Box
        component="img"
        src={src}
        alt={alt || ""}
        loading="lazy"
        onError={() => setFailed(true)}
        sx={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    </Box>
  );
}

/** Mostra a disponibilidade derivada E os campos factuais que a originaram. */
export function AvailabilityCell({ product }) {
  return (
    <Stack spacing={0.5} alignItems="flex-start">
      <Chip
        size="small"
        label={product.is_available ? "Disponível" : "Indisponível"}
        sx={{
          fontWeight: 800,
          ...(product.is_available
            ? { bgcolor: newStoreAdminColors.greenStrong, color: "#061006" }
            : { bgcolor: "rgba(255,255,255,0.12)", color: "rgba(245,247,245,0.78)" }),
        }}
      />
      <Typography variant="caption" sx={{ color: "rgba(245,247,245,0.55)" }}>
        available {String(product.tray_available ?? "—")} · vitrine{" "}
        {String(product.tray_available_in_store ?? "—")}
      </Typography>
      {product.availability_text && (
        <Typography variant="caption" sx={{ color: "rgba(245,247,245,0.45)" }}>
          {product.availability_text}
        </Typography>
      )}
    </Stack>
  );
}

/** Campo de NSCréditos: aceita apenas dígitos. */
export function NsCreditsField({ value, onChange, disabled, error, label = "NSCréditos" }) {
  return (
    <TextField
      size="small"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
      placeholder={label}
      disabled={disabled}
      error={Boolean(error)}
      inputProps={{ inputMode: "numeric", "aria-label": label }}
      sx={{ width: 130 }}
    />
  );
}
