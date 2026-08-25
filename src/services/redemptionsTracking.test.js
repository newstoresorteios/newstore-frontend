// Cliente de acompanhamento logístico (domínio da Tray) — somente leitura.

import {
  getMyRedemptionTrayStatus,
  describeLogisticsPhase,
  describeTrackingUnavailable,
  describeRedemptionStatus,
} from './redemptions';

function mockFetchOk(body = {}) {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve(body),
    })
  );
}

afterEach(() => {
  delete global.fetch;
});

describe('endpoint de acompanhamento', () => {
  it('consulta pelo ID do RESGATE, nunca pelo número do pedido Tray', async () => {
    mockFetchOk({ available: false });
    await getMyRedemptionTrayStatus('aaaaaaaa-1111-2222-3333-444444444444');

    const url = String(global.fetch.mock.calls[0][0]);
    expect(url).toContain('/store/redemptions/aaaaaaaa-1111-2222-3333-444444444444/tray-status');
    // O navegador nunca informa tray_order_id — ele sai do banco, no backend.
    expect(url).not.toMatch(/tray_order_id|order_id=/);
  });

  it('usa a rota pública do cliente, nunca a rota de admin', async () => {
    mockFetchOk({});
    await getMyRedemptionTrayStatus('aaaaaaaa-1111-2222-3333-444444444444');

    const url = String(global.fetch.mock.calls[0][0]);
    expect(url).not.toContain('/admin/');
  });

  it('é somente leitura (GET) e não fala direto com a Tray', async () => {
    mockFetchOk({});
    await getMyRedemptionTrayStatus('aaaaaaaa-1111-2222-3333-444444444444');

    const [url, options] = global.fetch.mock.calls[0];
    expect(String(options?.method || 'GET').toUpperCase()).toBe('GET');
    expect(String(url)).not.toMatch(/tray\.com\.br|web_api|\/orders\//i);
  });
});

describe('fases logísticas', () => {
  it('traduz apenas as fases que a Tray comprova', () => {
    expect(describeLogisticsPhase('received')).toBe('Pedido recebido pela Tray');
    expect(describeLogisticsPhase('shipped')).toBe('Pedido enviado');
    expect(describeLogisticsPhase('canceled')).toBe('Pedido cancelado');
  });

  it('não existe fase "entregue" — a Tray não fornece essa evidência', () => {
    expect(describeLogisticsPhase('delivered')).not.toMatch(/entregue/i);
  });

  it('fase desconhecida cai no rótulo que o backend mandou, nunca em invenção', () => {
    expect(describeLogisticsPhase('fase_nova', 'Rótulo do backend')).toBe('Rótulo do backend');
    expect(describeLogisticsPhase('fase_nova')).toBe('Acompanhamento indisponível');
  });
});

describe('indisponibilidade', () => {
  it('Tray fora do ar: o resgate continua registrado', () => {
    const msg = describeTrackingUnavailable({ available: false, temporarily_unavailable: true });
    expect(msg).toMatch(/não foi possível atualizar o acompanhamento/i);
    expect(msg).toMatch(/resgate continua registrado/i);
  });

  it('sem pedido Tray a mensagem é factual, não é erro', () => {
    expect(describeTrackingUnavailable({ available: false, reason: 'tray_order_not_created' })).toMatch(
      /ainda não gerou pedido de entrega/i
    );
  });
});

describe('separação de domínios', () => {
  it('o status do RESGATE e a fase LOGÍSTICA são vocabulários distintos', () => {
    // NewStore fala de resgate...
    expect(describeRedemptionStatus('confirmed')).toBe('Confirmado');
    // ...a Tray fala de entrega. Nenhum dos dois usa o rótulo do outro.
    expect(describeLogisticsPhase('shipped')).toBe('Pedido enviado');
    expect(describeRedemptionStatus('confirmed')).not.toMatch(/enviado|entregue/i);
  });
});
