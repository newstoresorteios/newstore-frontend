// Testes do cliente do carrinho da Loja de Premios.
// Execute com: npm test

import {
  getPublicProduct,
  getCart,
  addCartItem,
  updateCartItem,
  removeCartItem,
  clearCart,
  validateCart,
  parseQuantityInput,
  cartBadgeCount,
  isVariantSelectable,
  variantLabel,
  describeIssue,
  describeCartError,
  isAuthError,
} from './rewardCart';

import { getJSON, postJSON, patchJSON, delJSON } from '../lib/api';

jest.mock('../lib/api', () => ({
  getJSON: jest.fn(() => Promise.resolve({})),
  postJSON: jest.fn(() => Promise.resolve({})),
  patchJSON: jest.fn(() => Promise.resolve({})),
  delJSON: jest.fn(() => Promise.resolve({})),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('parseQuantityInput', () => {
  it('aceita inteiros >= 1', () => {
    expect(parseQuantityInput('1')).toBe(1);
    expect(parseQuantityInput('10')).toBe(10);
    expect(parseQuantityInput(3)).toBe(3);
  });

  it('rejeita zero, negativo, decimal e nao-numerico', () => {
    expect(parseQuantityInput('0')).toBeNull();
    expect(parseQuantityInput('-1')).toBeNull();
    expect(parseQuantityInput('1.5')).toBeNull();
    expect(parseQuantityInput('abc')).toBeNull();
    expect(parseQuantityInput('')).toBeNull();
    expect(parseQuantityInput(null)).toBeNull();
    expect(parseQuantityInput(0)).toBeNull();
    expect(parseQuantityInput(1.5)).toBeNull();
  });
});

describe('cartBadgeCount', () => {
  it('conta ITENS DISTINTOS, nao unidades', () => {
    const cart = { items: [{ id: 'a', quantity: 5 }, { id: 'b', quantity: 3 }] };
    expect(cartBadgeCount(cart)).toBe(2);
  });

  it('carrinho vazio ou ausente conta zero', () => {
    expect(cartBadgeCount({ items: [] })).toBe(0);
    expect(cartBadgeCount(null)).toBe(0);
    expect(cartBadgeCount(undefined)).toBe(0);
  });
});

describe('variacoes', () => {
  it('variacao indisponivel nao pode ser selecionada', () => {
    expect(isVariantSelectable({ variant_id: '1', is_available: true })).toBe(true);
    expect(isVariantSelectable({ variant_id: '1', is_available: false })).toBe(false);
    expect(isVariantSelectable({ variant_id: '1', tray_available: 0 })).toBe(false);
    expect(isVariantSelectable(null)).toBe(false);
  });

  it('monta o rotulo a partir dos valores factuais', () => {
    expect(variantLabel({ values: [{ type: 'Cor', value: 'Azul' }, { type: 'Tamanho', value: '41' }] })).toBe(
      'Cor: Azul · Tamanho: 41'
    );
    expect(variantLabel({ values: [], reference: 'REF-1' })).toBe('REF-1');
    expect(variantLabel({ values: [], variant_id: '77' })).toBe('#77');
  });
});

describe('chamadas de API', () => {
  it('o detalhe usa o endpoint publico do catalogo', () => {
    getPublicProduct('123');
    expect(getJSON).toHaveBeenCalledWith('/store/products/123');
  });

  it('adicionar envia SOMENTE a intencao', () => {
    addCartItem({ rewardProductId: 'uuid-1', trayVariantId: '2003', quantity: 2 });
    expect(postJSON).toHaveBeenCalledWith('/store/cart/items', {
      reward_product_id: 'uuid-1',
      tray_variant_id: '2003',
      quantity: 2,
    });
  });

  it('NUNCA envia preco, nome, imagem ou estoque', () => {
    addCartItem({
      rewardProductId: 'uuid-1',
      quantity: 1,
      nscredits_price: 1,
      name: 'FALSO',
      image_url: 'x',
      stock: 999,
      tray_product_id: '999',
    });
    const body = postJSON.mock.calls[0][1];
    expect(Object.keys(body).sort()).toEqual(['quantity', 'reward_product_id', 'tray_variant_id']);
    expect(body.nscredits_price).toBeUndefined();
    expect(body.tray_product_id).toBeUndefined();
  });

  it('produto simples envia variant null', () => {
    addCartItem({ rewardProductId: 'uuid-1', quantity: 1 });
    expect(postJSON.mock.calls[0][1].tray_variant_id).toBeNull();
  });

  it('alterar quantidade usa PATCH no item', () => {
    updateCartItem('item-1', 3);
    expect(patchJSON).toHaveBeenCalledWith('/store/cart/items/item-1', { quantity: 3 });
  });

  it('remover e limpar usam DELETE local', () => {
    removeCartItem('item-1');
    expect(delJSON).toHaveBeenCalledWith('/store/cart/items/item-1');

    clearCart();
    expect(delJSON).toHaveBeenCalledWith('/store/cart');
  });

  it('validar usa o endpoint de validacao, nao de checkout', () => {
    validateCart();
    expect(postJSON).toHaveBeenCalledWith('/store/cart/validate', {});
  });

  it('nenhuma chamada aponta para a Tray nem para pedido', () => {
    getCart();
    addCartItem({ rewardProductId: 'x', quantity: 1 });
    updateCartItem('i', 1);
    removeCartItem('i');
    clearCart();
    validateCart();

    const urls = [
      ...getJSON.mock.calls.map((c) => c[0]),
      ...postJSON.mock.calls.map((c) => c[0]),
      ...patchJSON.mock.calls.map((c) => c[0]),
      ...delJSON.mock.calls.map((c) => c[0]),
    ];
    urls.forEach((u) => {
      expect(u.startsWith('/')).toBe(true);
      expect(u).not.toMatch(/web_api|tray/i);
      expect(u).not.toMatch(/order|pedido|checkout|redeem|resgate/i);
    });
  });
});

describe('mensagens de problema', () => {
  it('cada codigo tem mensagem propria — nao um erro generico', () => {
    const codigos = [
      'product_not_published',
      'product_unavailable',
      'variant_required',
      'variant_unavailable',
      'insufficient_stock',
      'price_changed',
      'insufficient_nscredits',
      'tray_unavailable',
    ];
    const mensagens = codigos.map((c) => describeIssue(c));
    expect(new Set(mensagens).size).toBe(codigos.length);
    mensagens.forEach((m) => expect(m).not.toBe('Não foi possível completar a operação.'));
  });

  it('erro de API vira mensagem tratada', () => {
    expect(describeCartError(new Error('insufficient_stock:409'))).toMatch(/Estoque insuficiente/i);
    expect(describeCartError(new Error('variant_required:409'))).toMatch(/Escolha uma opção/i);
    expect(describeCartError(new Error('unauthorized:401'))).toMatch(/Entre na sua conta/i);
    expect(describeCartError(new Error('tray_unavailable:503'))).toMatch(/disponibilidade/i);
  });

  it('classifica erro de autenticacao', () => {
    expect(isAuthError(new Error('unauthorized:401'))).toBe(true);
    expect(isAuthError(new Error('insufficient_stock:409'))).toBe(false);
  });
});
