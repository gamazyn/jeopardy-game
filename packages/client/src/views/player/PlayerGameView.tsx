import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { socket } from '../../socket.js';
import { useGameStore } from '../../store/gameStore.js';
import { usePlayerStore } from '../../store/playerStore.js';
import { useSocketEvents } from '../../hooks/useSocketEvents.js';
import { GameBoard } from '../../components/board/GameBoard.js';
import { Scoreboard } from '../../components/scores/Scoreboard.js';
import { QuestionTimer } from '../../components/question/QuestionTimer.js';

export function PlayerGameView() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const {
    gameConfig,
    players,
    phase,
    activeQuestion,
    timer,
    myWagerSent,
    finalClue,
    finalMedia,
    setMyWagerSent,
    doublePlayerId,
    doublePlayerName,
    doubleWager,
    challengeState,
  } = useGameStore();
  const { myId, myName, buzzerPosition } = usePlayerStore();
  const [wagerAmount, setWagerAmount] = useState('');
  const [wagerAnswer, setWagerAnswer] = useState('');
  const [doubleWagerInput, setDoubleWagerInput] = useState('');
  const [doubleWagerSent, setDoubleWagerSent] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Callback ref que ignora null: evita que a exit animation do AnimatePresence
  // sobrescreva o ref com null depois do novo elemento já ter sido registrado.
  const audioCallbackRef = useCallback((el: HTMLAudioElement | null) => {
    if (el !== null) audioRef.current = el;
  }, []);
  useSocketEvents();

  useEffect(() => {
    function handleAudioSync({ action, currentTime }: { action: 'play' | 'pause' | 'seek'; currentTime: number }) {
      const el = audioRef.current;
      if (!el) return;
      el.currentTime = currentTime;
      if (action === 'play') el.play().catch(() => {});
      else if (action === 'pause') el.pause();
    }
    socket.on('audio:sync', handleAudioSync);
    return () => { socket.off('audio:sync', handleAudioSync); };
  }, []);

  const myPlayer = players.find((p) => p.id === myId);

  function buzz() {
    if (!sessionId || !myId) return;
    socket.emit('player:buzz', { sessionId, playerId: myId });
  }

  function submitWager(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionId || !myId) return;
    const amount = Math.max(0, parseInt(wagerAmount) || 0);
    socket.emit('player:finalWager', { sessionId, playerId: myId, amount, answer: wagerAnswer });
    setMyWagerSent();
  }

  function submitDoubleWager(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionId || !myId) return;
    const amount = Math.max(0, parseInt(doubleWagerInput) || 0);
    socket.emit('player:doubleWager', { sessionId, playerId: myId, amount });
    setDoubleWagerSent(true);
  }

  if (!gameConfig) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-6">
        <h1 className="text-5xl font-bold text-jeopardy-gold tracking-wider">JEOPARDY!</h1>
        <div className="card text-center max-w-sm w-full">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-lg font-bold mb-1">{myName}</p>
          <p className="text-slate-400 text-sm">Aguardando o host iniciar o quiz...</p>
        </div>
        {players.length > 0 && (
          <div className="card max-w-sm w-full">
            <h3 className="text-jeopardy-gold font-bold text-sm uppercase tracking-wider mb-3">
              Jogadores na sala ({players.length})
            </h3>
            <ul className="flex flex-col gap-2">
              {players.map((p) => (
                <li key={p.id} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.avatarColor }} />
                  <span className="text-sm">{p.name}</span>
                  {p.id === myId && <span className="text-jeopardy-gold text-xs ml-auto">você</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  const isDoubleAndNotAssigned = activeQuestion?.question.type === 'double' && doublePlayerId && doublePlayerId !== myId;
  const canBuzz = (phase === 'question' || phase === 'all_play') && !buzzerPosition && !isDoubleAndNotAssigned;

  return (
    <div className="min-h-screen flex flex-col p-4 gap-4">
      {/* Header com meu score */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-slate-300 text-sm">{myName}</div>
          <div className={`text-3xl font-bold ${(myPlayer?.score ?? 0) < 0 ? 'text-red-400' : 'text-jeopardy-gold'}`}>
            ${(myPlayer?.score ?? 0).toLocaleString('pt-BR')}
          </div>
        </div>
        <div className="text-slate-400 text-sm">{gameConfig.name}</div>
      </div>

      {/* Board (somente leitura) */}
      {(phase === 'board' || phase === 'question' || phase === 'all_play' || phase === 'buzzer_queue') && (
        <div className="flex gap-4">
          <div className="flex-1">
            <GameBoard
              categories={gameConfig.categories}
              gameId={gameConfig.id}
              activeQuestionId={activeQuestion?.questionId}
            />
          </div>
          <div className="w-48">
            <Scoreboard players={players} myId={myId ?? undefined} />
          </div>
        </div>
      )}

      {/* Dupla Aposta */}
      {phase === 'double_wager' && activeQuestion && (
        <div className="fixed inset-0 bg-jeopardy-blue flex flex-col items-center justify-center p-6 z-50 gap-6">
          <div className="text-6xl">🎯</div>
          <h2 className="text-4xl font-bold text-jeopardy-gold">DUPLA APOSTA!</h2>
          <p className="text-jeopardy-gold text-xl">${activeQuestion.question.value}</p>

          {doublePlayerId === myId ? (
            // Sou o jogador atribuído
            !doubleWagerSent ? (
              <form onSubmit={submitDoubleWager} className="flex flex-col gap-4 w-full max-w-md">
                <p className="text-center text-slate-300">Você foi selecionado! Faça sua aposta antes de ver a pergunta.</p>
                <input
                  type="number"
                  min={0}
                  max={Math.max(myPlayer?.score ?? 0, 0)}
                  value={doubleWagerInput}
                  onChange={(e) => setDoubleWagerInput(e.target.value)}
                  className="w-full bg-jeopardy-blue-light border-2 border-jeopardy-gold rounded-lg px-4 py-3 text-jeopardy-gold text-2xl text-center font-bold focus:outline-none"
                  placeholder="0"
                  autoFocus
                />
                <p className="text-slate-400 text-xs text-center">Máx: ${Math.max(myPlayer?.score ?? 0, 0).toLocaleString('pt-BR')}</p>
                <button type="submit" className="btn-primary text-xl">Confirmar Aposta</button>
              </form>
            ) : (
              <p className="text-slate-300 animate-pulse">Aposta enviada! Aguardando o host...</p>
            )
          ) : doublePlayerId ? (
            // Outro jogador foi selecionado
            <div className="text-center text-slate-300">
              <p className="text-xl font-bold text-white">{doublePlayerName}</p>
              <p className="text-slate-400 mt-2 animate-pulse">está fazendo sua aposta...</p>
            </div>
          ) : (
            // Aguardando host atribuir
            <p className="text-slate-400 animate-pulse">Aguardando o host atribuir a um jogador...</p>
          )}
        </div>
      )}

      {/* Questão ativa — overlay para player */}
      <AnimatePresence>
        {activeQuestion && (phase === 'question' || phase === 'all_play' || phase === 'buzzer_queue') && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-jeopardy-blue/95 flex flex-col items-center justify-center p-6 z-50 gap-6"
          >
            <div className="text-jeopardy-gold text-xl">
              ${activeQuestion.question.value}
              {phase === 'all_play' && <span className="ml-3 text-sm bg-yellow-500 text-black px-2 py-0.5 rounded font-bold">TODOS JOGAM</span>}
              {activeQuestion.question.type === 'double' && doubleWager !== null && <span className="ml-3 text-sm bg-purple-500 text-white px-2 py-0.5 rounded font-bold">DUPLA APOSTA ${doubleWager}</span>}
            </div>

            {/* Notificação de challenge */}
            {challengeState?.challengedId === myId && (
              <div className="bg-orange-600 text-white px-4 py-2 rounded-xl font-bold text-lg">
                ⚔️ Você foi desafiado por {challengeState.challengerName}!
              </div>
            )}

            {activeQuestion.question.media && (
              <img
                src={`/media/${gameConfig.id}/${activeQuestion.question.media.filename}`}
                alt=""
                className="max-h-48 object-contain rounded-xl"
              />
            )}

            {activeQuestion.question.clueAudio && (
              <audio
                key={activeQuestion.question.clueAudio.filename}
                ref={audioCallbackRef}
                src={`/media/${gameConfig.id}/${activeQuestion.question.clueAudio.filename}`}
                autoPlay
              />
            )}

            <p className="text-3xl font-bold text-center leading-tight max-w-2xl">
              {activeQuestion.question.clue}
            </p>

            {timer && (
              <div className="w-full max-w-md">
                <QuestionTimer
                  remainingMs={timer.remainingMs}
                  totalMs={timer.totalMs}
                  isPaused={timer.isPaused}
                />
              </div>
            )}

            {/* Buzzer */}
            {(phase === 'question' || phase === 'all_play') && !isDoubleAndNotAssigned && (
              <motion.button
                whileTap={{ scale: 0.92 }}
                className={`w-40 h-40 rounded-full font-bold text-2xl border-8 transition-all ${
                  buzzerPosition
                    ? buzzerPosition === 1
                      ? 'bg-green-600 border-green-400 text-white'
                      : 'bg-gray-700 border-gray-600 text-gray-400'
                    : 'bg-red-600 border-red-400 text-white animate-buzzer-pulse cursor-pointer'
                }`}
                onClick={canBuzz ? buzz : undefined}
                disabled={!!buzzerPosition}
              >
                {buzzerPosition
                  ? buzzerPosition === 1
                    ? 'Sua vez!'
                    : `#${buzzerPosition}`
                  : 'BUZZ!'}
              </motion.button>
            )}

            {phase === 'buzzer_queue' && buzzerPosition === 1 && (
              <div className="text-green-400 text-xl font-bold animate-pulse">
                Responda!
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Revelação da resposta */}
      {phase === 'answer_reveal' && activeQuestion && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-jeopardy-blue flex flex-col items-center justify-center p-8 z-50 gap-6 text-center"
        >
          <div className="text-jeopardy-gold text-xl">${activeQuestion.question.value}</div>

          {/* Clue reference (dimmed) */}
          {activeQuestion.question.media && (
            <img
              src={`/media/${gameConfig.id}/${activeQuestion.question.media.filename}`}
              alt=""
              className="max-h-36 object-contain rounded-xl opacity-60"
            />
          )}
          {/* Hidden clue audio for sync — only used when no answerAudio */}
          {activeQuestion.question.clueAudio && !activeQuestion.question.answerAudio && (
            <audio
              key={activeQuestion.question.clueAudio.filename}
              ref={audioCallbackRef}
              src={`/media/${gameConfig.id}/${activeQuestion.question.clueAudio.filename}`}
            />
          )}

          <p className="text-slate-400 text-lg italic max-w-xl">{activeQuestion.question.clue}</p>

          <div className="border-t border-jeopardy-gold/30 pt-6 w-full max-w-xl">
            <p className="text-slate-400 text-xs uppercase tracking-widest mb-2">Resposta</p>
            <p className="text-4xl font-bold text-jeopardy-gold leading-tight">{activeQuestion.question.answer}</p>
          </div>

          {activeQuestion.question.answerMedia && (
            <img
              src={`/media/${gameConfig.id}/${activeQuestion.question.answerMedia.filename}`}
              alt=""
              className="max-h-56 object-contain rounded-xl border-2 border-jeopardy-gold/40"
            />
          )}
          {activeQuestion.question.answerAudio && (
            <audio
              key={activeQuestion.question.answerAudio.filename}
              ref={audioCallbackRef}
              src={`/media/${gameConfig.id}/${activeQuestion.question.answerAudio.filename}`}
              autoPlay
            />
          )}

          <p className="text-slate-500 text-sm animate-pulse">Aguardando o host continuar...</p>
        </motion.div>
      )}

      {/* Desafio Final */}
      {phase === 'final_challenge' && (
        <div className="fixed inset-0 bg-jeopardy-blue flex flex-col items-center justify-center p-6 z-50 gap-6">
          <h2 className="text-4xl font-bold text-jeopardy-gold">Desafio Final!</h2>
          {finalClue && (
            <p className="text-2xl font-bold text-center max-w-xl">{finalClue}</p>
          )}
          {finalMedia && (
            finalMedia.type === 'audio' ? (
              <audio src={`/media/${gameConfig?.id}/${finalMedia.filename}`} autoPlay controls className="w-full max-w-md" />
            ) : (
              <img src={`/media/${gameConfig?.id}/${finalMedia.filename}`} alt="" className="max-h-48 object-contain rounded-xl" />
            )
          )}
          {!myWagerSent ? (
            <form onSubmit={submitWager} className="flex flex-col gap-4 w-full max-w-md">
              <div>
                <label className="text-slate-300 text-sm mb-1 block">
                  Quanto você aposta? (máx: ${Math.max(myPlayer?.score ?? 0, 0)})
                </label>
                <input
                  type="number"
                  min={0}
                  max={Math.max(myPlayer?.score ?? 0, 0)}
                  value={wagerAmount}
                  onChange={(e) => setWagerAmount(e.target.value)}
                  className="w-full bg-jeopardy-blue-light border-2 border-jeopardy-gold rounded-lg px-4 py-3 text-jeopardy-gold text-2xl text-center font-bold focus:outline-none"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-slate-300 text-sm mb-1 block">Sua resposta</label>
                <input
                  type="text"
                  value={wagerAnswer}
                  onChange={(e) => setWagerAnswer(e.target.value)}
                  maxLength={500}
                  className="w-full bg-jeopardy-blue-light border-2 border-slate-500 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-jeopardy-gold"
                  placeholder="O que é..."
                />
              </div>
              <button type="submit" className="btn-primary text-xl" disabled={!wagerAnswer.trim()}>
                Enviar Resposta
              </button>
            </form>
          ) : (
            <div className="text-center text-slate-300">
              <p className="text-xl mb-2">Aposta enviada!</p>
              <p>Aguardando o host revelar os resultados...</p>
            </div>
          )}
        </div>
      )}

      {/* Game Over */}
      {phase === 'game_over' && (
        <div className="fixed inset-0 bg-jeopardy-blue flex flex-col items-center justify-center p-6 z-50 gap-6">
          <h2 className="text-5xl font-bold text-jeopardy-gold mb-4">Fim de Jogo!</h2>
          <div className="flex flex-col gap-2 w-full max-w-md">
            {[...players]
              .sort((a, b) => b.score - a.score)
              .map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={`flex items-center gap-3 p-3 rounded-xl ${
                    i === 0 ? 'bg-jeopardy-gold text-jeopardy-blue' : 'bg-slate-800/50'
                  }`}
                >
                  <span className="font-bold text-xl w-8">#{i + 1}</span>
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: p.avatarColor }}
                  />
                  <span className="flex-1 font-bold">{p.name}</span>
                  <span className="font-bold">${p.score.toLocaleString('pt-BR')}</span>
                </motion.div>
              ))}
          </div>
          <button
            className="btn-ghost mt-4"
            onClick={() => { socket.disconnect(); navigate('/'); }}
          >
            ← Voltar ao Menu
          </button>
        </div>
      )}
    </div>
  );
}
