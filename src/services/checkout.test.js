// Testes do cliente de checkout/resgate da Loja de Premios.
// Execute com: npm test

import {
  getCheckoutBootstrap,
  listAddresses,
  createAddress,
  deleteAddress,
  prepareRedemption,
  confirmRedemption,
  makeIdempotencyKey,
  describeCheckoutError,
  isCheckoutAuthError,
  isRewardRedemptionEnabled,
} from './checkout';

import { getJSON, postJSON, delJSON } from '../lib/api';

jest.mock('../lib/api', () => ({
  getJSON: jest.fn(() => Promise.resolve({})),
  postJSON: jest.fn(() => Promise.resolve({})),
  delJSON: jest.fn(() => Promise.resolve({})),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('bootstrap/enderecos', () => {
  it('getCheckoutBootstrap chama GET /store/checkout', () => {
    getCheckoutBootstrap();
    expect(getJSON).toHaveBeenCalledWith('/store/checkout');
  });

  it('listAddresses chama GET /store/checkout/addresses', () => {
    listAddresses();
    expect(getJSON).toHaveBeenCalledWith('/store/checkout/addresses');
  });

  it('createAddress envia o payload como veio, sem inventar campos', () => {
    const input = { recipient_name: 'Joao', zipcode: '01304001', street: 'Rua Augusta', number: '123', neighborhood: 'Centro', city: 'SP', state: 'SP' };
    createAddress(input);
    expect(postJSON).toHaveBeenCalledWith('/store/checkout/addresses', input);
  });

  it('deleteAddress chama DELETE com o id codificado na URL', () => {
    deleteAddress('addr uuid/1');
    expect(delJSON).toHaveBeenCalledWith(`/store/checkout/addresses/${encodeURIComponent('addr uuid/1')}`);
  });
});

describe('prepare/confirm', () => {
  it('prepareRedemption envia address_id, nunca frete', () => {
    prepareRedemption('addr-1');
    expect(postJSON).toHaveBeenCalledWith('/store/redemptions/prepare', { address_id: 'addr-1' });
  });

  it('confirmRedemption envia address_id + idempotency_key, nunca shipping_option', () => {
    confirmRedemption('addr-1', 'key-abc');
    const [path, body] = postJSON.mock.calls[0];
    expect(path).toBe('/store/redemptions/confirm');
    expect(body).toEqual({ address_id: 'addr-1', idempotency_key: 'key-abc' });
    expect(body).not.toHaveProperty('shipping_option');
  });
});

describe('makeIdempotencyKey', () => {
  it('gera chaves diferentes a cada chamada', () => {
    const a = makeIdempotencyKey();
    const b = makeIdempotencyKey();
    expect(a).not.toBe(b);
    expect(typeof a).toBe('string');
    expect(a.length).toBeGreaterThan(0);
  });
});

describe('describeCheckoutError', () => {
  it('mapeia codigos conhecidos', () => {
    expect(describeCheckoutError(new Error('reward_redemption_disabled:503'))).toMatch(/não está disponível/);
    expect(describeCheckoutError(new Error('address_not_found:404'))).toMatch(/endereço válido/);
    expect(describeCheckoutError(new Error('insufficient_balance:409'))).toMatch(/insuficiente/);
    expect(describeCheckoutError(new Error('coupon_expired:409'))).toMatch(/vencido/);
  });

  it('401 vira mensagem de sessao expirada mesmo sem codigo mapeado', () => {
    expect(describeCheckoutError(new Error('algum_codigo:401'))).toMatch(/sessão expirou/);
  });

  it('503 sem codigo mapeado cai no fallback do kill-switch', () => {
    expect(describeCheckoutError(new Error('outro_codigo:503'))).toMatch(/não está disponível/);
  });

  it('codigo desconhecido cai no fallback generico', () => {
    expect(describeCheckoutError(new Error('nunca_visto:418'))).toBe('Não foi possível concluir o resgate agora.');
  });
});

describe('isCheckoutAuthError', () => {
  it('reconhece 401 e o codigo unauthorized', () => {
    expect(isCheckoutAuthError(new Error('qualquer:401'))).toBe(true);
    expect(isCheckoutAuthError(new Error('unauthorized:403'))).toBe(true);
    expect(isCheckoutAuthError(new Error('address_not_found:404'))).toBe(false);
  });
});

describe('isRewardRedemptionEnabled', () => {
  const original = process.env.REACT_APP_REWARD_REDEMPTION_ENABLED;
  afterEach(() => {
    process.env.REACT_APP_REWARD_REDEMPTION_ENABLED = original;
  });

  it('default (ausente) e false', () => {
    delete process.env.REACT_APP_REWARD_REDEMPTION_ENABLED;
    expect(isRewardRedemptionEnabled()).toBe(false);
  });

  it("so 'true' exato liga", () => {
    process.env.REACT_APP_REWARD_REDEMPTION_ENABLED = 'true';
    expect(isRewardRedemptionEnabled()).toBe(true);
    process.env.REACT_APP_REWARD_REDEMPTION_ENABLED = 'TRUE';
    expect(isRewardRedemptionEnabled()).toBe(true);
    process.env.REACT_APP_REWARD_REDEMPTION_ENABLED = 'false';
    expect(isRewardRedemptionEnabled()).toBe(false);
    process.env.REACT_APP_REWARD_REDEMPTION_ENABLED = '1';
    expect(isRewardRedemptionEnabled()).toBe(false);
  });
});
