// Evita caracteres ambíguos: 0, O, I, 1
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

export function generateJoinCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return code;
}

export function isValidJoinCode(code: string): boolean {
  if (code.length !== CODE_LENGTH) return false;
  return [...code].every((c) => CHARSET.includes(c));
}
