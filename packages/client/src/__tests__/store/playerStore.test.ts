import { describe, it, expect, beforeEach } from 'vitest';
import { usePlayerStore } from '../../store/playerStore.js';

beforeEach(() => {
  usePlayerStore.setState({ myId: null, myName: '', buzzerPosition: null });
});

describe('setMyId', () => {
  it('configura o ID do socket', () => {
    usePlayerStore.getState().setMyId('socket-abc');
    expect(usePlayerStore.getState().myId).toBe('socket-abc');
  });
});

describe('setMyName', () => {
  it('configura o nome do jogador', () => {
    usePlayerStore.getState().setMyName('Alice');
    expect(usePlayerStore.getState().myName).toBe('Alice');
  });

  it('permite sobrescrever nome', () => {
    usePlayerStore.getState().setMyName('Alice');
    usePlayerStore.getState().setMyName('Bob');
    expect(usePlayerStore.getState().myName).toBe('Bob');
  });
});

describe('setBuzzerPosition', () => {
  it('configura posição na fila do buzzer', () => {
    usePlayerStore.getState().setBuzzerPosition(2);
    expect(usePlayerStore.getState().buzzerPosition).toBe(2);
  });

  it('aceita null para limpar posição', () => {
    usePlayerStore.getState().setBuzzerPosition(1);
    usePlayerStore.getState().setBuzzerPosition(null);
    expect(usePlayerStore.getState().buzzerPosition).toBeNull();
  });
});

describe('estado inicial', () => {
  it('myId é null por padrão', () => {
    expect(usePlayerStore.getState().myId).toBeNull();
  });

  it('myName é string vazia por padrão', () => {
    expect(usePlayerStore.getState().myName).toBe('');
  });

  it('buzzerPosition é null por padrão', () => {
    expect(usePlayerStore.getState().buzzerPosition).toBeNull();
  });
});
