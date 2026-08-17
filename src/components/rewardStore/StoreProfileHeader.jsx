// src/components/rewardStore/StoreProfileHeader.jsx
//
// Bloco de perfil/resumo do cliente no topo da /loja.
// Dá à Loja a sensação de área do cliente, e não de landing solta.
//
// HONESTIDADE DE DADOS: só exibe o que o backend realmente fornece.
// O saldo de NSCréditos agora é factual (GET /api/me/nscredits) e tem três
// estados distintos: carregando, saldo real (inclusive 0) e indisponível.
// Saldo 0 é um saldo válido; erro de consulta NUNCA vira 0.
// O histórico de pedidos ainda não existe — segue como reserva visual.

import * as React from "react";
import { Link as RouterLink } from "react-router-dom";
import { Avatar, Box, Button, Chip, Divider, Paper, Skeleton, Stack, Typography } from "@mui/material";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";

import { formatNsCredits } from "../../services/nscredits";

export function initialsOf(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "NS";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatMemberSince(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

/** Célula do resumo. `pending` marca o dado que ainda não existe no backend. */
function SummaryCell({ label, value, hint, pending }) {
  return (
    <Stack spacing={0.25} sx={{ minWidth: 120 }}>
      <Typography variant="caption" sx={{ opacity: 0.6, fontWeight: 700, letterSpacing: 0.4 }}>
        {label}
      </Typography>
      <Typography
        sx={{
          fontWeight: 900,
          fontSize: { xs: 18, md: 20 },
          color: pending ? "rgba(255,255,255,0.45)" : "secondary.main",
          lineHeight: 1.2,
        }}
      >
        {value}
      </Typography>
      {hint && (
        <Typography variant="caption" sx={{ opacity: 0.5 }}>
          {hint}
        </Typography>
      )}
    </Stack>
  );
}

/** Célula do saldo de NSCréditos, com os três estados factuais. */
function BalanceCell({ wallet }) {
  const { balance, loading, error, onRetry } = wallet || {};

  if (loading) {
    return (
      <Stack spacing={0.25} sx={{ minWidth: 140 }}>
        <Typography variant="caption" sx={{ opacity: 0.6, fontWeight: 700, letterSpacing: 0.4 }}>
          SALDO DISPONÍVEL
        </Typography>
        <Skeleton width={120} height={30} data-testid="saldo-carregando" />
      </Stack>
    );
  }

  if (error) {
    return (
      <Stack spacing={0.25} sx={{ minWidth: 140 }}>
        <Typography variant="caption" sx={{ opacity: 0.6, fontWeight: 700, letterSpacing: 0.4 }}>
          SALDO DISPONÍVEL
        </Typography>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Typography sx={{ fontWeight: 900, fontSize: { xs: 16, md: 18 }, color: "rgba(255,255,255,0.55)" }}>
            Saldo indisponível
          </Typography>
          {onRetry && (
            <Button
              size="small"
              onClick={onRetry}
              startIcon={<RefreshRoundedIcon fontSize="small" />}
              sx={{ minWidth: 0, px: 1 }}
            >
              Tentar de novo
            </Button>
          )}
        </Stack>
      </Stack>
    );
  }

  return (
    <Stack spacing={0.25} sx={{ minWidth: 140 }}>
      <Typography variant="caption" sx={{ opacity: 0.6, fontWeight: 700, letterSpacing: 0.4 }}>
        SALDO DISPONÍVEL
      </Typography>
      <Typography sx={{ fontWeight: 900, fontSize: { xs: 20, md: 24 }, color: "secondary.main", lineHeight: 1.2 }}>
        {formatNsCredits(balance ?? 0)} NSCréditos
      </Typography>
    </Stack>
  );
}

export default function StoreProfileHeader({ user, loading, wallet }) {
  if (loading) return null;

  // Visitante não autenticado: convite para entrar, sem inventar perfil.
  if (!user) {
    return (
      <Paper
        variant="outlined"
        sx={{
          p: { xs: 2, md: 3 },
          borderRadius: 3,
          borderColor: "rgba(255,255,255,0.10)",
          background: "linear-gradient(120deg, rgba(103,194,58,0.10), rgba(255,193,7,0.05))",
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          alignItems={{ xs: "flex-start", sm: "center" }}
          justifyContent="space-between"
        >
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar sx={{ bgcolor: "rgba(255,255,255,0.08)", width: 56, height: 56 }}>
              <PersonRoundedIcon />
            </Avatar>
            <Stack spacing={0.25}>
              <Typography sx={{ fontWeight: 900, fontSize: { xs: 18, md: 20 } }}>
                Bem-vindo à Loja de Prêmios
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.75 }}>
                Entre na sua conta para acompanhar seus NSCréditos.
              </Typography>
            </Stack>
          </Stack>

          <Button
            component={RouterLink}
            to="/login"
            variant="contained"
            sx={{ bgcolor: "primary.main", color: "#0E0E0E", fontWeight: 900, borderRadius: 999, px: 3 }}
          >
            ENTRAR
          </Button>
        </Stack>
      </Paper>
    );
  }

  const memberSince = formatMemberSince(user.created_at);
  const firstName = String(user.name || "").trim().split(/\s+/)[0] || "cliente";

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 2, md: 3 },
        borderRadius: 3,
        borderColor: "rgba(103,194,58,0.25)",
        background: "linear-gradient(120deg, rgba(103,194,58,0.12), rgba(255,193,7,0.06))",
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={{ xs: 2, md: 3 }}
        alignItems={{ xs: "flex-start", md: "center" }}
        justifyContent="space-between"
      >
        <Stack direction="row" spacing={2} alignItems="center" sx={{ minWidth: 0 }}>
          <Avatar
            sx={{
              width: { xs: 52, md: 64 },
              height: { xs: 52, md: 64 },
              bgcolor: "primary.main",
              color: "#0E0E0E",
              fontWeight: 900,
              fontSize: { xs: 18, md: 22 },
            }}
          >
            {initialsOf(user.name)}
          </Avatar>

          <Stack spacing={0.25} sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 900, fontSize: { xs: 18, md: 22 }, lineHeight: 1.2 }}>
              Olá, {firstName}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              {user.id != null && (
                <Chip
                  size="small"
                  label={`ID ${user.id}`}
                  sx={{ fontWeight: 800, bgcolor: "rgba(255,255,255,0.08)" }}
                />
              )}
              {memberSince && (
                <Typography variant="caption" sx={{ opacity: 0.7 }}>
                  Membro desde {memberSince}
                </Typography>
              )}
            </Stack>
          </Stack>
        </Stack>

        <Divider flexItem orientation="vertical" sx={{ display: { xs: "none", md: "block" } }} />

        <Stack direction="row" spacing={{ xs: 3, md: 4 }} flexWrap="wrap" useFlexGap>
          <BalanceCell wallet={wallet} />
          <SummaryCell label="RESGATES" value="—" hint="nenhum registrado" pending />
        </Stack>

        <Button
          startIcon={<ReceiptLongRoundedIcon />}
          variant="outlined"
          disabled
          sx={{
            fontWeight: 900,
            borderRadius: 999,
            px: 3,
            whiteSpace: "nowrap",
            alignSelf: { xs: "stretch", md: "auto" },
          }}
        >
          MEUS PEDIDOS
        </Button>
      </Stack>

      <Box sx={{ mt: 1.5 }}>
        <Typography variant="caption" sx={{ opacity: 0.5 }}>
          O resgate com NSCréditos será liberado em breve.
        </Typography>
      </Box>
    </Paper>
  );
}
