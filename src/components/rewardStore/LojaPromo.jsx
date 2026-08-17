// src/components/rewardStore/LojaPromo.jsx
//
// Propaganda da LOJA DE PRÊMIOS NS na landing dos sorteios.
//
// Fica nas BORDAS da página, fora da área útil do conteúdo — nunca no meio do
// fluxo entre a introdução e a cartela do sorteio.
//
// A landing usa <Container maxWidth="lg"> (1200px), então o espaço livre de cada
// lado é (viewport - 1200) / 2. A coluna ocupa 200px de largura + 24px de
// afastamento da borda = 224px. Para não encostar no conteúdo é preciso
// (viewport - 1200) / 2 >= 224, ou seja viewport >= 1648px — por isso o limiar
// de 1680px, que ainda deixa 16px de folga.
//
// Abaixo desse limiar as colunas somem e a chamada vira uma faixa horizontal
// compacta no rodapé do conteúdo, fora do fluxo do sorteio.

import * as React from "react";
import { Link as RouterLink } from "react-router-dom";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";

/** Largura mínima da viewport para caber uma coluna lateral sem cobrir o conteúdo. */
export const RAIL_MIN_WIDTH = 1680;
/** Largura da coluna e afastamento da borda — usados no cálculo do limiar acima. */
const RAIL_WIDTH = 200;
const RAIL_OFFSET = 24;
const RAIL_QUERY = `@media (min-width:${RAIL_MIN_WIDTH}px)`;
const BELOW_RAIL_QUERY = `@media (max-width:${RAIL_MIN_WIDTH - 1}px)`;

const GOLD_GREEN_TEXT = {
  background: "linear-gradient(90deg, #67C23A, #FFC107)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  WebkitTextFillColor: "transparent",
};

function RailCard({ side }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        width: RAIL_WIDTH,
        p: 2,
        borderRadius: 3,
        borderColor: "rgba(103,194,58,0.35)",
        bgcolor: "rgba(18,18,18,0.92)",
        backdropFilter: "blur(2px)",
        background:
          "linear-gradient(160deg, rgba(103,194,58,0.14), rgba(255,193,7,0.08)), rgba(18,18,18,0.92)",
        boxShadow: "0 12px 28px rgba(0,0,0,0.35)",
      }}
    >
      <Stack spacing={1.25} alignItems="flex-start">
        <StorefrontRoundedIcon sx={{ color: "#67C23A" }} />

        <Typography sx={{ fontWeight: 900, fontSize: 15, letterSpacing: 0.5, ...GOLD_GREEN_TEXT }}>
          LOJA DE PRÊMIOS NS
        </Typography>

        <Typography sx={{ fontWeight: 700, fontSize: 14, lineHeight: 1.35 }}>
          {side === "left" ? "Seus NSCréditos valem prêmios." : "Conheça a Loja de Prêmios."}
        </Typography>

        <Typography variant="body2" sx={{ opacity: 0.75, fontSize: 12.5, lineHeight: 1.4 }}>
          {side === "left"
            ? "Conheça os produtos disponíveis na New Store."
            : "Produtos selecionados para trocar por NSCréditos."}
        </Typography>

        <Button
          component={RouterLink}
          to="/loja"
          size="small"
          fullWidth
          variant="contained"
          sx={{
            mt: 0.5,
            bgcolor: "#67C23A",
            color: "#0E0E0E",
            fontWeight: 900,
            borderRadius: 999,
            "&:hover": { bgcolor: "#7CFF6B" },
          }}
        >
          CONHECER A LOJA
        </Button>
      </Stack>
    </Paper>
  );
}

/**
 * Colunas fixas nas bordas esquerda e direita.
 * Só renderizam em telas largas; não empurram nem sobrepõem o conteúdo central.
 */
export function LojaPromoRails() {
  const base = {
    display: "none",
    [RAIL_QUERY]: { display: "block" },
    position: "fixed",
    top: "50%",
    transform: "translateY(-50%)",
    zIndex: 2,
  };

  return (
    <>
      <Box aria-label="Loja de Prêmios NS" sx={{ ...base, left: RAIL_OFFSET }}>
        <RailCard side="left" />
      </Box>
      <Box aria-label="Loja de Prêmios NS" sx={{ ...base, right: RAIL_OFFSET }}>
        <RailCard side="right" />
      </Box>
    </>
  );
}

/**
 * Faixa horizontal compacta para quando não há espaço lateral
 * (tablet, mobile e desktops mais estreitos). Fica no rodapé do conteúdo,
 * depois do sorteio — nunca entre a introdução e a cartela.
 */
export function LojaPromoStrip() {
  return (
    <Paper
      variant="outlined"
      sx={{
        display: "block",
        [RAIL_QUERY]: { display: "none" },
        p: { xs: 2, md: 2.5 },
        borderRadius: 3,
        borderColor: "rgba(103,194,58,0.35)",
        background: "linear-gradient(90deg, rgba(103,194,58,0.10), rgba(255,193,7,0.08))",
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
          CONHECER A LOJA
        </Button>
      </Stack>
    </Paper>
  );
}

export { BELOW_RAIL_QUERY };
