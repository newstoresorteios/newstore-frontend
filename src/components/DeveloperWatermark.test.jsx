// Assinatura institucional: aparece nas areas publicas, some no /admin.
//
// react-router-dom v7 usa "exports" no package.json e o resolver do Jest do
// CRA nao o enxerga -- por isso o projeto inteiro mocka o router virtualmente.
// Seguimos a mesma convencao aqui.
import React from 'react';
import { render, screen } from '@testing-library/react';

// prefixo `mock` exigido pelo Jest para variavel usada dentro de jest.mock()
let mockPath = '/';
jest.mock('react-router-dom', () => ({ useLocation: () => ({ pathname: mockPath }) }), { virtual: true });

import DeveloperWatermark, { isAdminPath } from './DeveloperWatermark';

function renderAt(path) {
  mockPath = path;
  return render(<DeveloperWatermark />);
}

const PUBLICAS = ['/', '/loja', '/loja/produto/14518', '/loja/resgate', '/loja/pedidos', '/conta'];

describe('rotas publicas', () => {
  it.each(PUBLICAS)('mostra a assinatura em %s', (path) => {
    renderAt(path);
    expect(screen.getByText('Desenvolvido por')).toBeInTheDocument();
    expect(screen.getByText('Tironi Tech')).toBeInTheDocument();
  });

  it('mostra o monograma TT', () => {
    renderAt('/');
    expect(screen.getByText('TT')).toBeInTheDocument();
  });
});

describe('painel administrativo', () => {
  it.each(['/admin', '/admin/loja-premios', '/admin/sorteios'])('NAO mostra a assinatura em %s', (path) => {
    renderAt(path);
    expect(screen.queryByText('Tironi Tech')).not.toBeInTheDocument();
    expect(screen.queryByTestId('developer-watermark')).not.toBeInTheDocument();
  });

  it('isAdminPath distingue /admin de rotas que so comecam parecido', () => {
    expect(isAdminPath('/admin')).toBe(true);
    expect(isAdminPath('/admin/loja-premios')).toBe(true);
    // nao pode esconder uma rota publica so por conter "admin" no meio
    expect(isAdminPath('/loja')).toBe(false);
    expect(isAdminPath('/administrativo-publico')).toBe(false);
    expect(isAdminPath('')).toBe(false);
  });
});

describe('nao atrapalha a UX', () => {
  it('nunca intercepta clique (pointer-events none)', () => {
    renderAt('/loja');
    expect(screen.getByTestId('developer-watermark')).toHaveStyle({ pointerEvents: 'none' });
  });

  it('fica abaixo de drawer/modal/overlays na pilha de z-index', () => {
    renderAt('/loja');
    const z = Number(screen.getByTestId('developer-watermark').style.zIndex);
    // drawer do carrinho 1200, resumo flutuante 1250, modal 1300, push 2000
    expect(z).toBeLessThan(1200);
  });

  it('nao e focavel pelo teclado (assinatura, nao controle)', () => {
    renderAt('/');
    const el = screen.getByTestId('developer-watermark');
    expect(el.querySelector('a, button, [tabindex]')).toBeNull();
  });

  it('nao estoura a largura da tela', () => {
    renderAt('/');
    expect(screen.getByTestId('developer-watermark')).toHaveStyle({ maxWidth: 'calc(100vw - 16px)' });
  });
});
