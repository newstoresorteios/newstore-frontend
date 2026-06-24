import * as React from "react";
import { Alert, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import { getPushAccess, sendAdminSingleDeviceTestPush } from "../services/pushNotifications";

export default function AdminPushTestPanel() {
  const [visible, setVisible] = React.useState(false);
  const [title, setTitle] = React.useState("New Store");
  const [body, setBody] = React.useState("Teste controlado de Push.");
  const [url, setUrl] = React.useState("/me");
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState(null);

  React.useEffect(() => {
    let mounted = true;
    getPushAccess()
      .then((access) => mounted && setVisible(
        access?.ok === true &&
        access?.visible === true &&
        access?.allowed === true &&
        access?.mode === "single_device_test"
      ))
      .catch(() => mounted && setVisible(false));
    return () => { mounted = false; };
  }, []);

  if (!visible) return null;

  async function send() {
    if (!visible) return;
    setBusy(true);
    setNotice(null);
    try {
      await sendAdminSingleDeviceTestPush({ title, body, url });
      setNotice({ severity: "success", text: "Push enviado para a subscription configurada." });
    } catch (error) {
      const code = error?.code || error?.message;
      const text = code === "push_test_subscription_id_missing"
        ? "PUSH_TEST_SUBSCRIPTION_ID ainda não foi configurado."
        : code === "push_production_send_blocked"
          ? "Envio Push bloqueado em produção pelo modo de segurança."
          : "Envio bloqueado pelo modo de teste.";
      setNotice({ severity: "warning", text });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, mb: 2, borderRadius: 4 }}>
      <Stack spacing={2}>
        <Typography variant="h6" fontWeight={900}>Teste Push controlado</Typography>
        <Typography variant="body2" sx={{ opacity: 0.75 }}>
          Envia exclusivamente para PUSH_TEST_SUBSCRIPTION_ID. Não usa audiência, clientes, telefone, WhatsApp ou Brevo.
        </Typography>
        {notice && <Alert severity={notice.severity}>{notice.text}</Alert>}
        <TextField label="Título" value={title} onChange={(event) => setTitle(event.target.value)} inputProps={{ maxLength: 80 }} />
        <TextField label="Mensagem" value={body} onChange={(event) => setBody(event.target.value)} inputProps={{ maxLength: 180 }} multiline minRows={2} />
        <TextField label="URL opcional" value={url} onChange={(event) => setUrl(event.target.value)} />
        <Button variant="contained" onClick={send} disabled={busy || !title.trim() || !body.trim()} sx={{ alignSelf: "flex-start" }}>
          Enviar teste para subscription configurada
        </Button>
      </Stack>
    </Paper>
  );
}
