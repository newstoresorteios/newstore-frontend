import * as React from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import NotificationsActiveRoundedIcon from "@mui/icons-material/NotificationsActiveRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import {
  getNotificationCatalog,
  getNotificationHealth,
  previewManualNotification,
  searchNotificationRecipients,
  sendManualNotification,
} from "../../../services/adminNotifications";
import NotificationStatusChip from "./NotificationStatusChip";
import {
  CHANNEL_LABELS,
  connectedBrevoWhatsAppTemplates,
  friendlyError,
  isRemainingEmailTemplate,
  remainingNumbersForEmailTemplate,
  templateKey,
  templateLanguageLabel,
  templateName,
} from "./notificationUi";

const STEPS = ["Canal", "Modelo", "Destinatários", "Prévia", "Confirmação"];
const CHANNELS = [
  {
    key: "whatsapp",
    title: "WhatsApp",
    description: "Envia um template aprovado da Brevo. Exige telefone válido e consentimento.",
    icon: <WhatsAppIcon />,
  },
  {
    key: "push",
    title: "Push",
    description: "Envia para dispositivos que ativaram as notificações.",
    icon: <NotificationsActiveRoundedIcon />,
  },
  {
    key: "email",
    title: "E-mail",
    description: "Envia individualmente pelo SMTP da Brevo.",
    icon: <EmailRoundedIcon />,
  },
];

const EMPTY_FORM = {
  audience: "selected",
  title: "",
  message: "",
  url: "/",
  subject: "",
  text: "",
  html: "",
  params: {},
};

function parseObject(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function renderLocalTemplate(value, params) {
  return String(value || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => String(params?.[key] ?? ""));
}

function templateParameters(template) {
  const defaults = parseObject(template?.default_params);
  const configured = template?.message_params;
  let names = [];
  if (Array.isArray(configured)) {
    names = configured.map((item) => typeof item === "string" ? item : item?.key || item?.name).filter(Boolean);
  } else {
    names = Object.keys(parseObject(configured));
  }
  const sources = [template?.default_message, template?.title_template, template?.body_template, template?.subject_template, template?.text_template, template?.html_template];
  for (const source of sources) {
    for (const match of String(source || "").matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)) names.push(match[1]);
  }
  return Array.from(new Set([...Object.keys(defaults), ...names])).map((key) => ({ key, defaultValue: defaults[key] ?? "" }));
}

function formForTemplate(template, channel, audience = "selected") {
  const defaultParams = parseObject(template?.default_params);
  return {
    ...EMPTY_FORM,
    audience,
    title: channel === "push" ? renderLocalTemplate(template?.title_template || "", defaultParams) : "",
    message: channel === "push" ? renderLocalTemplate(template?.body_template || template?.default_message || "", defaultParams) : "",
    url: channel === "push" ? renderLocalTemplate(template?.url_template || "/", defaultParams) : "/",
    subject: channel === "email" ? String(template?.subject_template || "") : "",
    text: channel === "email" ? String(template?.text_template || template?.default_message || "") : "",
    html: channel === "email" ? String(template?.html_template || "") : "",
    params: defaultParams,
  };
}

function validEmailDrawUrl(value) {
  const url = String(value || "").trim();
  return (url.startsWith("/") && !url.startsWith("//")) || url.startsWith("https://");
}

function recipientId(recipient) {
  return Number(recipient?.user_id ?? recipient?.userId ?? recipient?.id);
}

function recipientName(recipient) {
  return recipient?.name || recipient?.full_name || recipient?.fullName || recipient?.email || `Usuário ${recipientId(recipient)}`;
}

function hasPhone(recipient) {
  return Boolean(String(recipient?.phone || recipient?.whatsapp || "").trim());
}

function hasValidEmail(recipient) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(recipient?.email || "").trim());
}

function hasPush(recipient) {
  return recipient?.push_available === true || recipient?.has_active_push === true || Number(recipient?.active_push_subscriptions || recipient?.push_subscriptions || 0) > 0;
}

function whatsappAllowed(recipient) {
  return recipient?.whatsapp_can_send === true;
}

function channelAvailability(channel, catalog, health) {
  const channelCatalog = catalog?.channels?.[channel];
  const manual = health?.manual_channels?.[channel];
  const catalogEnabled = channelCatalog?.enabled !== false;
  if (channel === "whatsapp") {
    const configured = manual?.brevo_configured !== false && manual?.enabled !== false;
    return { enabled: catalogEnabled && configured, reason: "Brevo não configurada" };
  }
  if (channel === "push") {
    const configured = manual?.vapid_configured !== false && manual?.enabled !== false;
    return { enabled: catalogEnabled && configured, reason: "VAPID não configurado" };
  }
  const configured = manual?.smtp_configured !== false && manual?.enabled !== false;
  return { enabled: catalogEnabled && configured, reason: "SMTP não configurado" };
}

function Count({ label, value }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h6" sx={{ fontWeight: 900 }}>{value ?? 0}</Typography>
    </Box>
  );
}

function PreviewPanel({ preview }) {
  const commonCounts = [
    ["Usuários encontrados", preview.requested_users],
    ["Usuários elegíveis", preview.eligible_users],
  ];
  const emailCounts = [
    ["E-mails válidos", preview.valid_emails],
    ["E-mails inválidos", preview.invalid_emails],
    ["Sem e-mail", preview.missing_contact],
    ["Duplicados removidos", preview.duplicate_emails_removed],
    ["Quantidade de lotes", preview.estimated_batches],
  ];
  const pushCounts = [
    ["Dispositivos elegíveis", preview.eligible_devices],
    ["Bloqueados por consentimento", preview.blocked_by_consent],
    ["Subscriptions inativas", preview.inactive_subscriptions],
  ];
  const whatsappCounts = [
    ["Telefones válidos", preview.valid_phones],
    ["Bloqueados por consentimento", preview.blocked_by_consent],
    ["Contatos ausentes", preview.missing_contact],
  ];
  const counts = [
    ...commonCounts,
    ...(preview.channel === "email" ? emailCounts : []),
    ...(preview.channel === "push" ? pushCounts : []),
    ...(preview.channel === "whatsapp" ? whatsappCounts : []),
  ];
  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        <NotificationStatusChip status={preview.can_send ? "configured" : "error"} label={preview.can_send ? "Pronto para confirmação" : "Envio bloqueado"} />
        <Chip size="small" label={CHANNEL_LABELS[preview.channel] || preview.channel} variant="outlined" />
        <Chip size="small" label={preview.provider || "Provedor não informado"} variant="outlined" />
      </Stack>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
        {counts.map(([label, value]) => <Count key={label} label={label} value={value} />)}
      </Box>
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        <Typography variant="caption" color="text.secondary">Modelo</Typography>
        <Typography variant="body2" sx={{ fontWeight: 800 }}>{templateName(preview.template)}</Typography>
        {preview.title_preview && <><Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>Título</Typography><Typography>{preview.title_preview}</Typography></>}
        {preview.message_preview && <><Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>Mensagem</Typography><Typography sx={{ whiteSpace: "pre-wrap" }}>{preview.message_preview}</Typography></>}
        {preview.subject_preview && <><Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>Assunto</Typography><Typography>{preview.subject_preview}</Typography></>}
        {preview.text_preview && <><Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>Texto</Typography><Typography sx={{ whiteSpace: "pre-wrap" }}>{preview.text_preview}</Typography></>}
        {preview.html_preview && <><Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>HTML seguro (código)</Typography><Box component="pre" sx={{ m: 0, mt: 0.5, p: 1.5, borderRadius: 1, bgcolor: "action.hover", overflow: "auto", whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 12 }}>{preview.html_preview}</Box></>}
      </Paper>
      {Array.isArray(preview.warnings) && preview.warnings.map((warning) => <Alert severity="warning" key={String(warning)}>{friendlyError(warning)} <Typography component="span" variant="caption">({String(warning)})</Typography></Alert>)}
    </Stack>
  );
}

function ResultPanel({ result, channel, audience, onNew }) {
  const summary = result?.summary || {};
  const commonValues = [
    ["Campanha criada", result?.campaign_id || result?.campaign?.id || "-"],
    ["Usuários encontrados", result?.requested_users ?? summary.requested_users],
  ];
  const emailValues = [
    ["E-mails válidos", result?.valid_emails],
    ["Enviados", result?.sent],
    ["Aceitos pelo SMTP", result?.accepted ?? result?.sent],
    ["Falhas", result?.failed],
    ["Ignorados", result?.skipped],
    ["Duplicados removidos", result?.duplicate_emails_removed],
    ["Lotes processados", result?.batches_processed],
  ];
  const otherValues = [
    ["Usuários elegíveis", result?.eligible_users ?? summary.eligible_users],
    ["Dispositivos elegíveis", result?.eligible_devices ?? summary.eligible_devices],
    ["Enviados", result?.sent ?? summary.sent ?? summary.accepted_count],
    ["Falhas", result?.failed ?? summary.failed ?? summary.failed_count],
    ["Ignorados", result?.skipped ?? summary.skipped ?? summary.skipped_count],
  ];
  const values = [...commonValues, ...(channel === "email" ? emailValues : otherValues)];
  const acceptedLabel = channel === "whatsapp" ? "WhatsApp aceito pela Brevo" : channel === "email" ? "E-mail aceito pelo SMTP" : "Push enviado";
  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <CheckCircleRoundedIcon color="success" />
        <Typography variant="h6" sx={{ fontWeight: 900 }}>{audience === "all_with_email" ? "Campanha de e-mail criada" : acceptedLabel}</Typography>
      </Stack>
      <Alert severity="info" sx={{ mb: 2 }}>O provedor aceitou ou enviou a mensagem. Entrega e leitura, quando disponíveis, aparecem no histórico.</Alert>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
        {values.map(([label, value]) => <Count key={label} label={label} value={value ?? 0} />)}
      </Box>
      <Button variant="contained" startIcon={<RefreshRoundedIcon />} onClick={onNew} sx={{ mt: 2 }}>Novo envio</Button>
    </Paper>
  );
}

export default function ManualNotificationComposer({ initialChannel = "", initialPreset = null }) {
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [catalog, setCatalog] = React.useState(null);
  const [health, setHealth] = React.useState(null);
  const [loadingCatalog, setLoadingCatalog] = React.useState(true);
  const [catalogError, setCatalogError] = React.useState("");
  const [channel, setChannel] = React.useState(initialChannel);
  const [activeStep, setActiveStep] = React.useState(0);
  const [selectedTemplate, setSelectedTemplate] = React.useState(null);
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [recipientQuery, setRecipientQuery] = React.useState("");
  const [recipientOptions, setRecipientOptions] = React.useState([]);
  const [recipients, setRecipients] = React.useState([]);
  const [searching, setSearching] = React.useState(false);
  const [preview, setPreview] = React.useState(null);
  const [previewing, setPreviewing] = React.useState(false);
  const [previewError, setPreviewError] = React.useState("");
  const [bulkConfirmed, setBulkConfirmed] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const sendingRef = React.useRef(false);
  const [sendError, setSendError] = React.useState("");
  const [result, setResult] = React.useState(null);

  const loadCatalog = React.useCallback(async () => {
    setLoadingCatalog(true);
    setCatalogError("");
    const [catalogResult, healthResult] = await Promise.allSettled([getNotificationCatalog(), getNotificationHealth()]);
    if (catalogResult.status === "fulfilled") setCatalog(catalogResult.value);
    else setCatalogError(friendlyError(catalogResult.reason, "Não foi possível carregar os modelos."));
    if (healthResult.status === "fulfilled") setHealth(healthResult.value);
    setLoadingCatalog(false);
  }, []);

  React.useEffect(() => { loadCatalog(); }, [loadCatalog]);
  React.useEffect(() => {
    if (!initialChannel) return;
    setChannel(initialChannel);
  }, [initialChannel]);

  React.useEffect(() => {
    if (recipientQuery.trim().length < 2) {
      setRecipientOptions([]);
      return undefined;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const rows = await searchNotificationRecipients(recipientQuery.trim(), 20);
        if (active) setRecipientOptions(rows);
      } catch {
        if (active) setRecipientOptions([]);
      } finally {
        if (active) setSearching(false);
      }
    }, 300);
    return () => { active = false; window.clearTimeout(timer); };
  }, [recipientQuery]);

  const invalidatePreview = React.useCallback(() => {
    setPreview(null);
    setPreviewError("");
    setBulkConfirmed(false);
    setSendError("");
    setResult(null);
  }, []);

  React.useEffect(() => {
    const presetChannel = String(initialPreset?.channel || "");
    const presetTemplateKey = String(initialPreset?.templateKey || "");
    if (!catalog || !presetChannel || !presetTemplateKey) return;
    const template = (catalog?.channels?.[presetChannel]?.templates || []).find(
      (item) => templateKey(item) === presetTemplateKey
    );
    if (!template) return;

    invalidatePreview();
    setChannel(presetChannel);
    setSelectedTemplate(template);
    setRecipients([]);
    setRecipientQuery("");
    setForm(formForTemplate(template, presetChannel, initialPreset?.audience || "selected"));
    setActiveStep(1);
  }, [catalog, initialPreset, invalidatePreview]);

  const updateForm = (patch) => {
    invalidatePreview();
    setForm((current) => ({ ...current, ...patch }));
  };

  const connectedWhatsappTemplates = React.useMemo(
    () => connectedBrevoWhatsAppTemplates(catalog?.channels?.whatsapp?.templates),
    [catalog]
  );
  const emailAllWithEmailSupported = (catalog?.channels?.email?.audiences || []).includes("all_with_email");
  const templates = React.useMemo(() => {
    if (channel !== "whatsapp") return catalog?.channels?.[channel]?.templates || [];
    return connectedWhatsappTemplates.filter(
      (template) => template.manual_send_allowed !== false
    );
  }, [catalog, channel, connectedWhatsappTemplates]);
  const params = templateParameters(selectedTemplate);
  const remainingEmailTemplate = channel === "email" && isRemainingEmailTemplate(selectedTemplate);
  const remainingNumbers = remainingNumbersForEmailTemplate(selectedTemplate);
  const editableParams = remainingEmailTemplate
    ? params.filter(({ key }) => !["name", "remaining_numbers"].includes(key))
    : params;
  const pushTitleError = channel === "push" && (!form.title.trim() || form.title.length > 80);
  const pushMessageError = channel === "push" && (!form.message.trim() || form.message.length > 180);
  const pushUrlError = channel === "push" && (!form.url.startsWith("/") || form.url.startsWith("//"));
  const whatsappParamsValid = channel !== "whatsapp" || params.every(({ key }) => String(form.params[key] ?? "").trim());
  const emailDrawUrlError = remainingEmailTemplate && !validEmailDrawUrl(form.params.draw_url);
  const emailFieldsValid = channel !== "email" || (
    form.subject.trim() &&
    form.text.trim() &&
    (!remainingEmailTemplate || (String(form.params.draw_name || "").trim() && !emailDrawUrlError))
  );
  const modelValid = Boolean(selectedTemplate) && !pushTitleError && !pushMessageError && !pushUrlError && whatsappParamsValid && emailFieldsValid;
  const recipientsValid = ["all_active_push", "all_with_email"].includes(form.audience) || recipients.length > 0;

  React.useEffect(() => {
    if (!selectedTemplate) return;
    const selectedKey = templateKey(selectedTemplate);
    if (templates.some((template) => templateKey(template) === selectedKey)) return;
    invalidatePreview();
    setSelectedTemplate(null);
  }, [invalidatePreview, selectedTemplate, templates]);

  const chooseChannel = (value) => {
    if (!channelAvailability(value, catalog, health).enabled) return;
    invalidatePreview();
    setChannel(value);
    setSelectedTemplate(null);
    setRecipients([]);
    setForm(EMPTY_FORM);
  };

  const chooseTemplate = (key) => {
    const template = templates.find((item) => templateKey(item) === key) || null;
    invalidatePreview();
    setSelectedTemplate(template);
    if (!template) return;
    setForm((current) => formForTemplate(template, channel, current.audience));
  };

  const changeAudience = (audience) => {
    updateForm({ audience });
    if (audience !== "selected") {
      setRecipients([]);
      setRecipientQuery("");
    }
  };

  const addRecipient = (recipient) => {
    const id = recipientId(recipient);
    if (!Number.isInteger(id) || id <= 0 || recipients.some((item) => recipientId(item) === id) || recipients.length >= 50) return;
    invalidatePreview();
    setRecipients((items) => [...items, recipient]);
    setRecipientQuery("");
  };

  const removeRecipient = (id) => {
    invalidatePreview();
    setRecipients((items) => items.filter((item) => recipientId(item) !== id));
  };

  const payload = React.useMemo(() => ({
    channel,
    template_key: templateKey(selectedTemplate),
    ...(selectedTemplate?.id != null ? { template_id: selectedTemplate.id } : {}),
    audience: form.audience,
    ...(form.audience === "selected" ? { user_ids: recipients.map(recipientId) } : {}),
    ...(form.audience === "all_with_email" ? { user_ids: [] } : {}),
    title: channel === "push" ? form.title : null,
    message: channel === "push" ? form.message : null,
    subject: channel === "email" ? form.subject : null,
    html: channel === "email" ? form.html : null,
    text: channel === "email" ? form.text : null,
    url: channel === "push" ? form.url : "/",
    params: form.params,
  }), [channel, form, recipients, selectedTemplate]);

  const generatePreview = async () => {
    if (!modelValid || !recipientsValid || previewing) return;
    setPreviewing(true);
    setPreviewError("");
    setPreview(null);
    setBulkConfirmed(false);
    try {
      const response = await previewManualNotification(payload);
      setPreview(response);
    } catch (error) {
      setPreviewError(friendlyError(error, "Não foi possível gerar a prévia."));
    } finally {
      setPreviewing(false);
    }
  };

  const send = async () => {
    if (sendingRef.current || !preview?.can_send || (preview.requires_bulk_confirmation && !bulkConfirmed)) return;
    sendingRef.current = true;
    setSending(true);
    setSendError("");
    try {
      const response = await sendManualNotification({
        ...payload,
        ...(preview.requires_bulk_confirmation ? { confirm_bulk_send: true } : {}),
      });
      setResult(response);
      setBulkConfirmed(false);
    } catch (error) {
      setSendError(friendlyError(error, "Não foi possível enviar a mensagem."));
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const nextDisabled = activeStep === 0 ? !channel : activeStep === 1 ? !modelValid : activeStep === 2 ? !recipientsValid : activeStep === 3 ? !preview?.can_send : false;

  const recipientStats = {
    selected: recipients.length,
    phones: recipients.filter(hasPhone).length,
    consent: recipients.filter(whatsappAllowed).length,
    blocked: recipients.filter((item) => hasPhone(item) && !whatsappAllowed(item)).length,
    noPhone: recipients.filter((item) => !hasPhone(item)).length,
    emails: recipients.filter(hasValidEmail).length,
    noEmail: recipients.filter((item) => !String(item?.email || "").trim()).length,
    invalidEmail: recipients.filter((item) => String(item?.email || "").trim() && !hasValidEmail(item)).length,
  };

  const renderChannel = () => (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" }, gap: 2 }}>
      {CHANNELS.map((item) => {
        const availability = channelAvailability(item.key, catalog, health);
        const selected = channel === item.key;
        return (
          <Paper
            key={item.key}
            component="button"
            type="button"
            disabled={!availability.enabled || loadingCatalog}
            onClick={() => chooseChannel(item.key)}
            variant="outlined"
            sx={{ p: 2, borderRadius: 2, minHeight: 170, textAlign: "left", color: "text.primary", bgcolor: selected ? "action.selected" : "background.paper", borderColor: selected ? "primary.main" : "divider", cursor: availability.enabled ? "pointer" : "not-allowed", opacity: availability.enabled ? 1 : 0.55 }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box sx={{ color: selected ? "primary.main" : "text.secondary" }}>{item.icon}</Box>
              <NotificationStatusChip status={availability.enabled ? "configured" : "disabled"} label={availability.enabled ? "Disponível" : availability.reason} />
            </Stack>
            <Typography variant="subtitle1" sx={{ fontWeight: 900, mt: 1 }}>{item.title}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{item.description}</Typography>
          </Paper>
        );
      })}
    </Box>
  );

  const renderModel = () => (
    <Stack spacing={2}>
      <FormControl fullWidth>
        <InputLabel id="manual-template-label">Modelo</InputLabel>
        <Select id="manual-template" labelId="manual-template-label" label="Modelo" value={templateKey(selectedTemplate)} onChange={(event) => chooseTemplate(event.target.value)}>
          {templates.map((template) => (
            <MenuItem key={templateKey(template)} value={templateKey(template)} disabled={template.is_active === false}>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {templateName(template)}{template.is_active === false ? " (inativo)" : ""}
                </Typography>
                {channel === "whatsapp" && (
                  <Typography variant="caption" color="text.secondary">
                    Template Brevo #{Number(template.provider_template_id)} · {templateLanguageLabel(template)}
                  </Typography>
                )}
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {!templates.length && !loadingCatalog && (
        <Alert severity="info">
          {channel === "whatsapp"
            ? connectedWhatsappTemplates.length
              ? "Nenhum template Brevo está disponível para envio manual. Consulte os templates de uso automático na aba Modelos."
              : "Nenhum template Brevo conectado foi encontrado. Sincronize os templates ou verifique a configuração do backend."
            : "Nenhum modelo disponível para este canal."}
        </Alert>
      )}
      {channel === "push" && selectedTemplate && (
        <>
          <Alert severity="info">Usar este modelo em um envio manual não altera nem executa a regra automática.</Alert>
          <TextField label="Título" required value={form.title} onChange={(event) => updateForm({ title: event.target.value })} inputProps={{ maxLength: 80 }} error={pushTitleError} helperText={`${form.title.length}/80${!form.title.trim() ? " - Título obrigatório" : ""}`} />
          <TextField label="Mensagem" required multiline minRows={3} value={form.message} onChange={(event) => updateForm({ message: event.target.value })} inputProps={{ maxLength: 180 }} error={pushMessageError} helperText={`${form.message.length}/180${!form.message.trim() ? " - Mensagem obrigatória" : ""}`} />
          <TextField label="URL" value={form.url} onChange={(event) => updateForm({ url: event.target.value })} error={pushUrlError} helperText={pushUrlError ? "A URL deve começar com / e não pode começar com //." : "Caminho interno aberto ao tocar na notificação."} />
        </>
      )}
      {channel === "whatsapp" && selectedTemplate && (
        <>
          <Alert severity="info">O conteúdo aprovado não pode ser editado aqui. Preencha somente os parâmetros exigidos pelo template.</Alert>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary">Template Brevo</Typography>
            <Typography sx={{ fontWeight: 800 }}>
              Template Brevo #{Number(selectedTemplate.provider_template_id)} · {templateLanguageLabel(selectedTemplate)}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary">Status:</Typography>
              <NotificationStatusChip
                status={selectedTemplate.provider_status || selectedTemplate.configuration_status || "configured"}
              />
            </Stack>
            <Typography variant="body2" sx={{ mt: 1 }}>
              {selectedTemplate.description || selectedTemplate.default_message || "Conteúdo administrado na Brevo."}
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              <strong>Parâmetros:</strong> {params.map(({ key }) => key).join(", ") || "Nenhum"}
            </Typography>
          </Paper>
        </>
      )}
      {channel === "email" && selectedTemplate && (
        <>
          {remainingEmailTemplate && (
            <Alert severity="info">
              O nome é preenchido individualmente pelo backend e a quantidade pertence ao modelo escolhido.
            </Alert>
          )}
          <TextField label="Assunto" required value={form.subject} onChange={(event) => updateForm({ subject: event.target.value })} />
          <TextField label="Texto" required multiline minRows={4} value={form.text} onChange={(event) => updateForm({ text: event.target.value })} />
          <TextField label="HTML" multiline minRows={6} value={form.html} onChange={(event) => updateForm({ html: event.target.value })} helperText="O HTML será exibido como código seguro na prévia." />
          {remainingEmailTemplate && (
            <TextField
              label="Quantidade restante"
              value={`${remainingNumbers} números`}
              InputProps={{ readOnly: true }}
            />
          )}
        </>
      )}
      {selectedTemplate && editableParams.length > 0 && (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
          {editableParams.map(({ key, defaultValue }) => (
            <TextField
              key={key}
              required={channel === "whatsapp" || (remainingEmailTemplate && ["draw_name", "draw_url"].includes(key))}
              label={key === "draw_name" ? "Nome do sorteio" : key === "draw_url" ? "Link do sorteio" : key}
              value={form.params[key] ?? defaultValue}
              error={
                (channel === "whatsapp" && !String(form.params[key] ?? defaultValue).trim()) ||
                (remainingEmailTemplate && key === "draw_url" && emailDrawUrlError)
              }
              helperText={remainingEmailTemplate && key === "draw_url" && emailDrawUrlError ? "Use um caminho iniciado por / ou uma URL https://." : undefined}
              onChange={(event) => updateForm({ params: { ...form.params, [key]: event.target.value } })}
            />
          ))}
        </Box>
      )}
    </Stack>
  );

  const renderRecipients = () => (
    <Stack spacing={2}>
      {["push", "email"].includes(channel) && (
        <FormControl fullWidth>
          <InputLabel id="manual-audience-label">Audiência</InputLabel>
          <Select id="manual-audience" labelId="manual-audience-label" label="Audiência" value={form.audience} onChange={(event) => changeAudience(event.target.value)}>
            <MenuItem value="selected">{channel === "email" ? "Escolher usuários" : "Usuários selecionados"}</MenuItem>
            {channel === "push" && <MenuItem value="all_active_push">Todos com Push ativo</MenuItem>}
            {channel === "email" && emailAllWithEmailSupported && <MenuItem value="all_with_email">Todos os usuários com e-mail válido</MenuItem>}
          </Select>
        </FormControl>
      )}
      {["all_active_push", "all_with_email"].includes(form.audience) ? (
        <Alert severity="warning">
          {form.audience === "all_with_email"
            ? "A audiência será calculada pelo backend. Usuários sem e-mail válido e endereços duplicados serão ignorados."
            : "A audiência real será calculada pelo backend durante a prévia. Nenhum ID selecionado será enviado como audiência confiável."}
        </Alert>
      ) : (
        <>
          <Autocomplete
            options={recipientOptions}
            loading={searching}
            inputValue={recipientQuery}
            onInputChange={(_, value) => setRecipientQuery(value)}
            onChange={(_, value) => value && addRecipient(value)}
            filterOptions={(options) => options}
            getOptionLabel={recipientName}
            isOptionEqualToValue={(a, b) => recipientId(a) === recipientId(b)}
            renderInput={(paramsInput) => <TextField {...paramsInput} label="Buscar destinatário" placeholder="Nome, e-mail ou telefone" helperText="Digite ao menos 2 caracteres. Limite de 50 usuários." />}
            renderOption={(props, option) => (
              <li {...props} key={recipientId(option)}>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 800 }}>{recipientName(option)}</Typography>
                  <Typography variant="caption" color="text.secondary">{option.email || "Sem e-mail"} · {option.phone || "Sem telefone"}</Typography>
                  <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }} flexWrap="wrap">
                    {channel === "push" && <Chip size="small" label={hasPush(option) ? "Push disponível" : "Sem Push"} color={hasPush(option) ? "success" : "default"} />}
                    {channel === "whatsapp" && <Chip size="small" label={whatsappAllowed(option) ? "WhatsApp autorizado" : "WhatsApp bloqueado"} color={whatsappAllowed(option) ? "success" : "warning"} />}
                  </Stack>
                </Box>
              </li>
            )}
          />
          <Stack direction="row" gap={1} flexWrap="wrap">
            {recipients.map((recipient) => <Chip key={recipientId(recipient)} label={recipientName(recipient)} onDelete={() => removeRecipient(recipientId(recipient))} />)}
          </Stack>
          {!recipients.length && <Alert severity="info">Selecione ao menos um destinatário.</Alert>}
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
              <Count label="Usuários selecionados" value={recipientStats.selected} />
              {channel === "whatsapp" && <><Count label="Telefone presente" value={recipientStats.phones} /><Count label="Consentimento" value={recipientStats.consent} /><Count label="Bloqueados" value={recipientStats.blocked} /><Count label="Sem telefone" value={recipientStats.noPhone} /></>}
              {channel === "email" && <><Count label="E-mails válidos" value={recipientStats.emails} /><Count label="E-mails ausentes" value={recipientStats.noEmail} /><Count label="E-mails inválidos" value={recipientStats.invalidEmail} /></>}
            </Box>
          </Paper>
        </>
      )}
    </Stack>
  );

  const renderPreview = () => (
    <Stack spacing={2}>
      <Alert severity="info">A prévia consulta a audiência real no backend e não envia mensagens.</Alert>
      {previewError && <Alert severity="error">{previewError}</Alert>}
      {preview ? <PreviewPanel preview={preview} /> : <Alert severity="warning">Gere a prévia obrigatória antes de avançar para a confirmação.</Alert>}
      <Button variant="contained" startIcon={previewing ? <CircularProgress size={16} /> : <RefreshRoundedIcon />} onClick={generatePreview} disabled={previewing || !modelValid || !recipientsValid} sx={{ alignSelf: "flex-start" }}>
        {previewing ? "Gerando prévia..." : preview ? "Gerar nova prévia" : "Gerar prévia"}
      </Button>
    </Stack>
  );

  const renderConfirmation = () => {
    if (result) return <ResultPanel result={result} channel={channel} audience={form.audience} onNew={() => { setResult(null); setPreview(null); setBulkConfirmed(false); setRecipients([]); setActiveStep(2); }} />;
    const bulkText = form.audience === "all_active_push"
      ? `Confirmo o envio para ${preview?.eligible_users ?? 0} usuários e ${preview?.eligible_devices ?? 0} dispositivos.`
      : form.audience === "all_with_email"
        ? `Confirmo o envio para ${preview?.valid_emails ?? 0} endereços de e-mail válidos.`
      : `Confirmo o envio para ${preview?.eligible_users ?? 0} usuários.`;
    return (
      <Stack spacing={2}>
        {preview && <PreviewPanel preview={preview} />}
        {preview?.requires_bulk_confirmation ? (
          <FormControlLabel control={<Checkbox checked={bulkConfirmed} onChange={(event) => setBulkConfirmed(event.target.checked)} disabled={sending} />} label={bulkText} />
        ) : (
          <Alert severity="info">Revise a prévia acima. Este envio é destinado a um único usuário e não exige confirmação de lote.</Alert>
        )}
        {sendError && <Alert severity="error">{sendError}</Alert>}
        <Button variant="contained" size="large" startIcon={sending ? <CircularProgress size={18} /> : <SendRoundedIcon />} onClick={send} disabled={sending || !preview?.can_send || (preview?.requires_bulk_confirmation && !bulkConfirmed)} sx={{ alignSelf: { xs: "stretch", sm: "flex-start" } }}>
          {sending ? "Enviando..." : form.audience === "all_with_email" ? "Enviar e-mail para todos" : `Enviar ${CHANNEL_LABELS[channel]}`}
        </Button>
      </Stack>
    );
  };

  const content = [renderChannel, renderModel, renderRecipients, renderPreview, renderConfirmation][activeStep]();

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 900 }}>Enviar mensagem manual</Typography>
        <Typography variant="body2" color="text.secondary">Selecione o canal, personalize o modelo e confirme somente depois da prévia.</Typography>
      </Box>
      {catalogError && <Alert severity="error" action={<Button color="inherit" size="small" onClick={loadCatalog}>Tentar novamente</Button>}>{catalogError}</Alert>}
      <Stepper activeStep={activeStep} orientation={mobile ? "vertical" : "horizontal"} sx={{ py: 1 }}>
        {STEPS.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
      </Stepper>
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 2, minHeight: 320 }}>
        {loadingCatalog && activeStep === 0 ? <Stack alignItems="center" sx={{ py: 6 }}><CircularProgress /></Stack> : content}
      </Paper>
      {!result && (
        <Stack direction={{ xs: "column-reverse", sm: "row" }} justifyContent="space-between" spacing={1}>
          <Button variant="outlined" disabled={activeStep === 0 || sending} onClick={() => setActiveStep((step) => Math.max(0, step - 1))}>Voltar</Button>
          {activeStep < STEPS.length - 1 && <Button variant="contained" disabled={nextDisabled || sending} onClick={() => setActiveStep((step) => step + 1)}>Continuar</Button>}
        </Stack>
      )}
    </Stack>
  );
}
