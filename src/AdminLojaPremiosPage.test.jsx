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
  });
});

describe('estrutura do módulo', () => {
  it('mostra o título e as cinco abas', async () => {
    render(<AdminLojaPremiosPage />);

    expect(screen.getByText('Loja de Prêmios NS')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Produtos Tray' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Publicados' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'NSCréditos' })).toBeInTheDocument();
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

describe('aba Relatórios', () => {
  it('mostra números do catálogo e estado vazio honesto para resgates', async () => {
    render(<AdminLojaPremiosPage />);
    userEvent.click(screen.getByRole('tab', { name: 'Relatórios' }));

    expect(await screen.findByText('Catálogo da loja')).toBeInTheDocument();
    expect(screen.getAllByText(/Nenhum resgate registrado até o momento/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Total de resgates')).toBeInTheDocument();
    expect(screen.getAllByText('aguarda o módulo de resgate').length).toBeGreaterThan(0);
  });

  it('não inventa métricas de resgate', async () => {
    render(<AdminLojaPremiosPage />);
    userEvent.click(screen.getByRole('tab', { name: 'Relatórios' }));

    await screen.findByText('Catálogo da loja');
    // Todos os indicadores de resgate ficam em branco.
    const placeholders = screen.getAllByText('—');
    expect(placeholders.length).toBeGreaterThanOrEqual(6);
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

  it('não oferece configuração de estoque, preço Tray ou checkout', async () => {
    const { container } = render(<AdminLojaPremiosPage />);
    userEvent.click(screen.getByRole('tab', { name: 'Configurações' }));
    await screen.findByText('Integração Tray');

    expect(container.textContent).not.toMatch(/reservar estoque|bloquear estoque|configurar checkout|alterar preço tray/i);
  });
});
