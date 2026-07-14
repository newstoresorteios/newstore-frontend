export const CHANNEL_LABELS = {
  whatsapp: "WhatsApp",
  push: "Push",
  email: "E-mail",
  inbound: "Mensagens recebidas",
};

export const ERROR_LABELS = {
  no_active_push_recipients: "Nenhum dispositivo Push ativo",
  "push_subscription_gone_or_expired:410": "Subscription expirada e desativada",
  push_subscription_gone_or_expired: "Subscription expirada e desativada",
  rule_inactive_or_not_found: "Regra inativa ou não encontrada",
  manual_bulk_confirmation_required: "Confirmação de envio em lote necessária",
  manual_recipients_required: "Selecione pelo menos um destinatário",
  manual_too_many_recipients: "O limite é de 50 usuários por envio",
  manual_push_url_invalid: "A URL deve ser um caminho interno válido",
  manual_template_not_found: "Modelo não encontrado",
  manual_template_not_allowed: "Este modelo é reservado ao uso automático do sistema",
  manual_email_smtp_not_configured: "SMTP não configurado",
  manual_push_no_eligible_recipients: "Nenhum dispositivo Push elegível",
  manual_email_no_valid_recipients: "Nenhum e-mail válido",
};

export function friendlyError(value, fallback = "Não foi possível concluir a operação.") {
  const code = String(value?.code || value?.error || value?.message || value || "").trim();
  if (!code) return fallback;
  if (ERROR_LABELS[code]) return ERROR_LABELS[code];
  const known = Object.keys(ERROR_LABELS).find((key) => code.includes(key));
  return known ? ERROR_LABELS[known] : code;
}

export function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("pt-BR");
}

export function asList(value, keys = []) {
  if (Array.isArray(value)) return value;
  for (const key of keys) {
    if (Array.isArray(value?.[key])) return value[key];
  }
  return [];
}

export function templateKey(template) {
  return String(template?.template_key || template?.event_key || template?.id || "");
}

export function templateName(template) {
  return template?.name || template?.description || templateKey(template) || "Modelo sem nome";
}

export function isConnectedBrevoWhatsAppTemplate(template) {
  const providerTemplateId = Number(template?.provider_template_id);
  return template?.provider === "brevo"
    && Number.isInteger(providerTemplateId)
    && providerTemplateId > 0
    && template?.sendable !== false
    && template?.available !== false;
}

export function connectedBrevoWhatsAppTemplates(templates) {
  return Array.isArray(templates)
    ? templates.filter(isConnectedBrevoWhatsAppTemplate)
    : [];
}

export function templateLanguageLabel(template) {
  const language = String(template?.language || template?.template_language || "").trim();
  const normalized = language.replace("-", "_").toLowerCase();
  if (normalized === "pt_br" || normalized === "pt_pt" || normalized === "pt") return "Português";
  if (normalized === "en_us" || normalized === "en_gb" || normalized === "en") return "Inglês";
  if (normalized === "es_es" || normalized === "es" || normalized.startsWith("es_")) return "Espanhol";
  return language || "Idioma não informado";
}

export function manualSendBlockReasonLabel(value) {
  const reason = String(value || "").trim();
  if (reason === "system_only_template") {
    return "Template reservado aos fluxos automáticos do sistema";
  }
  return reason || "Uso manual não permitido pelo backend";
}

export function sourceLabel(value) {
  const source = String(value || "").toLowerCase();
  if (["manual", "admin_manual"].includes(source)) return "Manual";
  if (["test", "dry_run"].includes(source)) return "Teste";
  if (["automatic", "automation", "engine", "scanner", "push_rule"].includes(source)) return "Automático";
  return value || "Automático";
}
