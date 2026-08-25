// Testes de "Meus Pedidos" (/loja/pedidos).
// Execute com: npm test

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
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

jest.mock('./services/redemptions', () => {
  const actual = jest.requireActual('./services/redemptions');
  return { ...actual, listMyRedemptions: jest.fn(), getMyRedemptionTrayStatus: jest.fn() };
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

import { listMyRedemptions, getMyRedemptionTrayStatus } from './services/redemptions';
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

/* ─────────────── Acompanhamento logístico (domínio da Tray) ─────────────── */

const CONFIRMADO = {
  id: 'aaaaaaaa-1111-2222-3333-444444444444',
  credits_amount: 300,
  status: 'confirmed',
  tray_order_id: '778899',
  created_at: '2026-08-18T12:00:00.000Z',
};

function listaCom(items) {
  listMyRedemptions.mockResolvedValue({ items, paging: { page: 1, limit: 50, total: items.length } });
}

function enviado() {
  return {
    redemption_id: CONFIRMADO.id,
    available: true,
    order: { id: '778899' },
    logistics: {
      phase: 'shipped',
      label: 'Pedido enviado',
      shipment_method: 'Sedex',
      carrier: 'Correios',
      tracking_code: 'AD507735291BR',
      tracking_url: 'https://www.exemplo-loja.com.br/rastreio?cod_acesso=A4400C4741',
      shipped_at: '2026-05-28',
      estimated_delivery_at: '2026-06-17',
      updated_at: '2026-05-28 15:14:29',
      is_traceable: true,
    },
    checked_at: '2026-08-25T10:00:00.000Z',
  };
}

function recebido() {
  return {
    redemption_id: CONFIRMADO.id,
    available: true,
    order: { id: '778899' },
    logistics: {
      phase: 'received',
      label: 'Pedido recebido pela Tray',
      hint: 'Aguardando atualização da separação/envio.',
      updated_at: '2026-08-24 22:23:57',
    },
    checked_at: '2026-08-25T10:00:00.000Z',
  };
}

it('abrir a lista NAO consulta a Tray para nenhum pedido', async () => {
  listaCom([
    CONFIRMADO,
    { ...CONFIRMADO, id: 'bbbbbbbb-1111-2222-3333-444444444444', tray_order_id: '778900' },
    { ...CONFIRMADO, id: 'cccccccc-1111-2222-3333-444444444444', tray_order_id: '778901' },
    { ...CONFIRMADO, id: 'dddddddd-1111-2222-3333-444444444444', tray_order_id: '778902' },
    { ...CONFIRMADO, id: 'eeeeeeee-1111-2222-3333-444444444444', tray_order_id: '778903' },
  ]);
  renderPage();

  await screen.findAllByText('Confirmado');
  expect(getMyRedemptionTrayStatus).not.toHaveBeenCalled();
  expect(screen.getAllByRole('button', { name: /ACOMPANHAR PEDIDO/i })).toHaveLength(5);
});

it('acompanhar UM pedido faz exatamente UMA consulta, nao uma por pedido', async () => {
  listaCom([
    CONFIRMADO,
    { ...CONFIRMADO, id: 'bbbbbbbb-1111-2222-3333-444444444444', tray_order_id: '778900' },
    { ...CONFIRMADO, id: 'cccccccc-1111-2222-3333-444444444444', tray_order_id: '778901' },
    { ...CONFIRMADO, id: 'dddddddd-1111-2222-3333-444444444444', tray_order_id: '778902' },
    { ...CONFIRMADO, id: 'eeeeeeee-1111-2222-3333-444444444444', tray_order_id: '778903' },
  ]);
  getMyRedemptionTrayStatus.mockResolvedValue(recebido());
  renderPage();

  const botoes = await screen.findAllByRole('button', { name: /ACOMPANHAR PEDIDO/i });
  userEvent.click(botoes[2]);

  await waitFor(() => {
    expect(getMyRedemptionTrayStatus).toHaveBeenCalledTimes(1);
  });
  expect(getMyRedemptionTrayStatus).toHaveBeenCalledWith('cccccccc-1111-2222-3333-444444444444');
});

it('pedido sem pedido Tray nao oferece acompanhamento', async () => {
  listaCom([{ id: 'comp-1', credits_amount: 300, status: 'compensated', created_at: '2026-08-18T12:00:00.000Z' }]);
  renderPage();

  await screen.findByText(/créditos devolvidos/i);
  expect(screen.queryByRole('button', { name: /ACOMPANHAR PEDIDO/i })).not.toBeInTheDocument();
});

it('mostra os dados factuais de envio devolvidos pela Tray', async () => {
  listaCom([CONFIRMADO]);
  getMyRedemptionTrayStatus.mockResolvedValue(enviado());
  renderPage();

  userEvent.click(await screen.findByRole('button', { name: /ACOMPANHAR PEDIDO/i }));

  expect(await screen.findByText('Pedido enviado')).toBeInTheDocument();
  expect(screen.getByText('Sedex')).toBeInTheDocument();
  expect(screen.getByText('Correios')).toBeInTheDocument();
  expect(screen.getByText('AD507735291BR')).toBeInTheDocument();
  expect(screen.getByText('Enviado em').parentElement).toHaveTextContent('28/05/2026');
  expect(screen.getByText('Previsão de entrega').parentElement).toHaveTextContent('17/06/2026');
  expect(screen.getByText('Última atualização').parentElement).toHaveTextContent('28/05/2026 15:14');

  const rastrear = screen.getByRole('link', { name: /RASTREAR ENTREGA/i });
  expect(rastrear).toHaveAttribute('href', enviado().logistics.tracking_url);
  expect(rastrear).toHaveAttribute('rel', expect.stringContaining('noopener'));
  expect(rastrear).toHaveAttribute('target', '_blank');
});

it('sem informacao logistica mostra fallback honesto, nunca "em separacao"', async () => {
  listaCom([CONFIRMADO]);
  getMyRedemptionTrayStatus.mockResolvedValue(recebido());
  const { container } = renderPage();

  userEvent.click(await screen.findByRole('button', { name: /ACOMPANHAR PEDIDO/i }));

  expect(await screen.findByText('Pedido recebido pela Tray')).toBeInTheDocument();
  expect(screen.getByText(/Aguardando atualização da separação\/envio/i)).toBeInTheDocument();
  expect(container.textContent).not.toMatch(/em separação/i);
  expect(container.textContent).not.toMatch(/aguardando envio/i);
  expect(container.textContent).not.toMatch(/AGUARDANDO PAGAMENTO/i);
  // Campo sem valor não vira "Transportadora: —".
  expect(screen.queryByText('Transportadora')).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /RASTREAR ENTREGA/i })).not.toBeInTheDocument();
});

it('resgate confirmado continua confirmado quando a Tray esta fora do ar', async () => {
  listaCom([CONFIRMADO]);
  getMyRedemptionTrayStatus.mockRejectedValue(new Error('tray_unavailable:503'));
  renderPage();

  userEvent.click(await screen.findByRole('button', { name: /ACOMPANHAR PEDIDO/i }));

  expect(await screen.findByText(/Não foi possível atualizar o acompanhamento agora/i)).toBeInTheDocument();
  // O pedido NAO some e o status do resgate NAO muda.
  expect(screen.getByText('Confirmado')).toBeInTheDocument();
  expect(screen.getByText('Pedido #778899')).toBeInTheDocument();
});

it('acompanhamento indisponivel nao derruba os outros pedidos da lista', async () => {
  listaCom([CONFIRMADO, { ...CONFIRMADO, id: 'bbbbbbbb-1111-2222-3333-444444444444', tray_order_id: '778900' }]);
  getMyRedemptionTrayStatus.mockRejectedValue(new Error('500'));
  renderPage();

  const botoes = await screen.findAllByRole('button', { name: /ACOMPANHAR PEDIDO/i });
  userEvent.click(botoes[0]);

  await screen.findByText(/Não foi possível atualizar o acompanhamento agora/i);
  // O segundo pedido segue intacto, com o proprio botao ainda disponivel.
  expect(screen.getAllByText('Confirmado')).toHaveLength(2);
  expect(screen.getByText('Pedido #778900')).toBeInTheDocument();
});

it('backend sem pedido Tray responde estado factual, sem erro', async () => {
  listaCom([CONFIRMADO]);
  getMyRedemptionTrayStatus.mockResolvedValue({
    redemption_id: CONFIRMADO.id,
    available: false,
    reason: 'tray_order_not_created',
    checked_at: '2026-08-25T10:00:00.000Z',
  });
  renderPage();

  userEvent.click(await screen.findByRole('button', { name: /ACOMPANHAR PEDIDO/i }));
  expect(await screen.findByText(/ainda não gerou pedido de entrega/i)).toBeInTheDocument();
});

it('ATUALIZAR ACOMPANHAMENTO faz uma nova consulta read-only', async () => {
  listaCom([CONFIRMADO]);
  getMyRedemptionTrayStatus.mockResolvedValue(recebido());
  renderPage();

  userEvent.click(await screen.findByRole('button', { name: /ACOMPANHAR PEDIDO/i }));
  await screen.findByText('Pedido recebido pela Tray');
  expect(getMyRedemptionTrayStatus).toHaveBeenCalledTimes(1);

  getMyRedemptionTrayStatus.mockResolvedValue(enviado());
  userEvent.click(screen.getByRole('button', { name: /ATUALIZAR ACOMPANHAMENTO/i }));

  expect(await screen.findByText('Pedido enviado')).toBeInTheDocument();
  expect(getMyRedemptionTrayStatus).toHaveBeenCalledTimes(2);
});

it('o acompanhamento nunca fala em entrega sem evidencia da Tray', async () => {
  listaCom([CONFIRMADO]);
  // Pedido "FINALIZADO" na Tray continua sendo apenas ENVIADO para o cliente:
  // os campos de entrega da Tray vem vazios.
  getMyRedemptionTrayStatus.mockResolvedValue(enviado());
  const { container } = renderPage();

  userEvent.click(await screen.findByRole('button', { name: /ACOMPANHAR PEDIDO/i }));
  await screen.findByText('Pedido enviado');

  expect(container.textContent).not.toMatch(/entregue/i);
});

it('o acompanhamento fica dentro do card do proprio pedido', async () => {
  listaCom([CONFIRMADO, { ...CONFIRMADO, id: 'bbbbbbbb-1111-2222-3333-444444444444', tray_order_id: '778900' }]);
  getMyRedemptionTrayStatus.mockResolvedValue(enviado());
  renderPage();

  const botoes = await screen.findAllByRole('button', { name: /ACOMPANHAR PEDIDO/i });
  userEvent.click(botoes[0]);
  await screen.findByText('Pedido enviado');

  // O outro pedido nao ganhou bloco de acompanhamento nenhum.
  const card = screen.getByText('Pedido #778900').closest('.MuiPaper-root');
  expect(within(card).queryByText('Pedido enviado')).not.toBeInTheDocument();
  expect(within(card).getByRole('button', { name: /ACOMPANHAR PEDIDO/i })).toBeInTheDocument();
});
