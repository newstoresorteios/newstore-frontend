import React from "react";

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "28px 16px",
    background:
      "radial-gradient(circle at top left, rgba(103, 194, 58, 0.18), transparent 34%), linear-gradient(145deg, #080908 0%, #111410 48%, #070807 100%)",
    color: "#f7f7f2",
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  shell: {
    width: "100%",
    maxWidth: 720,
  },
  card: {
    border: "1px solid rgba(255, 255, 255, 0.12)",
    borderRadius: 8,
    background: "rgba(18, 20, 18, 0.94)",
    boxShadow: "0 24px 70px rgba(0, 0, 0, 0.42)",
    overflow: "hidden",
  },
  header: {
    padding: "28px 24px 18px",
    borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
  },
  eyebrow: {
    margin: "0 0 10px",
    color: "#b8d7ad",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  title: {
    margin: 0,
    fontSize: "clamp(28px, 6vw, 42px)",
    lineHeight: 1.08,
    letterSpacing: 0,
  },
  subtitle: {
    margin: "12px 0 0",
    color: "#d5dacd",
    fontSize: 16,
    lineHeight: 1.55,
  },
  body: {
    padding: 24,
  },
  message: {
    margin: 0,
    color: "#f2f4ed",
    fontSize: "clamp(18px, 4vw, 22px)",
    lineHeight: 1.55,
    whiteSpace: "pre-line",
  },
  notice: {
    marginTop: 18,
    padding: "12px 14px",
    borderRadius: 8,
    background: "rgba(103, 194, 58, 0.1)",
    border: "1px solid rgba(103, 194, 58, 0.28)",
    color: "#dff0d7",
    fontSize: 14,
  },
  actions: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
    marginTop: 22,
  },
  button: {
    width: "100%",
    minHeight: 56,
    border: 0,
    borderRadius: 8,
    padding: "14px 18px",
    color: "#071007",
    cursor: "pointer",
    fontSize: 15,
    fontWeight: 800,
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  authorizeButton: {
    background: "linear-gradient(135deg, #72d44a 0%, #4ea82f 100%)",
    boxShadow: "0 12px 24px rgba(103, 194, 58, 0.24)",
  },
  rejectButton: {
    background: "transparent",
    border: "1px solid rgba(255, 139, 139, 0.55)",
    color: "#ffd9d9",
  },
  feedback: {
    marginTop: 16,
    padding: "13px 14px",
    borderRadius: 8,
    background: "rgba(255, 255, 255, 0.07)",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    color: "#f4f4ee",
    fontSize: 14,
    lineHeight: 1.45,
  },
  details: {
    marginTop: 24,
    paddingTop: 18,
    borderTop: "1px solid rgba(255, 255, 255, 0.08)",
  },
  detailsTitle: {
    margin: "0 0 12px",
    color: "#b9beb4",
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  detailsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 10,
  },
  detailItem: {
    minHeight: 72,
    padding: "12px 13px",
    borderRadius: 8,
    background: "rgba(255, 255, 255, 0.045)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
  },
  detailLabel: {
    display: "block",
    marginBottom: 7,
    color: "#9da49a",
    fontSize: 12,
  },
  detailValue: {
    display: "block",
    color: "#f5f5ef",
    fontSize: 15,
    fontWeight: 700,
    overflowWrap: "anywhere",
  },
  footer: {
    marginTop: 14,
    color: "#8f968b",
    fontSize: 12,
    textAlign: "center",
  },
};

function getParam(searchParams, key) {
  const value = searchParams.get(key);
  return value && value.trim() ? value.trim() : "";
}

function formatQuotaValue(value) {
  if (!value) return "";

  const normalizedValue = String(value).replace(/\./g, "").replace(",", ".");
  const numericValue = Number(normalizedValue);

  if (!Number.isFinite(numericValue)) {
    return `R$ ${value}`;
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(numericValue);
}

function detailValue(value) {
  return value || "—";
}

export default function AutorizacaoCativoPage() {
  const searchParams = React.useMemo(
    () => new URLSearchParams(window.location.search),
    []
  );
  const [feedback, setFeedback] = React.useState("");

  const authorization = React.useMemo(
    () => ({
      authorizationId: getParam(searchParams, "authorizationId"),
      userId: getParam(searchParams, "userId"),
      userName: getParam(searchParams, "userName"),
      drawId: getParam(searchParams, "drawId"),
      prizeName: getParam(searchParams, "prizeName"),
      quotaValue: getParam(searchParams, "quotaValue"),
      captiveNumber: getParam(searchParams, "captiveNumber"),
      expiresAt: getParam(searchParams, "expiresAt"),
      status: getParam(searchParams, "status"),
      token: getParam(searchParams, "token"),
    }),
    [searchParams]
  );

  const displayName = authorization.userName || "[Nome do Cliente]";
  const displayPrize = authorization.prizeName || "[Nome do Prêmio]";
  const displayQuota = authorization.quotaValue
    ? formatQuotaValue(authorization.quotaValue)
    : "R$ [Valor]";
  const displayNumber = authorization.captiveNumber || "[Número]";

  function handleAuthorize() {
    // TODO: conectar a autorizacao real quando o backend estiver disponivel.
    setFeedback(
      "Sua autorização foi registrada localmente nesta prévia. A conexão real ainda será implementada."
    );
  }

  function handleReject() {
    // TODO: conectar a recusa real quando o backend estiver disponivel.
    setFeedback(
      "Sua recusa foi registrada localmente nesta prévia. A conexão real ainda será implementada."
    );
  }

  const details = [
    ["ID da autorização", authorization.authorizationId],
    ["ID do usuário", authorization.userId],
    ["ID do sorteio", authorization.drawId],
    ["Número cativo", authorization.captiveNumber],
    ["Valor da cota", authorization.quotaValue ? displayQuota : ""],
    ["Status", authorization.status],
  ];

  return (
    <main style={styles.page}>
      <section style={styles.shell} aria-labelledby="autorizacao-cativo-title">
        <div style={styles.card}>
          <header style={styles.header}>
            <p style={styles.eyebrow}>New Store Sorteios</p>
            <h1 id="autorizacao-cativo-title" style={styles.title}>
              Autorização de Participação
            </h1>
            <p style={styles.subtitle}>
              Confirme se deseja participar desta rodada com seu número cativo.
            </p>
          </header>

          <div style={styles.body}>
            <p style={styles.message}>
              {`Olá, ${displayName}! Um novo sorteio especial da New Store foi lançado: ${displayPrize}.\n\nO valor da cota para esta rodada é de ${displayQuota}.\n\nComo você possui o número cativo ${displayNumber}, gostaria de autorizar a cobrança automática no seu cartão cadastrado para garantir sua participação?`}
            </p>

            <div style={styles.notice}>
              Nenhuma cobrança será feita sem sua autorização.
            </div>

            <div style={styles.actions}>
              <button
                type="button"
                style={{ ...styles.button, ...styles.authorizeButton }}
                onClick={handleAuthorize}
              >
                SIM, AUTORIZAR
              </button>
              <button
                type="button"
                style={{ ...styles.button, ...styles.rejectButton }}
                onClick={handleReject}
              >
                NÃO PARTICIPAR DESTA RODADA
              </button>
            </div>

            {feedback ? (
              <div style={styles.feedback} role="status" aria-live="polite">
                {feedback}
              </div>
            ) : null}

            <section style={styles.details} aria-label="Dados da autorização">
              <h2 style={styles.detailsTitle}>Dados da autorização</h2>
              <div style={styles.detailsGrid}>
                {details.map(([label, value]) => (
                  <div style={styles.detailItem} key={label}>
                    <span style={styles.detailLabel}>{label}</span>
                    <span style={styles.detailValue}>{detailValue(value)}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        <footer style={styles.footer}>New Store Sorteios</footer>
      </section>
    </main>
  );
}
