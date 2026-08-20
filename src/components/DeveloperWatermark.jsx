// src/components/DeveloperWatermark.jsx
//
// Assinatura institucional "Desenvolvido por Tironi Tech" nas áreas PÚBLICAS
// da NewStore (sorteios + Loja NS). Não aparece em /admin: o painel é
// ferramenta interna, não vitrine.
//
// Montada uma única vez em App.js (mesmo ponto do PushPermissionPrompt), logo
// depois das <Routes> — evita repetir o markup em cada página.
//
// Decisões de segurança visual:
//   pointer-events: none  -> nunca rouba clique de CTA, carrinho ou checkout.
//   z-index 1100          -> abaixo do drawer do carrinho (1200), do resumo
//                            flutuante de participações (1250), dos modais
//                            (1300) e do prompt de push (2000). Se algum
//                            desses aparecer, ele cobre a marca -- e não o
//                            contrário, que é a prioridade correta.
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

const wrapStyle = {
  position: "fixed",
  left: "50%",
  transform: "translateX(-50%)",
  bottom: "calc(8px + env(safe-area-inset-bottom, 0px))",
  zIndex: 1100,
  pointerEvents: "none",
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "5px 12px 5px 6px",
  borderRadius: 999,
  border: `1px solid ${VERDE}55`,
  background: `${CARVAO}D9`,
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  fontFamily: ["Inter", "system-ui", "Segoe UI", "Roboto", "Arial"].join(","),
  lineHeight: 1,
  // Nunca encostar nas bordas em telas estreitas.
  maxWidth: "calc(100vw - 16px)",
  boxSizing: "border-box",
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
  fontSize: 11,
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
    <div style={wrapStyle} data-testid="developer-watermark">
      <span style={monogramStyle} aria-hidden="true">
        TT
      </span>
      <span style={textStyle}>
        <span style={prefixStyle}>Desenvolvido por</span>
        <span style={brandStyle}>Tironi Tech</span>
      </span>
    </div>
  );
}
