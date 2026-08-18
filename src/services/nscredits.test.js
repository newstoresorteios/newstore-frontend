// Testes do cliente da carteira de NSCreditos.
// Execute com: npm test

import {
  getMyNsCredits,
  searchNsCreditUsers,
  getNsCreditWallet,
  applyNsCreditAdjustment,
  newIdempotencyKey,
  parseNsCreditAmountInput,
  formatNsCredits,
  describeNsCreditError,
  parseApiError,
} from './nscredits';

import { getJSON, postJSON } from '../lib/api';

jest.mock('../lib/api', () => ({
  getJSON: jest.fn(() => Promise.resolve({})),
  postJSON: jest.fn(() => Promise.resolve({})),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('parseNsCreditAmountInput', () => {
  it('aceita inteiros positivos', () => {
    expect(parseNsCreditAmountInput('1')).toBe(1);
    expect(parseNsCreditAmountInput('100')).toBe(100);
    expect(parseNsCreditAmountInput('5000')).toBe(5000);
    expect(parseNsCreditAmountInput('100000')).toBe(100000);
    expect(parseNsCreditAmountInput(' 2000 ')).toBe(2000);
    expect(parseNsCreditAmountInput(2000)).toBe(2000);
  });

  it('rejeita zero, negativo, decimal e nao-numerico', () => {
    expect(parseNsCreditAmountInput('0')).toBeNull();
    expect(parseNsCreditAmountInput('-1')).toBeNull();
    expect(parseNsCreditAmountInput('1.5')).toBeNull();
    expect(parseNsCreditAmountInput('1000abc')).toBeNull();
    expect(parseNsCreditAmountInput('')).toBeNull();
    expect(parseNsCreditAmountInput(null)).toBeNull();
    expect(parseNsCreditAmountInput(undefined)).toBeNull();
    expect(parseNsCreditAmountInput(NaN)).toBeNull();
    expect(parseNsCreditAmountInput(true)).toBeNull();
  });

  it('rejeita valor acima da faixa segura', () => {
    expect(parseNsCreditAmountInput(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
    expect(parseNsCreditAmountInput('9007199254740992')).toBeNull();
  });
});

describe('formatNsCredits', () => {
  it('formata em pt-BR sem casas decimais quando o valor e inteiro', () => {
    expect(formatNsCredits(8450)).toBe('8.450');
    expect(formatNsCredits(10500)).toBe('10.500');
    expect(formatNsCredits(0)).toBe('0');
    expect(formatNsCredits(1000000)).toBe('1.000.000');
  });

  it('mostra 2 casas decimais quando o saldo (coupon_value_cents/100) tem fracao', () => {
    expect(formatNsCredits(381.5)).toBe('381,50');
    expect(formatNsCredits(381)).toBe('381');
  });

  it('valor invalido nao vira zero', () => {
    expect(formatNsCredits(null)).toBe('—');
    expect(formatNsCredits(undefined)).toBe('—');
    expect(formatNsCredits('abc')).toBe('—');
  });
});

describe('newIdempotencyKey', () => {
  it('gera chaves distintas e nao usa apenas timestamp', () => {
    const a = newIdempotencyKey();
    const b = newIdempotencyKey();
    expect(a).toBeTruthy();
    expect(a).not.toBe(b);
    expect(/^\d+$/.test(a)).toBe(false);
  });
});

describe('chamadas de API', () => {
  it('o cliente le somente a propria carteira', () => {
    getMyNsCredits();
    expect(getJSON).toHaveBeenCalledWith('/me/nscredits');
  });

  it('a busca administrativa e paginada', () => {
    searchNsCreditUsers({ q: 'joao', page: 2, limit: 20 });
    const url = getJSON.mock.calls[0][0];
    expect(url).toContain('/admin/store/nscredits/users?');
    expect(url).toContain('q=joao');
    expect(url).toContain('page=2');
    expect(url).toContain('limit=20');
  });

  it('busca vazia nao envia q', () => {
    searchNsCreditUsers({ q: '   ', page: 1, limit: 20 });
    expect(getJSON.mock.calls[0][0]).not.toContain('q=');
  });

  it('detalhe da carteira usa o endpoint administrativo', () => {
    getNsCreditWallet(123, { page: 1, limit: 50 });
    expect(getJSON.mock.calls[0][0]).toContain('/admin/store/nscredits/users/123?');
  });

  it('a movimentacao envia operacao, valor, motivo e idempotency_key', () => {
    applyNsCreditAdjustment(123, {
      operation: 'credit',
      amount: '2000',
      reason: '  Bonificacao administrativa  ',
      idempotencyKey: 'chave-1',
    });

    expect(postJSON).toHaveBeenCalledWith('/admin/store/nscredits/users/123/transactions', {
      operation: 'credit',
      amount: 2000,
      reason: 'Bonificacao administrativa',
      idempotency_key: 'chave-1',
    });
  });

  it('NUNCA envia created_by nem balance', () => {
    applyNsCreditAdjustment(123, {
      operation: 'debit',
      amount: 1000,
      reason: 'Correcao',
      idempotencyKey: 'k',
      created_by: 1,
      balance: 999999,
    });

    const body = postJSON.mock.calls[0][1];
    expect(body.created_by).toBeUndefined();
    expect(body.balance).toBeUndefined();
    expect(Object.keys(body).sort()).toEqual(['amount', 'idempotency_key', 'operation', 'reason']);
  });
});

describe('tratamento de erro', () => {
  it('extrai codigo e status', () => {
    expect(parseApiError(new Error('insufficient_balance:409'))).toEqual({
      code: 'insufficient_balance',
      status: 409,
    });
  });

  it('mensagens especificas por tipo de falha', () => {
    expect(describeNsCreditError(new Error('insufficient_balance:409'))).toMatch(/Saldo insuficiente/i);
    expect(describeNsCreditError(new Error('reason_required:400'))).toMatch(/motivo/i);
    expect(describeNsCreditError(new Error('invalid_amount:400'))).toMatch(/inteiro maior que zero/i);
    expect(describeNsCreditError(new Error('user_not_found:404'))).toMatch(/nao encontrado/i);
    expect(describeNsCreditError(new Error('forbidden:403'))).toMatch(/administradores/i);
  });

  it('erro desconhecido usa o fallback', () => {
    expect(describeNsCreditError(new Error('coisa:418'), 'Falhou.')).toBe('Falhou.');
  });
});
