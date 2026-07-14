import * as React from "react";
import { Chip, Tooltip } from "@mui/material";

const STATUS_LABELS = {
  online: "Online",
  configured: "Configurado",
  disabled: "Desativado",
  empty: "Sem destinatários",
  attention: "Com atenção",
  error: "Erro",
  unavailable: "Não foi possível verificar",
  sent: "Enviado",
  accepted: "Aceito pelo provedor",
  delivered: "Entregue",
  read: "Lido",
  failed: "Falhou",
  skipped: "Ignorado",
  pending: "Pendente",
  active: "Ativo",
  inactive: "Inativo",
};

const STATUS_COLORS = {
  online: "success",
  configured: "success",
  disabled: "default",
  empty: "warning",
  attention: "warning",
  error: "error",
  unavailable: "default",
  sent: "success",
  accepted: "info",
  delivered: "success",
  read: "info",
  failed: "error",
  skipped: "warning",
  pending: "info",
  active: "success",
  inactive: "default",
};

export function normalizeNotificationStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  if (["accepted", "provider_accepted"].includes(status)) return "accepted";
  if (["sent", "success", "ok"].includes(status)) return "sent";
  if (["delivered"].includes(status)) return "delivered";
  if (["read", "opened"].includes(status)) return "read";
  if (["failed", "failure", "rejected", "error"].includes(status)) return "failed";
  if (["skipped", "ignored", "deduped"].includes(status)) return "skipped";
  if (["pending", "created", "queued"].includes(status)) return "pending";
  return status || "unavailable";
}

export default function NotificationStatusChip({ status, label, technical, size = "small" }) {
  const normalized = normalizeNotificationStatus(status);
  const chip = (
    <Chip
      size={size}
      color={STATUS_COLORS[normalized] || "default"}
      label={label || STATUS_LABELS[normalized] || status || STATUS_LABELS.unavailable}
      variant={normalized === "disabled" || normalized === "inactive" || normalized === "unavailable" ? "outlined" : "filled"}
    />
  );
  return technical ? <Tooltip title={technical}>{chip}</Tooltip> : chip;
}
