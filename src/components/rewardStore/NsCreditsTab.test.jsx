// Testes da aba NSCRÉDITOS do módulo LOJA DE PRÊMIOS NS.
// Execute com: npm test

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('../../services/nscredits', () => {
  const actual = jest.requireActual('../../services/nscredits');
  return {
    ...actual,
    searchNsCreditUsers: jest.fn(),
    getNsCreditWallet: jest.fn(),
    applyNsCreditAdjustment: jest.fn(),
  };
});

import NsCreditsTab from './NsCreditsTab';
import {
  searchNsCreditUsers,
  getNsCreditWallet,
  applyNsCreditAdjustment,
} from '../../services/nscredits';

const USER = { id: 123, name: 'Joao Pedro', email: 'joao@email.com', balance: 8450 };

function wallet(balance = 8450, transactions = []) {
  return {
    user: { id: 123, name: 'Joao Pedro', email: 'joao@email.com' },
    wallet: { balance },
    transactions,
    paging: { page: 1, limit: 50, total: transactions.length },
  };
}

const LEDGER = [
  {
    id: 51,
    operation: 'debit',
    amount: 1550,
    balance_before: 10000,
    balance_after: 8450,
    source_type: 'admin',
    reason: 'Ajuste administrativo',
    created_at: '2026-08-15T13:00:00.000Z',
  },
  {
    id: 50,
    operation: 'credit',
    amount: 10000,
    balance_before: 0,
    balance_after: 10000,
    source_type: 'admin',
    reason: 'Credito inicial',
    created_at: '2026-08-14T13:00:00.000Z',
  },
];

const onNotify = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  searchNsCreditUsers.mockResolvedValue({ items: [USER], paging: { page: 1, limit: 20, total: 1 } });
  getNsCreditWallet.mockResolvedValue(wallet(8450, LEDGER));
  applyNsCreditAdjustment.mockResolvedValue({
    ok: true,
    replayed: false,
    wallet: { balance: 10450 },
    transaction: { id: 52 },
  });
});

async function selectUser() {
  render(<NsCreditsTab onNotify={onNotify} />);
  const card = await screen.findByText('Joao Pedro');
  userEvent.click(card);
  await screen.findByText('SALDO ATUAL');
}

describe('busca de clientes', () => {
  it('lista clientes reais com saldo', async () => {
    render(<NsCreditsTab onNotify={onNotify} />);

    expect(await screen.findByText('Joao Pedro')).toBeInTheDocument();
    expect(screen.getByText(/joao@email.com/)).toBeInTheDocument();
    expect(screen.getByText('8.450')).toBeInTheDocument();
  });

  it('a busca dispara no submit e e paginada', async () => {
    render(<NsCreditsTab onNotify={onNotify} />);
    await screen.findByText('Joao Pedro');
    expect(searchNsCreditUsers).toHaveBeenCalledTimes(1);

    userEvent.type(screen.getByLabelText('Buscar cliente'), 'joao');
    expect(searchNsCreditUsers).toHaveBeenCalledTimes(1);

    userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(searchNsCreditUsers).toHaveBeenCalledTimes(2));
    expect(searchNsCreditUsers).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: 'joao', page: 1, limit: 20 })
    );
  });

  it('estado vazio e informado', async () => {
    searchNsCreditUsers.mockResolvedValue({ items: [], paging: { page: 1, limit: 20, total: 0 } });
    render(<NsCreditsTab onNotify={onNotify} />);
    expect(await screen.findByText(/Nenhum cliente encontrado/i)).toBeInTheDocument();
  });
});

describe('carteira do cliente', () => {
  it('selecionar o cliente mostra saldo e historico', async () => {
    await selectUser();

    expect(getNsCreditWallet).toHaveBeenCalledWith(123, { page: 1, limit: 50 });
    expect(screen.getByText('8.450 NSCréditos')).toBeInTheDocument();
    expect(screen.getByText('Credito inicial')).toBeInTheDocument();
    expect(screen.getByText('Ajuste administrativo')).toBeInTheDocument();
    expect(screen.getByText('+ 10.000')).toBeInTheDocument();
    expect(screen.getByText('− 1.550')).toBeInTheDocument();
  });

  it('sem cliente selecionado, orienta o admin', async () => {
    render(<NsCreditsTab onNotify={onNotify} />);
    await screen.findByText('Joao Pedro');
    expect(screen.getByText(/Selecione um cliente/i)).toBeInTheDocument();
  });
});

describe('modal de adicionar', () => {
  it('exige quantidade e motivo', async () => {
    await selectUser();
    userEvent.click(screen.getByRole('button', { name: /ADICIONAR CRÉDITOS/i }));

    expect(await screen.findByText('Adicionar NSCréditos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CONFIRMAR CRÉDITO' })).toBeDisabled();

    userEvent.type(screen.getByLabelText('Quantidade'), '2000');
    expect(screen.getByRole('button', { name: 'CONFIRMAR CRÉDITO' })).toBeDisabled();

    userEvent.type(screen.getByLabelText('Motivo'), 'Bonificacao administrativa');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'CONFIRMAR CRÉDITO' })).not.toBeDisabled()
    );
  });

  it('mostra o preview do novo saldo', async () => {
    await selectUser();
    userEvent.click(screen.getByRole('button', { name: /ADICIONAR CRÉDITOS/i }));
    await screen.findByText('Adicionar NSCréditos');

    userEvent.type(screen.getByLabelText('Quantidade'), '2000');
    expect(await screen.findByText('10.450 NSCréditos')).toBeInTheDocument();
  });

  it('quantidade invalida nao habilita a confirmacao', async () => {
    await selectUser();
    userEvent.click(screen.getByRole('button', { name: /ADICIONAR CRÉDITOS/i }));
    await screen.findByText('Adicionar NSCréditos');

    const campo = screen.getByLabelText('Quantidade');
    userEvent.type(campo, 'abc1,5');
    expect(campo).toHaveValue('15');

    userEvent.clear(campo);
    userEvent.type(campo, '0');
    userEvent.type(screen.getByLabelText('Motivo'), 'x');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'CONFIRMAR CRÉDITO' })).toBeDisabled()
    );
  });

  it('exige confirmacao explicita antes de executar', async () => {
    await selectUser();
    userEvent.click(screen.getByRole('button', { name: /ADICIONAR CRÉDITOS/i }));
    await screen.findByText('Adicionar NSCréditos');

    userEvent.type(screen.getByLabelText('Quantidade'), '2000');
    userEvent.type(screen.getByLabelText('Motivo'), 'Bonificacao administrativa');
    userEvent.click(await screen.findByRole('button', { name: 'CONFIRMAR CRÉDITO' }));

    // Primeiro clique so pede confirmacao: nada foi enviado ainda.
    expect(await screen.findByText(/Você está adicionando 2.000 NSCréditos para Joao Pedro/i)).toBeInTheDocument();
    expect(applyNsCreditAdjustment).not.toHaveBeenCalled();

    userEvent.click(screen.getByRole('button', { name: 'CONFIRMAR' }));
    await waitFor(() => expect(applyNsCreditAdjustment).toHaveBeenCalledTimes(1));
  });

  it('envia operacao, valor, motivo e idempotency key', async () => {
    await selectUser();
    userEvent.click(screen.getByRole('button', { name: /ADICIONAR CRÉDITOS/i }));
    await screen.findByText('Adicionar NSCréditos');

    userEvent.type(screen.getByLabelText('Quantidade'), '2000');
    userEvent.type(screen.getByLabelText('Motivo'), 'Bonificacao administrativa');
    userEvent.click(await screen.findByRole('button', { name: 'CONFIRMAR CRÉDITO' }));
    userEvent.click(await screen.findByRole('button', { name: 'CONFIRMAR' }));

    await waitFor(() => expect(applyNsCreditAdjustment).toHaveBeenCalled());
    const [userId, payload] = applyNsCreditAdjustment.mock.calls[0];
    expect(userId).toBe(123);
    expect(payload.operation).toBe('credit');
    expect(payload.amount).toBe(2000);
    expect(payload.reason).toBe('Bonificacao administrativa');
    expect(payload.idempotencyKey).toBeTruthy();
  });

  it('atualiza saldo e ledger apos o sucesso', async () => {
    await selectUser();
    getNsCreditWallet.mockResolvedValue(
      wallet(10450, [
        { id: 52, operation: 'credit', amount: 2000, balance_before: 8450, balance_after: 10450, source_type: 'admin', reason: 'Bonificacao administrativa', created_at: '2026-08-16T13:00:00.000Z' },
        ...LEDGER,
      ])
    );

    userEvent.click(screen.getByRole('button', { name: /ADICIONAR CRÉDITOS/i }));
    await screen.findByText('Adicionar NSCréditos');
    userEvent.type(screen.getByLabelText('Quantidade'), '2000');
    userEvent.type(screen.getByLabelText('Motivo'), 'Bonificacao administrativa');
    userEvent.click(await screen.findByRole('button', { name: 'CONFIRMAR CRÉDITO' }));
    userEvent.click(await screen.findByRole('button', { name: 'CONFIRMAR' }));

    expect(await screen.findByText('10.450 NSCréditos')).toBeInTheDocument();
    expect(await screen.findByText('+ 2.000')).toBeInTheDocument();
    expect(getNsCreditWallet).toHaveBeenCalledTimes(2);
  });
});

describe('modal de remover', () => {
  it('bloqueia debito maior que o saldo', async () => {
    await selectUser();
    userEvent.click(screen.getByRole('button', { name: /REMOVER CRÉDITOS/i }));
    await screen.findByText('Remover NSCréditos');

    userEvent.type(screen.getByLabelText('Quantidade'), '99999');
    userEvent.type(screen.getByLabelText('Motivo'), 'Correcao');

    expect(await screen.findByText('Saldo insuficiente.')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'CONFIRMAR DÉBITO' })).toBeDisabled()
    );
    expect(applyNsCreditAdjustment).not.toHaveBeenCalled();
  });

  it('debito valido mostra o preview e envia operation debit', async () => {
    applyNsCreditAdjustment.mockResolvedValue({ ok: true, replayed: false, wallet: { balance: 7450 }, transaction: { id: 53 } });
    await selectUser();
    userEvent.click(screen.getByRole('button', { name: /REMOVER CRÉDITOS/i }));
    await screen.findByText('Remover NSCréditos');

    userEvent.type(screen.getByLabelText('Quantidade'), '1000');
    userEvent.type(screen.getByLabelText('Motivo'), 'Correcao administrativa');
    expect(await screen.findByText('7.450 NSCréditos')).toBeInTheDocument();

    userEvent.click(screen.getByRole('button', { name: 'CONFIRMAR DÉBITO' }));
    expect(await screen.findByText(/Você está removendo 1.000 NSCréditos de Joao Pedro/i)).toBeInTheDocument();

    userEvent.click(screen.getByRole('button', { name: 'CONFIRMAR' }));
    await waitFor(() => expect(applyNsCreditAdjustment).toHaveBeenCalled());
    expect(applyNsCreditAdjustment.mock.calls[0][1].operation).toBe('debit');
  });
});

describe('robustez', () => {
  it('erro do backend e exibido ao admin', async () => {
    applyNsCreditAdjustment.mockRejectedValue(new Error('insufficient_balance:409'));
    await selectUser();

    userEvent.click(screen.getByRole('button', { name: /ADICIONAR CRÉDITOS/i }));
    await screen.findByText('Adicionar NSCréditos');
    userEvent.type(screen.getByLabelText('Quantidade'), '2000');
    userEvent.type(screen.getByLabelText('Motivo'), 'Teste');
    userEvent.click(await screen.findByRole('button', { name: 'CONFIRMAR CRÉDITO' }));
    userEvent.click(await screen.findByRole('button', { name: 'CONFIRMAR' }));

    await waitFor(() =>
      expect(onNotify).toHaveBeenCalledWith(expect.stringMatching(/Saldo insuficiente/i), 'error')
    );
  });

  it('dupla submissao fica bloqueada enquanto a requisicao esta em andamento', async () => {
    let resolver;
    applyNsCreditAdjustment.mockReturnValue(new Promise((r) => { resolver = r; }));
    await selectUser();

    userEvent.click(screen.getByRole('button', { name: /ADICIONAR CRÉDITOS/i }));
    await screen.findByText('Adicionar NSCréditos');
    userEvent.type(screen.getByLabelText('Quantidade'), '2000');
    userEvent.type(screen.getByLabelText('Motivo'), 'Teste');
    userEvent.click(await screen.findByRole('button', { name: 'CONFIRMAR CRÉDITO' }));

    const confirmar = await screen.findByRole('button', { name: 'CONFIRMAR' });
    userEvent.click(confirmar);
    await waitFor(() => expect(applyNsCreditAdjustment).toHaveBeenCalledTimes(1));

    // Enquanto o request roda, o botao fica desabilitado: um segundo clique
    // e simplesmente impossivel, entao nao ha como duplicar a movimentacao.
    await waitFor(() => expect(confirmar).toBeDisabled());
    expect(applyNsCreditAdjustment).toHaveBeenCalledTimes(1);

    resolver({ ok: true, replayed: false, wallet: { balance: 10450 }, transaction: { id: 52 } });
    await waitFor(() => expect(getNsCreditWallet).toHaveBeenCalledTimes(2));
  });

  it('resposta repetida (idempotencia) avisa sem duplicar', async () => {
    applyNsCreditAdjustment.mockResolvedValue({ ok: true, replayed: true, wallet: { balance: 8450 }, transaction: { id: 51 } });
    await selectUser();

    userEvent.click(screen.getByRole('button', { name: /ADICIONAR CRÉDITOS/i }));
    await screen.findByText('Adicionar NSCréditos');
    userEvent.type(screen.getByLabelText('Quantidade'), '2000');
    userEvent.type(screen.getByLabelText('Motivo'), 'Teste');
    userEvent.click(await screen.findByRole('button', { name: 'CONFIRMAR CRÉDITO' }));
    userEvent.click(await screen.findByRole('button', { name: 'CONFIRMAR' }));

    await waitFor(() =>
      expect(onNotify).toHaveBeenCalledWith(expect.stringMatching(/já havia sido registrada/i), 'info')
    );
  });
});
