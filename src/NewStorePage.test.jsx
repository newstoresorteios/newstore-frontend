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

// Fase de testes controlados da Loja NS: a ENTRADA publica a partir da landing
// dos sorteios fica escondida. A loja em si continua existindo e acessivel por
// digitacao direta (/loja) -- ver appRoutes.test.js.
it('nao apresenta a entrada publica da Loja de Premios na landing', async () => {
  render(<NewStorePage />);

  // espera a landing montar antes de afirmar ausencia
  await screen.findByText(/Bem-vindos ao Sorteio da/i);

  expect(screen.queryByText('LOJA DE PRÊMIOS NS')).not.toBeInTheDocument();
  expect(screen.queryByText('VER PRÊMIOS')).not.toBeInTheDocument();
  expect(screen.queryByText('Seus NSCréditos valem prêmios.')).not.toBeInTheDocument();
});

it('nao existe nenhum link para /loja na landing dos sorteios', async () => {
  const { container } = render(<NewStorePage />);

  await screen.findByText(/Bem-vindos ao Sorteio da/i);

  const lojaLinks = Array.from(container.querySelectorAll('a[href]')).filter((a) =>
    (a.getAttribute('href') || '').startsWith('/loja')
  );
  expect(lojaLinks).toHaveLength(0);
});

it('não mostra saldo fictício de NSCréditos', async () => {
  const { container } = render(<NewStorePage />);

  await screen.findByText(/Bem-vindos ao Sorteio da/i);
  // A carteira do cliente ainda não existe: nada de "Você possui N NSCréditos".
  expect(container.textContent).not.toMatch(/você possui[\s\S]{0,20}nscréditos/i);
  expect(container.textContent).not.toMatch(/saldo[\s\S]{0,20}nscréditos/i);
});

it('a landing do sorteio continua renderizando', async () => {
  render(<NewStorePage />);

  await screen.findByText(/Bem-vindos ao Sorteio da/i);
  expect(screen.getByText(/Bem-vindos ao Sorteio da/i)).toBeInTheDocument();
  expect(screen.getByText(/Participe, concorra e ainda receba 100% do valor de volta/i)).toBeInTheDocument();
});

// Os testes de POSICAO/ORDEM da propaganda no DOM da landing sairam junto com a
// propria propaganda: ela esta oculta durante a fase de testes controlados da
// Loja NS. O componente segue em components/rewardStore/LojaPromo.jsx -- quando
// a entrada publica voltar, estes testes voltam com ela.
