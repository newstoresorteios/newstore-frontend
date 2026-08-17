// Testes da vitrine pública /loja.
// Execute com: npm test

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

// react-router-dom v7 é ESM-only: o resolver do react-scripts 5 não o carrega
// em ambiente de teste.
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

jest.mock('./services/rewardStore', () => {
  const actual = jest.requireActual('./services/rewardStore');
  return {
    ...actual,
    listPublicProducts: jest.fn(),
  };
});

jest.mock('./services/nscredits', () => {
  const actual = jest.requireActual('./services/nscredits');
  return {
    ...actual,
    getMyNsCredits: jest.fn(),
  };
});

// A /loja passou a viver dentro do LojaShell, que monta o carrinho.
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

import LojaPage from './LojaPage';
import { listPublicProducts } from './services/rewardStore';
import { getMyNsCredits } from './services/nscredits';

function product(overrides = {}) {
  return {
    tray_product_id: '123',
    name: 'Citizen Promaster',
    description_small: 'Relogio de mergulho',
    reference: 'NY0129',
    brand: 'Citizen',
    image_url: 'https://cdn/1.jpg',
    images: ['https://cdn/1.jpg'],
    nscredits_price: 5000,
    display_order: 0,
    has_variation: false,
    is_available: true,
    availability_reason: 'available',
    availability_text: 'Disponivel',
    variants: [],
    last_synced_at: '2026-08-12T00:00:00.000Z',
    ...overrides,
  };
}

const USER = { id: 42, name: 'Joao Pedro Matos', email: 'jp@exemplo.com', created_at: '2025-03-10T12:00:00.000Z' };

function renderPage() {
  return render(<LojaPage />);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: USER, loading: false });
  getMyNsCredits.mockResolvedValue({ wallet: { balance: 8450 } });
});

describe('catálogo', () => {
  it('mostra o produto publicado com o valor em NSCréditos', async () => {
    listPublicProducts.mockResolvedValue({ items: [product()] });

    renderPage();

    expect(await screen.findByText('Citizen Promaster')).toBeInTheDocument();
    expect(screen.getAllByText('5.000').length).toBeGreaterThan(0);
    expect(screen.getAllByText('VALOR EM NSCRÉDITOS').length).toBeGreaterThan(0);
    expect(screen.getByText('DISPONÍVEL')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'VISUALIZAR' })).toBeInTheDocument();
  });

  it('a vitrine consulta apenas o catálogo local do backend', async () => {
    listPublicProducts.mockResolvedValue({ items: [product()] });

    renderPage();

    await screen.findByText('Citizen Promaster');
    expect(listPublicProducts).toHaveBeenCalledTimes(1);
  });

  it('nao mostra CARREGAR MAIS quando so ha uma pagina', async () => {
    listPublicProducts.mockResolvedValue({
      items: [product()],
      paging: { page: 1, limit: 24, total: 1, pages: 1 },
    });

    renderPage();

    await screen.findByText('Citizen Promaster');
    expect(screen.queryByRole('button', { name: 'CARREGAR MAIS' })).not.toBeInTheDocument();
  });

  it('CARREGAR MAIS busca a proxima pagina e acrescenta itens (A5)', async () => {
    listPublicProducts
      .mockResolvedValueOnce({
        items: [product({ tray_product_id: '1', name: 'Produto 1' })],
        paging: { page: 1, limit: 1, total: 2, pages: 2 },
      })
      .mockResolvedValueOnce({
        items: [product({ tray_product_id: '2', name: 'Produto 2' })],
        paging: { page: 2, limit: 1, total: 2, pages: 2 },
      });

    renderPage();

    await screen.findByText('Produto 1');
    const botao = screen.getByRole('button', { name: 'CARREGAR MAIS' });
    fireEvent.click(botao);

    expect(await screen.findByText('Produto 2')).toBeInTheDocument();
    expect(screen.getByText('Produto 1')).toBeInTheDocument();
    expect(listPublicProducts).toHaveBeenCalledTimes(2);
    expect(listPublicProducts).toHaveBeenNthCalledWith(2, { page: 2, limit: 1 });
    expect(screen.queryByRole('button', { name: 'CARREGAR MAIS' })).not.toBeInTheDocument();
  });

  it('produto indisponível na Tray continua no catálogo, marcado como INDISPONÍVEL', async () => {
    listPublicProducts.mockResolvedValue({
      items: [product({ is_available: false, availability_reason: 'unavailable_in_tray' })],
    });

    renderPage();

    expect(await screen.findByText('Citizen Promaster')).toBeInTheDocument();
    expect(screen.getByText('INDISPONÍVEL')).toBeInTheDocument();
    expect(screen.queryByText('DISPONÍVEL')).not.toBeInTheDocument();
  });

  it('sinaliza produtos com variações', async () => {
    listPublicProducts.mockResolvedValue({
      items: [
        product({
          has_variation: true,
          variants: [{ variant_id: '1', reference: 'TAM-40', values: [], is_available: true }],
        }),
      ],
    });

    renderPage();

    expect(await screen.findByText('Variações')).toBeInTheDocument();
  });

  it('estado vazio é diferente de estado de erro', async () => {
    listPublicProducts.mockResolvedValue({ items: [] });

    renderPage();

    expect(await screen.findByText(/Nenhum prêmio disponível/i)).toBeInTheDocument();
  });

  it('erro de carregamento mostra mensagem tratada e opção de tentar de novo', async () => {
    listPublicProducts.mockRejectedValue(new Error('store_catalog_unavailable:500'));

    renderPage();

    expect(await screen.findByText(/Nao foi possivel carregar o catalogo da loja/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tentar de novo/i })).toBeInTheDocument();
  });

  it('não expõe preço em reais na vitrine', async () => {
    listPublicProducts.mockResolvedValue({ items: [product()] });

    const { container } = renderPage();

    await screen.findByText('Citizen Promaster');
    await waitFor(() => {
      expect(container.textContent).not.toMatch(/R\$/);
    });
  });
});

describe('composição visual', () => {
  it('tem o título e o subtítulo da loja', async () => {
    listPublicProducts.mockResolvedValue({ items: [product()] });
    renderPage();

    expect(await screen.findByText('Loja de Prêmios')).toBeInTheDocument();
    expect(screen.getByText(/Prêmios selecionados pela New Store/i)).toBeInTheDocument();
  });

  it('mostra o bloco inferior de benefícios', async () => {
    listPublicProducts.mockResolvedValue({ items: [product()] });
    renderPage();

    await screen.findByText('Citizen Promaster');
    expect(screen.getByText('100% Seguro')).toBeInTheDocument();
    expect(screen.getByText('Entrega Garantida')).toBeInTheDocument();
    expect(screen.getByText('NSCréditos')).toBeInTheDocument();
  });
});

describe('bloco de perfil do cliente', () => {
  it('mostra saudação, ID e data de membro do usuário autenticado', async () => {
    listPublicProducts.mockResolvedValue({ items: [product()] });
    renderPage();

    expect(await screen.findByText('Olá, Joao')).toBeInTheDocument();
    expect(screen.getByText('ID 42')).toBeInTheDocument();
    expect(screen.getByText(/Membro desde/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /MEUS PEDIDOS/i })).toBeInTheDocument();
  });

  it('mostra o saldo factual da carteira', async () => {
    listPublicProducts.mockResolvedValue({ items: [product()] });
    renderPage();

    await screen.findByText('Olá, Joao');
    expect(screen.getByText('SALDO DISPONÍVEL')).toBeInTheDocument();
    expect(await screen.findByText('8.450 NSCréditos')).toBeInTheDocument();
    expect(getMyNsCredits).toHaveBeenCalledTimes(1);
  });

  it('saldo zero e um saldo valido, nao erro', async () => {
    getMyNsCredits.mockResolvedValue({ wallet: { balance: 0 } });
    listPublicProducts.mockResolvedValue({ items: [product()] });
    renderPage();

    await screen.findByText('Olá, Joao');
    expect(await screen.findByText('0 NSCréditos')).toBeInTheDocument();
    expect(screen.queryByText(/Saldo indisponível/i)).not.toBeInTheDocument();
  });

  it('erro ao consultar a carteira NAO vira zero', async () => {
    getMyNsCredits.mockRejectedValue(new Error('nscredits_failed:500'));
    listPublicProducts.mockResolvedValue({ items: [product()] });
    renderPage();

    await screen.findByText('Olá, Joao');
    expect(await screen.findByText(/Saldo indisponível/i)).toBeInTheDocument();
    expect(screen.queryByText('0 NSCréditos')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tentar de novo/i })).toBeInTheDocument();
  });

  it('o loading nao pisca saldo falso', async () => {
    let resolver;
    getMyNsCredits.mockReturnValue(new Promise((r) => { resolver = r; }));
    listPublicProducts.mockResolvedValue({ items: [product()] });
    renderPage();

    await screen.findByText('Olá, Joao');
    expect(screen.getByTestId('saldo-carregando')).toBeInTheDocument();
    expect(screen.queryByText('0 NSCréditos')).not.toBeInTheDocument();
    expect(screen.queryByText(/Saldo indisponível/i)).not.toBeInTheDocument();

    await act(async () => {
      resolver({ wallet: { balance: 8450 } });
    });
    expect(await screen.findByText('8.450 NSCréditos')).toBeInTheDocument();
  });

  it('nao mostra frase de saldo inventada', async () => {
    listPublicProducts.mockResolvedValue({ items: [product()] });
    const { container } = renderPage();

    await screen.findByText('Olá, Joao');
    expect(container.textContent).not.toMatch(/você possui[\s\S]{0,20}nscréditos/i);
  });

  it('MEUS PEDIDOS fica desabilitado enquanto não existe resgate', async () => {
    listPublicProducts.mockResolvedValue({ items: [product()] });
    renderPage();

    const botao = await screen.findByRole('button', { name: /MEUS PEDIDOS/i });
    expect(botao).toBeDisabled();
  });

  it('visitante não autenticado vê convite para entrar, sem perfil falso', async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    listPublicProducts.mockResolvedValue({ items: [product()] });

    renderPage();

    expect(await screen.findByText(/Bem-vindo à Loja de Prêmios/i)).toBeInTheDocument();
    expect(screen.getByText('ENTRAR')).toBeInTheDocument();
    expect(screen.queryByText(/Olá,/)).not.toBeInTheDocument();
    expect(screen.queryByText('SALDO DISPONÍVEL')).not.toBeInTheDocument();
    expect(getMyNsCredits).not.toHaveBeenCalled();
  });

  it('não renderiza perfil enquanto a autenticação carrega', async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    listPublicProducts.mockResolvedValue({ items: [product()] });

    renderPage();

    await screen.findByText('Citizen Promaster');
    expect(screen.queryByText(/Bem-vindo à Loja de Prêmios/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Olá,/)).not.toBeInTheDocument();
  });
});
