// src/components/DeveloperWatermark.jsx
//
// Assinatura institucional "Desenvolvido por Tironi Tech" no RODAPÉ das
// áreas PÚBLICAS da NewStore (sorteios + Loja NS). Não aparece em /admin:
// o painel é ferramenta interna, não vitrine.
//
// Montada uma única vez em App.js (mesmo ponto do PushPermissionPrompt),
// depois das <Routes> — entra no fluxo do documento, não sobrepõe a página.
//
// Decisões de segurança visual:
//   estilos inline        -> cada página monta seu próprio ThemeProvider, e
//                            este componente vive FORA deles. Usar as cores
//                            literais já praticadas no projeto (#0E0E0E,
//                            #67C23A, #FFC107) mantém a identidade sem
//                            depender de um tema que aqui não existe.

import * as React from "react";
import { useLocation } from "react-router-dom";

// Paleta já usada pela NewStore (ver createTheme das páginas: primary #67C23A,
// secondary #FFC107, background.default #0E0E0E).
const VERDE = "#67C23A";
const DOURADO = "#FFC107";
const CARVAO = "#0E0E0E";

const footerStyle = {
  width: "100%",
  marginTop: "auto",
  padding: "18px 16px calc(18px + env(safe-area-inset-bottom, 0px))",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  borderTop: `1px solid ${VERDE}33`,
  background: CARVAO,
  boxSizing: "border-box",
  fontFamily: ["Inter", "system-ui", "Segoe UI", "Roboto", "Arial"].join(","),
  lineHeight: 1,
};

const monogramStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 22,
  height: 22,
  borderRadius: 7,
  flexShrink: 0,
  background: `linear-gradient(135deg, ${VERDE}, ${DOURADO})`,
  color: CARVAO,
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.5,
};

const textStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  whiteSpace: "nowrap",
  fontSize: 12,
  letterSpacing: 0.2,
};

const prefixStyle = { color: "rgba(255,255,255,0.62)", fontWeight: 500 };
const brandStyle = { color: "#FFFFFF", fontWeight: 800 };

/** true quando a rota atual é do painel administrativo. */
export function isAdminPath(pathname) {
  const p = String(pathname || "");
  return p === "/admin" || p.startsWith("/admin/");
}

export default function DeveloperWatermark() {
  const { pathname } = useLocation();
  if (isAdminPath(pathname)) return null;

  return (
    <footer style={footerStyle} data-testid="developer-watermark">
      <span style={monogramStyle} aria-hidden="true">
        TT
      </span>
      <span style={textStyle}>
        <span style={prefixStyle}>Desenvolvido por</span>
        <span style={brandStyle}>Tironi Tech</span>
      </span>
    </footer>
  );
}
