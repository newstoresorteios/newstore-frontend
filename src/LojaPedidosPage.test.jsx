// Testes de "Meus Pedidos" (/loja/pedidos).
// Execute com: npm test

import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock(
  'react-router-dom',
  () => ({
    useNavigate: () => jest.fn(),
    Link: ({ children, to, ...rest }) => (
      <a href={to} {...rest}>
        {children}
      </a>
    ),
  }),
  { virtual: true }
);

const mockUseAuth = jest.fn();
jest.mock('./authContext', () => ({ useAuth: () => mockUseAuth() }));

jest.mock('./services/redemptions', () => {
  const actual = jest.requireActual('./services/redemptions');
  return { ...actual, listMyRedemptions: jest.fn() };
});

jest.mock('./services/nscredits', () => {
  const actual = jest.requireActual('./services/nscredits');
  return { ...actual, getMyNsCredits: jest.fn() };
});

// A página vive dentro do LojaShell, que monta o carrinho.
jest.mock('./services/rewardCart', () => {
  const actual = jest.requireActual('./services/rewardCart');
  return {
    ...actual,
    getCart: jest.fn(() =>
      Promise.resolve({ cart: { id: null, items: [], totals: { items: 0, units: 0, nscredits: 0 } } })
    ),
    addCartItem: jest.fn(),
    updateCartItem: jest.fn(),
    removeCartItem: jest.fn(),
    clearCart: jest.fn(),
    validateCart: jest.fn(),
  };
});

import { listMyRedemptions } from './services/redemptions';
import { getMyNsCredits } from './services/nscredits';
import LojaPedidosPage from './LojaPedidosPage';

function renderPage() {
  return render(<LojaPedidosPage />);
}

beforeEach(() => {
  jest.clearAllMocks();
  getMyNsCredits.mockResolvedValue({ wallet: { balance: 500 } });
  mockUseAuth.mockReturnValue({ user: { id: 42, name: 'Joao', is_admin: false }, loading: false });
});

it('visitante nao autenticado ve convite para entrar', async () => {
  mockUseAuth.mockReturnValue({ user: null, loading: false });
  renderPage();

  expect(await screen.findByText(/Entre na sua conta/i)).toBeInTheDocument();
  expect(listMyRedemptions).not.toHaveBeenCalled();
});

it('lista vazia mostra CTA para a vitrine, nao erro', async () => {
  listMyRedemptions.mockResolvedValue({ items: [], paging: { page: 1, limit: 50, total: 0 } });
  renderPage();

  expect(await screen.findByText(/ainda não tem nenhum pedido/i)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /VER PRÊMIOS/i })).toHaveAttribute('href', '/loja');
});

it('erro ao carregar mostra mensagem tratada e opcao de tentar de novo', async () => {
  listMyRedemptions.mockRejectedValue(new Error('internal_error:500'));
  renderPage();

  expect(await screen.findByRole('button', { name: /Tentar de novo/i })).toBeInTheDocument();
});

it('lista os pedidos com status legivel, inclusive o estado bloqueado da Fase E', async () => {
  listMyRedemptions.mockResolvedValue({
    items: [
      { id: 'aaaa1111-bbbb', credits_amount: 1500, status: 'blocked_tray_contract_pending', created_at: '2026-08-18T12:00:00.000Z' },
      { id: 'cccc2222-dddd', credits_amount: 500, status: 'reconciliation_required', created_at: '2026-08-17T10:00:00.000Z' },
    ],
    paging: { page: 1, limit: 50, total: 2 },
  });
  renderPage();

  expect(await screen.findByText(/1\.500 NSCréditos/)).toBeInTheDocument();
  expect(screen.getByText('Aguardando liberação do resgate real')).toBeInTheDocument();
  expect(screen.getByText('Em verificação')).toBeInTheDocument();
  expect(screen.getByText(/créditos foram devolvidos integralmente/i)).toBeInTheDocument();
});

it('pedido confirmado mostra o numero do pedido Tray', async () => {
  listMyRedemptions.mockResolvedValue({
    items: [{ id: 'conf-1', credits_amount: 200, status: 'confirmed', tray_order_id: '778899', created_at: '2026-08-18T12:00:00.000Z' }],
    paging: { page: 1, limit: 50, total: 1 },
  });
  renderPage();

  expect(await screen.findByText('Confirmado')).toBeInTheDocument();
  expect(screen.getByText('Pedido #778899')).toBeInTheDocument();
});

it('reconciliation_required mostra aviso para nao tentar de novo', async () => {
  listMyRedemptions.mockResolvedValue({
    items: [{ id: 'rec-1', credits_amount: 300, status: 'reconciliation_required', created_at: '2026-08-18T12:00:00.000Z' }],
    paging: { page: 1, limit: 50, total: 1 },
  });
  renderPage();

  expect(await screen.findByText(/não tente resgatar de novo/i)).toBeInTheDocument();
});

it('cliente Tray nao mapeado mostra status e devolucao de creditos', async () => {
  listMyRedemptions.mockResolvedValue({
    items: [{ id: 'unm-1', credits_amount: 400, status: 'blocked_tray_customer_unmapped', created_at: '2026-08-18T12:00:00.000Z' }],
    paging: { page: 1, limit: 50, total: 1 },
  });
  renderPage();

  expect(await screen.findByText(/Não foi possível localizar seu cadastro/i)).toBeInTheDocument();
  expect(screen.getByText(/créditos foram devolvidos integralmente/i)).toBeInTheDocument();
});

it('nunca mostra "confirmado" quando o backend nao confirmou', async () => {
  listMyRedemptions.mockResolvedValue({
    items: [{ id: 'x1', credits_amount: 100, status: 'blocked_tray_contract_pending', created_at: '2026-08-18T12:00:00.000Z' }],
    paging: { page: 1, limit: 50, total: 1 },
  });
  renderPage();

  await screen.findByText(/100 NSCréditos/);
  expect(screen.queryByText(/^Confirmado$/)).not.toBeInTheDocument();
});
