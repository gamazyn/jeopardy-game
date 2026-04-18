import { describe, it, expect } from 'vitest';
import { sanitizePlayerName, sanitizeAnswer, sanitizeText } from '../../utils/sanitize.js';

describe('sanitizePlayerName', () => {
  it('retorna nome sem alterações quando válido', () => {
    expect(sanitizePlayerName('João')).toBe('João');
    expect(sanitizePlayerName('Player 1')).toBe('Player 1');
  });

  it('remove espaços no início e fim', () => {
    expect(sanitizePlayerName('  Alice  ')).toBe('Alice');
    expect(sanitizePlayerName('\tBob\n')).toBe('Bob');
  });

  it('trunca em 30 caracteres', () => {
    const long = 'A'.repeat(50);
    expect(sanitizePlayerName(long)).toHaveLength(30);
  });

  it('remove caracteres perigosos HTML', () => {
    expect(sanitizePlayerName('Alice<script>')).toBe('Alicescript');
    expect(sanitizePlayerName('Bob"name')).toBe('Bobname');
    expect(sanitizePlayerName("Eve'xss")).toBe('Evexss');
    expect(sanitizePlayerName('User`cmd')).toBe('Usercmd');
    expect(sanitizePlayerName('>attack')).toBe('attack');
  });

  it('preserva acentos e caracteres especiais válidos', () => {
    expect(sanitizePlayerName('Ação')).toBe('Ação');
    expect(sanitizePlayerName('Müller')).toBe('Müller');
  });

  it('retorna string vazia para string com apenas espaços', () => {
    expect(sanitizePlayerName('   ')).toBe('');
  });

  it('aplica trim antes do slice', () => {
    const name = '  ' + 'A'.repeat(30) + '  ';
    expect(sanitizePlayerName(name)).toHaveLength(30);
  });
});

describe('sanitizeAnswer', () => {
  it('retorna resposta sem alterações quando válida', () => {
    expect(sanitizeAnswer('O que é Brasília?')).toBe('O que é Brasília?');
  });

  it('remove espaços no início e fim', () => {
    expect(sanitizeAnswer('  resposta  ')).toBe('resposta');
  });

  it('trunca em 500 caracteres', () => {
    const long = 'A'.repeat(600);
    expect(sanitizeAnswer(long)).toHaveLength(500);
  });

  it('NÃO remove caracteres HTML (diferente de sanitizeText)', () => {
    expect(sanitizeAnswer('resposta<b>ok</b>')).toBe('resposta<b>ok</b>');
    expect(sanitizeAnswer('answer "quoted"')).toBe('answer "quoted"');
  });

  it('retorna string vazia para string em branco', () => {
    expect(sanitizeAnswer('   ')).toBe('');
  });
});

describe('sanitizeText', () => {
  it('retorna texto sem alterações quando válido', () => {
    expect(sanitizeText('Texto normal')).toBe('Texto normal');
  });

  it('remove espaços no início e fim', () => {
    expect(sanitizeText('  texto  ')).toBe('texto');
  });

  it('trunca com maxLength padrão de 2000', () => {
    const long = 'A'.repeat(2500);
    expect(sanitizeText(long)).toHaveLength(2000);
  });

  it('trunca com maxLength customizado', () => {
    const long = 'A'.repeat(100);
    expect(sanitizeText(long, 50)).toHaveLength(50);
  });

  it('remove caracteres perigosos HTML', () => {
    expect(sanitizeText('<script>alert(1)</script>')).toBe('scriptalert(1)/script');
    expect(sanitizeText('text"inject')).toBe('textinject');
    expect(sanitizeText("it's")).toBe('its');
    expect(sanitizeText('back`tick')).toBe('backtick');
  });

  it('preserva quebras de linha e espaços internos', () => {
    expect(sanitizeText('linha 1\nlinha 2')).toBe('linha 1\nlinha 2');
  });
});
