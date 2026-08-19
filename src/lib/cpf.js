// src/lib/cpf.js
//
// CPF e exigido pela Tray pra criar Customer nesta loja (M7.1, provado via
// teste controlado real). Esta validacao aqui e so UX -- o backend
// (rewardProfile.js) sempre revalida e e a fonte da verdade.
//
// Nunca usar Number() em CPF -- e uma string, perderia zeros a esquerda.

/** Somente os digitos. */
export function normalizeCPF(raw) {
  return String(raw ?? "").replace(/\D/g, "");
}

/** 123.456.789-01 -- formatacao visual enquanto o usuario digita. */
export function formatCPFInput(raw) {
  const d = normalizeCPF(raw).slice(0, 11);
  const parts = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)].filter(Boolean);
  let out = parts.join(".");
  if (d.length > 9) out += `-${d.slice(9, 11)}`;
  return out;
}

/** ***.***.***-01 -- so os dois digitos verificadores ficam visiveis. */
export function maskCPF(raw) {
  const d = normalizeCPF(raw);
  if (d.length !== 11) return null;
  return `***.***.***-${d.slice(9)}`;
}

/**
 * Validacao real de CPF: 11 digitos, rejeita sequencias repetidas, confere
 * os dois digitos verificadores pelo algoritmo oficial. Mesma logica de
 * src/services/rewardProfile.js no backend.
 */
export function isValidCPF(raw) {
  const d = normalizeCPF(raw);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;

  const nums = d.split("").map(Number);

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += nums[i] * (10 - i);
  let rem = sum % 11;
  const d10 = rem < 2 ? 0 : 11 - rem;
  if (d10 !== nums[9]) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += nums[i] * (11 - i);
  rem = sum % 11;
  const d11 = rem < 2 ? 0 : 11 - rem;
  if (d11 !== nums[10]) return false;

  return true;
}
