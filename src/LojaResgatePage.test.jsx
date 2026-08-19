// Testes do fechamento do resgate (/loja/resgate).
// Execute com: npm test

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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

jest.mock('./services/nscredits', () => {
  const actual = jest.requireActual('./services/nscredits');
  return { ...actual, getMyNsCredits: jest.fn() };
});

jest.mock('./services/rewardCart', () => {
  const actual = jest.requireActual('./services/rewardCart');
  return {
    ...actual,
    getCart: jest.fn(() =>
      Promise.resolve({ cart: { id: 'cart-1', items: [], totals: { items: 0, units: 0, nscredits: 0 } } })
    ),
    addCartItem: jest.fn(),
    updateCartItem: jest.fn(),
    removeCartItem: jest.fn(),
    clearCart: jest.fn(),
    validateCart: jest.fn(),
  };
});

jest.mock('./services/checkout', () => {
  const actual = jest.requireActual('./services/checkout');
  return {
    ...actual,
    getCheckoutBootstrap: jest.fn(),
    createAddress: jest.fn(),
    prepareRedemption: jest.fn(),
    confirmRedemption: jest.fn(),
    isRewardRedemptionEnabled: jest.fn(),
  };
});

jest.mock('./services/rewardProfile', () => ({
  getMyProfile: jest.fn(),
  updateMyBirthDate: jest.fn(),
}));

import { getMyNsCredits } from './services/nscredits';
import {
  getCheckoutBootstrap,
  createAddress,
  prepareRedemption,
  confirmRedemption,
  isRewardRedemptionEnabled,
} from './services/checkout';
import { getMyProfile, updateMyBirthDate } from './services/rewardProfile';
import LojaResgatePage from './LojaResgatePage';

function addr(overrides = {}) {
  return {
    id: 'addr-1',
    recipient_name: 'Joao Pedro',
    zipcode: '01304001',
    street: 'Rua Augusta',
    number: '123',
    neighborhood: 'Consolacao',
    city: 'Sao Paulo',
    state: 'SP',
    is_default: true,
    ...overrides,
  };
}

function preparedPayload(overrides = {}) {
  return {
    items: [
      { id: 'item-1', name: 'Citizen Promaster', variant_name: 'Azul / 41', quantity: 1, current_nscredits_price: 1500, nscredits_subtotal: 1500 },
    ],
    credits_amount: 1500,
    coupon_balance_before: 2000,
    coupon_balance_after_preview: 500,
    coupon_code: 'NSU-0042-AB',
    coupon_expires_at: '2026-12-31T00:00:00.000Z',
    address: addr(),
    ...overrides,
  };
}

function renderPage() {
  return render(<LojaResgatePage />);
}

beforeEach(() => {
  jest.clearAllMocks();
  getMyNsCredits.mockResolvedValue({ wallet: { balance: 20 } });
  mockUseAuth.mockReturnValue({ user: { id: 42, name: 'Joao', is_admin: false }, loading: false });
  isRewardRedemptionEnabled.mockReturnValue(true);
  getCheckoutBootstrap.mockResolvedValue({ wallet: { balance: 20 }, addresses: [addr()] });
  prepareRedemption.mockResolvedValue(preparedPayload());
  getMyProfile.mockResolvedValue({ id: 42, name: 'Joao', email: 'joao@x.com', birth_date: '1990-01-01', profile_complete_for_reward: true, missing_reward_fields: [] });
});

it('kill-switch desligado: nao chama nenhuma API, mostra aviso honesto', async () => {
  isRewardRedemptionEnabled.mockReturnValue(false);
  renderPage();

  expect(await screen.findByText(/ainda não está disponível/i)).toBeInTheDocument();
  expect(getCheckoutBootstrap).not.toHaveBeenCalled();
});

it('visitante nao autenticado ve convite para entrar', async () => {
  mockUseAuth.mockReturnValue({ user: null, loading: false });
  renderPage();

  expect(await screen.findByText(/Entre na sua conta/i)).toBeInTheDocument();
});

it('perfil incompleto (sem birth_date): mostra COMPLETE SEUS DADOS, nunca a revisao direto', async () => {
  getMyProfile.mockResolvedValue({ id: 42, name: 'Joao', email: 'joao@x.com', birth_date: null, profile_complete_for_reward: false, missing_reward_fields: ['birth_date'] });
  renderPage();

  expect(await screen.findByText(/Complete seus dados para continuar/i)).toBeInTheDocument();
  expect(getCheckoutBootstrap).toHaveBeenCalled(); // bootstrap roda em paralelo, so a UI muda
});

it('salvar data de nascimento libera o fluxo normal sem pedir de novo', async () => {
  getMyProfile.mockResolvedValue({ id: 42, name: 'Joao', email: 'joao@x.com', birth_date: null, profile_complete_for_reward: false, missing_reward_fields: ['birth_date'] });
  updateMyBirthDate.mockResolvedValue({ birth_date: '1990-05-20', profile_complete_for_reward: true, missing_reward_fields: [] });
  renderPage();

  const input = await screen.findByLabelText(/Data de nascimento/i);
  fireEvent.change(input, { target: { value: '1990-05-20' } });
  userEvent.click(screen.getByRole('button', { name: /SALVAR E CONTINUAR/i }));

  await waitFor(() => expect(updateMyBirthDate).toHaveBeenCalledWith('1990-05-20'));
  expect(await screen.findByText('Citizen Promaster')).toBeInTheDocument();
});

it('endereco padrao ja vem selecionado e dispara a revisao automaticamente', async () => {
  renderPage();

  await waitFor(() => expect(prepareRedemption).toHaveBeenCalledWith('addr-1'));
  expect(await screen.findByText('Citizen Promaster')).toBeInTheDocument();
  expect(screen.getAllByText(/1\.500 NSCréditos/).length).toBeGreaterThan(0);
});

it('sem enderecos salvos, mostra o formulario direto', async () => {
  getCheckoutBootstrap.mockResolvedValue({ wallet: { balance: 20 }, addresses: [] });
  renderPage();

  expect(await screen.findByLabelText(/Nome do destinatário/i)).toBeInTheDocument();
  expect(prepareRedemption).not.toHaveBeenCalled();
});

it('confirmar com sucesso mostra RESGATE CONFIRMADO e nunca permite duplo clique', async () => {
  let resolveConfirm;
  confirmRedemption.mockReturnValue(new Promise((resolve) => { resolveConfirm = resolve; }));

  renderPage();
  const botao = await screen.findByRole('button', { name: /CONFIRMAR RESGATE/i });
  userEvent.click(botao);

  expect(await screen.findByText(/PROCESSANDO RESGATE/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /PROCESSANDO RESGATE/i })).toBeDisabled();
  expect(confirmRedemption).toHaveBeenCalledTimes(1);

  resolveConfirm({
    replayed: false,
    redemption: { id: 'r1', status: 'confirmed', tray_order_id: '778899', credits_amount: 1500, coupon_value_after_cents: 50000 },
  });

  expect(await screen.findByText('RESGATE CONFIRMADO')).toBeInTheDocument();
  expect(screen.getByText(/Pedido #778899/)).toBeInTheDocument();
});

it('reconciliation_required mostra tela honesta de verificacao, nunca "falhou"', async () => {
  confirmRedemption.mockResolvedValue({
    replayed: false,
    redemption: { id: 'r2', status: 'reconciliation_required', credits_amount: 1500, coupon_value_after_cents: 50000 },
  });

  renderPage();
  userEvent.click(await screen.findByRole('button', { name: /CONFIRMAR RESGATE/i }));

  expect(await screen.findByText('ESTAMOS CONFIRMANDO SEU RESGATE')).toBeInTheDocument();
  expect(screen.getByText(/Não tente novamente/i)).toBeInTheDocument();
});

it('compensado mostra devolucao dos creditos, nao um erro generico', async () => {
  confirmRedemption.mockResolvedValue({
    replayed: false,
    redemption: { id: 'r3', status: 'compensated', credits_amount: 1500, coupon_value_after_cents: 200000 },
  });

  renderPage();
  userEvent.click(await screen.findByRole('button', { name: /CONFIRMAR RESGATE/i }));

  expect(await screen.findByText('RESGATE NÃO CONCLUÍDO')).toBeInTheDocument();
  expect(screen.getByText(/foram devolvidos integralmente/i)).toBeInTheDocument();
});

it('erro de rede no confirm permite tentar de novo reusando a mesma idempotency_key', async () => {
  confirmRedemption.mockRejectedValueOnce(new Error('tray_unavailable:503'));
  confirmRedemption.mockResolvedValueOnce({
    replayed: false,
    redemption: { id: 'r4', status: 'confirmed', tray_order_id: '1', credits_amount: 1500, coupon_value_after_cents: 50000 },
  });

  renderPage();
  const botao = await screen.findByRole('button', { name: /CONFIRMAR RESGATE/i });
  userEvent.click(botao);

  await screen.findByText(/não está disponível/i);

  userEvent.click(screen.getByRole('button', { name: /CONFIRMAR RESGATE/i }));
  expect(await screen.findByText('RESGATE CONFIRMADO')).toBeInTheDocument();

  const [, keyFirst] = confirmRedemption.mock.calls[0];
  const [, keySecond] = confirmRedemption.mock.calls[1];
  expect(keyFirst).toBe(keySecond);
});
