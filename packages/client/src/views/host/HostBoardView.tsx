import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { socket } from '../../socket.js';
import { useGameStore } from '../../store/gameStore.js';
import { useSocketEvents } from '../../hooks/useSocketEvents.js';
import { GameBoard } from '../../components/board/GameBoard.js';
import { Scoreboard } from '../../components/scores/Scoreboard.js';
import { QuestionTimer } from '../../components/question/QuestionTimer.js';

export function HostBoardView() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const {
    gameConfig,
    players,
    phase,
    activeQuestion,
    buzzerQueue,
    timer,
    hostToken,
  } = useGameStore();
  useSocketEvents();

  if (!gameConfig || !sessionId || !hostToken) return null;

  const pendingBuzzers = buzzerQueue.filter((b) => !b.responded);
  const topBuzzer = pendingBuzzers[0];

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

  function endGame() {
    if (confirm('Encerrar o jogo agora?')) {
      socket.emit('host:endGame', { sessionId: sessionId!, hostToken: hostToken! });
    }
  }

  const allUsed = gameConfig.categories.every((c) => c.questions.every((q) => q.used));

  return (
    <div className="min-h-screen flex flex-col p-4 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-jeopardy-gold">{gameConfig.name}</h1>
        <div className="flex gap-2">
          {allUsed && gameConfig.finalChallengeEnabled && (
            <button
              className="btn-primary"
              onClick={() => socket.emit('host:startFinal', { sessionId: sessionId!, hostToken: hostToken! })}
            >
              Desafio Final!
            </button>
          )}
          <button className="btn-ghost text-sm py-2 px-4" onClick={endGame}>
            Encerrar
          </button>
        </div>
      </div>

      <div className="flex gap-4 flex-1">
        {/* Board */}
        <div className="flex-1">
          <GameBoard
            categories={gameConfig.categories}
            onSelectQuestion={phase === 'board' ? selectQuestion : undefined}
            activeQuestionId={activeQuestion?.questionId}
          />
        </div>

        {/* Painel lateral */}
        <div className="w-64 flex flex-col gap-4">
          <Scoreboard players={players} />

          {/* Timer + controles */}
          <AnimatePresence>
            {(phase === 'question' || phase === 'buzzer_queue') && activeQuestion && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="card flex flex-col gap-3"
              >
                <p className="text-sm text-blue-200 text-center">
                  {activeQuestion.question.clue}
                </p>
                <p className="text-xs text-blue-400 text-center italic">
                  {activeQuestion.question.answer}
                </p>

                {timer && (
                  <QuestionTimer
                    remainingMs={timer.remainingMs}
                    totalMs={timer.totalMs}
                    isPaused={timer.isPaused}
                  />
                )}

                <div className="grid grid-cols-2 gap-2">
                  {timer?.isPaused ? (
                    <button className="btn-ghost text-xs py-1" onClick={() => timerControl('resume')}>
                      ▶ Retomar
                    </button>
                  ) : (
                    <button className="btn-ghost text-xs py-1" onClick={() => timerControl('pause')}>
                      ⏸ Pausar
                    </button>
                  )}
                  <button className="btn-ghost text-xs py-1" onClick={() => timerControl('extend', 30)}>
                    +30s
                  </button>
                  <button className="btn-ghost text-xs py-1" onClick={() => timerControl('extend', 60)}>
                    +60s
                  </button>
                  <button className="btn-ghost text-xs py-1 text-red-400 border-red-400 hover:bg-red-400 hover:text-white" onClick={clearQuestion}>
                    Cancelar
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Fila de buzzers */}
          <AnimatePresence>
            {phase === 'buzzer_queue' && pendingBuzzers.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="card flex flex-col gap-3"
              >
                <h3 className="text-jeopardy-gold font-bold text-sm">Fila de Respostas</h3>
                {pendingBuzzers.map((entry, i) => (
                  <div key={entry.playerId} className="flex flex-col gap-2 border-b border-blue-700 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-blue-400 text-xs">#{i + 1}</span>
                      <span className="font-bold flex-1">{entry.playerName}</span>
                    </div>
                    {i === 0 && (
                      <div className="flex gap-2">
                        <button
                          className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-2 rounded text-sm"
                          onClick={() => judge(entry.playerId, true)}
                        >
                          Correto
                        </button>
                        <button
                          className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded text-sm"
                          onClick={() => judge(entry.playerId, false)}
                        >
                          Errado
                        </button>
                        <button
                          className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-3 rounded text-sm"
                          onClick={() => skipPlayer(entry.playerId)}
                        >
                          Pular
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Overlay da questão */}
      <AnimatePresence>
        {activeQuestion && phase === 'question' && pendingBuzzers.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-jeopardy-blue/95 flex items-center justify-center p-8 z-50"
          >
            <div className="max-w-3xl w-full text-center">
              <div className="text-jeopardy-gold text-2xl mb-4">
                ${activeQuestion.question.value}
              </div>
              {activeQuestion.question.media && (
                <img
                  src={`/media/${activeQuestion.question.media.filename}`}
                  alt=""
                  className="mx-auto max-h-64 object-contain mb-6 rounded-xl"
                />
              )}
              <p className="text-4xl font-bold leading-tight mb-8">
                {activeQuestion.question.clue}
              </p>
              {timer && (
                <div className="max-w-md mx-auto mb-6">
                  <QuestionTimer
                    remainingMs={timer.remainingMs}
                    totalMs={timer.totalMs}
                    isPaused={timer.isPaused}
                  />
                </div>
              )}
              <div className="flex justify-center gap-3">
                {timer?.isPaused ? (
                  <button className="btn-ghost" onClick={() => timerControl('resume')}>▶ Retomar</button>
                ) : (
                  <button className="btn-ghost" onClick={() => timerControl('pause')}>⏸ Pausar</button>
                )}
                <button className="btn-ghost" onClick={() => timerControl('extend', 30)}>+30s</button>
                <button className="btn-ghost text-red-400 border-red-400" onClick={clearQuestion}>Fechar</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
