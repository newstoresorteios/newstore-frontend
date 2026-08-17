// Testes da chamada da Loja de Prêmios na landing dos sorteios.
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

it('mostra a chamada da Loja de Prêmios', async () => {
  render(<NewStorePage />);

  expect((await screen.findAllByText('LOJA DE PRÊMIOS NS')).length).toBeGreaterThan(0);
  expect(screen.getAllByText('Seus NSCréditos valem prêmios.').length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Conheça os produtos disponíveis na New Store/i).length).toBeGreaterThan(0);
});

it('todo CTA da loja leva para /loja', async () => {
  render(<NewStorePage />);

  const ctas = await screen.findAllByText('CONHECER A LOJA');
  expect(ctas.length).toBeGreaterThan(0);
  ctas.forEach((cta) => {
    const link = cta.closest('a');
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/loja');
  });
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

it('a chamada da loja NÃO fica mais entre a introdução e a cartela', async () => {
  const { container } = render(<NewStorePage />);

  await screen.findAllByText('LOJA DE PRÊMIOS NS');
  const texto = container.textContent;

  const intro = texto.indexOf('Bem-vindos ao Sorteio da');
  const cartela = texto.indexOf('Sorteio de um Watch Winder');
  const primeiroBanner = texto.indexOf('LOJA DE PRÊMIOS NS');

  expect(intro).toBeGreaterThanOrEqual(0);
  expect(cartela).toBeGreaterThan(intro);
  // O banner não pode estar no intervalo entre a introdução e a cartela.
  expect(primeiroBanner).toBeGreaterThan(cartela);
});

it('a propaganda vive nas bordas (colunas fixas) e numa faixa de rodapé', async () => {
  render(<NewStorePage />);

  // Duas colunas laterais + uma faixa compacta = 3 ocorrências no DOM.
  // A visibilidade de cada uma é decidida por media query no CSS.
  const chamadas = await screen.findAllByText('LOJA DE PRÊMIOS NS');
  expect(chamadas.length).toBe(3);

  const rails = document.querySelectorAll('[aria-label="Loja de Prêmios NS"]');
  expect(rails.length).toBe(2);
});

it('as colunas laterais são fixas e ficam fora do fluxo do conteúdo', async () => {
  render(<NewStorePage />);
  await screen.findAllByText('LOJA DE PRÊMIOS NS');

  const rails = document.querySelectorAll('[aria-label="Loja de Prêmios NS"]');
  rails.forEach((rail) => {
    // position:fixed garante que não empurram a grade do sorteio.
    expect(window.getComputedStyle(rail).position).toBe('fixed');
  });
});
