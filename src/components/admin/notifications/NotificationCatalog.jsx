import * as React from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SyncRoundedIcon from "@mui/icons-material/SyncRounded";
import {
  createPushRule,
  getNotificationCatalog,
  listPushRules,
  seedDefaultPushRules,
  syncBrevoWhatsAppTemplates,
  updateNotificationTemplate,
  updatePushRule,
} from "../../../services/adminNotifications";
import NotificationStatusChip from "./NotificationStatusChip";
import {
  connectedBrevoWhatsAppTemplates,
  formatDate,
  friendlyError,
  isRemainingEmailTemplate,
  manualSendBlockReasonLabel,
  templateKey,
  templateLanguageLabel,
  templateName,
} from "./notificationUi";

const EMPTY_RULE = {
  event_key: "",
  name: "",
  description: "",
  title_template: "",
  body_template: "",
  url_template: "/",
  category: "operational",
  threshold_value: "",
  cooldown_minutes: "",
  is_active: true,
};

function parseParams(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "object") return Object.keys(value);
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : Object.keys(parsed || {});
  } catch {
    return [String(value)];
  }
}

function TemplateCard({ template, channel, onToggle, onEdit, onUseTemplate, onSendAll, busy }) {
  const status = template.is_active === false ? "inactive" : "active";
  const origin = channel === "whatsapp" ? "Brevo" : channel === "push" ? "Regra Push" : template.source === "builtin" ? "Modelo padrão" : "Banco";
  const systemOnly = channel === "whatsapp" && template.manual_send_allowed === false;
  const blockReason = String(template.manual_send_block_reason || "").trim();
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, display: "flex", flexDirection: "column", minHeight: 250 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>{templateName(template)}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "ui-monospace, Menlo, Consolas, monospace", overflowWrap: "anywhere" }}>{templateKey(template)}</Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" justifyContent="flex-end">
          {channel === "email" && <Chip size="small" color="primary" variant="outlined" label="E-mail SMTP" />}
          {systemOnly && <Chip size="small" color="warning" label="Uso automático do sistema" />}
          <NotificationStatusChip status={status} />
        </Stack>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{template.description || "Sem descrição."}</Typography>
      {systemOnly && (
        <Alert severity="warning" sx={{ mt: 1.5 }}>
          Este template pode ser consultado, mas não pode ser selecionado para envio manual.
          <> Motivo informado pelo backend: {manualSendBlockReasonLabel(blockReason)}{blockReason && ` (${blockReason})`}.</>
        </Alert>
      )}
      <Stack spacing={0.5} sx={{ mt: 1.5, flex: 1 }}>
        {channel === "whatsapp" && <>
          <Typography variant="body2" sx={{ fontWeight: 800 }}>Template Brevo #{Number(template.provider_template_id)} · {templateLanguageLabel(template)}</Typography>
          <Typography variant="body2"><strong>Status Brevo:</strong> {template.provider_status || template.configuration_status || (template.is_active === false ? "inactive" : "active")}</Typography>
          <Typography variant="body2"><strong>Parâmetros:</strong> {parseParams(template.message_params || template.default_params).join(", ") || "Nenhum"}</Typography>
        </>}
        {channel === "push" && <>
          <Typography variant="body2"><strong>Título:</strong> {template.title_template || "-"}</Typography>
          <Typography variant="body2"><strong>Mensagem:</strong> {template.body_template || "-"}</Typography>
          <Typography variant="body2"><strong>URL:</strong> {template.url_template || "/"}</Typography>
          <Typography variant="body2"><strong>Categoria:</strong> {template.category || "-"}</Typography>
          <Typography variant="body2"><strong>Threshold:</strong> {template.threshold_value ?? "-"} · <strong>Cooldown:</strong> {template.cooldown_minutes ?? "-"} min</Typography>
        </>}
        {channel === "email" && <>
          <Typography variant="body2"><strong>Assunto:</strong> {template.subject_template || "-"}</Typography>
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}><strong>Texto:</strong> {template.text_template || template.default_message || "-"}</Typography>
          {template.html_template && <Box component="pre" sx={{ m: 0, mt: 0.5, p: 1, borderRadius: 1, bgcolor: "action.hover", whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 11 }}>{template.html_template}</Box>}
        </>}
      </Stack>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} spacing={1} sx={{ mt: 2 }}>
        <Typography variant="caption" color="text.secondary">Origem: {origin}</Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ width: { xs: "100%", sm: "auto" } }}>
          {onUseTemplate && <Button size="small" variant="outlined" onClick={() => onUseTemplate(template)} sx={{ width: { xs: "100%", sm: "auto" } }}>Usar modelo</Button>}
          {onSendAll && <Button size="small" variant="contained" onClick={() => onSendAll(template)} sx={{ width: { xs: "100%", sm: "auto" } }}>Enviar para todos</Button>}
          {onEdit && <Button size="small" variant="outlined" startIcon={<EditRoundedIcon />} onClick={() => onEdit(template)}>Editar</Button>}
          {onToggle && <Button size="small" variant="outlined" disabled={busy} onClick={() => onToggle(template)}>{template.is_active === false ? "Ativar" : "Desativar"}</Button>}
        </Stack>
      </Stack>
    </Paper>
  );
}

export default function NotificationCatalog({ initialChannel = "whatsapp", focusEvent = "", onUseTemplate, onSendAll }) {
  const [subtab, setSubtab] = React.useState(initialChannel);
  const [catalog, setCatalog] = React.useState(null);
  const [pushRules, setPushRules] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [ruleDialog, setRuleDialog] = React.useState(false);
  const [editingRule, setEditingRule] = React.useState(null);
  const [ruleForm, setRuleForm] = React.useState(EMPTY_RULE);
  const [emailDialog, setEmailDialog] = React.useState(false);
  const [editingEmail, setEditingEmail] = React.useState(null);
  const [emailForm, setEmailForm] = React.useState({ name: "", description: "", subject_template: "", text_template: "", html_template: "", is_active: true });

  React.useEffect(() => { setSubtab(initialChannel || "whatsapp"); }, [initialChannel]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    const [catalogResult, rulesResult] = await Promise.allSettled([getNotificationCatalog(), listPushRules()]);
    if (catalogResult.status === "fulfilled") setCatalog(catalogResult.value);
    else setError(friendlyError(catalogResult.reason, "Não foi possível carregar o catálogo."));
    if (rulesResult.status === "fulfilled") {
      const value = rulesResult.value;
      setPushRules(Array.isArray(value) ? value : value?.rows || value?.items || value?.rules || []);
    }
    setLoading(false);
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const syncWhatsapp = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await syncBrevoWhatsAppTemplates();
      const fresh = await getNotificationCatalog();
      setCatalog((current) => ({
        ...(current || fresh),
        channels: { ...(current?.channels || fresh.channels), whatsapp: fresh?.channels?.whatsapp },
      }));
      setMessage("Templates do WhatsApp sincronizados com a Brevo.");
    } catch (syncError) {
      setError(friendlyError(syncError, "Não foi possível sincronizar os templates."));
    } finally {
      setBusy(false);
    }
  };

  const toggleTemplate = async (template) => {
    if (template.id == null) return;
    setBusy(true);
    setError("");
    try {
      await updateNotificationTemplate(template.id, { is_active: template.is_active === false });
      const channel = subtab;
      setCatalog((current) => ({ ...current, channels: { ...current.channels, [channel]: { ...current.channels[channel], templates: current.channels[channel].templates.map((item) => item.id === template.id ? { ...item, is_active: template.is_active === false } : item) } } }));
    } catch (toggleError) {
      setError(friendlyError(toggleError));
    } finally {
      setBusy(false);
    }
  };

  const openRule = (rule = null) => {
    setEditingRule(rule);
    setRuleForm(rule ? { ...EMPTY_RULE, ...rule, threshold_value: rule.threshold_value ?? "", cooldown_minutes: rule.cooldown_minutes ?? "" } : EMPTY_RULE);
    setRuleDialog(true);
  };

  React.useEffect(() => {
    if (!focusEvent || !pushRules.length) return;
    const rule = pushRules.find((item) => item.event_key === focusEvent);
    if (rule) {
      setEditingRule(rule);
      setRuleForm({ ...EMPTY_RULE, ...rule, threshold_value: rule.threshold_value ?? "", cooldown_minutes: rule.cooldown_minutes ?? "" });
      setRuleDialog(true);
    }
  }, [focusEvent, pushRules]);

  const saveRule = async () => {
    if (!ruleForm.event_key.trim() || !ruleForm.title_template.trim() || !ruleForm.body_template.trim()) {
      setError("Evento, título e mensagem são obrigatórios.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const payload = {
        ...ruleForm,
        threshold_value: ruleForm.threshold_value === "" ? null : Number(ruleForm.threshold_value),
        cooldown_minutes: ruleForm.cooldown_minutes === "" ? null : Number(ruleForm.cooldown_minutes),
      };
      if (editingRule?.id != null) await updatePushRule(editingRule.id, payload);
      else await createPushRule(payload);
      const response = await listPushRules();
      setPushRules(Array.isArray(response) ? response : response?.rows || response?.items || response?.rules || []);
      setRuleDialog(false);
      setMessage("Regra salva. Nenhuma notificação foi enviada.");
    } catch (saveError) {
      setError(friendlyError(saveError));
    } finally {
      setBusy(false);
    }
  };

  const seedRules = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await seedDefaultPushRules();
      const rows = await listPushRules();
      setPushRules(Array.isArray(rows) ? rows : rows?.rows || rows?.items || rows?.rules || []);
      setMessage(`Modelos padrão restaurados: ${response?.created_count ?? 0}. Nenhuma notificação foi enviada.`);
    } catch (seedError) {
      setError(friendlyError(seedError));
    } finally {
      setBusy(false);
    }
  };

  const openEmail = (template) => {
    if (template.editable !== true) return;
    setEditingEmail(template);
    setEmailForm({
      name: template.name || "",
      description: template.description || "",
      subject_template: template.subject_template || "",
      text_template: template.text_template || template.default_message || "",
      html_template: template.html_template || "",
      is_active: template.is_active !== false,
    });
    setEmailDialog(true);
  };

  const saveEmail = async () => {
    if (!editingEmail?.id) return;
    setBusy(true);
    setError("");
    try {
      await updateNotificationTemplate(editingEmail.id, emailForm);
      setCatalog((current) => ({ ...current, channels: { ...current.channels, email: { ...current.channels.email, templates: current.channels.email.templates.map((item) => item.id === editingEmail.id ? { ...item, ...emailForm } : item) } } }));
      setEmailDialog(false);
      setMessage("Modelo de e-mail atualizado.");
    } catch (saveError) {
      setError(friendlyError(saveError));
    } finally {
      setBusy(false);
    }
  };

  const channelTemplates = React.useMemo(() => {
    if (subtab === "push") return pushRules;
    const backendTemplates = catalog?.channels?.[subtab]?.templates || [];
    return subtab === "whatsapp"
      ? connectedBrevoWhatsAppTemplates(backendTemplates)
      : backendTemplates;
  }, [catalog, pushRules, subtab]);
  const remainingEmailTemplates = React.useMemo(
    () => channelTemplates.filter(isRemainingEmailTemplate),
    [channelTemplates]
  );

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 900 }}>Catálogo de modelos</Typography>
        <Typography variant="body2" color="text.secondary">Consulte conteúdos disponíveis e administre somente o que o backend marca como editável.</Typography>
      </Box>
      <Paper variant="outlined" sx={{ borderRadius: 2, p: 0.5 }}>
        <Tabs value={subtab} onChange={(_, value) => setSubtab(value)} variant="scrollable" scrollButtons="auto">
          <Tab value="whatsapp" label="WhatsApp" />
          <Tab value="push" label="Push" />
          <Tab value="email" label="E-mail" />
        </Tabs>
      </Paper>
      {subtab === "whatsapp" && <Alert severity="info">O conteúdo aprovado é administrado na Brevo e não pode ser editado diretamente nesta tela.</Alert>}
      {subtab === "push" && <Alert severity="warning">Salvar uma regra altera apenas os próximos eventos automáticos. Nenhuma notificação é enviada ao salvar.</Alert>}
      {subtab === "email" && !loading && remainingEmailTemplates.length === 0 && (
        <Alert severity="info">Nenhum modelo de aviso de números restantes foi encontrado.</Alert>
      )}
      {error && <Alert severity="error">{error}</Alert>}
      {message && <Alert severity="success">{message}</Alert>}
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
        <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>{channelTemplates.length} modelo(s)</Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button variant="outlined" startIcon={loading ? <CircularProgress size={16} /> : <RefreshRoundedIcon />} onClick={load} disabled={loading || busy}>Atualizar</Button>
          {subtab === "whatsapp" && <Button variant="contained" startIcon={<SyncRoundedIcon />} onClick={syncWhatsapp} disabled={busy}>Sincronizar templates da Brevo</Button>}
          {subtab === "push" && <><Button variant="outlined" onClick={seedRules} disabled={busy}>Restaurar modelos padrão</Button><Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => openRule()}>Nova regra</Button></>}
        </Stack>
      </Stack>
      {loading ? <Stack alignItems="center" sx={{ py: 8 }}><CircularProgress /></Stack> : channelTemplates.length ? (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
          {channelTemplates.map((template) => {
            const remainingEmail = subtab === "email" && isRemainingEmailTemplate(template);
            return (
              <TemplateCard
                key={templateKey(template)}
                template={template}
                channel={subtab}
                busy={busy}
                onToggle={subtab === "whatsapp" && template.id != null ? toggleTemplate : null}
                onEdit={subtab === "push" ? openRule : subtab === "email" && template.editable === true ? openEmail : null}
                onUseTemplate={remainingEmail ? onUseTemplate : null}
                onSendAll={remainingEmail ? onSendAll : null}
              />
            );
          })}
        </Box>
      ) : (
        <Alert severity="info">
          {subtab === "whatsapp"
            ? "Nenhum template Brevo conectado foi encontrado. Sincronize os templates ou verifique a configuração do backend."
            : "Nenhum modelo disponível neste canal."}
        </Alert>
      )}

      <Dialog open={ruleDialog} onClose={() => !busy && setRuleDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingRule ? "Editar regra Push" : "Nova regra Push"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info">Esta edição não executa a regra nem envia Push.</Alert>
            <TextField label="Event key" required value={ruleForm.event_key} disabled={Boolean(editingRule)} onChange={(event) => setRuleForm((form) => ({ ...form, event_key: event.target.value }))} />
            <TextField label="Nome" value={ruleForm.name} onChange={(event) => setRuleForm((form) => ({ ...form, name: event.target.value }))} />
            <TextField label="Descrição" value={ruleForm.description} onChange={(event) => setRuleForm((form) => ({ ...form, description: event.target.value }))} />
            <TextField label="Título" required value={ruleForm.title_template} onChange={(event) => setRuleForm((form) => ({ ...form, title_template: event.target.value }))} helperText={`${ruleForm.title_template.length}/100`} inputProps={{ maxLength: 100 }} />
            <TextField label="Mensagem" required multiline minRows={3} value={ruleForm.body_template} onChange={(event) => setRuleForm((form) => ({ ...form, body_template: event.target.value }))} helperText={`${ruleForm.body_template.length}/260`} inputProps={{ maxLength: 260 }} />
            <TextField label="URL" value={ruleForm.url_template} onChange={(event) => setRuleForm((form) => ({ ...form, url_template: event.target.value }))} />
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" }, gap: 2 }}>
              <FormControl><InputLabel>Categoria</InputLabel><Select label="Categoria" value={ruleForm.category} onChange={(event) => setRuleForm((form) => ({ ...form, category: event.target.value }))}><MenuItem value="operational">operational</MenuItem></Select></FormControl>
              <TextField label="Threshold" type="number" value={ruleForm.threshold_value} onChange={(event) => setRuleForm((form) => ({ ...form, threshold_value: event.target.value }))} />
              <TextField label="Cooldown (minutos)" type="number" value={ruleForm.cooldown_minutes} onChange={(event) => setRuleForm((form) => ({ ...form, cooldown_minutes: event.target.value }))} />
            </Box>
            <FormControlLabel control={<Checkbox checked={ruleForm.is_active} onChange={(event) => setRuleForm((form) => ({ ...form, is_active: event.target.checked }))} />} label="Regra ativa" />
            {editingRule?.updated_at && <Typography variant="caption" color="text.secondary">Atualizada em {formatDate(editingRule.updated_at)}</Typography>}
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setRuleDialog(false)} disabled={busy}>Cancelar</Button><Button variant="contained" onClick={saveRule} disabled={busy}>{busy ? "Salvando..." : "Salvar regra"}</Button></DialogActions>
      </Dialog>

      <Dialog open={emailDialog} onClose={() => !busy && setEmailDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Editar modelo de e-mail</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ pt: 1 }}><TextField label="Nome" value={emailForm.name} onChange={(event) => setEmailForm((form) => ({ ...form, name: event.target.value }))} /><TextField label="Descrição" value={emailForm.description} onChange={(event) => setEmailForm((form) => ({ ...form, description: event.target.value }))} /><TextField label="Assunto" value={emailForm.subject_template} onChange={(event) => setEmailForm((form) => ({ ...form, subject_template: event.target.value }))} /><TextField label="Texto" multiline minRows={4} value={emailForm.text_template} onChange={(event) => setEmailForm((form) => ({ ...form, text_template: event.target.value }))} /><TextField label="HTML" multiline minRows={6} value={emailForm.html_template} onChange={(event) => setEmailForm((form) => ({ ...form, html_template: event.target.value }))} /><FormControlLabel control={<Checkbox checked={emailForm.is_active} onChange={(event) => setEmailForm((form) => ({ ...form, is_active: event.target.checked }))} />} label="Modelo ativo" /></Stack></DialogContent>
        <DialogActions><Button onClick={() => setEmailDialog(false)} disabled={busy}>Cancelar</Button><Button variant="contained" onClick={saveEmail} disabled={busy}>{busy ? "Salvando..." : "Salvar modelo"}</Button></DialogActions>
      </Dialog>
    </Stack>
  );
}
