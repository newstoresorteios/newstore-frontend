// Testes da chamada da Loja de Prêmios na landing dos sorteios.
//
// FASE 5, item 45-51: a propaganda deixou de viver nas bordas (rails) e
// passou a ficar no fluxo normal do conteúdo, entre o sorteio principal e o
// bloco de sorteio adicional (quando existir).
//
// Execute com: npm test

import React from 'react';
import { render, screen } from '@testing-library/react';

// react-router-dom v7 é ESM-only: o resolver do react-scripts 5 não o carrega
// em ambiente de teste.
jest.mock(
  'react-router-dom',
  () => ({
    useNavigate: () => jest.fn(),
    Link: ({ children, to, ...rest }) => (
      <a href={to} {...rest}>
        {children}
      </a>
    ),
  }),
  { virtual: true }
);

jest.mock('./authContext', () => ({
  useAuth: () => ({ user: null, loading: false, logout: jest.fn() }),
}));

jest.mock('./services/pix', () => ({
  createPixPayment: jest.fn(),
  checkPixStatus: jest.fn(),
}));

import NewStorePage from './NewStorePage';

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({}),
      text: () => Promise.resolve('{}'),
    })
  );
});

it('mostra a chamada da Loja de Prêmios uma única vez', async () => {
  render(<NewStorePage />);

  expect(await screen.findAllByText('LOJA DE PRÊMIOS NS')).toHaveLength(1);
  expect(screen.getByText('Seus NSCréditos valem prêmios.')).toBeInTheDocument();
  expect(screen.getByText(/Conheça os produtos disponíveis na New Store/i)).toBeInTheDocument();
});

it('o CTA da loja leva para /loja', async () => {
  render(<NewStorePage />);

  const cta = await screen.findByText('VER PRÊMIOS');
  const link = cta.closest('a');
  expect(link).toBeTruthy();
  expect(link.getAttribute('href')).toBe('/loja');
});

it('não mostra saldo fictício de NSCréditos', async () => {
  const { container } = render(<NewStorePage />);

  await screen.findAllByText('LOJA DE PRÊMIOS NS');
  // A carteira do cliente ainda não existe: nada de "Você possui N NSCréditos".
  expect(container.textContent).not.toMatch(/você possui[\s\S]{0,20}nscréditos/i);
  expect(container.textContent).not.toMatch(/saldo[\s\S]{0,20}nscréditos/i);
});

it('a landing do sorteio continua renderizando', async () => {
  render(<NewStorePage />);

  await screen.findAllByText('LOJA DE PRÊMIOS NS');
  expect(screen.getByText(/Bem-vindos ao Sorteio da/i)).toBeInTheDocument();
  expect(screen.getByText(/Participe, concorra e ainda receba 100% do valor de volta/i)).toBeInTheDocument();
});

it('ordem no DOM: sorteio principal < propaganda da Loja < bloco de sorteio adicional', async () => {
  const { container } = render(<NewStorePage />);

  await screen.findAllByText('LOJA DE PRÊMIOS NS');
  const texto = container.textContent;

  const intro = texto.indexOf('Bem-vindos ao Sorteio da');
  const fimDaCartela = texto.indexOf('primeiro sorteio da');
  const banner = texto.indexOf('LOJA DE PRÊMIOS NS');
  // Sem sorteio adicional mockado, este é o marcador real do bloco (item 50:
  // a propaganda não pode depender de existir um sorteio adicional).
  const blocoAdicional = texto.indexOf('Nenhum sorteio adicional aberto no momento');

  expect(intro).toBeGreaterThanOrEqual(0);
  expect(fimDaCartela).toBeGreaterThan(intro);
  expect(banner).toBeGreaterThan(fimDaCartela);
  expect(blocoAdicional).toBeGreaterThan(banner);
});

it('não existem mais colunas fixas (rails) nas bordas da página', async () => {
  render(<NewStorePage />);
  await screen.findAllByText('LOJA DE PRÊMIOS NS');

  const rails = document.querySelectorAll('[aria-label="Loja de Prêmios NS"]');
  // Um único banner, no fluxo normal — nenhum elemento position:fixed.
  expect(rails.length).toBe(1);
  expect(window.getComputedStyle(rails[0]).position).not.toBe('fixed');
});

it('o banner participa do layout normal (não é absoluto/fixo, não poderia sobrepor a cartela)', async () => {
  render(<NewStorePage />);
  await screen.findAllByText('LOJA DE PRÊMIOS NS');

  const banner = document.querySelector('[aria-label="Loja de Prêmios NS"]');
  const position = window.getComputedStyle(banner).position;
  expect(['static', 'relative', '']).toContain(position);
});
