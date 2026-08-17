// Testes do cliente da Loja de Premios.
// Execute com: npm test

import {
  parseNsCreditsInput,
  listTrayProducts,
  listPublishedProducts,
  publishProducts,
  patchProduct,
  syncProducts,
  listPublicProducts,
  describeApiError,
  isAuthError,
  isRecoverableError,
  parseApiError,
} from './rewardStore';

import { getJSON, postJSON, patchJSON } from '../lib/api';

jest.mock('../lib/api', () => ({
  getJSON: jest.fn(() => Promise.resolve({})),
  postJSON: jest.fn(() => Promise.resolve({})),
  patchJSON: jest.fn(() => Promise.resolve({})),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('parseNsCreditsInput', () => {
  it('aceita inteiros positivos', () => {
    expect(parseNsCreditsInput('1')).toBe(1);
    expect(parseNsCreditsInput('500')).toBe(500);
    expect(parseNsCreditsInput('5000')).toBe(5000);
    expect(parseNsCreditsInput('15000')).toBe(15000);
    expect(parseNsCreditsInput(' 5000 ')).toBe(5000);
    expect(parseNsCreditsInput(5000)).toBe(5000);
  });

  it('rejeita zero, negativo, fracionario e nao-numerico', () => {
    expect(parseNsCreditsInput('0')).toBeNull();
    expect(parseNsCreditsInput('-1')).toBeNull();
    expect(parseNsCreditsInput('1.5')).toBeNull();
    expect(parseNsCreditsInput('1,5')).toBeNull();
    expect(parseNsCreditsInput('abc')).toBeNull();
    expect(parseNsCreditsInput('')).toBeNull();
    expect(parseNsCreditsInput(null)).toBeNull();
    expect(parseNsCreditsInput(undefined)).toBeNull();
    expect(parseNsCreditsInput(0)).toBeNull();
    expect(parseNsCreditsInput(-1)).toBeNull();
    expect(parseNsCreditsInput(1.5)).toBeNull();
    expect(parseNsCreditsInput(true)).toBeNull();
  });
});

describe('chamadas administrativas', () => {
  it('encaminha paginacao, busca e filtros para o backend NewStore', () => {
    listTrayProducts({ page: 3, limit: 20, q: 'Citizen', qField: 'name', available: '1', brand: 'Citizen' });

    expect(getJSON).toHaveBeenCalledTimes(1);
    const url = getJSON.mock.calls[0][0];
    expect(url).toContain('/admin/store/tray-products?');
    expect(url).toContain('page=3');
    expect(url).toContain('limit=20');
    expect(url).toContain('q=Citizen');
    expect(url).toContain('qField=name');
    expect(url).toContain('available=1');
    expect(url).toContain('brand=Citizen');
  });

  it('omite filtros vazios da querystring', () => {
    listTrayProducts({ page: 1, limit: 20 });
    const url = getJSON.mock.calls[0][0];
    expect(url).not.toContain('q=');
    expect(url).not.toContain('available=');
    expect(url).not.toContain('brand=');
  });

  it('nunca chama a Tray direto do navegador', () => {
    listTrayProducts({});
    listPublishedProducts({});
    listPublicProducts();
    syncProducts(['123']);

    const urls = [
      ...getJSON.mock.calls.map((c) => c[0]),
      ...postJSON.mock.calls.map((c) => c[0]),
    ];
    urls.forEach((u) => {
      expect(u.startsWith('/')).toBe(true);
      expect(u).not.toMatch(/web_api/i);
      expect(u).not.toMatch(/^https?:/i);
    });
  });

  it('a publicacao envia SOMENTE a intencao administrativa', () => {
    publishProducts([
      {
        tray_product_id: 123,
        nscredits_price: '5000',
        // Tudo abaixo e snapshot do navegador e nao pode ser enviado:
        name: 'NOME FALSO',
        stock: 999999,
        available: 1,
        price: 1,
        image_url: 'https://malicioso/x.jpg',
        variants: [{ id: 1 }],
      },
    ]);

    expect(postJSON).toHaveBeenCalledWith('/admin/store/products/publish', {
      products: [{ tray_product_id: '123', nscredits_price: 5000 }],
    });
  });

  it('o PATCH envia apenas propriedades da NewStore', () => {
    patchProduct('123', { nscredits_price: 6000, is_published: false, display_order: 5 });

    expect(patchJSON).toHaveBeenCalledWith('/admin/store/products/123', {
      nscredits_price: 6000,
      is_published: false,
      display_order: 5,
    });
  });

  it('sync sem ids manda corpo vazio e com ids manda a lista', () => {
    syncProducts();
    expect(postJSON).toHaveBeenCalledWith('/admin/store/products/sync', {});

    jest.clearAllMocks();
    syncProducts([123, '456']);
    expect(postJSON).toHaveBeenCalledWith('/admin/store/products/sync', {
      tray_product_ids: ['123', '456'],
    });
  });

  it('a listagem publica usa o endpoint publico do backend', () => {
    listPublicProducts();
    expect(getJSON).toHaveBeenCalledWith('/store/products');
  });
});

describe('tratamento de erro', () => {
  it('extrai codigo e status do erro do lib/api', () => {
    expect(parseApiError(new Error('tray_rate_limited:429'))).toEqual({
      code: 'tray_rate_limited',
      status: 429,
    });
    expect(parseApiError(new Error('500'))).toEqual({ code: '', status: 500 });
  });

  it('diferencia Tray indisponivel de sessao expirada', () => {
    const trayDown = new Error('tray_unavailable:503');
    const expired = new Error('unauthorized:401');

    expect(describeApiError(trayDown)).toMatch(/Tray/i);
    expect(describeApiError(expired)).toMatch(/sessao/i);
    expect(describeApiError(trayDown)).not.toEqual(describeApiError(expired));
  });

  it('classifica erro de autenticacao', () => {
    expect(isAuthError(new Error('unauthorized:401'))).toBe(true);
    expect(isAuthError(new Error('forbidden:403'))).toBe(true);
    expect(isAuthError(new Error('tray_unavailable:503'))).toBe(false);
  });

  it('classifica erro recuperavel (vale oferecer tentar de novo)', () => {
    expect(isRecoverableError(new Error('tray_rate_limited:429'))).toBe(true);
    expect(isRecoverableError(new Error('tray_unavailable:503'))).toBe(true);
    expect(isRecoverableError(new Error('invalid_nscredits_price:400'))).toBe(false);
  });

  it('erro de busca, publicacao e sincronizacao tem mensagens proprias', () => {
    expect(describeApiError(new Error('invalid_nscredits_price:400'))).toMatch(/inteiro/i);
    expect(describeApiError(new Error('empty_batch:400'))).toMatch(/Selecione/i);
    expect(describeApiError(new Error('batch_too_large:400'))).toMatch(/50/);
    expect(describeApiError(new Error('reward_product_conflict:409'))).toMatch(/Conflito/i);
    expect(describeApiError(new Error('tray_product_not_found:404'))).toMatch(/Tray/i);
  });

  it('erro desconhecido cai no fallback informado', () => {
    expect(describeApiError(new Error('coisa_estranha:418'), 'Falhou.')).toBe('Falhou.');
  });
});
