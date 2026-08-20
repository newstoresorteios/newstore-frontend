// src/services/rewardProfile.js
//
// Completude de perfil exigida para o resgate por NSCréditos: a Tray
// exige birth_date E cpf para criar um Customer nesta loja (backend:
// rewardProfile.js -- cpf provado obrigatorio via teste controlado real,
// M7.1). Mesmo padrão do telefone em /conta -- pede uma vez quando falta,
// salva, reutiliza depois.

import { apiJoin, authHeaders } from "../lib/api";

async function request(path, opts = {}) {
  const r = await fetch(apiJoin(path), {
    method: opts.method || "GET",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}), ...authHeaders() },
    credentials: "omit",
    body:
      opts.body == null
        ? undefined
        : typeof opts.body === "string"
        ? opts.body
        : JSON.stringify(opts.body),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    const err = new Error(text || `${r.status}`);
    err.status = r.status;
    throw err;
  }
  return r.json();
}

/** Perfil do usuario autenticado, incluindo completude para o resgate Loja NS. */
export async function getMyProfile() {
  const json = await request("/me");
  return json.user || null;
}

/** Salva a data de nascimento (YYYY-MM-DD) exigida pela Tray para criar o Customer. */
export async function updateMyBirthDate(birthDate) {
  const json = await request("/me/birth-date", { method: "PATCH", body: { birth_date: birthDate } });
  return json.profile || null;
}

/**
 * Salva o CPF exigido por esta loja Tray para criar o Customer. Aceita
 * formatado ou so digitos -- o backend normaliza e valida (fonte da
 * verdade); aqui so repassa a string, nunca usa Number (perde zeros a
 * esquerda).
 */
export async function updateMyCpf(cpf) {
  const json = await request("/me/cpf", { method: "PATCH", body: { cpf } });
  return json.profile || null;
}
