// Testes do drawer do carrinho e da pré-validação.
// Execute com: npm test

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }), { virtual: true });

jest.mock('../../services/rewardCart', () => {
  const actual = jest.requireActual('../../services/rewardCart');
  return {
    ...actual,
    getCart: jest.fn(),
    addCartItem: jest.fn(),
    updateCartItem: jest.fn(),
    removeCartItem: jest.fn(),
    clearCart: jest.fn(),
    validateCart: jest.fn(),
  };
});

import CartDrawer from './CartDrawer';
import { CartProvider } from './CartContext';
import { getCart, updateCartItem, removeCartItem, validateCart } from '../../services/rewardCart';

function item(overrides = {}) {
  return {
    id: 'item-1',
    reward_product_id: 'uuid-1',
    tray_product_id: '123',
    tray_variant_id: '2003',
    quantity: 1,
    nscredits_unit_price: 5000,
    nscredits_unit_price_snapshot: 5000,
    nscredits_subtotal: 5000,
    price_changed: false,
    name: 'Citizen Promaster',
    variant_name: 'Azul / 41',
    image_url: null,
    is_published: true,
    ...overrides,
  };
}

function cartWith(items) {
  return {
    id: 'cart-1',
    items,
    totals: {
      items: items.length,
      units: items.reduce((a, i) => a + i.quantity, 0),
      nscredits: items.reduce((a, i) => a + i.nscredits_subtotal, 0),
    },
  };
}

function renderDrawer(walletBalance = 8450) {
  return render(
    <CartProvider enabled>
      <CartDrawer open onClose={() => {}} walletBalance={walletBalance} />
    </CartProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  getCart.mockResolvedValue({ cart: cartWith([item()]) });
  updateCartItem.mockImplementation((id, q) => Promise.resolve({ ok: true, cart: cartWith([item({ quantity: q, nscredits_subtotal: 5000 * q })]) }));
  removeCartItem.mockResolvedValue({ ok: true, cart: cartWith([]) });
  validateCart.mockResolvedValue({
    valid: true,
    cart: { id: 'cart-1', total_items: 1, total_units: 1, total_nscredits: 5000 },
    wallet: { balance: 8450, sufficient: true, missing: 0 },
    issues: [],
    items: [{ id: 'item-1', valid: true, issues: [] }],
  });
});

describe('conteudo do carrinho', () => {
  it('mostra itens, variacao, total e saldo', async () => {
    renderDrawer();

    expect(await screen.findByText('Citizen Promaster')).toBeInTheDocument();
    expect(screen.getByText('Azul / 41')).toBeInTheDocument();
    // Aparece duas vezes: preço do item e total do carrinho (mesmo valor).
    expect(screen.getAllByText('5.000 NSCréditos').length).toBe(2);
    expect(screen.getByText('TOTAL')).toBeInTheDocument();
    expect(screen.getByText('SALDO')).toBeInTheDocument();
    expect(screen.getByText('8.450 NSCréditos')).toBeInTheDocument();
  });

  it('carrinho vazio informa e nao mostra total', async () => {
    getCart.mockResolvedValue({ cart: cartWith([]) });
    renderDrawer();

    expect(await screen.findByText(/carrinho está vazio/i)).toBeInTheDocument();
    expect(screen.queryByText('TOTAL')).not.toBeInTheDocument();
  });
});

describe('alterar e remover', () => {
  it('altera a quantidade pelo backend', async () => {
    renderDrawer();
    await screen.findByText('Citizen Promaster');

    userEvent.click(screen.getByLabelText('Aumentar Citizen Promaster'));
    await waitFor(() => expect(updateCartItem).toHaveBeenCalledWith('item-1', 2));
  });

  it('nao deixa diminuir abaixo de 1', async () => {
    renderDrawer();
    await screen.findByText('Citizen Promaster');
    expect(screen.getByLabelText('Diminuir Citizen Promaster')).toBeDisabled();
  });

  it('remove o item', async () => {
    renderDrawer();
    await screen.findByText('Citizen Promaster');

    userEvent.click(screen.getByRole('button', { name: /REMOVER/i }));
    await waitFor(() => expect(removeCartItem).toHaveBeenCalledWith('item-1'));
  });

  it('erro do backend ao alterar e exibido', async () => {
    updateCartItem.mockRejectedValue(new Error('insufficient_stock:409'));
    renderDrawer();
    await screen.findByText('Citizen Promaster');

    userEvent.click(screen.getByLabelText('Aumentar Citizen Promaster'));
    expect(await screen.findByText(/Estoque insuficiente/i)).toBeInTheDocument();
  });
});

describe('pre-validacao', () => {
  it('carrinho valido mostra pronto para revisao', async () => {
    renderDrawer();
    await screen.findByText('Citizen Promaster');

    userEvent.click(screen.getByRole('button', { name: /VALIDAR CARRINHO/i }));
    expect(await screen.findByText(/pronto para revisão/i)).toBeInTheDocument();
  });

  it('saldo insuficiente mostra quanto falta e nao debita', async () => {
    validateCart.mockResolvedValue({
      valid: false,
      cart: { id: 'cart-1', total_items: 1, total_units: 2, total_nscredits: 10000 },
      wallet: { balance: 8450, sufficient: false, missing: 1550 },
      issues: ['insufficient_nscredits'],
      items: [{ id: 'item-1', valid: true, issues: [] }],
    });

    renderDrawer();
    await screen.findByText('Citizen Promaster');
    userEvent.click(screen.getByRole('button', { name: /VALIDAR CARRINHO/i }));

    expect(await screen.findByText(/Saldo insuficiente/i)).toBeInTheDocument();
    expect(screen.getByText(/Você possui: 8.450 NSCréditos/i)).toBeInTheDocument();
    expect(screen.getByText(/Necessário: 10.000 NSCréditos/i)).toBeInTheDocument();
    expect(screen.getByText(/Faltam: 1.550 NSCréditos/i)).toBeInTheDocument();
  });

  it('cupom vencido mostra mensagem propria, nao a de saldo insuficiente', async () => {
    validateCart.mockResolvedValue({
      valid: false,
      cart: { id: 'cart-1', total_items: 1, total_units: 1, total_nscredits: 1500 },
      wallet: { balance: 8450, sufficient: false, missing: 1500 },
      issues: ['coupon_expired'],
      items: [{ id: 'item-1', valid: true, issues: [] }],
    });

    renderDrawer();
    await screen.findByText('Citizen Promaster');
    userEvent.click(screen.getByRole('button', { name: /VALIDAR CARRINHO/i }));

    expect(await screen.findByText(/vencido/i)).toBeInTheDocument();
    expect(screen.queryByText(/Saldo insuficiente/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Faltam:/i)).not.toBeInTheDocument();
  });

  it('problema por item aparece junto do item', async () => {
    validateCart.mockResolvedValue({
      valid: false,
      cart: { id: 'cart-1', total_items: 1, total_units: 1, total_nscredits: 5000 },
      wallet: { balance: 8450, sufficient: true, missing: 0 },
      issues: [],
      items: [{ id: 'item-1', valid: false, issues: ['variant_unavailable'] }],
    });

    renderDrawer();
    await screen.findByText('Citizen Promaster');
    userEvent.click(screen.getByRole('button', { name: /VALIDAR CARRINHO/i }));

    expect(await screen.findByText(/opção escolhida está indisponível/i)).toBeInTheDocument();
  });

  it('produto despublicado e sinalizado sem sumir do carrinho', async () => {
    validateCart.mockResolvedValue({
      valid: false,
      cart: { id: 'cart-1', total_items: 1, total_units: 1, total_nscredits: 5000 },
      wallet: { balance: 8450, sufficient: true, missing: 0 },
      issues: [],
      items: [{ id: 'item-1', valid: false, issues: ['product_not_published'] }],
    });

    renderDrawer();
    await screen.findByText('Citizen Promaster');
    userEvent.click(screen.getByRole('button', { name: /VALIDAR CARRINHO/i }));

    expect(await screen.findByText(/não está mais disponível na Loja/i)).toBeInTheDocument();
    expect(screen.getByText('Citizen Promaster')).toBeInTheDocument();
  });

  it('Tray indisponivel nao declara o carrinho pronto', async () => {
    validateCart.mockResolvedValue({
      valid: false,
      cart: { id: 'cart-1', total_items: 1, total_units: 1, total_nscredits: 5000 },
      wallet: { balance: 8450, sufficient: true, missing: 0 },
      issues: [],
      items: [{ id: 'item-1', valid: false, issues: ['tray_unavailable'] }],
    });

    renderDrawer();
    await screen.findByText('Citizen Promaster');
    userEvent.click(screen.getByRole('button', { name: /VALIDAR CARRINHO/i }));

    expect(await screen.findByText(/confirmar a disponibilidade/i)).toBeInTheDocument();
    expect(screen.queryByText(/pronto para revisão/i)).not.toBeInTheDocument();
  });

  it('preco alterado e informado no item', async () => {
    getCart.mockResolvedValue({
      cart: cartWith([item({ nscredits_unit_price: 6000, nscredits_unit_price_snapshot: 5000, nscredits_subtotal: 6000, price_changed: true })]),
    });

    renderDrawer();
    expect(await screen.findByText(/Valor atualizado de 5.000 para 6.000 NSCréditos/i)).toBeInTheDocument();
  });
});

describe('fechamento ainda nao existe', () => {
  it('o botao CONTINUAR fica desabilitado mesmo com carrinho valido', async () => {
    renderDrawer();
    await screen.findByText('Citizen Promaster');

    userEvent.click(screen.getByRole('button', { name: /VALIDAR CARRINHO/i }));
    await screen.findByText(/pronto para revisão/i);

    expect(screen.getByRole('button', { name: 'CONTINUAR' })).toBeDisabled();
    expect(screen.getByText(/fechamento do resgate será liberado em breve/i)).toBeInTheDocument();
  });

  it('nao existe botao de finalizar resgate', async () => {
    renderDrawer();
    await screen.findByText('Citizen Promaster');

    expect(screen.queryByRole('button', { name: /FINALIZAR RESGATE/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /RESGATAR/i })).not.toBeInTheDocument();
  });
});

describe('duplo clique', () => {
  it('acoes ficam bloqueadas enquanto a requisicao esta em andamento', async () => {
    let resolver;
    updateCartItem.mockReturnValue(new Promise((r) => { resolver = r; }));
    renderDrawer();
    await screen.findByText('Citizen Promaster');

    const aumentar = screen.getByLabelText('Aumentar Citizen Promaster');
    userEvent.click(aumentar);
    await waitFor(() => expect(updateCartItem).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(aumentar).toBeDisabled());

    resolver({ ok: true, cart: cartWith([item({ quantity: 2 })]) });
    await waitFor(() => expect(aumentar).not.toBeDisabled());
    expect(updateCartItem).toHaveBeenCalledTimes(1);
  });
});
