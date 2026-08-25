// src/components/rewardStore/RedemptionTimeline.jsx
//
// HISTÓRICO DO RESGATE — reward_redemption_events em ordem cronológica.
//
// O `meta` exibido aqui já chega filtrado por whitelist do backend (nunca
// token, senha, cookie, CPF ou URL de banco). Este componente só apresenta
// o que recebeu — não interpreta nem completa nada.

import * as React from "react";
import { Box, Chip, Stack, Typography } from "@mui/material";

import { newStoreAdminColors } from "../../adminTheme";
import { describeRedemptionStatus } from "../../services/redemptionsAdmin";
import { formatDateTime } from "./shared";

function Dot({ last }) {
  return (
    <Stack alignItems="center" sx={{ flexShrink: 0, width: 20 }}>
      <Box
        sx={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          bgcolor: newStoreAdminColors.green,
          mt: 0.75,
        }}
      />
      {!last && <Box sx={{ width: 2, flex: 1, minHeight: 24, bgcolor: "rgba(255,255,255,0.12)" }} />}
    </Stack>
  );
}

export default function RedemptionTimeline({ events = [], catalog = [] }) {
  if (!events.length) {
    return (
      <Typography variant="body2" sx={{ opacity: 0.6 }}>
        Nenhum evento registrado para este resgate.
      </Typography>
    );
  }

  return (
    <Stack spacing={0} data-testid="redemption-timeline">
      {events.map((event, index) => {
        const info = describeRedemptionStatus(event.to_status, catalog);
        return (
          <Stack key={event.id} direction="row" spacing={1.5} alignItems="stretch">
            <Dot last={index === events.length - 1} />
            <Stack spacing={0.4} sx={{ pb: index === events.length - 1 ? 0 : 2, minWidth: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography sx={{ fontWeight: 800 }}>{info.label}</Typography>
                <Typography variant="caption" sx={{ opacity: 0.55 }}>
                  {formatDateTime(event.created_at)}
                </Typography>
              </Stack>

              {event.reason && (
                <Chip size="small" variant="outlined" label={event.reason} sx={{ alignSelf: "flex-start", fontWeight: 700 }} />
              )}

              {event.meta?.http_status != null && (
                <Typography variant="caption" sx={{ opacity: 0.6 }}>
                  HTTP {event.meta.http_status}
                  {event.meta.tray_error_code ? ` · ${event.meta.tray_error_code}` : ""}
                </Typography>
              )}

              {Array.isArray(event.meta?.tray_messages) &&
                event.meta.tray_messages.map((message, i) => (
                  <Typography key={i} variant="caption" sx={{ opacity: 0.75, wordBreak: "break-word" }}>
                    {message}
                  </Typography>
                ))}
            </Stack>
          </Stack>
        );
      })}
    </Stack>
  );
}
