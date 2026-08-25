// Cliente administrativo de PEDIDOS / RESGATES — somente leitura.

import {
  describeRedemptionStatus,
  statusChipSx,
  STATUS_CHIP_STYLES,
  describeRedemptionAdminError,
  listRedemptions,
  getRedemption,
  getRedemptionTrayOrder,
  getStoreReports,
} from './redemptionsAdmin';

const CATALOG = [
  { status: 'confirmed', label: 'Confirmado', description: 'Pedido Tray criado.', severity: 'success' },
  { status: 'reconciliation_required', label: 'Requer conciliação', description: 'Conferência manual.', severity: 'warning' },
];

function mockFetchOk(body = {}) {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve(body),
    })
  );
}

describe('status', () => {
  it('usa o catálogo factual do backend quando ele existe', () => {
    expect(describeRedemptionStatus('reconciliation_required', CATALOG).label).toBe('Requer conciliação');
    expect(describeRedemptionStatus('confirmed', CATALOG).severity).toBe('success');
  });

  it('sem catálogo cai no rótulo conhecido, nunca no código cru', () => {
    expect(describeRedemptionStatus('compensated').label).toBe('Compensado');
    expect(describeRedemptionStatus('blocked_tray_profile_incomplete').label).toBe('Bloqueado: perfil incompleto');
  });

  it('status desconhecido não inventa rótulo bonito', () => {
    expect(describeRedemptionStatus('status_novo_do_futuro').label).toBe('status_novo_do_futuro');
  });

  it('cada severidade tem um estilo do tema admin, sem paleta nova', () => {
    for (const severity of ['success', 'info', 'warning', 'error', 'neutral']) {
      expect(STATUS_CHIP_STYLES[severity]).toBeDefined();
      expect(statusChipSx(severity)).toMatchObject(STATUS_CHIP_STYLES[severity]);
    }
    expect(statusChipSx('inexistente')).toMatchObject(STATUS_CHIP_STYLES.neutral);
  });
});

describe('erros', () => {
  it('traduz os códigos próprios do módulo', () => {
    expect(describeRedemptionAdminError(new Error('redemption_not_found:404'))).toMatch(/não encontrado/i);
    expect(describeRedemptionAdminError(new Error('tray_order_not_created:409'))).toMatch(/ainda não gerou pedido/i);
  });

  it('reaproveita as mensagens já existentes da loja', () => {
    expect(describeRedemptionAdminError(new Error('forbidden:403'))).toMatch(/administradores/i);
  });
});

describe('chamadas', () => {
  afterEach(() => {
    delete global.fetch;
  });

  it('a listagem envia os filtros como query string e omite os vazios', async () => {
    mockFetchOk({ items: [] });
    await listRedemptions({ page: 2, limit: 20, q: '25626', status: 'confirmed', from: '', to: '' });

    const url = global.fetch.mock.calls[0][0];
    expect(url).toContain('/admin/store/redemptions?');
    expect(url).toContain('page=2');
    expect(url).toContain('q=25626');
    expect(url).toContain('status=confirmed');
    expect(url).not.toContain('from=');
    expect(url).not.toContain('to=');
  });

  it('todas as chamadas do módulo são GET (nenhuma mutação)', async () => {
    mockFetchOk({});
    await listRedemptions({});
    await getRedemption('11111111-2222-3333-4444-555555555555');
    await getRedemptionTrayOrder('11111111-2222-3333-4444-555555555555');
    await getStoreReports({});

    expect(global.fetch).toHaveBeenCalledTimes(4);
    for (const [, options] of global.fetch.mock.calls) {
      expect(String(options?.method || 'GET').toUpperCase()).toBe('GET');
    }
  });

  it('o status Tray passa pelo backend NewStore, nunca direto na Tray', async () => {
    mockFetchOk({});
    await getRedemptionTrayOrder('11111111-2222-3333-4444-555555555555');

    const url = String(global.fetch.mock.calls[0][0]);
    expect(url).toContain('/admin/store/redemptions/');
    expect(url).toContain('/tray');
    expect(url).not.toMatch(/tray\.com\.br|web_api/i);
  });
});
