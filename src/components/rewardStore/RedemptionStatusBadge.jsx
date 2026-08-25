// src/components/rewardStore/RedemptionStatusBadge.jsx
//
// Badge de status do resgate. O rótulo e a severidade saem SEMPRE do mapa
// centralizado (services/redemptionsAdmin) alimentado pelo catálogo factual
// do backend — nunca de ternários espalhados pelo JSX.

import * as React from "react";
import { Chip, Tooltip } from "@mui/material";

import { describeRedemptionStatus, statusChipSx } from "../../services/redemptionsAdmin";

export default function RedemptionStatusBadge({ status, statusInfo, catalog = [], size = "small" }) {
  const info = statusInfo || describeRedemptionStatus(status, catalog);
  const chip = <Chip size={size} label={info.label} sx={statusChipSx(info.severity)} />;

  if (!info.description) return chip;
  return (
    <Tooltip title={info.description} arrow>
      <span>{chip}</span>
    </Tooltip>
  );
}
