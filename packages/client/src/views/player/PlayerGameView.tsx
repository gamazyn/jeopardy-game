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
    myFinalAnswerSent,
    finalClue,
    finalMedia,
    setMyWagerSent,
    setMyFinalAnswerSent,
    doublePlayerId,
    doublePlayerName,
    doubleWager,
    challengeState,
    reset: resetGame,
  } = useGameStore();
  const { myId, myName, buzzerPosition, setBuzzerPosition } = usePlayerStore();
  const [wagerAmount, setWagerAmount] = useState('');
  const [wagerAnswer, setWagerAnswer] = useState('');
  const [doubleWagerInput, setDoubleWagerInput] = useState('');
  const [doubleWagerSent, setDoubleWagerSent] = useState(false);
  const [speedInput, setSpeedInput] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUnlocked = useRef(false);
  // Callback ref que ignora null: evita que a exit animation do AnimatePresence
  // sobrescreva o ref com null depois do novo elemento já ter sido registrado.
  const audioCallbackRef = useCallback((el: HTMLAudioElement | null) => {
    if (el !== null) audioRef.current = el;
  }, []);

  // Callback ref que monta e já chama play() — necessário em mobile onde autoPlay é bloqueado
  const autoPlayCallbackRef = useCallback((el: HTMLAudioElement | null) => {
    if (el !== null) {
      audioRef.current = el;
      el.play().catch(() => {});
    }
  }, []);
  useSocketEvents();

  // Desbloqueia autoplay no primeiro gesto do usuário (obrigatório em mobile)
  useEffect(() => {
    function unlock() {
      if (audioUnlocked.current) return;
      audioUnlocked.current = true;
      const silent = new Audio();
      silent.play().catch(() => {});
    }
    window.addEventListener('touchstart', unlock, { once: true });
    window.addEventListener('click', unlock, { once: true });
    return () => {
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('click', unlock);
    };
  }, []);

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
    socket.emit('player:finalWager', { sessionId, playerId: myId, amount });
    setMyWagerSent();
  }

  function submitFinalAnswer(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionId || !myId || !wagerAnswer.trim()) return;
    socket.emit('player:finalAnswer', { sessionId, playerId: myId, answer: wagerAnswer });
    setMyFinalAnswerSent();
  }

  function submitDoubleWager(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionId || !myId) return;
    const amount = Math.max(0, parseInt(doubleWagerInput) || 0);
    socket.emit('player:doubleWager', { sessionId, playerId: myId, amount });
    setDoubleWagerSent(true);
  }

  function submitSpeedAnswer(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionId || !speedInput.trim()) return;
    socket.emit('player:speedAnswer', { sessionId, answer: speedInput.trim() });
    setSpeedInput(''); // limpar para nova tentativa
  }

  if (!gameConfig) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center p-6 gap-6 overflow-y-auto">
        <h1 className="text-5xl font-bold text-jeopardy-gold tracking-wider">Responde Aí!</h1>
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
  const isLockedAllPlay = phase === 'all_play' && activeQuestion?.lockedPlayerIds?.includes(myId ?? '');
  const canBuzz = (phase === 'question' || phase === 'all_play' || phase === 'buzzer_queue') && !buzzerPosition && !isDoubleAndNotAssigned && !isLockedAllPlay;

  // speed_round: meu acerto (se houver)
  const mySpeedEntry = activeQuestion?.speedRoundCorrect?.find((e) => e.playerId === myId);

  return (
    <div className="fixed inset-0 flex flex-col p-3 gap-2 overflow-hidden">
      {/* Header com meu score */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <div className="text-slate-400 text-xs font-ui">{myName}</div>
          <div
            className={`text-2xl font-mono font-bold ${(myPlayer?.score ?? 0) < 0 ? 'text-red-400' : 'text-jeopardy-gold'}`}
            style={(myPlayer?.score ?? 0) >= 0 ? { textShadow: '0 0 16px rgba(232,184,75,0.5)' } : undefined}
          >
            ${(myPlayer?.score ?? 0).toLocaleString('pt-BR')}
          </div>
        </div>
        <div className="text-slate-400 text-xs">{gameConfig.name}</div>
      </div>

      {/* Board (somente leitura) */}
      {(phase === 'board' || phase === 'question' || phase === 'all_play' || phase === 'buzzer_queue') && (
        <>
          {/* Scoreboard mobile: faixa horizontal acima do board */}
          <div className="flex-shrink-0 md:hidden">
            <Scoreboard players={players} myId={myId ?? undefined} compact />
          </div>

          <div className="flex flex-1 min-h-0 gap-3">
            <div className="flex-1 min-w-0 min-h-0">
              <GameBoard
                categories={gameConfig.categories}
                gameId={gameConfig.id}
                activeQuestionId={activeQuestion?.questionId}
                fillHeight
              />
            </div>
            {/* Scoreboard desktop: coluna lateral */}
            <div className="hidden md:block w-48 flex-shrink-0">
              <Scoreboard players={players} myId={myId ?? undefined} />
            </div>
          </div>
        </>
      )}

      {/* Dupla Aposta */}
      {phase === 'double_wager' && activeQuestion && (
        <div className="fixed inset-0 bg-jeopardy-blue flex flex-col items-center justify-center p-4 md:p-6 z-50 gap-4 md:gap-6 overflow-y-auto">
          <div className="text-5xl md:text-6xl">🎯</div>
          <h2 className="text-3xl md:text-4xl font-bold text-jeopardy-gold">DUPLA APOSTA!</h2>
          <p className="text-jeopardy-gold text-xl">${activeQuestion.question.value}</p>

          {doublePlayerId === myId ? (
            // Sou o jogador atribuído
            !doubleWagerSent ? (
              <form onSubmit={submitDoubleWager} className="flex flex-col gap-4 w-full max-w-md">
                <p className="text-center text-slate-300">Você foi selecionado! Faça sua aposta antes de ver a pergunta.</p>
                <input
                  type="number"
                  min={0}
                  max={Math.max(myPlayer?.score ?? 0, activeQuestion.question.value)}
                  value={doubleWagerInput}
                  onChange={(e) => setDoubleWagerInput(e.target.value)}
                  className="w-full bg-jeopardy-blue-light border-2 border-jeopardy-gold rounded-lg px-4 py-3 text-jeopardy-gold text-2xl text-center font-bold focus:outline-none"
                  placeholder="0"
                  autoFocus
                />
                <p className="text-slate-400 text-xs text-center">
                  Máx: ${Math.max(myPlayer?.score ?? 0, activeQuestion.question.value).toLocaleString('pt-BR')}
                  {(myPlayer?.score ?? 0) < 0 && (
                    <span className="text-orange-400 ml-1">(valor da questão — saldo negativo)</span>
                  )}
                </p>
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
            className="fixed inset-0 bg-jeopardy-blue/95 flex flex-col items-center justify-center p-4 md:p-6 z-50 gap-4 md:gap-6 overflow-y-auto"
          >
            <div className="text-jeopardy-gold text-xl">
              ${activeQuestion.question.value}
              {phase === 'all_play' && !isLockedAllPlay && <span className="ml-3 text-sm bg-yellow-500 text-black px-2 py-0.5 rounded font-bold">TODOS JOGAM</span>}
              {isLockedAllPlay && <span className="ml-3 text-sm bg-red-600 text-white px-2 py-0.5 rounded font-bold">🚫 BLOQUEADO</span>}
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
                ref={autoPlayCallbackRef}
                src={`/media/${gameConfig.id}/${activeQuestion.question.clueAudio.filename}`}
              />
            )}

            <p className="text-xl md:text-3xl font-bold text-center leading-tight max-w-2xl">
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

            {/* Tempo esgotado */}
            {timer?.remainingMs === 0 && !timer.isPaused && (
              <div
                className="font-arcade text-2xl tracking-widest animate-pulse"
                style={{ color: '#ef4444', textShadow: '0 0 20px rgba(239,68,68,0.7)' }}
              >
                ⏰ TEMPO ESGOTADO!
              </div>
            )}

            {/* Buzzer */}
            {(phase === 'question' || phase === 'all_play' || phase === 'buzzer_queue') && !isDoubleAndNotAssigned && (
              <motion.button
                whileTap={canBuzz ? { y: 4 } : {}}
                style={{ width: 'min(60vw, 180px)', height: 'min(60vw, 180px)' }}
                className={`buzz-btn ${
                  buzzerPosition
                    ? buzzerPosition === 1 ? 'winner' : 'queued'
                    : 'available'
                }`}
                onClick={canBuzz ? buzz : undefined}
                disabled={!!buzzerPosition}
              >
                {buzzerPosition
                  ? buzzerPosition === 1 ? 'SUA VEZ!' : `#${buzzerPosition}`
                  : 'BUZZ!'}
              </motion.button>
            )}

            {phase === 'buzzer_queue' && buzzerPosition === 1 && (
              <div className="text-green-400 text-lg font-arcade animate-pulse tracking-wider">
                RESPONDA!
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
          className="fixed inset-0 bg-jeopardy-blue flex flex-col items-center justify-center p-4 md:p-8 z-50 gap-4 md:gap-6 text-center overflow-y-auto"
        >
          <div className="text-jeopardy-gold text-xl">${activeQuestion.question.value}</div>
          {timer?.remainingMs === 0 && (
            <div
              className="font-arcade text-xl tracking-widest"
              style={{ color: '#ef4444', textShadow: '0 0 16px rgba(239,68,68,0.6)' }}
            >
              ⏰ TEMPO ESGOTADO!
            </div>
          )}

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
            <p className="text-2xl md:text-4xl font-bold text-jeopardy-gold leading-tight">{activeQuestion.question.answer}</p>
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
              ref={autoPlayCallbackRef}
              src={`/media/${gameConfig.id}/${activeQuestion.question.answerAudio.filename}`}
            />
          )}

          <p className="text-slate-500 text-sm animate-pulse">Aguardando o host continuar...</p>
        </motion.div>
      )}

      {/* Rodada Rápida */}
      {phase === 'speed_round' && activeQuestion && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-jeopardy-blue flex flex-col items-center justify-center p-4 md:p-6 z-50 gap-4 md:gap-6 overflow-y-auto"
        >
          <div className="font-arcade text-base text-green-400 tracking-widest">⚡ RODADA RÁPIDA</div>
          <div className="text-jeopardy-gold text-xl">${activeQuestion.question.value}</div>

          {activeQuestion.question.media && (
            <img
              src={`/media/${gameConfig.id}/${activeQuestion.question.media.filename}`}
              alt=""
              className="max-h-40 object-contain rounded-xl"
            />
          )}

          <p className="text-xl md:text-3xl font-bold text-center leading-tight max-w-2xl">
            {activeQuestion.question.clue}
          </p>

          {timer && (
            <div className="w-full max-w-md">
              <QuestionTimer remainingMs={timer.remainingMs} totalMs={timer.totalMs} isPaused={timer.isPaused} />
            </div>
          )}

          {/* Feed de acertos ao vivo */}
          {(activeQuestion.speedRoundCorrect?.length ?? 0) > 0 && (
            <div className="w-full max-w-md flex flex-col gap-1">
              {activeQuestion.speedRoundCorrect!.map((entry) => (
                <div
                  key={entry.playerId}
                  className={`flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm ${entry.playerId === myId ? 'bg-green-600/30 border border-green-500/40' : 'bg-slate-800/40'}`}
                >
                  <span className="font-mono text-jeopardy-gold font-bold w-5">#{entry.rank}</span>
                  <span className="font-bold flex-1">{entry.playerName}</span>
                  <span className="text-green-400 font-mono">+${entry.scoreChange}</span>
                </div>
              ))}
            </div>
          )}

          {/* Input de resposta */}
          {mySpeedEntry ? (
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="text-4xl">✅</div>
              <p className="font-arcade text-green-400 tracking-wider">ACERTOU!</p>
              <p className="text-slate-400 text-sm">#{mySpeedEntry.rank} — +${mySpeedEntry.scoreChange} pts</p>
            </div>
          ) : (
            <form onSubmit={submitSpeedAnswer} className="flex gap-2 w-full max-w-md">
              <input
                type="text"
                value={speedInput}
                onChange={(e) => setSpeedInput(e.target.value)}
                maxLength={200}
                autoFocus
                className="flex-1 bg-jeopardy-blue-light border-2 border-slate-600 focus:border-jeopardy-gold rounded-lg px-4 py-3 text-white text-lg focus:outline-none transition-colors"
                placeholder="Digite sua resposta..."
              />
              <button
                type="submit"
                disabled={!speedInput.trim()}
                className="btn-primary px-5 text-lg disabled:opacity-40"
              >
                ↵
              </button>
            </form>
          )}
        </motion.div>
      )}

      {/* Desafio Final */}
      {phase === 'final_challenge' && (
        <div className="fixed inset-0 bg-jeopardy-blue flex flex-col items-center justify-center p-4 md:p-6 z-50 gap-4 md:gap-6 overflow-y-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-jeopardy-gold">Desafio Final: Aposta</h2>
          {timer && (
            <div className="w-full max-w-md">
              <QuestionTimer remainingMs={timer.remainingMs} totalMs={timer.totalMs} isPaused={timer.isPaused} />
            </div>
          )}
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
              <p className="text-slate-300 text-sm text-center">
                Defina sua aposta agora. A resposta sera enviada na proxima etapa.
              </p>
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
              <button type="submit" className="btn-primary text-xl">
                Confirmar Aposta
              </button>
            </form>
          ) : (
            <div
              className="flex flex-col items-center gap-4 p-8 rounded-2xl text-center max-w-sm w-full"
              style={{
                background: 'rgba(232,184,75,0.06)',
                border: '1px solid rgba(232,184,75,0.2)',
              }}
            >
              <div className="text-4xl animate-bounce">⏳</div>
              <p className="font-arcade text-lg text-jeopardy-gold tracking-wide">APOSTA ENVIADA!</p>
              <p className="text-slate-400 font-ui text-sm">Aguarde. A etapa para enviar sua resposta vai abrir em seguida.</p>
              <div className="flex gap-1.5 mt-1">
                {[0,1,2].map(i => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-jeopardy-gold/40 animate-pulse"
                    style={{ animationDelay: `${i * 0.2}s` }}
                  />
                ))}
              </div>
            </div>
          )}
          {timer?.remainingMs === 0 && (
            <p className="text-slate-400 font-ui text-sm">Tempo encerrado. Aguardando revelacao...</p>
          )}
        </div>
      )}

      {phase === 'final_answer' && (
        <div className="fixed inset-0 bg-jeopardy-blue flex flex-col items-center justify-center p-4 md:p-6 z-50 gap-4 md:gap-6 overflow-y-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-jeopardy-gold">Desafio Final: Resposta</h2>
          {timer && (
            <div className="w-full max-w-md">
              <QuestionTimer remainingMs={timer.remainingMs} totalMs={timer.totalMs} isPaused={timer.isPaused} />
            </div>
          )}
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
          {!myFinalAnswerSent ? (
            <form onSubmit={submitFinalAnswer} className="flex flex-col gap-4 w-full max-w-md">
              <p className="text-slate-300 text-sm text-center">
                Agora envie sua resposta final antes que o tempo acabe.
              </p>
              <div>
                <label className="text-slate-300 text-sm mb-1 block">Sua resposta</label>
                <input
                  type="text"
                  value={wagerAnswer}
                  onChange={(e) => setWagerAnswer(e.target.value)}
                  maxLength={500}
                  className="w-full bg-jeopardy-blue-light border-2 border-slate-500 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-jeopardy-gold"
                  placeholder="O que e..."
                />
              </div>
              <button type="submit" className="btn-primary text-xl" disabled={!wagerAnswer.trim()}>
                Enviar Resposta
              </button>
            </form>
          ) : (
            <div
              className="flex flex-col items-center gap-4 p-8 rounded-2xl text-center max-w-sm w-full"
              style={{
                background: 'rgba(232,184,75,0.06)',
                border: '1px solid rgba(232,184,75,0.2)',
              }}
            >
              <div className="text-4xl animate-bounce">✍️</div>
              <p className="font-arcade text-lg text-jeopardy-gold tracking-wide">RESPOSTA ENVIADA!</p>
              <p className="text-slate-400 font-ui text-sm">Resposta confirmada. Aguarde a revelacao do host.</p>
            </div>
          )}
        </div>
      )}

      {/* Aguardando revelação do Desafio Final */}
      {phase === 'final_reveal' && (
        <div className="fixed inset-0 bg-jeopardy-blue flex flex-col items-center justify-center p-6 z-50 gap-6">
          <span className="text-5xl animate-bounce">🏆</span>
          <h2
            className="font-arcade text-3xl text-jeopardy-gold text-center"
            style={{ textShadow: '0 0 24px rgba(232,184,75,0.6)' }}
          >
            DESAFIO FINAL!
          </h2>
          <div
            className="flex flex-col items-center gap-3 p-6 rounded-2xl text-center max-w-sm w-full"
            style={{ background: 'rgba(232,184,75,0.06)', border: '1px solid rgba(232,184,75,0.2)' }}
          >
            <p className="text-slate-300 font-ui">Aposta enviada!</p>
            <p className="text-slate-500 font-ui text-sm">O host está revelando os resultados...</p>
            <div className="flex gap-1.5 mt-2">
              {[0,1,2].map(i => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full bg-jeopardy-gold/40 animate-pulse"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Game Over */}
      {phase === 'game_over' && (
        <div className="fixed inset-0 bg-jeopardy-blue flex flex-col items-center justify-center p-4 md:p-6 z-50 gap-4 md:gap-6 overflow-y-auto">
          <h2
            className="font-arcade text-4xl md:text-5xl text-jeopardy-gold mb-2 md:mb-4"
            style={{ textShadow: '0 0 30px rgba(232,184,75,0.7), 0 0 60px rgba(232,184,75,0.3)' }}
          >
            FIM DE JOGO!
          </h2>
          <div className="flex flex-col gap-2 w-full max-w-md">
            {[...players]
              .sort((a, b) => b.score - a.score)
              .map((p, i) => {
                const rankConfig = [
                  { medal: '🥇', border: '#E8B84B', bg: 'rgba(232,184,75,0.15)', glow: '0 0 20px rgba(232,184,75,0.4)', textClass: 'text-jeopardy-gold', size: 'text-xl' },
                  { medal: '🥈', border: '#94a3b8', bg: 'rgba(148,163,184,0.1)', glow: 'none', textClass: 'text-slate-300', size: 'text-lg' },
                  { medal: '🥉', border: '#f97316', bg: 'rgba(249,115,22,0.1)', glow: 'none', textClass: 'text-orange-400', size: 'text-base' },
                ][i] ?? { medal: `#${i+1}`, border: '#334155', bg: 'rgba(51,65,85,0.4)', glow: 'none', textClass: 'text-slate-400', size: 'text-base' };

                return (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.12 }}
                    className={`flex items-center gap-3 p-3 rounded-xl ${i === 0 ? 'animate-winner-shimmer' : ''}`}
                    style={{
                      borderLeft: `4px solid ${rankConfig.border}`,
                      background: rankConfig.bg,
                      boxShadow: rankConfig.glow,
                    }}
                  >
                    <span className="text-xl w-8 text-center">{rankConfig.medal}</span>
                    <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: p.avatarColor }} />
                    <span className={`flex-1 font-ui font-bold ${rankConfig.textClass} ${rankConfig.size}`}>{p.name}</span>
                    <span className={`font-mono font-bold ${rankConfig.textClass}`}>
                      ${p.score.toLocaleString('pt-BR')}
                    </span>
                  </motion.div>
                );
              })}
          </div>
          <button
            className="btn-ghost mt-4"
            onClick={() => { socket.disconnect(); resetGame(); setBuzzerPosition(null); navigate('/'); }}
          >
            ← Voltar ao Menu
          </button>
        </div>
      )}
    </div>
  );
}
