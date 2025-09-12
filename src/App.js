// src/App.js
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { SelectionContext } from "./selectionContext";
import NewStorePage from "./NewStorePage";
import AccountPage from "./AccountPage";
import LoginPage from "./LoginPage";

import { AuthProvider } from "./authContext";
import ProtectedRoute from "./ProtectedRoute";
import AdminRoute from "./AdminRoute";
import NonAdminRoute from "./NonAdminRoute";

import AdminDashboard from "./AdminDashboard";
import AdminSorteios from "./AdminSorteios";
import AdminClientes from "./AdminClientes";
import AdminVencedores from "./AdminVencedores";
import RegisterPage from './RegisterPage';

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

            {/* CONTA só para usuário autenticado, e nunca admin */}
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

            {/* ROTAS ADMIN (apenas admin) */}
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
          </Routes>
        </BrowserRouter>
      </SelectionContext.Provider>
    </AuthProvider>
  );
}
