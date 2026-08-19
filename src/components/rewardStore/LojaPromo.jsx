// src/components/rewardStore/LojaPromo.jsx
//
// Propaganda da LOJA DE PRÊMIOS NS na landing dos sorteios.
//
// Posição fixa no fluxo normal do conteúdo: sempre DEPOIS do sorteio
// principal e ANTES do bloco "SORTEIO ADICIONAL" — nunca nas bordas/laterais
// da página (isso existia antes como LojaPromoRails e foi removido: cobria
// espaço fora da área útil sem participar do layout normal, e sumia em
// telas estreitas).
//
// Um único componente para todos os tamanhos de tela: banner horizontal no
// desktop, empilha em coluna no mobile — nunca sobrepõe nem estreita a
// cartela do sorteio, porque participa do fluxo normal do documento.

import * as React from "react";
import { Link as RouterLink } from "react-router-dom";
import { Paper, Stack, Typography, Button } from "@mui/material";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";

const GOLD_GREEN_TEXT = {
  background: "linear-gradient(90deg, #67C23A, #FFC107)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  WebkitTextFillColor: "transparent",
};

/**
 * Banner central da Loja de Prêmios NS.
 * Fica entre o sorteio principal e o bloco de sorteio adicional (quando
 * existir); se não houver sorteio adicional, continua aparecendo logo
 * após o principal — não depende da existência do adicional.
 */
export default function LojaPromo() {
  return (
    <Paper
      variant="outlined"
      aria-label="Loja de Prêmios NS"
      sx={{
        p: { xs: 2, md: 2.5 },
        borderRadius: 3,
        borderColor: "rgba(103,194,58,0.35)",
        background: "linear-gradient(90deg, rgba(103,194,58,0.10), rgba(255,193,7,0.08))",
        width: "100%",
        maxWidth: "100%",
        overflowX: "hidden",
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={{ xs: 1.5, sm: 3 }}
        alignItems={{ xs: "flex-start", sm: "center" }}
        justifyContent="space-between"
      >
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
          <StorefrontRoundedIcon sx={{ color: "#67C23A", flexShrink: 0 }} />
          <Stack spacing={0.25} sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 900, fontSize: { xs: 16, md: 18 }, ...GOLD_GREEN_TEXT }}>
              LOJA DE PRÊMIOS NS
            </Typography>
            <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
              Seus NSCréditos valem prêmios.
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.75 }}>
              Conheça os produtos disponíveis na New Store.
            </Typography>
          </Stack>
        </Stack>

        <Button
          component={RouterLink}
          to="/loja"
          variant="contained"
          sx={{
            bgcolor: "#67C23A",
            color: "#0E0E0E",
            fontWeight: 900,
            borderRadius: 999,
            px: 3,
            whiteSpace: "nowrap",
            flexShrink: 0,
            alignSelf: { xs: "stretch", sm: "auto" },
            "&:hover": { bgcolor: "#7CFF6B" },
          }}
        >
          VER PRÊMIOS
        </Button>
      </Stack>
    </Paper>
  );
}
