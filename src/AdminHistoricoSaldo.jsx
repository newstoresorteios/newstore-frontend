// src/AdminHistoricoSaldo.jsx
import * as React from "react";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import {
  AppBar, Box, Container, CssBaseline, Divider, IconButton, Menu, MenuItem,
  Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  ThemeProvider, Toolbar, Typography, createTheme, Button, Stack, TextField,
} from "@mui/material";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import AccountCircleRoundedIcon from "@mui/icons-material/AccountCircleRounded";
import logoNewStore from "./Logo-branca-sem-fundo-768x132.png";
import { useAuth } from "./authContext";
import { getJSON } from "./lib/api";

const theme = createTheme({
  palette: { mode: "dark", background: { default: "#0E0E0E", paper: "#121212" }, success: { main: "#67C23A" } },
  typography: { fontFamily: ["Inter", "system-ui", "Segoe UI", "Roboto", "Arial"].join(",") },
});

const PAGE_SIZE = 50;
const MOVEMENTS_PAGE_SIZE = 100;

const fmtBRLFromCents = (value) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
    .format(Number.isFinite(Number(value)) ? Number(value) / 100 : 0);

const fmtDateTime = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
};

const safeText = (value, fallback = "—") => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "object") return fallback;
  const text = String(value).trim();
  return text || fallback;
};

const getBalanceCents = (user) => {
  const cents = Number(user?.balance_cents || 0);
  return Number.isFinite(cents) ? cents : 0;
};

const sortTextValue = (value) => {
  if (value === null || value === undefined || typeof value === "object") return "";
  return String(value).trim();
};

const sortNumberValue = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const sortDateValue = (value) => {
  if (!value) return Number.NEGATIVE_INFINITY;
  const date = new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
};

const compareUsers = (a, b, sortKey, sortDirection) => {
  let result = 0;

  if (sortKey === "name") {
    result = sortTextValue(a?.name).localeCompare(sortTextValue(b?.name), "pt-BR", { sensitivity: "base" });
  } else if (sortKey === "email") {
    result = sortTextValue(a?.email).localeCompare(sortTextValue(b?.email), "pt-BR", { sensitivity: "base" });
  } else if (sortKey === "coupon") {
    result = sortTextValue(a?.coupon_code || a?.tray_code).localeCompare(sortTextValue(b?.coupon_code || b?.tray_code), "pt-BR", { sensitivity: "base" });
  } else if (sortKey === "balance_cents") {
    result = sortNumberValue(a?.balance_cents) - sortNumberValue(b?.balance_cents);
  } else if (sortKey === "last_movement_at") {
    result = sortDateValue(a?.last_movement_at) - sortDateValue(b?.last_movement_at);
  } else if (sortKey === "movements_count") {
    result = sortNumberValue(a?.movements_count) - sortNumberValue(b?.movements_count);
  }

  return sortDirection === "asc" ? result : -result;
};

const USER_TABLE_COLUMNS = [
  { key: "name", label: "NOME DO CLIENTE" },
  { key: "email", label: "E-MAIL" },
  { key: "coupon", label: "CUPOM" },
  { key: "balance_cents", label: "SALDO ATUAL" },
  { key: "last_movement_at", label: "ÚLTIMA MOVIMENTAÇÃO" },
  { key: "movements_count", label: "MOVIMENTAÇÕES" },
];

const fmtSignedBRLFromCents = (value) => {
  const cents = Number(value || 0);
  const amount = Number.isFinite(cents) ? cents / 100 : 0;
  const prefix = amount > 0 ? "+ " : amount < 0 ? "- " : "";
  return `${prefix}${fmtBRLFromCents(Math.abs(cents))}`;
};

const buildMovementReference = (movement) => {
  const refs = [];
  if (movement?.payment_id) refs.push(`Pagamento: ${safeText(movement.payment_id)}`);
  if (movement?.draw_id) refs.push(`Sorteio: ${safeText(movement.draw_id)}`);
  if (!refs.length && movement?.run_trace_id) refs.push(`Trace: ${safeText(movement.run_trace_id)}`);
  return refs.length ? refs.join(" | ") : "—";
};

const getMovementAdmin = (movement) => {
  if (movement?.admin?.name) return safeText(movement.admin.name);
  if (movement?.admin?.id) return `Admin ID ${safeText(movement.admin.id)}`;
  return "—";
};

export default function AdminHistoricoSaldo() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pagination, setPagination] = React.useState({
    page: 1,
    page_size: PAGE_SIZE,
    total: 0,
    total_pages: 1,
    has_previous: false,
    has_next: false,
  });
  const [selectedUserId, setSelectedUserId] = React.useState(null);
  const [selectedUserName, setSelectedUserName] = React.useState("");
  const [movements, setMovements] = React.useState([]);
  const [movementsLoading, setMovementsLoading] = React.useState(false);
  const [movementsError, setMovementsError] = React.useState(false);
  const [movementsPage, setMovementsPage] = React.useState(1);
  const [movementsPagination, setMovementsPagination] = React.useState({
    page: 1,
    page_size: MOVEMENTS_PAGE_SIZE,
    total: 0,
    total_pages: 1,
    has_previous: false,
    has_next: false,
  });
  const [sortKey, setSortKey] = React.useState("last_movement_at");
  const [sortDirection, setSortDirection] = React.useState("desc");

  const sortedUsers = React.useMemo(() => {
    return [...rows].sort((a, b) => compareUsers(a, b, sortKey, sortDirection));
  }, [rows, sortKey, sortDirection]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 400);

    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  React.useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setError(false);
      try {
        const params = new URLSearchParams({
          q: debouncedSearch,
          page: String(page),
          pageSize: String(PAGE_SIZE),
        });
        const payload = await getJSON(`/admin/balance-history/users?${params.toString()}`);
        const users = Array.isArray(payload?.users) ? payload.users : [];
        const mapped = users.map((user, index) => ({
          ...user,
          key: user?.user_id ?? index,
          nome: safeText(user?.name || user?.email),
          email: safeText(user?.email),
          cupom: safeText(user?.coupon_code || user?.tray_code),
          saldoCents: getBalanceCents(user),
          ultimaMovimentacao: fmtDateTime(user?.last_movement_at),
          movimentacoes: Number.isFinite(Number(user?.movements_count || 0)) ? Number(user?.movements_count || 0) : 0,
        }));
        if (alive) {
          setRows(mapped);
          setPagination({
            page: Number(payload?.pagination?.page) || page,
            page_size: Number(payload?.pagination?.page_size) || PAGE_SIZE,
            total: Number(payload?.pagination?.total) || 0,
            total_pages: Math.max(1, Number(payload?.pagination?.total_pages) || 1),
            has_previous: Boolean(payload?.pagination?.has_previous),
            has_next: Boolean(payload?.pagination?.has_next),
          });
        }
      } catch (err) {
        console.error("[AdminHistoricoSaldo][LOAD_USERS_ERROR]", err);
        if (alive) {
          setRows([]);
          setError(true);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [debouncedSearch, page]);

  React.useEffect(() => {
    if (!selectedUserId) return undefined;

    let alive = true;

    (async () => {
      setMovementsLoading(true);
      setMovementsError(false);
      try {
        const params = new URLSearchParams({
          page: String(movementsPage),
          pageSize: String(MOVEMENTS_PAGE_SIZE),
        });
        const payload = await getJSON(`/admin/balance-history/users/${selectedUserId}/movements?${params.toString()}`);
        const list = Array.isArray(payload?.movements) ? payload.movements : [];
        if (alive) {
          setMovements(list);
          setMovementsPagination({
            page: Number(payload?.pagination?.page) || movementsPage,
            page_size: Number(payload?.pagination?.page_size) || MOVEMENTS_PAGE_SIZE,
            total: Number(payload?.pagination?.total) || 0,
            total_pages: Math.max(1, Number(payload?.pagination?.total_pages) || 1),
            has_previous: Boolean(payload?.pagination?.has_previous),
            has_next: Boolean(payload?.pagination?.has_next),
          });
        }
      } catch (err) {
        console.error("[AdminHistoricoSaldo][LOAD_USER_MOVEMENTS_ERROR]", err);
        if (alive) {
          setMovements([]);
          setMovementsError(true);
        }
      } finally {
        if (alive) setMovementsLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [selectedUserId, movementsPage]);

  const [menuEl, setMenuEl] = React.useState(null);
  const open = Boolean(menuEl);
  const openMenu = (e) => setMenuEl(e.currentTarget);
  const closeMenu = () => setMenuEl(null);
  const goPainel = () => { closeMenu(); navigate("/admin"); };
  const doLogout = () => { closeMenu(); logout(); navigate("/"); };
  const totalPages = Math.max(1, Number(pagination.total_pages) || 1);
  const currentPage = Math.min(Math.max(1, Number(pagination.page) || page), totalPages);
  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
    setPage(1);
  };
  const previousPage = () => {
    setPage((current) => Math.max(1, current - 1));
  };
  const nextPage = () => {
    setPage((current) => Math.min(totalPages, current + 1));
  };
  const movementsTotalPages = Math.max(1, Number(movementsPagination.total_pages) || 1);
  const movementsCurrentPage = Math.min(Math.max(1, Number(movementsPagination.page) || movementsPage), movementsTotalPages);
  const handleUserClick = (row) => {
    if (!row?.user_id) return;
    setSelectedUserId(row.user_id);
    setSelectedUserName(row.nome);
    setMovementsPage(1);
  };
  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDirection((currentDirection) => (currentDirection === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  };
  const previousMovementsPage = () => {
    setMovementsPage((current) => Math.max(1, current - 1));
  };
  const nextMovementsPage = () => {
    setMovementsPage((current) => Math.min(movementsTotalPages, current + 1));
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="sticky" elevation={0} sx={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <Toolbar sx={{ position: "relative", minHeight: 64 }}>
          <IconButton edge="start" color="inherit" onClick={() => navigate("/admin")} aria-label="Voltar">
            <ArrowBackIosNewRoundedIcon />
          </IconButton>
          <Box component={RouterLink} to="/admin"
               sx={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}>
            <Box component="img" src={logoNewStore} alt="NEW STORE" sx={{ height: 40 }} />
          </Box>
          <IconButton color="inherit" sx={{ ml: "auto" }} onClick={openMenu}>
            <AccountCircleRoundedIcon />
          </IconButton>
          <Menu anchorEl={menuEl} open={open} onClose={closeMenu}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}>
            <MenuItem onClick={goPainel}>Painel (Admin)</MenuItem>
            <Divider />
            <MenuItem onClick={doLogout}>Sair</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 6 } }}>
        <Typography sx={{
          fontWeight: 900, textTransform: "uppercase",
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          fontSize: { xs: 24, md: 44 }, mb: 2,
        }}>
          Histórico de saldo
        </Typography>

        <TextField
          value={searchTerm}
          onChange={handleSearchChange}
          placeholder="PESQUISAR NOME, E-MAIL OU CUPOM"
          size="small"
          fullWidth
          sx={{ maxWidth: 420, mb: 2 }}
        />

        <Paper variant="outlined" sx={{ bgcolor: "background.paper" }}>
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table sx={{ minWidth: 980 }}>
              <TableHead>
                <TableRow>
                  {USER_TABLE_COLUMNS.map((column) => (
                    <TableCell
                      key={column.key}
                      onClick={() => handleSort(column.key)}
                      sx={{ fontWeight: 800, cursor: "pointer", userSelect: "none" }}
                    >
                      {column.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && (
                  <TableRow><TableCell colSpan={6}>Carregando usuários...</TableCell></TableRow>
                )}
                {!loading && error && (
                  <TableRow><TableCell colSpan={6} sx={{ color: "#bbb" }}>Não foi possível carregar os usuários.</TableCell></TableRow>
                )}
                {!loading && !error && rows.length === 0 && (
                  <TableRow><TableCell colSpan={6} sx={{ color: "#bbb" }}>Nenhum usuário encontrado.</TableCell></TableRow>
                )}
                {!loading && !error && sortedUsers.map((row, index) => (
                  <TableRow
                    key={row.key}
                    hover
                    onClick={() => handleUserClick(row)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleUserClick(row);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-pressed={selectedUserId === row.user_id}
                    sx={{
                      bgcolor: selectedUserId === row.user_id
                        ? "rgba(103,194,58,0.14)"
                        : index % 2 === 1 ? "rgba(255,255,255,0.025)" : "transparent",
                      cursor: "pointer",
                    }}
                  >
                    <TableCell>{row.nome}</TableCell>
                    <TableCell>{row.email}</TableCell>
                    <TableCell>{row.cupom}</TableCell>
                    <TableCell>{fmtBRLFromCents(row.saldoCents)}</TableCell>
                    <TableCell>{row.ultimaMovimentacao}</TableCell>
                    <TableCell>{row.movimentacoes}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Stack
            direction="row"
            spacing={2}
            alignItems="center"
            justifyContent="flex-end"
            sx={{ px: 2, py: 1.5 }}
          >
            <Button size="small" variant="outlined" color="inherit" onClick={previousPage} disabled={loading || !pagination.has_previous}>
              ANTERIOR
            </Button>
            <Typography sx={{ fontWeight: 800, fontSize: 13 }}>
              PÁGINA {currentPage} DE {totalPages}
            </Typography>
            <Button size="small" variant="outlined" color="inherit" onClick={nextPage} disabled={loading || !pagination.has_next}>
              PRÓXIMA
            </Button>
          </Stack>
        </Paper>

        {selectedUserId && (
          <Paper variant="outlined" sx={{ bgcolor: "background.paper", mt: 2 }}>
            <Box sx={{ px: 2, py: 1.5, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <Typography sx={{ fontWeight: 900, textTransform: "uppercase" }}>
                Histórico de movimentações — {selectedUserName || "—"}
              </Typography>
            </Box>
            <TableContainer sx={{ overflowX: "auto" }}>
              <Table sx={{ minWidth: 1280 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800 }}>DATA</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>TIPO</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>ORIGEM / PAGAMENTO</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>DESCRIÇÃO</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>VALOR</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>SALDO ANTERIOR</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>SALDO POSTERIOR</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>REFERÊNCIA</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>RESPONSÁVEL</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {movementsLoading && (
                    <TableRow><TableCell colSpan={9}>Carregando histórico do usuário...</TableCell></TableRow>
                  )}
                  {!movementsLoading && movementsError && (
                    <TableRow><TableCell colSpan={9} sx={{ color: "#bbb" }}>Não foi possível carregar o histórico deste usuário.</TableCell></TableRow>
                  )}
                  {!movementsLoading && !movementsError && movements.length === 0 && (
                    <TableRow><TableCell colSpan={9} sx={{ color: "#bbb" }}>Nenhuma movimentação encontrada para este usuário.</TableCell></TableRow>
                  )}
                  {!movementsLoading && !movementsError && movements.map((movement, index) => {
                    const delta = Number(movement?.delta_cents || 0);
                    return (
                      <TableRow
                        key={movement?.id ?? movement?.movement_id ?? `${selectedUserId}-${index}`}
                        hover
                        sx={{
                          bgcolor: index % 2 === 1 ? "rgba(255,255,255,0.025)" : "transparent",
                        }}
                      >
                        <TableCell title={movement?.history_created_at ? `Registro criado no histórico em: ${fmtDateTime(movement.history_created_at)}` : undefined}>
                          {fmtDateTime(movement?.event_date || movement?.created_at)}
                        </TableCell>
                        <TableCell>{safeText(movement?.movement_label || movement?.event_type)}</TableCell>
                        <TableCell>{safeText(movement?.origin_label || movement?.channel)}</TableCell>
                        <TableCell>{safeText(movement?.description, "Movimentação registrada no sistema")}</TableCell>
                        <TableCell sx={{ color: delta > 0 ? "success.main" : delta < 0 ? "#EF5350" : "inherit", fontWeight: 800 }}>
                          {fmtSignedBRLFromCents(delta)}
                        </TableCell>
                        <TableCell>{fmtBRLFromCents(movement?.balance_before_cents)}</TableCell>
                        <TableCell>{fmtBRLFromCents(movement?.balance_after_cents)}</TableCell>
                        <TableCell>{buildMovementReference(movement)}</TableCell>
                        <TableCell>{getMovementAdmin(movement)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <Stack
              direction="row"
              spacing={2}
              alignItems="center"
              justifyContent="flex-end"
              sx={{ px: 2, py: 1.5 }}
            >
              <Button size="small" variant="outlined" color="inherit" onClick={previousMovementsPage} disabled={movementsLoading || !movementsPagination.has_previous}>
                ANTERIOR
              </Button>
              <Typography sx={{ fontWeight: 800, fontSize: 13 }}>
                PÁGINA {movementsCurrentPage} DE {movementsTotalPages}
              </Typography>
              <Button size="small" variant="outlined" color="inherit" onClick={nextMovementsPage} disabled={movementsLoading || !movementsPagination.has_next}>
                PRÓXIMA
              </Button>
            </Stack>
          </Paper>
        )}
      </Container>
    </ThemeProvider>
  );
}
