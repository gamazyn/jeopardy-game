import { useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { socket } from '../../socket.js';
import { useGameStore } from '../../store/gameStore.js';
import { useSocketEvents } from '../../hooks/useSocketEvents.js';
import { GameBoard } from '../../components/board/GameBoard.js';
import { Scoreboard } from '../../components/scores/Scoreboard.js';
import { QuestionTimer } from '../../components/question/QuestionTimer.js';
import { ConfirmModal } from '../../components/ui/ConfirmModal.js';

export function HostBoardView() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const {
    gameConfig, players, phase, activeQuestion,
    buzzerQueue, timer, hostToken,
    finalClue, finalCorrectAnswer, wagersSubmitted, hostWagers, revealedWagers,
    doublePlayerId, doublePlayerName, challengeState,
  } = useGameStore();
  useSocketEvents();

  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Ignora null: evita que a exit animation do AnimatePresence sobrescreva o ref
  // com null depois do novo overlay já ter registrado o elemento correto.
  const audioCallbackRef = useCallback((el: HTMLAudioElement | null) => {
    if (el !== null) audioRef.current = el;
  }, []);

  function emitAudio(action: 'play' | 'pause' | 'seek') {
    if (!audioRef.current || !sessionId || !hostToken) return;
    socket.emit('host:audioControl', {
      sessionId,
      hostToken,
      action,
      currentTime: audioRef.current.currentTime,
    });
  }

  if (!gameConfig || !sessionId || !hostToken) return null;

  const pendingBuzzers = buzzerQueue.filter((b) => !b.responded);

  function selectQuestion(categoryId: string, questionId: string) {
    socket.emit('host:selectQuestion', { sessionId: sessionId!, hostToken: hostToken!, categoryId, questionId });
  }
  function judge(playerId: string, correct: boolean) {
    socket.emit('host:judge', { sessionId: sessionId!, hostToken: hostToken!, playerId, correct });
  }
  function skipPlayer(playerId: string) {
    socket.emit('host:skipPlayer', { sessionId: sessionId!, hostToken: hostToken!, playerId });
  }
  function clearQuestion() {
    socket.emit('host:clearQuestion', { sessionId: sessionId!, hostToken: hostToken! });
  }
  function timerControl(action: 'pause' | 'resume' | 'extend' | 'set', seconds?: number) {
    socket.emit('host:timerControl', { sessionId: sessionId!, hostToken: hostToken!, action, seconds });
  }
  function continueBoard() {
    socket.emit('host:continueBoard', { sessionId: sessionId!, hostToken: hostToken! });
  }
  function assignDouble(playerId: string) {
    socket.emit('host:assignDouble', { sessionId: sessionId!, hostToken: hostToken!, playerId });
  }
  function setChallenge(challengedId: string) {
    socket.emit('host:setChallenge', { sessionId: sessionId!, hostToken: hostToken!, challengedId });
  }
  function revealFinal(playerId: string, isCorrect: boolean) {
    socket.emit('host:revealFinal', { sessionId: sessionId!, hostToken: hostToken!, playerId, isCorrect });
  }
  function confirmEndGame() {
    socket.emit('host:endGame', { sessionId: sessionId!, hostToken: hostToken! });
    setShowEndConfirm(false);
  }

  const allUsed = gameConfig.categories.every((c) => c.questions.every((q) => q.used));
  const isFinalPhase = phase === 'final_challenge' || phase === 'final_reveal';
  const totalPlayers = players.length;
  const totalWagered = wagersSubmitted.length;
  const allWagered = totalWagered >= totalPlayers && totalPlayers > 0;

  // Players que ainda não foram revelados no final
  const unrevealedPlayers = players.filter(
    (p) => wagersSubmitted.some((w) => w.playerId === p.id) && hostWagers[p.id] && !revealedWagers[p.id],
  );

  return (
    <div className="min-h-screen flex flex-col p-4 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-jeopardy-gold truncate">{gameConfig.name}</h1>
        <div className="flex gap-2 flex-shrink-0">
          {allUsed && gameConfig.finalChallengeEnabled && !isFinalPhase && (
            <button
              className="btn-primary"
              onClick={() => socket.emit('host:startFinal', { sessionId: sessionId!, hostToken: hostToken! })}
            >
              Desafio Final!
            </button>
          )}
          <button className="btn-ghost text-sm py-2 px-3" onClick={() => setShowLeaveConfirm(true)}>
            ← Menu
          </button>
          <button
            className="text-sm py-2 px-3 border border-red-500 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-colors"
            onClick={() => setShowEndConfirm(true)}
          >
            Encerrar
          </button>
        </div>
      </div>

      <div className="flex gap-4 flex-1">
        {/* Board */}
        <div className="flex-1">
          <GameBoard
            categories={gameConfig.categories}
            gameId={gameConfig.id}
            onSelectQuestion={phase === 'board' ? selectQuestion : undefined}
            activeQuestionId={activeQuestion?.questionId}
          />
        </div>

        {/* Painel lateral */}
        <div className="w-64 flex flex-col gap-4">
          <Scoreboard players={players} />

          {/* Timer + controles */}
          <AnimatePresence>
            {(phase === 'question' || phase === 'all_play' || phase === 'buzzer_queue') && activeQuestion && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="card flex flex-col gap-3"
              >
                <p className="text-sm text-slate-300 text-center">{activeQuestion.question.clue}</p>
                <p className="text-xs text-slate-400 text-center italic">{activeQuestion.question.answer}</p>

                {timer && (
                  <QuestionTimer remainingMs={timer.remainingMs} totalMs={timer.totalMs} isPaused={timer.isPaused} />
                )}

                <div className="grid grid-cols-2 gap-2">
                  {timer?.isPaused ? (
                    <button className="btn-ghost text-xs py-1" onClick={() => timerControl('resume')}>▶ Retomar</button>
                  ) : (
                    <button className="btn-ghost text-xs py-1" onClick={() => timerControl('pause')}>⏸ Pausar</button>
                  )}
                  <button className="btn-ghost text-xs py-1" onClick={() => timerControl('extend', 30)}>+30s</button>
                  <button className="btn-ghost text-xs py-1" onClick={() => timerControl('extend', 60)}>+60s</button>
                  <button className="btn-ghost text-xs py-1 text-red-400 border-red-400 hover:bg-red-400 hover:text-white" onClick={clearQuestion}>Cancelar</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Fila de buzzers */}
          <AnimatePresence>
            {phase === 'buzzer_queue' && (pendingBuzzers.length > 0 || challengeState?.challengedId) && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="card flex flex-col gap-3"
              >
                {activeQuestion?.question.type === 'challenge' ? (
                  // UI especial para challenge
                  <>
                    <h3 className="text-jeopardy-gold font-bold text-sm">⚔️ Desafio</h3>
                    {!challengeState?.challengedId ? (
                      // Passo 1: desafiador buzzou, selecionar desafiado
                      <>
                        <p className="text-sm text-white font-bold">
                          {pendingBuzzers[0]?.playerName} desafia quem?
                        </p>
                        <div className="flex flex-col gap-1">
                          {players
                            .filter((p) => p.id !== pendingBuzzers[0]?.playerId)
                            .map((p) => (
                              <button
                                key={p.id}
                                className="text-left py-1 px-2 rounded bg-slate-700 hover:bg-jeopardy-gold hover:text-jeopardy-blue text-sm font-bold transition-colors"
                                onClick={() => setChallenge(p.id)}
                              >
                                {p.name}
                              </button>
                            ))}
                        </div>
                        <button className="btn-ghost text-xs py-1" onClick={() => skipPlayer(pendingBuzzers[0]?.playerId)}>Pular</button>
                      </>
                    ) : (
                      // Passo 2: desafiado definido, julgar
                      <>
                        <p className="text-xs text-slate-400">
                          <span className="text-white font-bold">{challengeState.challengerName}</span> desafia{' '}
                          <span className="text-jeopardy-gold font-bold">{challengeState.challengedName}</span>
                        </p>
                        <p className="text-xs text-slate-500">
                          Certo: {challengeState.challengedName} +${activeQuestion.question.value}, {challengeState.challengerName} -${Math.floor(activeQuestion.question.value / 2)}
                        </p>
                        <p className="text-xs text-slate-500">
                          Errado: {challengeState.challengedName} -${activeQuestion.question.value}, {challengeState.challengerName} +${Math.floor(activeQuestion.question.value / 2)}
                        </p>
                        <div className="flex gap-2 mt-1">
                          <button className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-2 rounded text-sm" onClick={() => judge(challengeState.challengedId!, true)}>Correto</button>
                          <button className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded text-sm" onClick={() => judge(challengeState.challengedId!, false)}>Errado</button>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  // UI padrão de fila
                  <>
                    <h3 className="text-jeopardy-gold font-bold text-sm">Fila de Respostas</h3>
                    {pendingBuzzers.map((entry, i) => (
                      <div key={entry.playerId} className="flex flex-col gap-2 border-b border-slate-600 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 text-xs">#{i + 1}</span>
                          <span className="font-bold flex-1">{entry.playerName}</span>
                        </div>
                        {i === 0 && (
                          <div className="flex gap-2">
                            <button className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-2 rounded text-sm" onClick={() => judge(entry.playerId, true)}>Correto</button>
                            <button className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded text-sm" onClick={() => judge(entry.playerId, false)}>Errado</button>
                            <button className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-3 rounded text-sm" onClick={() => skipPlayer(entry.playerId)}>Pular</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Overlay da questão ativa */}
      <AnimatePresence>
        {activeQuestion && (phase === 'question' || phase === 'all_play') && pendingBuzzers.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-jeopardy-blue/95 flex items-center justify-center p-8 z-50"
          >
            <div className="max-w-3xl w-full text-center">
              <div className="text-jeopardy-gold text-2xl mb-4">${activeQuestion.question.value}</div>
              {activeQuestion.question.media && (
                <img src={`/media/${gameConfig.id}/${activeQuestion.question.media.filename}`} alt="" className="mx-auto max-h-56 object-contain mb-4 rounded-xl" />
              )}
              {activeQuestion.question.clueAudio && (
                <audio
                  key={activeQuestion.question.clueAudio.filename}
                  ref={audioCallbackRef}
                  src={`/media/${gameConfig.id}/${activeQuestion.question.clueAudio.filename}`}
                  controls autoPlay className="mx-auto mb-4"
                  onPlay={() => emitAudio('play')}
                  onPause={() => emitAudio('pause')}
                  onSeeked={() => emitAudio(audioRef.current?.paused ? 'seek' : 'play')}
                />
              )}
              <p className="text-4xl font-bold leading-tight mb-8">{activeQuestion.question.clue}</p>
              <p className="text-slate-400 italic mb-4 text-lg">{activeQuestion.question.answer}</p>
              {activeQuestion.question.answerMedia && (
                <img src={`/media/${gameConfig.id}/${activeQuestion.question.answerMedia.filename}`} alt="" className="mx-auto max-h-40 object-contain mb-3 rounded-xl opacity-80 border-2 border-jeopardy-gold/40" />
              )}
              {activeQuestion.question.answerAudio && (
                <audio
                  src={`/media/${gameConfig.id}/${activeQuestion.question.answerAudio.filename}`}
                  controls className="mx-auto mb-4"
                />
              )}
              {timer && (
                <div className="max-w-md mx-auto mb-6">
                  <QuestionTimer remainingMs={timer.remainingMs} totalMs={timer.totalMs} isPaused={timer.isPaused} />
                </div>
              )}
              <div className="flex justify-center gap-3">
                {timer?.isPaused
                  ? <button className="btn-ghost" onClick={() => timerControl('resume')}>▶ Retomar</button>
                  : <button className="btn-ghost" onClick={() => timerControl('pause')}>⏸ Pausar</button>
                }
                <button className="btn-ghost" onClick={() => timerControl('extend', 30)}>+30s</button>
                <button className="btn-ghost text-red-400 border-red-400" onClick={clearQuestion}>Fechar</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlay da Dupla Aposta */}
      <AnimatePresence>
        {phase === 'double_wager' && activeQuestion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-jeopardy-blue flex items-center justify-center p-8 z-50"
          >
            <div className="max-w-2xl w-full text-center flex flex-col items-center gap-6">
              <div className="text-6xl">🎯</div>
              <h2 className="text-4xl font-bold text-jeopardy-gold">DUPLA APOSTA!</h2>
              <div className="text-jeopardy-gold text-xl">${activeQuestion.question.value} · {activeQuestion.question.clue}</div>
              <p className="text-slate-400 italic text-sm">{activeQuestion.question.answer}</p>

              {!doublePlayerId ? (
                <div className="w-full">
                  <p className="text-slate-300 mb-4">Atribuir a qual jogador?</p>
                  <div className="flex flex-col gap-2">
                    {players.map((p) => (
                      <button
                        key={p.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 hover:bg-jeopardy-gold hover:text-jeopardy-blue transition-colors font-bold"
                        onClick={() => assignDouble(p.id)}
                      >
                        <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: p.avatarColor }} />
                        <span className="flex-1 text-left">{p.name}</span>
                        <span className="text-sm opacity-60">${p.score.toLocaleString('pt-BR')}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">{doublePlayerName}</p>
                  <p className="text-slate-400 mt-2 animate-pulse">Aguardando aposta...</p>
                </div>
              )}

              <button className="btn-ghost text-sm" onClick={clearQuestion}>Cancelar</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlay de revelação da resposta */}
      <AnimatePresence>
        {phase === 'answer_reveal' && activeQuestion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-jeopardy-blue flex items-center justify-center p-8 z-50"
          >
            <div className="max-w-3xl w-full text-center flex flex-col items-center gap-6">
              <div className="text-jeopardy-gold text-2xl">${activeQuestion.question.value}</div>

              {/* Clue (referência) */}
              {activeQuestion.question.media && (
                <img src={`/media/${gameConfig.id}/${activeQuestion.question.media.filename}`} alt="" className="max-h-32 object-contain rounded-xl opacity-60" />
              )}
              {activeQuestion.question.clueAudio && (
                activeQuestion.question.answerAudio
                  // Quando há answerAudio, o clue audio é só referência visual — sem sync
                  ? <audio
                      src={`/media/${gameConfig.id}/${activeQuestion.question.clueAudio.filename}`}
                      controls
                      className="mx-auto opacity-40 pointer-events-none"
                    />
                  // Quando só existe clueAudio, ele é o áudio principal — sincroniza
                  : <audio
                      ref={audioCallbackRef}
                      src={`/media/${gameConfig.id}/${activeQuestion.question.clueAudio.filename}`}
                      controls className="mx-auto opacity-60"
                      onPlay={() => emitAudio('play')}
                      onPause={() => emitAudio('pause')}
                      onSeeked={() => emitAudio(audioRef.current?.paused ? 'seek' : 'play')}
                    />
              )}

              <p className="text-slate-400 text-xl italic">{activeQuestion.question.clue}</p>

              <div className="border-t border-jeopardy-gold/30 pt-6 w-full">
                <p className="text-slate-400 text-sm uppercase tracking-widest mb-2">Resposta</p>
                <p className="text-4xl font-bold text-jeopardy-gold leading-tight">{activeQuestion.question.answer}</p>
              </div>

              {/* Mídia da resposta */}
              {activeQuestion.question.answerMedia && (
                <img src={`/media/${gameConfig.id}/${activeQuestion.question.answerMedia.filename}`} alt="" className="max-h-56 object-contain rounded-xl border-2 border-jeopardy-gold/40" />
              )}
              {activeQuestion.question.answerAudio && (
                <audio
                  key={activeQuestion.question.answerAudio.filename}
                  ref={audioCallbackRef}
                  src={`/media/${gameConfig.id}/${activeQuestion.question.answerAudio.filename}`}
                  controls autoPlay className="mx-auto"
                  onPlay={() => emitAudio('play')}
                  onPause={() => emitAudio('pause')}
                  onSeeked={() => emitAudio(audioRef.current?.paused ? 'seek' : 'play')}
                />
              )}

              <button className="btn-primary text-xl px-10 py-3 mt-2" onClick={continueBoard}>
                Continuar →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlay do Desafio Final */}
      <AnimatePresence>
        {isFinalPhase && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-jeopardy-blue/97 flex flex-col items-center justify-start p-8 z-50 overflow-y-auto gap-6"
          >
            <h2 className="text-4xl font-bold text-jeopardy-gold">Desafio Final!</h2>

            {finalClue && (
              <div className="card max-w-2xl w-full text-center">
                <p className="text-2xl font-bold leading-tight">{finalClue}</p>
                {finalCorrectAnswer && (
                  <p className="text-slate-400 italic mt-3 text-lg">
                    Resposta correta: <span className="text-jeopardy-gold">{finalCorrectAnswer}</span>
                  </p>
                )}
              </div>
            )}

            {/* Status de apostas */}
            <div className="card max-w-2xl w-full">
              <h3 className="text-jeopardy-gold font-bold mb-3">
                Apostas recebidas: {totalWagered} / {totalPlayers}
              </h3>
              <div className="flex flex-col gap-2">
                {players.map((p) => {
                  const submitted = wagersSubmitted.some((w) => w.playerId === p.id);
                  const wager = hostWagers[p.id];

                  return (
                    <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/40">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.avatarColor }} />
                      <span className="flex-1 font-medium">{p.name}</span>

                      {!submitted && (
                        <span className="text-slate-400 text-xs">Aguardando...</span>
                      )}

                      {submitted && !wager && (
                        <span className="text-green-400 text-xs">Aposta enviada</span>
                      )}

                      {submitted && wager && revealedWagers[p.id] && (
                        <span className="text-slate-400 text-xs">✓ Revelado</span>
                      )}

                      {submitted && wager && !revealedWagers[p.id] && (
                        <div className="flex items-center gap-2">
                          <div className="text-right mr-2">
                            <div className="text-jeopardy-gold font-bold text-sm">${wager.amount}</div>
                            <div className="text-slate-300 text-xs italic max-w-[120px] truncate">{wager.answer}</div>
                          </div>
                          <button
                            className="bg-green-600 hover:bg-green-500 text-white font-bold py-1 px-3 rounded text-xs"
                            onClick={() => revealFinal(p.id, true)}
                          >
                            Correto
                          </button>
                          <button
                            className="bg-red-600 hover:bg-red-500 text-white font-bold py-1 px-3 rounded text-xs"
                            onClick={() => revealFinal(p.id, false)}
                          >
                            Errado
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Forçar início da revelação se nem todos apostaram */}
            {phase === 'final_challenge' && totalWagered > 0 && !allWagered && (
              <button
                className="btn-ghost"
                onClick={() => socket.emit('host:revealFinal', {
                  sessionId: sessionId!,
                  hostToken: hostToken!,
                  playerId: wagersSubmitted.find((w) => hostWagers[w.playerId])?.playerId ?? '',
                  isCorrect: false,
                })}
              >
                Revelar assim mesmo ({totalWagered}/{totalPlayers} apostas)
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Over */}
      <AnimatePresence>
        {phase === 'game_over' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-jeopardy-blue flex flex-col items-center justify-center p-6 z-50 gap-6"
          >
            <h2 className="text-5xl font-bold text-jeopardy-gold mb-4">Fim de Jogo!</h2>
            <div className="flex flex-col gap-2 w-full max-w-md">
              {[...players].sort((a, b) => b.score - a.score).map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={`flex items-center gap-3 p-3 rounded-xl ${i === 0 ? 'bg-jeopardy-gold text-jeopardy-blue' : 'bg-slate-800/50'}`}
                >
                  <span className="font-bold text-xl w-8">#{i + 1}</span>
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: p.avatarColor }} />
                  <span className="flex-1 font-bold">{p.name}</span>
                  <span className="font-bold">${p.score.toLocaleString('pt-BR')}</span>
                </motion.div>
              ))}
            </div>
            <button className="btn-ghost mt-4" onClick={() => navigate('/')}>
              ← Voltar ao Menu
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modais de confirmação */}
      <ConfirmModal
        open={showEndConfirm}
        title="Encerrar o jogo?"
        description="O jogo será encerrado para todos os jogadores. Esta ação não pode ser desfeita."
        confirmLabel="Encerrar"
        cancelLabel="Cancelar"
        danger
        onConfirm={confirmEndGame}
        onCancel={() => setShowEndConfirm(false)}
      />

      <ConfirmModal
        open={showLeaveConfirm}
        title="Voltar ao menu?"
        description="O jogo continuará rodando mas você perderá o controle como host."
        confirmLabel="Voltar ao Menu"
        cancelLabel="Cancelar"
        onConfirm={() => navigate('/')}
        onCancel={() => setShowLeaveConfirm(false)}
      />
    </div>
  );
}
