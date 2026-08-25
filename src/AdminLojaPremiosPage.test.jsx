// Testes do módulo LOJA DE PRÊMIOS NS dentro do painel /admin.
// Execute com: npm test

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// react-router-dom v7 é ESM-only: o resolver do react-scripts 5 não o carrega
// em ambiente de teste. A página só usa useNavigate, então mockamos o módulo.
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }), { virtual: true });

jest.mock('./services/rewardStore', () => {
  const actual = jest.requireActual('./services/rewardStore');
  return {
    ...actual,
    listTrayProducts: jest.fn(),
    listTrayBrands: jest.fn(),
    listPublishedProducts: jest.fn(),
    publishProducts: jest.fn(),
    patchProduct: jest.fn(),
    syncProducts: jest.fn(),
    getTrayProduct: jest.fn(),
    getStoreStatus: jest.fn(),
  };
});

jest.mock('./services/redemptionsAdmin', () => {
  const actual = jest.requireActual('./services/redemptionsAdmin');
  return {
    ...actual,
    listRedemptions: jest.fn(),
    getRedemption: jest.fn(),
    getRedemptionTrayOrder: jest.fn(),
    getStoreReports: jest.fn(),
  };
});

jest.mock('./services/nscredits', () => {
  const actual = jest.requireActual('./services/nscredits');
  return {
    ...actual,
    searchNsCreditUsers: jest.fn(() => Promise.resolve({ items: [], paging: { page: 1, limit: 20, total: 0 } })),
    getNsCreditWallet: jest.fn(),
    applyNsCreditAdjustment: jest.fn(),
  };
});

import AdminLojaPremiosPage from './AdminLojaPremiosPage';
import { searchNsCreditUsers } from './services/nscredits';
import {
  listRedemptions,
  getRedemption,
  getRedemptionTrayOrder,
  getStoreReports,
} from './services/redemptionsAdmin';
import {
  listTrayProducts,
  listTrayBrands,
  listPublishedProducts,
  publishProducts,
  patchProduct,
  syncProducts,
  getStoreStatus,
} from './services/rewardStore';

function trayItem(overrides = {}) {
  return {
    tray_product_id: '123',
    name: 'Citizen Promaster',
    description_small: 'Relogio',
    reference: 'NY0129',
    brand: 'Citizen',
    image_url: 'https://cdn/1.jpg',
    tray_price: 4599,
    stock: 3,
    tray_available: 1,
    tray_available_in_store: 1,
    availability_text: 'Disponivel',
    availability_days: null,
    has_variation: false,
    when_stock_runs_out: 'deactivate_product',
    available: true,
    available_in_store: true,
    is_available: true,
    availability_reason: 'available',
    reward: null,
    ...overrides,
  };
}

function publishedItem(overrides = {}) {
  return {
    tray_product_id: '123',
    nscredits_price: 5000,
    is_published: true,
    display_order: 0,
    name: 'Citizen Promaster',
    reference: 'NY0129',
    brand: 'Citizen',
    image_url: null,
    images: [],
    stock: 3,
    tray_available: 1,
    tray_available_in_store: 1,
    availability_text: 'Disponivel',
    has_variation: false,
    variants: [],
    tray_price_snapshot: 4599,
    last_synced_at: '2026-08-14T06:53:32.816Z',
    is_available: true,
    availability_reason: 'available',
    ...overrides,
  };
}

const STATUS_CATALOG = [
  { status: 'confirmed', label: 'Confirmado', description: 'Pedido Tray criado.', severity: 'success' },
  { status: 'compensated', label: 'Compensado', description: 'NSCreditos devolvidos.', severity: 'neutral' },
  { status: 'reconciliation_required', label: 'Requer conciliação', description: 'Conferência manual.', severity: 'warning' },
  { status: 'failed', label: 'Falhou', description: 'Nada foi debitado.', severity: 'error' },
];

function redemptionItem(overrides = {}) {
  return {
    id: '11111111-2222-3333-4444-555555555555',
    status: 'confirmed',
    user: { id: 42, name: 'Fulano de Tal', email: 'fulano@exemplo.com' },
    credits_amount: 30000,
    item_count: 2,
    tray_order_id: '25626',
    created_at: '2026-08-21T10:00:00.000Z',
    updated_at: '2026-08-21T10:05:00.000Z',
    ...overrides,
  };
}

function redemptionDetail(overrides = {}) {
  return {
    redemption: {
      id: '11111111-2222-3333-4444-555555555555',
      status: 'confirmed',
      status_info: STATUS_CATALOG[0],
      credits_amount: 30000,
      coupon_value_before_cents: 5000000,
      coupon_value_after_cents: 2000000,
      coupon_code_snapshot: 'NSU-0418-Q4',
      failure_reason: null,
      tray_order_id: '25626',
      shipping_snapshot: null,
      created_at: '2026-08-21T10:00:00.000Z',
      updated_at: '2026-08-21T10:05:00.000Z',
    },
    user: { id: 42, name: 'Fulano de Tal', email: 'fulano@exemplo.com' },
    items: [
      {
        id: 'item-1',
        reward_product_id: 'rp-1',
        tray_product_id: '900010',
        tray_variant_id: '77',
        product_name: 'Kit Relogio',
        variant_name: 'Azul',
        image_url: null,
        quantity: 2,
        nscredits_unit_price: 15000,
        nscredits_total: 30000,
      },
    ],
    address: {
      recipient_name: 'Joao Pedro',
      zipcode: '01304001',
      street: 'Rua Augusta',
      number: '123',
      complement: null,
      neighborhood: 'Consolacao',
      city: 'Sao Paulo',
      state: 'SP',
      country: 'BR',
    },
    events: [
      { id: 1, from_status: null, to_status: 'processing', reason: null, meta: null, created_at: '2026-08-21T10:00:00.000Z' },
      { id: 2, from_status: 'processing', to_status: 'confirmed', reason: null, meta: null, created_at: '2026-08-21T10:05:00.000Z' },
    ],
    ledger: {
      entries: [
        { id: 1, event_type: 'REDEMPTION_DEBIT', operation: 'debit', delta_cents: -3000000, delta: -30000, balance_before_cents: 5000000, balance_before: 50000, balance_after_cents: 2000000, balance_after: 20000, created_at: '2026-08-21T10:01:00.000Z' },
      ],
      debit_cents: 3000000,
      debit: 30000,
      compensation_cents: 0,
      compensation: 0,
      net_cents: -3000000,
      net: -30000,
      balance_before_cents: 5000000,
      balance_after_cents: 2000000,
      expectation: 'debit_only',
      matches_expectation: true,
    },
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  listTrayBrands.mockResolvedValue({ items: ['Citizen'] });
  listPublishedProducts.mockResolvedValue({ items: [], paging: { page: 1, limit: 200, total: 0 } });
  listTrayProducts.mockResolvedValue({
    items: [trayItem()],
    paging: { page: 1, limit: 20, total: 1, maxLimit: 50 },
  });
  publishProducts.mockResolvedValue({ ok: true, published: 1, items: [] });
  syncProducts.mockResolvedValue({ ok: true, succeeded: 1, failed: 0, results: [] });
  getStoreStatus.mockResolvedValue({
    tray: { ok: true, auth_mode: 'refresh', api_host: 'www.exemplo.com.br', access_expires_at: '2026-08-14 09:00:00', last_error: null },
    catalog: { total: 1, published: 1, unpublished: 0, last_synced_at: '2026-08-14T06:53:32.816Z' },
    modules: {
      redemption_backend: { enabled: true },
      tray_orders: { orders_created: 1, last_order_at: '2026-08-21T10:00:00.000Z' },
      webhook_order: { route: 'ready', delivery: 'unverified', events_total: 0, last_event_at: null },
    },
  });
  listRedemptions.mockResolvedValue({
    items: [redemptionItem()],
    paging: { page: 1, limit: 20, total: 1, total_pages: 1 },
    statuses: STATUS_CATALOG,
  });
  getRedemption.mockResolvedValue(redemptionDetail());
  getRedemptionTrayOrder.mockResolvedValue({
    tray_order_id: '25626',
    order: {
      tray_order_id: '25626',
      status: 'AGUARDANDO PAGAMENTO',
      status_type: 'open',
      payment_method: 'NSCréditos',
      point_sale: 'LOJA NS',
      shipment: 'PENDENTE TRAY',
      shipment_value: '0.00',
      total: '299.90',
      created_at: '2026-08-21',
      updated_at: '2026-08-21 11:00:00',
      logistics: {
        phase: 'received',
        label: 'Pedido recebido pela Tray',
        hint: 'Aguardando atualização da separação/envio.',
        updated_at: '2026-08-21 11:00:00',
      },
    },
    fetched_at: '2026-08-21T12:00:00.000Z',
  });
  getStoreReports.mockResolvedValue({
    redemptions: {
      total_attempts: 3,
      confirmed_redemptions: 2,
      unique_customers: 1,
      credits_redeemed: 30000,
      tray_orders_created: 2,
      in_progress: 0,
      reconciliation_required: 1,
      compensated: 1,
      failed: 0,
      blocked: 0,
      credits_compensated: 30000,
      by_status: { confirmed: 2, compensated: 1, reconciliation_required: 1 },
    },
    recent: [redemptionItem()],
    statuses: STATUS_CATALOG,
    catalog: { total: 1, published: 1, unpublished: 0, last_synced_at: '2026-08-14T06:53:32.816Z' },
  });
});

describe('estrutura do módulo', () => {
  it('mostra o título e as seis abas', async () => {
    render(<AdminLojaPremiosPage />);

    expect(screen.getByText('Loja de Prêmios NS')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Produtos Tray' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Publicados' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'NSCréditos' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Pedidos / Resgates' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Relatórios' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Configurações' })).toBeInTheDocument();

    await screen.findByText('Citizen Promaster');
  });

  it('a aba NSCréditos abre a administração da carteira', async () => {
    render(<AdminLojaPremiosPage />);
    await screen.findByText('Citizen Promaster');

    userEvent.click(screen.getByRole('tab', { name: 'NSCréditos' }));

    expect(await screen.findByLabelText('Buscar cliente')).toBeInTheDocument();
    expect(searchNsCreditUsers).toHaveBeenCalled();
  });

  it('abre em Produtos Tray', async () => {
    render(<AdminLojaPremiosPage />);
    expect(await screen.findByText('Citizen Promaster')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /PUBLICAR SELECIONADOS/i })).toBeInTheDocument();
  });
});

describe('aba Produtos Tray', () => {
  it('mostra os dados factuais da Tray', async () => {
    render(<AdminLojaPremiosPage />);

    expect(await screen.findByText('Citizen Promaster')).toBeInTheDocument();
    expect(screen.getByText('Tray #123')).toBeInTheDocument();
    expect(screen.getByText('NY0129')).toBeInTheDocument();
    expect(screen.getByText('Disponível')).toBeInTheDocument();
    expect(screen.getByText('Não publicado')).toBeInTheDocument();
  });

  it('sinaliza produto com variações', async () => {
    listTrayProducts.mockResolvedValue({
      items: [trayItem({ has_variation: true })],
      paging: { page: 1, limit: 20, total: 1, maxLimit: 50 },
    });
    render(<AdminLojaPremiosPage />);
    expect(await screen.findByText('Possui variações')).toBeInTheDocument();
  });

  it('não publica quando os NSCréditos não são inteiro positivo', async () => {
    render(<AdminLojaPremiosPage />);

    await screen.findByText('Citizen Promaster');
    userEvent.click(screen.getByRole('checkbox'));
    userEvent.click(screen.getByRole('button', { name: /PUBLICAR SELECIONADOS/i }));

    await waitFor(() => {
      expect(screen.getByText(/inteiro maior que zero/i)).toBeInTheDocument();
    });
    expect(publishProducts).not.toHaveBeenCalled();
  });

  it('publica enviando somente a intenção administrativa', async () => {
    render(<AdminLojaPremiosPage />);

    await screen.findByText('Citizen Promaster');
    userEvent.click(screen.getByRole('checkbox'));
    userEvent.type(screen.getByLabelText('NSCréditos'), '5000');
    userEvent.click(screen.getByRole('button', { name: /PUBLICAR SELECIONADOS/i }));

    await waitFor(() => {
      expect(publishProducts).toHaveBeenCalledTimes(1);
    });
    expect(publishProducts).toHaveBeenCalledWith([{ tray_product_id: '123', nscredits_price: 5000 }]);
  });

  it('o campo NSCréditos recusa caracteres não numéricos', async () => {
    render(<AdminLojaPremiosPage />);

    await screen.findByText('Citizen Promaster');
    const field = screen.getByLabelText('NSCréditos');
    userEvent.type(field, 'ab1c2,5');

    expect(field).toHaveValue('125');
  });

  it('a busca só dispara no submit, não a cada tecla', async () => {
    render(<AdminLojaPremiosPage />);

    await screen.findByText('Citizen Promaster');
    expect(listTrayProducts).toHaveBeenCalledTimes(1);

    userEvent.type(screen.getByPlaceholderText(/Buscar produto por nome/i), 'Citizen');
    expect(listTrayProducts).toHaveBeenCalledTimes(1);

    userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => {
      expect(listTrayProducts).toHaveBeenCalledTimes(2);
    });
    expect(listTrayProducts).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'Citizen', page: 1 }));
  });

  it('Tray indisponível mostra erro recuperável sem derrubar a aba de publicados', async () => {
    listTrayProducts.mockRejectedValue(new Error('tray_unavailable:503'));
    listPublishedProducts.mockResolvedValue({ items: [publishedItem()], paging: { page: 1, limit: 200, total: 1 } });

    render(<AdminLojaPremiosPage />);

    expect(await screen.findByText(/Tray esta temporariamente indisponivel/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tentar de novo/i })).toBeInTheDocument();
    expect(await screen.findByText('5.000 NSCréditos')).toBeInTheDocument();
  });
});

describe('aba Publicados', () => {
  it('despublicar é operação local: só altera is_published', async () => {
    listPublishedProducts.mockResolvedValue({ items: [publishedItem()], paging: { page: 1, limit: 200, total: 1 } });
    patchProduct.mockResolvedValue({ ok: true, item: publishedItem({ is_published: false }) });

    render(<AdminLojaPremiosPage />);

    userEvent.click(screen.getByRole('tab', { name: 'Publicados' }));
    await screen.findByText('5.000 NSCréditos');

    userEvent.click(screen.getByRole('button', { name: 'Despublicar' }));

    await waitFor(() => {
      expect(patchProduct).toHaveBeenCalledWith('123', { is_published: false });
    });
    expect(await screen.findByText(/continua existindo normalmente na Tray/i)).toBeInTheDocument();
  });

  it('permite alterar NSCréditos e ordem de exibição', async () => {
    listPublishedProducts.mockResolvedValue({ items: [publishedItem()], paging: { page: 1, limit: 200, total: 1 } });
    patchProduct.mockResolvedValue({ ok: true, item: publishedItem({ nscredits_price: 7500 }) });

    render(<AdminLojaPremiosPage />);
    userEvent.click(screen.getByRole('tab', { name: 'Publicados' }));
    await screen.findByText('5.000 NSCréditos');

    expect(screen.getByLabelText('Ordem de exibição')).toBeInTheDocument();

    userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => {
      expect(patchProduct).toHaveBeenCalledWith('123', { nscredits_price: 5000 });
    });
  });

  it('sincronizar publicados chama o backend, não a Tray direto', async () => {
    listPublishedProducts.mockResolvedValue({ items: [publishedItem()], paging: { page: 1, limit: 200, total: 1 } });

    render(<AdminLojaPremiosPage />);
    userEvent.click(screen.getByRole('tab', { name: 'Publicados' }));
    await screen.findByText('5.000 NSCréditos');

    userEvent.click(screen.getByRole('button', { name: /Sincronizar publicados/i }));
    await waitFor(() => {
      expect(syncProducts).toHaveBeenCalledWith();
    });
  });

  it('estado vazio orienta o admin', async () => {
    render(<AdminLojaPremiosPage />);
    userEvent.click(screen.getByRole('tab', { name: 'Publicados' }));
    expect(await screen.findByText(/Nenhum produto publicado ainda/i)).toBeInTheDocument();
  });
});

describe('aba Pedidos / Resgates', () => {
  it('carrega a lista real de resgates', async () => {
    render(<AdminLojaPremiosPage />);
    userEvent.click(screen.getByRole('tab', { name: 'Pedidos / Resgates' }));

    expect(await screen.findByText('Fulano de Tal')).toBeInTheDocument();
    expect(screen.getByText('Confirmado')).toBeInTheDocument();
    expect(screen.getByText('#25626')).toBeInTheDocument();
    expect(listRedemptions).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 20 }));
  });

  it('nunca mostra CPF nem endereço na listagem', async () => {
    const { container } = render(<AdminLojaPremiosPage />);
    userEvent.click(screen.getByRole('tab', { name: 'Pedidos / Resgates' }));
    await screen.findByText('Fulano de Tal');

    expect(container.textContent).not.toMatch(/CPF|Rua Augusta|CEP/i);
  });

  it('a busca só dispara no submit', async () => {
    render(<AdminLojaPremiosPage />);
    userEvent.click(screen.getByRole('tab', { name: 'Pedidos / Resgates' }));
    await screen.findByText('Fulano de Tal');
    expect(listRedemptions).toHaveBeenCalledTimes(1);

    userEvent.type(screen.getByLabelText('Buscar resgate'), '25626');
    expect(listRedemptions).toHaveBeenCalledTimes(1);

    userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => {
      expect(listRedemptions).toHaveBeenCalledTimes(2);
    });
    expect(listRedemptions).toHaveBeenLastCalledWith(expect.objectContaining({ q: '25626', page: 1 }));
  });

  it('o filtro de status só oferece os status factuais do backend', async () => {
    render(<AdminLojaPremiosPage />);
    userEvent.click(screen.getByRole('tab', { name: 'Pedidos / Resgates' }));
    await screen.findByText('Fulano de Tal');

    userEvent.click(screen.getByLabelText('Status'));
    const options = await screen.findAllByRole('option');
    const labels = options.map((o) => o.textContent);

    expect(labels).toContain('Todos');
    expect(labels).toContain('Requer conciliação');
    // Logística é da Tray: estes estados nunca existem aqui.
    expect(labels).not.toContain('Enviados');
    expect(labels).not.toContain('Entregues');
  });

  it('pagina pelo backend', async () => {
    listRedemptions.mockResolvedValue({
      items: [redemptionItem()],
      paging: { page: 1, limit: 20, total: 45, total_pages: 3 },
      statuses: STATUS_CATALOG,
    });

    render(<AdminLojaPremiosPage />);
    userEvent.click(screen.getByRole('tab', { name: 'Pedidos / Resgates' }));
    await screen.findByText('Fulano de Tal');
    expect(screen.getByText(/Página 1 de 3 · 45 resgates/)).toBeInTheDocument();

    userEvent.click(screen.getByRole('button', { name: 'Próxima' }));
    await waitFor(() => {
      expect(listRedemptions).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    });
  });

  it('estado vazio é honesto, sem falar em módulo inexistente', async () => {
    listRedemptions.mockResolvedValue({ items: [], paging: { page: 1, limit: 20, total: 0, total_pages: 0 }, statuses: STATUS_CATALOG });

    const { container } = render(<AdminLojaPremiosPage />);
    userEvent.click(screen.getByRole('tab', { name: 'Pedidos / Resgates' }));

    expect(await screen.findByText('Nenhum resgate encontrado.')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/ainda não foi implementado|aguarda o módulo/i);
  });

  it('erro mostra mensagem tratada e opção de tentar de novo', async () => {
    listRedemptions.mockRejectedValue(new Error('tray_unavailable:503'));

    render(<AdminLojaPremiosPage />);
    userEvent.click(screen.getByRole('tab', { name: 'Pedidos / Resgates' }));

    expect(await screen.findByText(/temporariamente indisponivel/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tentar de novo/i })).toBeInTheDocument();
  });

  it('abre o detalhe com itens, endereço, timeline e ledger', async () => {
    render(<AdminLojaPremiosPage />);
    userEvent.click(screen.getByRole('tab', { name: 'Pedidos / Resgates' }));
    await screen.findByText('Fulano de Tal');

    userEvent.click(screen.getByRole('button', { name: 'Ver detalhes' }));

    expect(await screen.findByText('Kit Relogio')).toBeInTheDocument();
    expect(screen.getByText(/Tray #900010 · variação #77 · Azul/)).toBeInTheDocument();
    expect(screen.getByText('Rua Augusta, 123')).toBeInTheDocument();
    expect(screen.getByText('CEP 01304001 · BR')).toBeInTheDocument();
    expect(screen.getByTestId('redemption-timeline')).toBeInTheDocument();
    expect(screen.getByText('REDEMPTION_DEBIT')).toBeInTheDocument();
    expect(getRedemption).toHaveBeenCalledWith('11111111-2222-3333-4444-555555555555');
  });

  it('o status do pedido Tray é consultado só sob demanda, e só por leitura', async () => {
    render(<AdminLojaPremiosPage />);
    userEvent.click(screen.getByRole('tab', { name: 'Pedidos / Resgates' }));
    await screen.findByText('Fulano de Tal');

    userEvent.click(screen.getByRole('button', { name: 'Ver detalhes' }));
    await screen.findByText('Kit Relogio');
    expect(getRedemptionTrayOrder).not.toHaveBeenCalled();

    userEvent.click(screen.getByRole('button', { name: /Atualizar status/i }));
    await waitFor(() => {
      expect(getRedemptionTrayOrder).toHaveBeenCalledWith('11111111-2222-3333-4444-555555555555');
    });
    expect(await screen.findByText('AGUARDANDO PAGAMENTO')).toBeInTheDocument();
    expect(screen.getByText(/Última consulta:/)).toBeInTheDocument();
  });

  it('o admin ve a logistica normalizada da Tray junto do status cru', async () => {
    getRedemptionTrayOrder.mockResolvedValue({
      tray_order_id: '25626',
      order: {
        tray_order_id: '25626',
        status: 'ENVIADO',
        status_type: 'open',
        shipment: 'Sedex',
        shipment_value: '51.48',
        total: '299.90',
        created_at: '2026-05-27',
        updated_at: '2026-05-28 15:14:29',
        logistics: {
          phase: 'shipped',
          label: 'Pedido enviado',
          shipment_method: 'Sedex',
          carrier: 'Correios',
          tracking_code: 'AD507735291BR',
          tracking_url: 'https://www.exemplo-loja.com.br/rastreio?cod_acesso=A4400C4741',
          shipped_at: '2026-05-28',
          estimated_delivery_at: '2026-06-17',
        },
      },
      fetched_at: '2026-08-21T12:00:00.000Z',
    });

    render(<AdminLojaPremiosPage />);
    userEvent.click(screen.getByRole('tab', { name: 'Pedidos / Resgates' }));
    await screen.findByText('Fulano de Tal');
    userEvent.click(screen.getByRole('button', { name: 'Ver detalhes' }));
    await screen.findByText('Kit Relogio');
    userEvent.click(screen.getByRole('button', { name: /Atualizar status/i }));

    expect(await screen.findByText('LOGÍSTICA TRAY')).toBeInTheDocument();
    expect(screen.getByText('Pedido enviado')).toBeInTheDocument();
    expect(screen.getByText('Correios')).toBeInTheDocument();
    expect(screen.getByText('AD507735291BR')).toBeInTheDocument();
    // O status comercial cru continua visivel SO para o admin.
    expect(screen.getByText('ENVIADO')).toBeInTheDocument();

    const rastreio = screen.getByRole('link', { name: 'abrir' });
    expect(rastreio).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(rastreio).toHaveAttribute('target', '_blank');
  });

  it('campo logistico sem valor nao vira "—" no admin', async () => {
    render(<AdminLojaPremiosPage />);
    userEvent.click(screen.getByRole('tab', { name: 'Pedidos / Resgates' }));
    await screen.findByText('Fulano de Tal');
    userEvent.click(screen.getByRole('button', { name: 'Ver detalhes' }));
    await screen.findByText('Kit Relogio');
    userEvent.click(screen.getByRole('button', { name: /Atualizar status/i }));

    await screen.findByText('LOGÍSTICA TRAY');
    expect(screen.getByText('Pedido recebido pela Tray')).toBeInTheDocument();
    expect(screen.queryByText('Transportadora')).not.toBeInTheDocument();
    expect(screen.queryByText('Rastreamento')).not.toBeInTheDocument();
  });

  it('o meta técnico dos eventos nunca traz segredo', async () => {
    getRedemption.mockResolvedValue(
      redemptionDetail({
        events: [
          {
            id: 1,
            from_status: 'tray_order_pending',
            to_status: 'compensated',
            reason: 'tray_order_failed',
            meta: { http_status: 400, tray_error_code: 'tray_request_failed', tray_messages: ['Customer.cpf: [redacted]'] },
            created_at: '2026-08-21T10:05:00.000Z',
          },
        ],
      })
    );

    const { container } = render(<AdminLojaPremiosPage />);
    userEvent.click(screen.getByRole('tab', { name: 'Pedidos / Resgates' }));
    await screen.findByText('Fulano de Tal');
    userEvent.click(screen.getByRole('button', { name: 'Ver detalhes' }));

    expect(await screen.findByText('HTTP 400 · tray_request_failed')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/access_token|refresh_token|Bearer/i);
  });
});

describe('aba Relatórios', () => {
  it('mostra os números reais de resgate, sem placeholder de módulo', async () => {
    const { container } = render(<AdminLojaPremiosPage />);
    userEvent.click(screen.getByRole('tab', { name: 'Relatórios' }));

    expect(await screen.findByText('Catálogo da loja')).toBeInTheDocument();
    expect(screen.getByText('Resgates confirmados')).toBeInTheDocument();
    expect(screen.getByText('Clientes que resgataram')).toBeInTheDocument();
    expect(screen.getByText('NSCréditos resgatados')).toBeInTheDocument();
    expect(screen.getByText('Pedidos Tray')).toBeInTheDocument();

    expect(container.textContent).not.toMatch(/ainda não foi implementado/i);
    expect(container.textContent).not.toMatch(/aguarda o módulo de resgate/i);
    // Logística é da Tray — a NewStore não inventa estados de entrega.
    expect(container.textContent).not.toMatch(/Enviados|Entregues/);
  });

  it('NSCréditos resgatados usa o número confirmado, nunca a soma das tentativas', async () => {
    render(<AdminLojaPremiosPage />);
    userEvent.click(screen.getByRole('tab', { name: 'Relatórios' }));

    const card = (await screen.findByText('NSCréditos resgatados')).parentElement;
    expect(card).toHaveTextContent('30.000');
    // 60.000 seria a soma de confirmado + compensado — o erro que este card não pode cometer.
    expect(screen.queryByText('60.000')).not.toBeInTheDocument();
    expect(screen.getByText('3 tentativas no total')).toBeInTheDocument();
  });

  it('mostra os últimos resgates reais com acesso ao detalhe', async () => {
    render(<AdminLojaPremiosPage />);
    userEvent.click(screen.getByRole('tab', { name: 'Relatórios' }));

    expect(await screen.findByText('Últimos resgates')).toBeInTheDocument();
    expect(screen.getByText('Fulano de Tal')).toBeInTheDocument();
    expect(screen.getByText('Tray #25626')).toBeInTheDocument();

    userEvent.click(screen.getByRole('button', { name: 'Ver detalhes' }));
    expect(await screen.findByText('Kit Relogio')).toBeInTheDocument();
  });

  it('sem resgate nenhum os cards ficam em zero, nunca em "—"', async () => {
    getStoreReports.mockResolvedValue({
      redemptions: {
        total_attempts: 0,
        confirmed_redemptions: 0,
        unique_customers: 0,
        credits_redeemed: 0,
        tray_orders_created: 0,
        in_progress: 0,
        reconciliation_required: 0,
        compensated: 0,
        failed: 0,
        blocked: 0,
        credits_compensated: 0,
        by_status: {},
      },
      recent: [],
      statuses: STATUS_CATALOG,
      catalog: { total: 0, published: 0, unpublished: 0, last_synced_at: null },
    });

    render(<AdminLojaPremiosPage />);
    userEvent.click(screen.getByRole('tab', { name: 'Relatórios' }));

    expect(await screen.findByText('Nenhum resgate encontrado.')).toBeInTheDocument();
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(6);
  });

  it('erro no relatório é tratado, sem voltar a texto de módulo inexistente', async () => {
    getStoreReports.mockRejectedValue(new Error('500'));

    const { container } = render(<AdminLojaPremiosPage />);
    userEvent.click(screen.getByRole('tab', { name: 'Relatórios' }));

    expect(await screen.findByRole('button', { name: /Tentar de novo/i })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/aguarda o módulo/i);
  });
});

describe('aba Configurações', () => {
  it('mostra o status factual da integração Tray', async () => {
    render(<AdminLojaPremiosPage />);
    userEvent.click(screen.getByRole('tab', { name: 'Configurações' }));

    expect(await screen.findByText('Integração Tray')).toBeInTheDocument();
    expect(screen.getByText('Conectada')).toBeInTheDocument();
    expect(screen.getByText('www.exemplo.com.br')).toBeInTheDocument();
    expect(screen.getByText('refresh')).toBeInTheDocument();
  });

  it('nunca exibe token da Tray', async () => {
    getStoreStatus.mockResolvedValue({
      tray: { ok: true, auth_mode: 'refresh', api_host: 'www.exemplo.com.br', access_expires_at: null, last_error: null },
      catalog: { total: 0, published: 0, unpublished: 0, last_synced_at: null },
    });

    const { container } = render(<AdminLojaPremiosPage />);
    userEvent.click(screen.getByRole('tab', { name: 'Configurações' }));
    await screen.findByText('Integração Tray');

    expect(container.textContent).not.toMatch(/access_token|refresh_token|consumer_/i);
  });

  it('ATUALIZAR COM A TRAY dispara a sincronização pelo backend', async () => {
    render(<AdminLojaPremiosPage />);
    userEvent.click(screen.getByRole('tab', { name: 'Configurações' }));
    await screen.findByText('Integração Tray');

    userEvent.click(screen.getByRole('button', { name: /ATUALIZAR COM A TRAY/i }));
    await waitFor(() => {
      expect(syncProducts).toHaveBeenCalledWith();
    });
  });

  it('mostra o estado factual dos módulos operacionais', async () => {
    render(<AdminLojaPremiosPage />);
    userEvent.click(screen.getByRole('tab', { name: 'Configurações' }));

    expect(await screen.findByText('Módulos operacionais')).toBeInTheDocument();
    expect(screen.getByText('Resgate (backend)')).toBeInTheDocument();
    expect(screen.getByText('Habilitado')).toBeInTheDocument();
    expect(screen.getByText('Pedidos Tray criados')).toBeInTheDocument();
  });

  it('webhook: endpoint disponível NÃO significa entrega comprovada', async () => {
    render(<AdminLojaPremiosPage />);
    userEvent.click(screen.getByRole('tab', { name: 'Configurações' }));

    await screen.findByText('Módulos operacionais');
    expect(screen.getByText('Webhook de pedido — endpoint').parentElement).toHaveTextContent('Disponível');
    expect(screen.getByText('Webhook de pedido — entrega Tray').parentElement).toHaveTextContent('Não comprovada');
    expect(screen.getByText('Ativação externa não comprovada')).toBeInTheDocument();
  });

  it('webhook com evento real registrado aparece como comprovado', async () => {
    getStoreStatus.mockResolvedValue({
      tray: { ok: true, auth_mode: 'refresh', api_host: 'www.exemplo.com.br', access_expires_at: null, last_error: null },
      catalog: { total: 0, published: 0, unpublished: 0, last_synced_at: null },
      modules: {
        redemption_backend: { enabled: false },
        tray_orders: { orders_created: 0, last_order_at: null },
        webhook_order: { route: 'ready', delivery: 'verified', events_total: 2, last_event_at: '2026-08-21T10:00:00.000Z' },
      },
    });

    render(<AdminLojaPremiosPage />);
    userEvent.click(screen.getByRole('tab', { name: 'Configurações' }));

    await screen.findByText('Módulos operacionais');
    expect(screen.getByText('Comprovada')).toBeInTheDocument();
    expect(screen.getByText('Desabilitado')).toBeInTheDocument();
  });

  it('preserva os números de sincronização do catálogo', async () => {
    render(<AdminLojaPremiosPage />);
    userEvent.click(screen.getByRole('tab', { name: 'Configurações' }));

    await screen.findByText('Catálogo curado');
    expect(screen.getByText('Produtos na loja')).toBeInTheDocument();
    expect(screen.getByText('Publicados em /loja')).toBeInTheDocument();
    expect(screen.getAllByText('Última sincronização').length).toBeGreaterThan(0);
  });

  it('não oferece configuração de estoque, preço Tray ou checkout', async () => {
    const { container } = render(<AdminLojaPremiosPage />);
    userEvent.click(screen.getByRole('tab', { name: 'Configurações' }));
    await screen.findByText('Integração Tray');

    expect(container.textContent).not.toMatch(/reservar estoque|bloquear estoque|configurar checkout|alterar preço tray/i);
  });
});
