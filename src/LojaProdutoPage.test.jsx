// Testes do detalhe do produto e da adição ao carrinho.
// Execute com: npm test

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockNavigate = jest.fn();
jest.mock(
  'react-router-dom',
  () => ({
    useNavigate: () => mockNavigate,
    useParams: () => ({ trayProductId: '123' }),
    Link: ({ children, to, ...rest }) => <a href={to} {...rest}>{children}</a>,
  }),
  { virtual: true }
);

const mockUseAuth = jest.fn();
jest.mock('./authContext', () => ({ useAuth: () => mockUseAuth() }));

jest.mock('./services/rewardCart', () => {
  const actual = jest.requireActual('./services/rewardCart');
  return {
    ...actual,
    getPublicProduct: jest.fn(),
    getCart: jest.fn(() => Promise.resolve({ cart: { id: null, items: [], totals: { items: 0, units: 0, nscredits: 0 } } })),
    addCartItem: jest.fn(),
    updateCartItem: jest.fn(),
    removeCartItem: jest.fn(),
    clearCart: jest.fn(),
    validateCart: jest.fn(),
  };
});

jest.mock('./services/nscredits', () => {
  const actual = jest.requireActual('./services/nscredits');
  return { ...actual, getMyNsCredits: jest.fn(() => Promise.resolve({ wallet: { balance: 8450 } })) };
});

import LojaProdutoPage from './LojaProdutoPage';
import { getPublicProduct, addCartItem } from './services/rewardCart';

const USER = { id: 6, name: 'Joao Pedro', email: 'joao@exemplo.com' };

function simples(overrides = {}) {
  return {
    reward_product_id: 'uuid-simples',
    tray_product_id: '123',
    name: 'Citizen Promaster',
    description_small: 'Relogio de mergulho',
    reference: 'NY0129',
    brand: 'Citizen',
    image_url: 'https://cdn/1.jpg',
    images: ['https://cdn/1.jpg'],
    nscredits_price: 5000,
    has_variation: false,
    is_available: true,
    availability_text: 'Disponivel',
    variants: [],
    ...overrides,
  };
}

function comVariacoes() {
  return simples({
    reward_product_id: 'uuid-variacao',
    name: 'Tenis XPTO',
    has_variation: true,
    variants: [
      { variant_id: '2003', reference: 'T-41', values: [{ type: 'Tamanho', value: '41' }], is_available: true },
      { variant_id: '2004', reference: 'T-40', values: [{ type: 'Tamanho', value: '40' }], is_available: false },
    ],
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: USER, loading: false });
  getPublicProduct.mockResolvedValue({ item: simples() });
  addCartItem.mockResolvedValue({ ok: true, cart: { id: 'c1', items: [{ id: 'i1' }], totals: { items: 1, units: 1, nscredits: 5000 } } });
});

describe('detalhe do produto', () => {
  it('mostra os dados factuais do produto', async () => {
    render(<LojaProdutoPage />);

    expect(await screen.findByText('Citizen Promaster')).toBeInTheDocument();
    expect(screen.getByText('CITIZEN · NY0129')).toBeInTheDocument();
    expect(screen.getByText('5.000')).toBeInTheDocument();
    expect(screen.getByText('DISPONÍVEL')).toBeInTheDocument();
    expect(screen.getByText('Relogio de mergulho')).toBeInTheDocument();
  });

  it('produto simples nao mostra seletor de variacao', async () => {
    render(<LojaProdutoPage />);
    await screen.findByText('Citizen Promaster');

    expect(screen.queryByText('Escolha uma opção')).not.toBeInTheDocument();
    expect(screen.getByText('Quantidade')).toBeInTheDocument();
  });

  it('produto indisponivel nao permite adicionar', async () => {
    getPublicProduct.mockResolvedValue({ item: simples({ is_available: false }) });
    render(<LojaProdutoPage />);

    await screen.findByText('Citizen Promaster');
    const botao = screen.getByRole('button', { name: 'INDISPONÍVEL' });
    expect(botao).toBeDisabled();
  });

  it('produto inexistente mostra erro tratado', async () => {
    getPublicProduct.mockRejectedValue(new Error('reward_product_not_found:404'));
    render(<LojaProdutoPage />);

    expect(await screen.findByText(/Produto não encontrado/i)).toBeInTheDocument();
  });
});

describe('variacoes', () => {
  it('lista as opcoes com o estado de cada uma', async () => {
    getPublicProduct.mockResolvedValue({ item: comVariacoes() });
    render(<LojaProdutoPage />);

    await screen.findByText('Tenis XPTO');
    expect(screen.getByText('Escolha uma opção')).toBeInTheDocument();
    expect(screen.getByText('Tamanho: 41')).toBeInTheDocument();
    expect(screen.getByText('Tamanho: 40')).toBeInTheDocument();
    expect(screen.getByText('Disponível')).toBeInTheDocument();
    expect(screen.getByText('Indisponível')).toBeInTheDocument();
  });

  it('nao seleciona a primeira opcao silenciosamente', async () => {
    getPublicProduct.mockResolvedValue({ item: comVariacoes() });
    render(<LojaProdutoPage />);

    await screen.findByText('Tenis XPTO');
    expect(screen.getByText(/Escolha uma opção antes de adicionar/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ADICIONAR AO CARRINHO' })).toBeDisabled();
  });

  it('variacao indisponivel nao pode ser selecionada', async () => {
    getPublicProduct.mockResolvedValue({ item: comVariacoes() });
    render(<LojaProdutoPage />);

    await screen.findByText('Tenis XPTO');
    userEvent.click(screen.getByLabelText('Tamanho: 40'));

    // Continua exigindo escolha: a opcao indisponivel nao foi aceita.
    expect(screen.getByRole('button', { name: 'ADICIONAR AO CARRINHO' })).toBeDisabled();
    expect(addCartItem).not.toHaveBeenCalled();
  });

  it('escolher variacao disponivel libera a adicao', async () => {
    getPublicProduct.mockResolvedValue({ item: comVariacoes() });
    render(<LojaProdutoPage />);

    await screen.findByText('Tenis XPTO');
    userEvent.click(screen.getByLabelText('Tamanho: 41'));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'ADICIONAR AO CARRINHO' })).not.toBeDisabled()
    );

    userEvent.click(screen.getByRole('button', { name: 'ADICIONAR AO CARRINHO' }));
    await waitFor(() => expect(addCartItem).toHaveBeenCalled());
    expect(addCartItem).toHaveBeenCalledWith({
      rewardProductId: 'uuid-variacao',
      trayVariantId: '2003',
      quantity: 1,
    });
  });
});

describe('quantidade', () => {
  it('nao permite descer abaixo de 1', async () => {
    render(<LojaProdutoPage />);
    await screen.findByText('Citizen Promaster');

    expect(screen.getByLabelText('Diminuir quantidade')).toBeDisabled();
  });

  it('incrementa e envia a quantidade escolhida', async () => {
    render(<LojaProdutoPage />);
    await screen.findByText('Citizen Promaster');

    userEvent.click(screen.getByLabelText('Aumentar quantidade'));
    userEvent.click(screen.getByLabelText('Aumentar quantidade'));
    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument());

    userEvent.click(screen.getByRole('button', { name: 'ADICIONAR AO CARRINHO' }));
    await waitFor(() => expect(addCartItem).toHaveBeenCalled());
    expect(addCartItem.mock.calls[0][0].quantity).toBe(3);
  });
});

describe('adicionar ao carrinho', () => {
  it('produto simples envia variant null', async () => {
    render(<LojaProdutoPage />);
    await screen.findByText('Citizen Promaster');

    userEvent.click(screen.getByRole('button', { name: 'ADICIONAR AO CARRINHO' }));
    await waitFor(() => expect(addCartItem).toHaveBeenCalled());
    expect(addCartItem.mock.calls[0][0].trayVariantId).toBeNull();
  });

  it('mostra confirmacao no sucesso', async () => {
    render(<LojaProdutoPage />);
    await screen.findByText('Citizen Promaster');

    userEvent.click(screen.getByRole('button', { name: 'ADICIONAR AO CARRINHO' }));
    expect(await screen.findByText(/adicionado ao carrinho/i)).toBeInTheDocument();
  });

  it('erro do backend e exibido com mensagem propria', async () => {
    addCartItem.mockRejectedValue(new Error('insufficient_stock:409'));
    render(<LojaProdutoPage />);
    await screen.findByText('Citizen Promaster');

    userEvent.click(screen.getByRole('button', { name: 'ADICIONAR AO CARRINHO' }));
    expect(await screen.findByText(/Estoque insuficiente/i)).toBeInTheDocument();
  });

  it('Tray indisponivel mostra mensagem propria', async () => {
    addCartItem.mockRejectedValue(new Error('tray_unavailable:503'));
    render(<LojaProdutoPage />);
    await screen.findByText('Citizen Promaster');

    userEvent.click(screen.getByRole('button', { name: 'ADICIONAR AO CARRINHO' }));
    expect(await screen.findByText(/confirmar a disponibilidade/i)).toBeInTheDocument();
  });

  it('visitante e mandado para o login existente', async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    render(<LojaProdutoPage />);
    await screen.findByText('Citizen Promaster');

    userEvent.click(screen.getByRole('button', { name: 'ADICIONAR AO CARRINHO' }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
    expect(mockNavigate).toHaveBeenCalledWith('/login', {
      state: { from: { pathname: '/loja/produto/123' } },
    });
    expect(addCartItem).not.toHaveBeenCalled();
  });

  it('deixa claro que o carrinho nao reserva o produto', async () => {
    render(<LojaProdutoPage />);
    await screen.findByText('Citizen Promaster');
    expect(screen.getByText(/não reserva o produto/i)).toBeInTheDocument();
  });
});
