export function sanitizePlayerName(name: string): string {
  return name.trim().slice(0, 30).replace(/[<>"'`]/g, '');
}

export function sanitizeAnswer(answer: string): string {
  return answer.trim().slice(0, 500);
}

export function sanitizeText(text: string, maxLength = 2000): string {
  return text.trim().slice(0, maxLength).replace(/[<>"'`]/g, '');
}
