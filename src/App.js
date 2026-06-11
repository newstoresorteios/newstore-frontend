// src/App.js
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { SelectionContext } from "./selectionContext";
import NewStorePage from "./NewStorePage";
import AccountPage from "./AccountPage";
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

export default function App() {
  const [selecionados, setSelecionados] = React.useState([]);
  const limparSelecao = React.useCallback(() => setSelecionados([]), []);

  return (
    <AuthProvider>
      <SelectionContext.Provider value={{ selecionados, setSelecionados, limparSelecao }}>
        <BrowserRouter>
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
          </Routes>
        </BrowserRouter>
      </SelectionContext.Provider>
    </AuthProvider>
  );
}
