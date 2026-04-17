import type { GameConfig, MediaAsset } from './game.js';
import type { Player } from './player.js';
import type { ActiveQuestion, BuzzerEntry, GamePhase, ChallengeState } from './state.js';

// ============================================================
// CLIENT → SERVER
// ============================================================

export interface C2S_HostCreate {
  gameConfigId: string;
}

export interface C2S_PlayerJoin {
  joinCode: string;
  playerName: string;
}

export interface C2S_HostStart {
  sessionId: string;
  hostToken: string;
}

export interface C2S_HostSelectQuestion {
  sessionId: string;
  hostToken: string;
  categoryId: string;
  questionId: string;
}

export interface C2S_HostJudge {
  sessionId: string;
  hostToken: string;
  playerId: string;
  correct: boolean;
}

export interface C2S_HostSkipPlayer {
  sessionId: string;
  hostToken: string;
  playerId: string;
}

export interface C2S_HostAdjustScore {
  sessionId: string;
  hostToken: string;
  playerId: string;
  delta: number;
}

export interface C2S_HostTimerControl {
  sessionId: string;
  hostToken: string;
  action: 'pause' | 'resume' | 'extend' | 'set';
  seconds?: number;
}

export interface C2S_HostClearQuestion {
  sessionId: string;
  hostToken: string;
}

export interface C2S_HostContinueBoard {
  sessionId: string;
  hostToken: string;
}

export interface C2S_HostAudioControl {
  sessionId: string;
  hostToken: string;
  action: 'play' | 'pause' | 'seek';
  currentTime: number;
}

export interface S2C_AudioSync {
  action: 'play' | 'pause' | 'seek';
  currentTime: number;
}

export interface C2S_HostStartFinal {
  sessionId: string;
  hostToken: string;
}

export interface C2S_HostRevealFinal {
  sessionId: string;
  hostToken: string;
  playerId: string;
  isCorrect: boolean;
}

export interface C2S_HostEndGame {
  sessionId: string;
  hostToken: string;
}

export interface C2S_PlayerBuzz {
  sessionId: string;
  playerId: string;
}

export interface C2S_PlayerFinalWager {
  sessionId: string;
  playerId: string;
  amount: number;
  answer: string;
}

// Dupla Aposta: host atribui a um jogador
export interface C2S_HostAssignDouble {
  sessionId: string;
  hostToken: string;
  playerId: string;
}

// Dupla Aposta: jogador envia a aposta
export interface C2S_PlayerDoubleWager {
  sessionId: string;
  playerId: string;
  amount: number;
}

// Challenge: host seleciona quem será desafiado
export interface C2S_HostSetChallenge {
  sessionId: string;
  hostToken: string;
  challengedId: string;
}

// ============================================================
// SERVER → CLIENT
// ============================================================

export interface S2C_Error {
  code: string;
  message: string;
}

export interface S2C_SessionCreated {
  sessionId: string;
  hostToken: string;
  tunnelUrl: string | null;
  localUrl: string | null;
}

export interface S2C_PlayerJoined {
  player: Player;
  allPlayers: Player[];
}

export interface S2C_PlayerLeft {
  playerId: string;
  allPlayers: Player[];
}

export interface S2C_GameStarted {
  gameConfig: Omit<GameConfig, 'finalChallengeAnswer'>;
  players: Player[];
}

export interface S2C_QuestionSelected {
  activeQuestion: ActiveQuestion;
  phase: GamePhase;
}

export interface S2C_QuestionClosed {
  questionId: string;
  categoryId: string;
  phase: GamePhase;
}

export interface S2C_QuestionAnswerReveal {
  phase: 'answer_reveal';
}

export interface S2C_BuzzerConfirmed {
  position: number;
}

export interface S2C_BuzzerQueueUpdate {
  queue: BuzzerEntry[];
  phase: GamePhase;
}

export interface S2C_JudgeResult {
  playerId: string;
  correct: boolean;
  scoreChange: number;
  newScore: number;
  nextInQueue: BuzzerEntry | null;
  phase: GamePhase;
}

export interface S2C_ScoreUpdate {
  players: Player[];
}

export interface S2C_TimerUpdate {
  action: 'start' | 'tick' | 'pause' | 'resume' | 'extend' | 'expired';
  remainingMs: number;
  totalMs: number;
}

export interface S2C_FinalChallengeStarted {
  clue: string;
  media?: MediaAsset;
  wagerDeadlineMs: number;
}

// Enviado a TODOS quando um player submete aposta (sem valores)
export interface S2C_FinalWagerConfirmed {
  playerId: string;
  playerName: string;
  totalSubmitted: number;
  totalPlayers: number;
}

// Enviado APENAS ao host com os detalhes da aposta
export interface S2C_FinalHostWagerReceived {
  playerId: string;
  playerName: string;
  amount: number;
  answer: string;
}

// Enviado APENAS ao host ao iniciar o Desafio Final
export interface S2C_FinalHostDetails {
  correctAnswer: string;
}

export interface S2C_FinalRevealed {
  playerId: string;
  playerName: string;
  wager: number;
  answer: string;
  isCorrect: boolean;
  oldScore: number;
  newScore: number;
}

export interface S2C_GameOver {
  finalScores: Player[];
  winnerId: string;
}

// Dupla Aposta: anuncio do jogador atribuído (null = aguardando atribuição)
export interface S2C_DoubleStarted {
  assignedPlayerId: string | null;
  assignedPlayerName: string | null;
}

// Dupla Aposta: aposta confirmada, clue vai revelar
export interface S2C_DoubleWagerLocked {
  assignedPlayerId: string;
  amount: number;
}

// Challenge: host definiu o par desafiador/desafiado
export interface S2C_ChallengeAssigned {
  challengeState: ChallengeState;
}

// ============================================================
// Mapa de eventos tipados para uso no Socket.io
// ============================================================

export interface ServerToClientEvents {
  'error': (data: S2C_Error) => void;
  'session:created': (data: S2C_SessionCreated) => void;
  'player:joined': (data: S2C_PlayerJoined) => void;
  'player:left': (data: S2C_PlayerLeft) => void;
  'game:started': (data: S2C_GameStarted) => void;
  'question:selected': (data: S2C_QuestionSelected) => void;
  'question:closed': (data: S2C_QuestionClosed) => void;
  'question:answerReveal': (data: S2C_QuestionAnswerReveal) => void;
  'audio:sync': (data: S2C_AudioSync) => void;
  'buzzer:opened': () => void;
  'buzzer:confirmed': (data: S2C_BuzzerConfirmed) => void;
  'buzzer:queueUpdate': (data: S2C_BuzzerQueueUpdate) => void;
  'judge:result': (data: S2C_JudgeResult) => void;
  'score:update': (data: S2C_ScoreUpdate) => void;
  'timer:update': (data: S2C_TimerUpdate) => void;
  'final:started': (data: S2C_FinalChallengeStarted) => void;
  'final:wagerConfirmed': (data: S2C_FinalWagerConfirmed) => void;
  'final:hostWagerReceived': (data: S2C_FinalHostWagerReceived) => void;
  'final:hostDetails': (data: S2C_FinalHostDetails) => void;
  'final:revealed': (data: S2C_FinalRevealed) => void;
  'game:over': (data: S2C_GameOver) => void;
  'double:started': (data: S2C_DoubleStarted) => void;
  'double:wagerLocked': (data: S2C_DoubleWagerLocked) => void;
  'challenge:assigned': (data: S2C_ChallengeAssigned) => void;
}

export interface ClientToServerEvents {
  'host:create': (data: C2S_HostCreate, ack: (res: S2C_SessionCreated | S2C_Error) => void) => void;
  'player:join': (data: C2S_PlayerJoin) => void;
  'host:start': (data: C2S_HostStart) => void;
  'host:selectQuestion': (data: C2S_HostSelectQuestion) => void;
  'host:judge': (data: C2S_HostJudge) => void;
  'host:skipPlayer': (data: C2S_HostSkipPlayer) => void;
  'host:adjustScore': (data: C2S_HostAdjustScore) => void;
  'host:timerControl': (data: C2S_HostTimerControl) => void;
  'host:clearQuestion': (data: C2S_HostClearQuestion) => void;
  'host:continueBoard': (data: C2S_HostContinueBoard) => void;
  'host:audioControl': (data: C2S_HostAudioControl) => void;
  'host:startFinal': (data: C2S_HostStartFinal) => void;
  'host:revealFinal': (data: C2S_HostRevealFinal) => void;
  'host:endGame': (data: C2S_HostEndGame) => void;
  'player:buzz': (data: C2S_PlayerBuzz) => void;
  'player:finalWager': (data: C2S_PlayerFinalWager) => void;
  'host:assignDouble': (data: C2S_HostAssignDouble) => void;
  'player:doubleWager': (data: C2S_PlayerDoubleWager) => void;
  'host:setChallenge': (data: C2S_HostSetChallenge) => void;
}
