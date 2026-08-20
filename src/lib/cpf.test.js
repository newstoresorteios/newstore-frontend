// src/lib/cpf.test.js
import { normalizeCPF, formatCPFInput, maskCPF, isValidCPF } from './cpf';

const VALID_CPF = '11144477735';
const VALID_CPF_B = '52998224725';
const VALID_CPF_LEADING_ZERO = '01065320493';

describe('normalizeCPF', () => {
  it('remove pontuacao, mantem so digitos', () => {
    expect(normalizeCPF('111.444.777-35')).toBe(VALID_CPF);
  });

  it('nunca usa Number -- preserva zero a esquerda', () => {
    expect(normalizeCPF('010.653.204-93')).toBe(VALID_CPF_LEADING_ZERO);
  });

  it('null/undefined vira string vazia, nunca quebra', () => {
    expect(normalizeCPF(null)).toBe('');
    expect(normalizeCPF(undefined)).toBe('');
  });
});

describe('isValidCPF', () => {
  it('aceita CPF valido conhecido, com ou sem formatacao', () => {
    expect(isValidCPF(VALID_CPF)).toBe(true);
    expect(isValidCPF('111.444.777-35')).toBe(true);
    expect(isValidCPF(VALID_CPF_B)).toBe(true);
  });

  it('aceita CPF valido com zero a esquerda', () => {
    expect(isValidCPF(VALID_CPF_LEADING_ZERO)).toBe(true);
  });

  it('rejeita digito verificador incorreto', () => {
    expect(isValidCPF('11144477736')).toBe(false);
  });

  it('rejeita sequencias repetidas (000...-999...)', () => {
    expect(isValidCPF('00000000000')).toBe(false);
    expect(isValidCPF('11111111111')).toBe(false);
    expect(isValidCPF('99999999999')).toBe(false);
  });

  it('rejeita tamanho errado', () => {
    expect(isValidCPF('123')).toBe(false);
    expect(isValidCPF('111444777350')).toBe(false);
  });

  it('rejeita nao-numerico e vazio', () => {
    expect(isValidCPF('abc.def.ghi-jk')).toBe(false);
    expect(isValidCPF('')).toBe(false);
    expect(isValidCPF(null)).toBe(false);
  });
});

describe('formatCPFInput', () => {
  it('formata progressivamente enquanto digita', () => {
    expect(formatCPFInput('111')).toBe('111');
    expect(formatCPFInput('111444')).toBe('111.444');
    expect(formatCPFInput('111444777')).toBe('111.444.777');
    expect(formatCPFInput('11144477735')).toBe('111.444.777-35');
  });

  it('ignora caracteres nao numericos na entrada', () => {
    expect(formatCPFInput('111.444.777-35')).toBe('111.444.777-35');
  });

  it('trunca em 11 digitos, nunca deixa digitar mais', () => {
    expect(formatCPFInput('111444777351234')).toBe('111.444.777-35');
  });
});

describe('maskCPF', () => {
  it('so os dois digitos verificadores ficam visiveis', () => {
    expect(maskCPF(VALID_CPF)).toBe('***.***.***-35');
    expect(maskCPF('111.444.777-35')).toBe('***.***.***-35');
  });

  it('cpf invalido (tamanho errado) nunca produz mascara', () => {
    expect(maskCPF('123')).toBe(null);
    expect(maskCPF('')).toBe(null);
  });
});
