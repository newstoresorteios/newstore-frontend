// src/pages/AdminAnalytics.jsx
import * as React from 'react';
import {
  Box, Stack, Paper, Typography, Select, MenuItem, FormControl, InputLabel,
  Grid, Chip, Divider, Table, TableHead, TableRow, TableCell, TableBody,
  IconButton, Button
} from '@mui/material';
import ArrowBackIosNewRoundedIcon from '@mui/icons-material/ArrowBackIosNewRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  LineChart, Line
} from 'recharts';

// Heatmap simples por decena (0–9, 10–19, ... 90–99)
function NumberHeatmap({ data }) {
  const grid = Array.from({ length: 100 }, (_, i) => ({ n: i, v: 0 }));
  (data || []).forEach(d => { grid[d.n] = { n: d.n, v: Number(d.sold_count) || 0 }; });
  const groups = Array.from({ length: 10 }, (_, g) => ({
    label: `${g * 10}-${g * 10 + 9}`,
    total: grid.slice(g * 10, g * 10 + 10).reduce((acc, x) => acc + x.v, 0),
  }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={groups} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" />
        <YAxis allowDecimals={false} />
        <RTooltip />
        <Bar dataKey="total" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function AdminAnalytics() {
  const nav = useNavigate();
  const [draws, setDraws] = React.useState([]);
  const [drawId, setDrawId] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [summary, setSummary] = React.useState(null);
  const [rfm, setRfm] = React.useState([]);

  const fetchDraws = React.useCallback(async () => {
    const r = await fetch('/api/admin/analytics/draws');
    const js = await r.json();
    setDraws(js || []);
    if (!drawId && js?.[0]?.id) setDrawId(js[0].id);
  }, [drawId]);

  const fetchSummary = React.useCallback(async () => {
    if (!drawId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/analytics/summary/${drawId}`);
      const js = await r.json();
      setSummary(js);
    } finally { setLoading(false); }
  }, [drawId]);

  const fetchRfm = React.useCallback(async () => {
    const r = await fetch(`/api/admin/analytics/rfm?limit=50`);
    const js = await r.json();
    setRfm(js || []);
  }, []);

  React.useEffect(() => { fetchDraws(); }, []);
  React.useEffect(() => { fetchSummary(); }, [drawId]);
  React.useEffect(() => { fetchRfm(); }, []);

  const funnel = summary?.funnel || { available: 0, reserved: 0, sold: 0 };
  const paid = summary?.paid || { gmv_cents: 0, avg_ticket_cents: 0, paid_orders: 0 };
  const fillPct = ((summary?.fill_rate || 0) * 100).toFixed(0);
  const hourData = (summary?.hourDist || []).map(x => ({ hour: Number(x.hour_br), paid: Number(x.paid) }));

  return (
    <Box p={2}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
        <Stack direction="row" gap={1} alignItems="center">
          <IconButton onClick={() => nav(-1)} aria-label="voltar">
            <ArrowBackIosNewRoundedIcon />
          </IconButton>
          <Typography variant="h5">Analytics do Sorteio</Typography>
        </Stack>
        <Stack direction="row" gap={1}>
          <Button startIcon={<RefreshRoundedIcon />} onClick={fetchSummary} disabled={loading}>
            Atualizar
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Paper style={{ padding: 16 }}>
            <FormControl fullWidth>
              <InputLabel id="sel-draw">Sorteio</InputLabel>
              <Select
                labelId="sel-draw" label="Sorteio"
                value={drawId || ''} onChange={(e) => setDrawId(e.target.value)}
              >
                {draws.map(d => (
                  <MenuItem key={d.id} value={d.id}>
                    #{d.id} — {d.product_name || 'S/ nome'} ({d.status})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Divider style={{ margin: '16px 0' }} />
            <Stack gap={1}>
              <Typography variant="body2">Preenchimento</Typography>
              <Stack direction="row" gap={1} flexWrap="wrap">
                <Chip label={`Disponíveis: ${funnel.available}`} />
                <Chip color="warning" label={`Reservados: ${funnel.reserved}`} />
                <Chip color="success" label={`Vendidos: ${funnel.sold}`} />
              </Stack>
              <Typography variant="h6" style={{ marginTop: 8 }}>
                Fill-rate: {fillPct}%
              </Typography>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={8}>
          <Paper style={{ padding: 16 }}>
            <Typography variant="subtitle1">GMV & Ticket</Typography>
            <Stack direction="row" gap={3} mt={1} flexWrap="wrap">
              <Chip color="primary" label={`GMV: R$ ${(paid.gmv_cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
              <Chip label={`Pedidos pagos: ${paid.paid_orders}`} />
              <Chip label={`Ticket médio: R$ ${(paid.avg_ticket_cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
            </Stack>
            <Divider style={{ margin: '16px 0' }} />
            <Typography variant="subtitle2">Pagos por hora (BR)</Typography>
            <Box height={220}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={hourData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="hour" tickFormatter={(h) => `${h}h`} />
                  <YAxis allowDecimals={false} />
                  <RTooltip />
                  <Line type="monotone" dataKey="paid" />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper style={{ padding: 16 }}>
            <Typography variant="subtitle1">Heatmap rápido — Números vendidos (0–99)</Typography>
            <NumberHeatmap data={summary?.numHeat} />
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper style={{ padding: 16 }}>
            <Typography variant="subtitle1">Vazamentos</Typography>
            <Stack direction="row" gap={2} mt={1} flexWrap="wrap">
              <Chip label={`Reservas expiradas: ${summary?.expired?.reservations || 0}`} />
              <Chip label={`Pagamentos expirados: ${summary?.expired?.payments || 0}`} />
            </Stack>
            <Typography variant="body2" style={{ marginTop: 8 }}>
              Dica: lembrete D-5min antes do vencimento da reserva e reenvio das instruções para pendentes &gt; 30min.
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper style={{ padding: 16 }}>
            <Typography variant="subtitle1" gutterBottom>Quem atacar agora (Top RFM)</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Cliente</TableCell>
                  <TableCell>E-mail</TableCell>
                  <TableCell>Telefone</TableCell>
                  <TableCell align="right">Freq</TableCell>
                  <TableCell align="right">Monetário</TableCell>
                  <TableCell align="right">Recência (dias)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rfm.map(r => (
                  <TableRow key={r.id} hover>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>{r.email}</TableCell>
                    <TableCell>{r.phone || '-'}</TableCell>
                    <TableCell align="right">{r.freq}</TableCell>
                    <TableCell align="right">{(r.monetary_cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell align="right">{Number(r.recency_days).toFixed(1)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
