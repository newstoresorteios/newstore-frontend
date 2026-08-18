// Guarda de rotas da Loja de Prêmios.
//
// App.js importa react-router-dom v7 (ESM-only), que o resolver do
// react-scripts 5 não carrega em teste — por isso a verificação é feita sobre
// o código-fonte do router, e não renderizando <App />.
//
// Execute com: npm test

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const SRC = join(__dirname);
const APP = readFileSync(join(SRC, 'App.js'), 'utf8');

function allSourceFiles(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      allSourceFiles(full, acc);
    } else if (/\.(js|jsx)$/.test(entry) && !/\.test\.(js|jsx)$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

describe('rotas da Loja de Prêmios', () => {
  it('/loja continua existindo como rota pública', () => {
    expect(APP).toMatch(/path="\/loja"/);
  });

  it('/loja/admin não existe mais', () => {
    expect(APP).not.toMatch(/path="\/loja\/admin"/);
  });

  it('as rotas da loja são o catálogo, o detalhe do produto e meus pedidos', () => {
    const rotasDaLoja = [...APP.matchAll(/path="(\/loja[^"]*)"/g)].map((m) => m[1]);
    expect(rotasDaLoja.sort()).toEqual(['/loja', '/loja/pedidos', '/loja/produto/:trayProductId']);
  });

  it('meus pedidos exige autenticação (fica dentro de ProtectedRoute)', () => {
    const trecho = APP.match(/<Route\s+path="\/loja\/pedidos"[\s\S]{0,120}/)?.[0] || '';
    expect(trecho).toMatch(/ProtectedRoute/);
  });

  it('o detalhe do produto é público, sem guarda de admin', () => {
    expect(APP).toMatch(/<Route path="\/loja\/produto\/:trayProductId" element=\{<LojaProdutoPage \/>\} \/>/);
  });

  it('não existe rota de checkout ou resgate nesta fase', () => {
    for (const proibida of ['/loja/checkout', '/loja/resgate', '/loja/pedido', '/loja/carrinho']) {
      expect(APP).not.toContain(`path="${proibida}"`);
    }
  });

  it('o módulo administrativo vive dentro de /admin', () => {
    expect(APP).toMatch(/path="\/admin\/loja-premios"/);
    expect(APP).toMatch(/AdminLojaPremiosPage/);
  });

  it('a rota administrativa da loja é protegida por AdminRoute', () => {
    const trecho = APP.slice(APP.indexOf('path="/admin/loja-premios"'));
    const bloco = trecho.slice(0, trecho.indexOf('/>') + 2);
    expect(bloco).toMatch(/AdminRoute/);
  });

  it('a rota pública /loja não é protegida por AdminRoute', () => {
    expect(APP).toMatch(/<Route path="\/loja" element=\{<LojaPage \/>\} \/>/);
  });
});

describe('nenhuma referência órfã a /loja/admin', () => {
  it('nenhum arquivo do src navega para /loja/admin', () => {
    // Procura o caminho usado como VALOR (entre aspas), não menções em comentário.
    const comoDestino = /["'`]\/loja\/admin["'`]/;
    const ofensores = allSourceFiles(SRC)
      .filter((file) => comoDestino.test(readFileSync(file, 'utf8')))
      .map((file) => file.replace(SRC, ''));
    expect(ofensores).toEqual([]);
  });

  it('a página LojaAdminPage do protótipo não existe mais', () => {
    const arquivos = allSourceFiles(SRC).map((f) => f.replace(SRC, ''));
    expect(arquivos.some((f) => /LojaAdminPage\.jsx$/.test(f))).toBe(false);
  });
});
