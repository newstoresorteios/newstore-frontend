// src/App.js
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { SelectionContext } from "./selectionContext";
import NewStorePage from "./NewStorePage";
import AccountPage from "./AccountPage";
import AccountDataPage from "./AccountDataPage";
import LoginPage from "./LoginPage";
import RegisterPage from "./RegisterPage";

import { AuthProvider } from "./authContext";
import ProtectedRoute from "./ProtectedRoute";
import NonAdminRoute from "./NonAdminRoute";
import AdminRoute from "./AdminRoute";

import AdminDashboard from "./AdminDashboard";
import AdminSorteios from "./AdminSorteios";
import AdminClientes from "./AdminClientes";
import AdminVencedores from "./AdminVencedores";
import AdminUsersPage from "./AdminUsersPage";
import DrawBoardPage from "./DrawBoardPage";
import AdminOpenDrawBuyers from "./AdminOpenDrawBuyers";
import AdminAnalytics from './AdminAnalytics';
import AdminNotificationsPage from "./AdminNotificationsPage";
import AdminHistoricoSaldo from "./AdminHistoricoSaldo";
import AdminCaptivesPage from "./AdminCaptivesPage";
import AutorizacaoCativoPage from "./AutorizacaoCativoPage";
import CaptiveConfirmationPage from "./CaptiveConfirmationPage";
import LojaPage from "./LojaPage";
import LojaProdutoPage from "./LojaProdutoPage";
import LojaPedidosPage from "./LojaPedidosPage";
import LojaResgatePage from "./LojaResgatePage";
import AdminLojaPremiosPage from "./AdminLojaPremiosPage";
import PushPermissionPrompt from "./components/PushPermissionPrompt";
import DeveloperWatermark from "./components/DeveloperWatermark";

export default function App() {
  const [selecionados, setSelecionados] = React.useState([]);
  const limparSelecao = React.useCallback(() => setSelecionados([]), []);

  return (
    <AuthProvider>
      <SelectionContext.Provider value={{ selecionados, setSelecionados, limparSelecao }}>
        <BrowserRouter>
          <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
            <div style={{ flex: 1 }}>
              <Routes>
            {/* HOME só para não-admin */}
            <Route
              path="/"
              element={
                <NonAdminRoute>
                  <NewStorePage />
                </NonAdminRoute>
              }
            />

            <Route path="/cadastro" element={<RegisterPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/autorizacao-cativo" element={<AutorizacaoCativoPage />} />
            <Route path="/cativo/confirmar" element={<CaptiveConfirmationPage />} />

            {/* LOJA DE PRÊMIOS — catálogo e detalhe do produto */}
            <Route path="/loja" element={<LojaPage />} />
            <Route path="/loja/produto/:trayProductId" element={<LojaProdutoPage />} />
            <Route
              path="/loja/pedidos"
              element={
                <ProtectedRoute>
                  <LojaPedidosPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/loja/resgate"
              element={
                <ProtectedRoute>
                  <LojaResgatePage />
                </ProtectedRoute>
              }
            />

            {/* CONTA: autenticado e não-admin */}
            <Route
              path="/conta"
              element={
                <ProtectedRoute>
                  <NonAdminRoute>
                    <AccountPage />
                  </NonAdminRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/conta/dados"
              element={
                <ProtectedRoute>
                  <NonAdminRoute>
                    <AccountDataPage />
                  </NonAdminRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/me"
              element={
                <ProtectedRoute>
                  <AccountPage />
                </ProtectedRoute>
              }
            />

            {/* ADMIN (somente admin) */}
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/sorteios"
              element={
                <AdminRoute>
                  <AdminSorteios />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/clientes"
              element={
                <AdminRoute>
                  <AdminClientes />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/vencedores"
              element={
                <AdminRoute>
                  <AdminVencedores />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/historico-saldo"
              element={
                <AdminRoute>
                  <AdminHistoricoSaldo />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/AdminClientesUser"
              element={
                <AdminRoute>
                  <AdminUsersPage />
                </AdminRoute>
              }
            />
            <Route
              path="/me/draw/:id"
              element={
                <ProtectedRoute>
                  <DrawBoardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/sorteiosAtivos"
              element={
                <AdminRoute>
                  <AdminOpenDrawBuyers />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/analytics"
              element={
                <AdminRoute>
                  <AdminAnalytics />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/notificacoes"
              element={
                <AdminRoute>
                  <AdminNotificationsPage />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/cativos"
              element={
                <AdminRoute>
                  <AdminCaptivesPage />
                </AdminRoute>
              }
            />
            {/* Módulo LOJA DE PRÊMIOS NS dentro do painel /admin */}
            <Route
              path="/admin/loja-premios"
              element={
                <AdminRoute>
                  <AdminLojaPremiosPage />
                </AdminRoute>
              }
            />
              </Routes>
            </div>
            <PushPermissionPrompt />
            {/* Rodapé institucional das áreas públicas (sorteios + Loja NS).
                Entra no fluxo do documento — não sobrepõe a página.
                O próprio componente se esconde em /admin. */}
            <DeveloperWatermark />
          </div>
        </BrowserRouter>
      </SelectionContext.Provider>
    </AuthProvider>
  );
}
