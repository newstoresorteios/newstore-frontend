import React from "react";
import { postJSON } from "./lib/api";

const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: "28px 16px",
    background: "linear-gradient(145deg, #080908 0%, #111410 54%, #070807 100%)",
    color: "#f7f7f2",
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: 680,
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 8,
    background: "rgba(18,20,18,0.96)",
    boxShadow: "0 24px 70px rgba(0,0,0,0.42)",
    overflow: "hidden",
  },
  header: {
    padding: "28px 24px 18px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  eyebrow: {
    margin: "0 0 10px",
    color: "#b8d7ad",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  title: {
    margin: 0,
    fontSize: "clamp(28px, 6vw, 40px)",
    lineHeight: 1.08,
    letterSpacing: 0,
  },
  subtitle: {
    margin: "12px 0 0",
    color: "#d5dacd",
    fontSize: 16,
    lineHeight: 1.55,
  },
  body: { padding: 24 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
  },
  label: {
    display: "block",
    marginBottom: 8,
    color: "#d5dacd",
    fontSize: 14,
    fontWeight: 800,
  },
  input: {
    width: "100%",
    minHeight: 50,
    boxSizing: "border-box",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.06)",
    color: "#f7f7f2",
    padding: "0 14px",
    fontSize: 16,
    fontWeight: 700,
    outline: "none",
  },
  button: {
    minHeight: 46,
    border: 0,
    borderRadius: 8,
    padding: "11px 15px",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 900,
    letterSpacing: 0,
  },
  primaryButton: { background: "#67C23A", color: "#071007" },
  declineButton: {
    background: "transparent",
    border: "1px solid rgba(255,139,139,0.55)",
    color: "#ffd9d9",
  },
  secondaryButton: { background: "rgba(255,255,255,0.1)", color: "#f7f7f2" },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 16,
  },
  feedback: {
    marginTop: 14,
    padding: "12px 14px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.07)",
    color: "#f4f4ee",
    fontSize: 14,
    lineHeight: 1.45,
  },
  error: {
    borderColor: "rgba(255,139,139,0.44)",
    background: "rgba(159,47,45,0.18)",
    color: "#ffd9d9",
  },
  item: {
    marginTop: 14,
    padding: 14,
    borderRadius: 8,
    background: "rgba(255,255,255,0.045)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  itemTitle: {
    margin: "0 0 10px",
    fontSize: 18,
    fontWeight: 900,
  },
  meta: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 8,
    color: "#d5dacd",
    fontSize: 14,
  },
  metaStrong: { display: "block", color: "#f7f7f2", fontWeight: 900, marginTop: 3 },
};

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function statusText(status) {
  if (status === "pending") return "Pendente";
  if (status === "authorized") return "Confirmada";
  if (status === "declined") return "Recusada";
  if (status === "expired") return "Expirada";
  return status || "-";
}

export default function CaptiveConfirmationPage() {
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [items, setItems] = React.useState([]);
  const [searched, setSearched] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [loading, setLoading] = React.useState("");

  const credentials = React.useMemo(() => ({
    email: email.trim().toLowerCase(),
    phone: normalizePhone(phone),
  }), [email, phone]);

  async function lookup() {
    if (!credentials.email || !credentials.phone) {
      setError("Informe e-mail e telefone cadastrados.");
      return;
    }
    setLoading("lookup");
    setError("");
    setSuccess("");
    setSearched(false);
    try {
      const payload = await postJSON("/captive-preauth/public/lookup", credentials);
      setItems(Array.isArray(payload.items) ? payload.items : []);
      setSearched(true);
    } catch {
      setItems([]);
      setSearched(true);
      setError("Não foi possível consultar confirmações agora.");
    } finally {
      setLoading("");
    }
  }

  async function decide(item, action) {
    setLoading(`${action}:${item.id}`);
    setError("");
    setSuccess("");
    try {
      const payload = await postJSON(`/captive-preauth/public/${action}`, {
        ...credentials,
        authorization_id: item.id,
      });
      const nextStatus = payload.status || (action === "authorize" ? "authorized" : "declined");
      setItems((current) => current.map((entry) => (
        entry.id === item.id ? { ...entry, status: nextStatus } : entry
      )));
      setSuccess(action === "authorize" ? "Participação confirmada com sucesso." : "Participação recusada.");
    } catch {
      setError("Não foi possível registrar sua decisão.");
    } finally {
      setLoading("");
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.card} aria-labelledby="confirmacao-cativo-title">
        <header style={styles.header}>
          <p style={styles.eyebrow}>New Store Sorteios</p>
          <h1 id="confirmacao-cativo-title" style={styles.title}>
            Confirmação de participação
          </h1>
          <p style={styles.subtitle}>
            Informe os dados cadastrados para consultar confirmações pendentes.
          </p>
        </header>

        <div style={styles.body}>
          <div style={styles.grid}>
            <div>
              <label style={styles.label} htmlFor="email">E-mail cadastrado</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                style={styles.input}
                autoComplete="email"
              />
            </div>
            <div>
              <label style={styles.label} htmlFor="phone">Telefone cadastrado</label>
              <input
                id="phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                style={styles.input}
                inputMode="tel"
                autoComplete="tel"
              />
            </div>
          </div>

          <div style={styles.actions}>
            <button
              type="button"
              style={{ ...styles.button, ...styles.secondaryButton }}
              onClick={lookup}
              disabled={Boolean(loading)}
            >
              {loading === "lookup" ? "Buscando..." : "Buscar confirmações"}
            </button>
          </div>

          {error ? <div style={{ ...styles.feedback, ...styles.error }} role="alert">{error}</div> : null}
          {success ? <div style={styles.feedback} role="status">{success}</div> : null}

          {searched && items.length === 0 && !error ? (
            <div style={styles.feedback}>Não encontramos confirmações pendentes para os dados informados.</div>
          ) : null}

          {items.map((item) => {
            const pending = item.status === "pending";
            const authorizing = loading === `authorize:${item.id}`;
            const declining = loading === `decline:${item.id}`;
            return (
              <article key={item.id} style={styles.item}>
                <h2 style={styles.itemTitle}>Número cativo {item.captive_number}</h2>
                <div style={styles.meta}>
                  <span>Referência/Sorteio <strong style={styles.metaStrong}>{item.draw_title || `Sorteio #${item.draw_id}`}</strong></span>
                  <span>Valor <strong style={styles.metaStrong}>{item.amount || "-"}</strong></span>
                  <span>Status <strong style={styles.metaStrong}>{statusText(item.status)}</strong></span>
                </div>
                {pending ? (
                  <div style={styles.actions}>
                    <button
                      type="button"
                      style={{ ...styles.button, ...styles.primaryButton }}
                      onClick={() => decide(item, "authorize")}
                      disabled={Boolean(loading)}
                    >
                      {authorizing ? "Confirmando..." : "Confirmar participação"}
                    </button>
                    <button
                      type="button"
                      style={{ ...styles.button, ...styles.declineButton }}
                      onClick={() => decide(item, "decline")}
                      disabled={Boolean(loading)}
                    >
                      {declining ? "Recusando..." : "Recusar participação"}
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
