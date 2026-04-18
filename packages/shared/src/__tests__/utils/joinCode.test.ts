import { describe, it, expect } from 'vitest';
import { generateJoinCode, isValidJoinCode } from '../../utils/joinCode.js';

const VALID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

describe('generateJoinCode', () => {
  it('gera código com 6 caracteres', () => {
    expect(generateJoinCode()).toHaveLength(6);
  });

  it('usa apenas caracteres do charset', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateJoinCode();
      expect([...code].every((c) => VALID_CHARS.includes(c))).toBe(true);
    }
  });

  it('não usa caracteres ambíguos (0, O, I, 1)', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateJoinCode();
      expect(code).not.toMatch(/[0OI1]/);
    }
  });

  it('gera códigos diferentes em chamadas consecutivas', () => {
    const codes = new Set(Array.from({ length: 20 }, generateJoinCode));
    expect(codes.size).toBeGreaterThan(1);
  });

  it('retorna apenas letras maiúsculas e dígitos', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateJoinCode()).toMatch(/^[A-Z2-9]+$/);
    }
  });
});

describe('isValidJoinCode', () => {
  it('retorna true para código válido de 6 chars', () => {
    expect(isValidJoinCode('ABCDEF')).toBe(true);
    expect(isValidJoinCode('234567')).toBe(true);
    expect(isValidJoinCode('HJKLMN')).toBe(true);
  });

  it('retorna false para código com comprimento errado', () => {
    expect(isValidJoinCode('')).toBe(false);
    expect(isValidJoinCode('ABC')).toBe(false);
    expect(isValidJoinCode('ABCDEFG')).toBe(false);
  });

  it('retorna false para caracteres inválidos', () => {
    expect(isValidJoinCode('ABCDE0')).toBe(false);
    expect(isValidJoinCode('ABCDEO')).toBe(false);
    expect(isValidJoinCode('ABCDEI')).toBe(false);
    expect(isValidJoinCode('ABCDE1')).toBe(false);
  });

  it('retorna false para letras minúsculas', () => {
    expect(isValidJoinCode('abcdef')).toBe(false);
    expect(isValidJoinCode('ABCDef')).toBe(false);
  });

  it('retorna false para caracteres especiais', () => {
    expect(isValidJoinCode('ABC!EF')).toBe(false);
    expect(isValidJoinCode('ABC EF')).toBe(false);
  });

  it('valida códigos gerados por generateJoinCode', () => {
    for (let i = 0; i < 20; i++) {
      expect(isValidJoinCode(generateJoinCode())).toBe(true);
    }
  });
});
