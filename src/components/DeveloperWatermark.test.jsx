// Assinatura institucional: aparece no rodape das areas publicas, some no /admin.
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
  it.each(PUBLICAS)('mostra a assinatura no rodape em %s', (path) => {
    renderAt(path);
    expect(screen.getByText('Desenvolvido por')).toBeInTheDocument();
    expect(screen.getByText('Tironi Tech')).toBeInTheDocument();
    expect(screen.getByTestId('developer-watermark').tagName.toLowerCase()).toBe('footer');
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

describe('e um rodape de documento, nao um overlay', () => {
  it('nao usa position fixed (nao cobre a pagina)', () => {
    renderAt('/');
    expect(screen.getByTestId('developer-watermark')).not.toHaveStyle({ position: 'fixed' });
  });

  it('nao e focavel pelo teclado (assinatura, nao controle)', () => {
    renderAt('/');
    const el = screen.getByTestId('developer-watermark');
    expect(el.querySelector('a, button, [tabindex]')).toBeNull();
  });
});
