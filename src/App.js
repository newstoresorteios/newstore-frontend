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
// ❌ Remova AdminRoute (não vamos usar)
// import AdminRoute from "./AdminRoute";
import RequireAdmin from "./RequireAdmin";

import AdminDashboard from "./AdminDashboard";
import AdminSorteios from "./AdminSorteios";
import AdminClientes from "./AdminClientes";
import AdminVencedores from "./AdminVencedores";

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

            {/* ADMIN: use SEMPRE RequireAdmin (espera loading terminar) */}
            <Route
              path="/admin"
              element={
                <RequireAdmin>
                  <AdminDashboard />
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/sorteios"
              element={
                <RequireAdmin>
                  <AdminSorteios />
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/clientes"
              element={
                <RequireAdmin>
                  <AdminClientes />
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/vencedores"
              element={
                <RequireAdmin>
                  <AdminVencedores />
                </RequireAdmin>
              }
            />
          </Routes>
        </BrowserRouter>
      </SelectionContext.Provider>
    </AuthProvider>
  );
}
