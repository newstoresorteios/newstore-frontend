// Testes do acesso ao módulo LOJA DE PRÊMIOS NS a partir do painel /admin.
// Execute com: npm test

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockNavigate = jest.fn();

// react-router-dom v7 é ESM-only: o resolver do react-scripts 5 não o carrega
// em ambiente de teste.
jest.mock(
  'react-router-dom',
  () => ({
    useNavigate: () => mockNavigate,
    Link: ({ children, ...rest }) => <a {...rest}>{children}</a>,
  }),
  { virtual: true }
);

jest.mock('./authContext', () => ({
  useAuth: () => ({ logout: jest.fn(), user: { role: 'admin' } }),
}));

import AdminDashboard from './AdminDashboard';

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    })
  );
});

it('o painel /admin oferece o módulo LOJA DE PRÊMIOS NS', async () => {
  render(<AdminDashboard />);
  expect(await screen.findByText('LOJA DE PRÊMIOS NS')).toBeInTheDocument();
});

it('clicar abre o módulo dentro do /admin', async () => {
  render(<AdminDashboard />);

  const card = await screen.findByText('LOJA DE PRÊMIOS NS');
  userEvent.click(card);

  await waitFor(() => {
    expect(mockNavigate).toHaveBeenCalledWith('/admin/loja-premios');
  });
});

it('não leva para um painel administrativo separado em /loja/admin', async () => {
  render(<AdminDashboard />);

  const card = await screen.findByText('LOJA DE PRÊMIOS NS');
  userEvent.click(card);

  await waitFor(() => {
    expect(mockNavigate).toHaveBeenCalled();
  });
  mockNavigate.mock.calls.forEach(([destino]) => {
    expect(String(destino)).not.toBe('/loja/admin');
  });
});

it('os módulos administrativos existentes continuam disponíveis', async () => {
  render(<AdminDashboard />);

  await screen.findByText('LOJA DE PRÊMIOS NS');
  expect(screen.getByText(/CADASTRO E MANUTENÇÃO/)).toBeInTheDocument();
  expect(screen.getByText(/SORTEIO ATIVO/)).toBeInTheDocument();
  expect(screen.getByText('DASHBOARD - ANALISE')).toBeInTheDocument();
  expect(screen.getByText('NOTIFICAÇÕES')).toBeInTheDocument();
  expect(screen.getByText('CATIVOS')).toBeInTheDocument();
});
