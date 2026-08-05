import * as React from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Stack, Typography } from "@mui/material";
import { formatCheckoutMoney } from "../utils/checkoutSelection";

const formatNumbers = (numbers) => (numbers || []).map((number) => String(number).padStart(2, "0")).join(", ");

export default function BatchCheckoutReviewDialog({ open, items, busy, onBack, onConfirm }) {
  const total = (items || []).reduce((sum, item) => sum + Number(item.amountCents || 0), 0);
  const totalNumbers = (items || []).reduce((sum, item) => sum + (item.numbers || []).length, 0);
  return (
    <Dialog open={open} onClose={busy ? undefined : onBack} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 900 }}>Revisar suas participações</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {(items || []).map((item) => (
            <Stack key={item.drawId} spacing={0.5}>
              <Typography sx={{ fontWeight: 800 }}>{item.title}</Typography>
              <Typography>{formatNumbers(item.numbers)}</Typography>
              <Typography variant="body2" color="text.secondary">
                {item.numbers.length} {item.numbers.length === 1 ? "número" : "números"} — {formatCheckoutMoney(item.amountCents)}
              </Typography>
            </Stack>
          ))}
          <Divider />
          <Typography sx={{ fontWeight: 800 }}>
            {totalNumbers} {totalNumbers === 1 ? "participação" : "participações"}
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 900 }}>
            Total previsto: {formatCheckoutMoney(total)}
          </Typography>
          <Typography variant="body2" color="warning.main">
            A disponibilidade, os limites e os valores serão validados novamente antes da reserva.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onBack} disabled={busy}>VOLTAR</Button>
        <Button variant="contained" color="success" onClick={onConfirm} disabled={busy || !items?.length}>
          {busy ? "VALIDANDO..." : "GERAR PIX"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
