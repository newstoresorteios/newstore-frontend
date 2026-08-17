import * as React from "react";
import { Box, Button, Chip, Divider, IconButton, Paper, Stack, Typography, useMediaQuery } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ExpandLessRoundedIcon from "@mui/icons-material/ExpandLessRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import { formatCheckoutMoney, getSelectedDrawGroups } from "../utils/checkoutSelection";

export default function FloatingParticipationSummary({
  items = [], pendingBatch, expanded, disabled, onToggle, onContinue, onReview,
  onRemoveNumber, onClearDraw, onOpenPix,
}) {
  const isDesktop = useMediaQuery("(min-width:900px)", { noSsr: true });
  const effectiveExpanded = isDesktop || expanded;
  const effectiveItems = pendingBatch?.items || items;
  const selectedDrawGroupCount = getSelectedDrawGroups(items).length;
  const totalNumbers = pendingBatch?.total_numbers ?? effectiveItems.reduce((sum, item) => sum + item.numbers.length, 0);
  const totalCents = pendingBatch?.amount_cents ?? effectiveItems.reduce((sum, item) => sum + Number(item.amountCents || item.amount_cents || 0), 0);
  const pending = Boolean(pendingBatch?.batch_id);
  if (!totalNumbers || (!pending && selectedDrawGroupCount < 2)) return null;

  return (
    <Paper
      elevation={18}
      aria-label="Suas participações"
      sx={{
        position: "fixed", zIndex: 1250,
        right: { xs: 8, md: 24 }, left: { xs: 8, md: "auto" },
        bottom: { xs: "calc(8px + env(safe-area-inset-bottom))", md: 24 },
        width: { xs: "auto", md: 370 }, maxHeight: { xs: "72vh", md: "75vh" },
        overflowY: effectiveExpanded ? "auto" : "hidden", border: "1px solid rgba(103,194,58,.5)",
        bgcolor: "rgba(18,18,18,.98)", backdropFilter: "blur(12px)",
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.25 }}>
        <Box>
          <Typography sx={{ fontWeight: 900 }}>{effectiveExpanded ? "Suas participações" : `${totalNumbers} números • ${formatCheckoutMoney(totalCents)}`}</Typography>
          {pending && !effectiveExpanded && <Typography variant="caption">PIX aguardando pagamento</Typography>}
        </Box>
        {!isDesktop && (
          <IconButton size="small" onClick={onToggle} aria-label={expanded ? "Recolher" : "Expandir"}>
            {expanded ? <ExpandMoreRoundedIcon /> : <ExpandLessRoundedIcon />}
          </IconButton>
        )}
      </Stack>
      {effectiveExpanded && (
        <Stack spacing={1.5} sx={{ px: 2, pb: 2 }}>
          {pending && (
            <Box>
              <Typography color="warning.main" sx={{ fontWeight: 800 }}>
                PIX aguardando pagamento
              </Typography>
              <Typography variant="body2">
                {totalNumbers} {totalNumbers === 1 ? "participação" : "participações"} em {effectiveItems.length} {effectiveItems.length === 1 ? "sorteio" : "sorteios"}
              </Typography>
              <Typography sx={{ fontWeight: 900 }}>{formatCheckoutMoney(totalCents)}</Typography>
            </Box>
          )}
          {effectiveItems.map((item) => {
            const drawId = item.drawId ?? item.draw_id;
            const drawType = item.drawType || item.draw_type;
            const title = item.title || (drawType === "principal"
              ? "Sorteio principal"
              : drawType === "secundario" ? `Secundário ${drawId}` : `Adicional ${drawId}`);
            const amount = item.amountCents ?? item.amount_cents;
            return (
              <Stack key={drawId} spacing={0.75}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography sx={{ fontWeight: 800 }}>{title}</Typography>
                  {!pending && <Button size="small" color="inherit" onClick={() => onClearDraw(drawId)} disabled={disabled}>Limpar</Button>}
                </Stack>
                <Stack direction="row" flexWrap="wrap" useFlexGap gap={0.75}>
                  {(item.numbers || []).map((number) => (
                    <Chip
                      key={number}
                      size="small"
                      label={String(number).padStart(2, "0")}
                      onDelete={!pending ? () => onRemoveNumber(drawId, number) : undefined}
                      deleteIcon={<CloseRoundedIcon />}
                    />
                  ))}
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {item.numbers.length} {item.numbers.length === 1 ? "número" : "números"} — {formatCheckoutMoney(amount)}
                </Typography>
              </Stack>
            );
          })}
          <Divider />
          <Stack direction="row" justifyContent="space-between">
            <Typography sx={{ fontWeight: 800 }}>
              {totalNumbers} {totalNumbers === 1 ? "participação" : "participações"}
            </Typography>
            <Typography sx={{ fontWeight: 900 }}>
              {pending ? "Total" : "Total previsto"}: {formatCheckoutMoney(totalCents)}
            </Typography>
          </Stack>
          {pending ? (
            <Button variant="contained" color="success" onClick={onOpenPix} disabled={disabled}>ABRIR PIX</Button>
          ) : (
            <>
              <Button variant="outlined" color="inherit" onClick={onContinue}>CONTINUAR ESCOLHENDO</Button>
              <Button variant="contained" color="success" onClick={onReview} disabled={disabled}>REVISAR E PAGAR JUNTOS</Button>
            </>
          )}
        </Stack>
      )}
    </Paper>
  );
}
