import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../socket.js';
import { useGameStore } from '../store/gameStore.js';
import { usePlayerStore } from '../store/playerStore.js';

export function LandingView() {
  const navigate = useNavigate();
  const { setSession, reset: resetGame } = useGameStore();
  const { myName, setMyName, setMyId, setBuzzerPosition } = usePlayerStore();
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!joinCode.trim() || !myName.trim()) return;
    setIsJoining(true);
    setError('');

    resetGame();
    setBuzzerPosition(null);
    socket.disconnect();
    socket.connect();

    socket.once('connect', () => {
      setMyId(socket.id ?? '');
      socket.emit('player:join', { joinCode: joinCode.toUpperCase(), playerName: myName });
    });

    socket.once('player:joined', ({ allPlayers }) => {
      const me = allPlayers.find((p) => p.id === socket.id);
      if (me) {
        setSession(joinCode.toUpperCase(), null, null, null, false);
        navigate(`/game/${joinCode.toUpperCase()}/player`);
      }
      setIsJoining(false);
    });

    socket.once('error', ({ message }) => {
      setError(message);
      setIsJoining(false);
      socket.off('player:joined');
      socket.disconnect();
    });
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-10 relative overflow-hidden">
      {/* grid background sutil */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(232,184,75,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(232,184,75,0.03) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Logo */}
      <div className="text-center relative z-10">
        <div className="inline-block relative mb-3">
          <h1
            className="font-arcade text-7xl md:text-8xl text-jeopardy-gold"
            style={{
              textShadow: '0 0 30px rgba(232,184,75,0.8), 0 0 60px rgba(232,184,75,0.4), 0 4px 0 #8a6a1a',
              letterSpacing: '0.05em',
            }}
          >
            Responde Aí!
          </h1>
        </div>
        <p className="text-slate-400 font-ui tracking-widest text-sm uppercase">O quiz show com seus amigos</p>
      </div>

      {/* Cards */}
      <div className="flex flex-col md:flex-row gap-5 w-full max-w-2xl relative z-10">
        {/* Card: Hospedar */}
        <div
          className="flex-1 flex flex-col gap-4 rounded-2xl p-6 transition-transform duration-200 hover:-translate-y-1"
          style={{
            background: 'linear-gradient(160deg, #1a2e45 0%, #0f1f33 100%)',
            border: '1px solid rgba(232,184,75,0.25)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
        >
          <div>
            <div className="text-3xl mb-2">🎙️</div>
            <h2 className="font-arcade text-xl text-jeopardy-gold tracking-wide mb-1">HOSPEDAR</h2>
            <p className="text-slate-400 font-ui text-sm">Crie uma sala e convide seus amigos</p>
          </div>
          <div className="flex flex-col gap-2 mt-auto">
            <button className="btn-primary" onClick={() => navigate('/host')}>
              Criar Sala
            </button>
            <button className="btn-ghost text-sm" onClick={() => navigate('/editor')}>
              Editor de Quizzes
            </button>
          </div>
        </div>

        {/* Divider mobile */}
        <div className="flex md:hidden items-center gap-3">
          <div className="flex-1 h-px bg-slate-700" />
          <span className="text-slate-500 font-mono text-xs">OU</span>
          <div className="flex-1 h-px bg-slate-700" />
        </div>

        {/* Card: Entrar */}
        <div
          className="flex-1 flex flex-col gap-4 rounded-2xl p-6 transition-transform duration-200 hover:-translate-y-1"
          style={{
            background: 'linear-gradient(160deg, #1a2a1a 0%, #0f1a0f 100%)',
            border: '1px solid rgba(74,222,128,0.2)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          <div>
            <div className="text-3xl mb-2">🎮</div>
            <h2 className="font-arcade text-xl text-green-400 tracking-wide mb-1">ENTRAR</h2>
            <p className="text-slate-400 font-ui text-sm">Participe de um jogo em andamento</p>
          </div>
          <form onSubmit={handleJoin} className="flex flex-col gap-3 mt-auto">
            <input
              type="text"
              placeholder="Seu nome"
              value={myName}
              onChange={(e) => setMyName(e.target.value)}
              maxLength={30}
              className="editor-input font-ui"
            />
            <input
              type="text"
              placeholder="CÓDIGO DA SALA"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="editor-input font-mono font-bold text-center text-xl tracking-[0.3em] uppercase"
            />
            {error && <p className="text-red-400 text-sm font-ui">{error}</p>}
            <button
              type="submit"
              className="btn-primary mt-1"
              disabled={isJoining || !joinCode.trim() || !myName.trim()}
              style={{
                background: isJoining ? undefined : 'linear-gradient(180deg, #4ade80 0%, #16a34a 60%, #15803d 100%)',
                boxShadow: isJoining ? undefined : '0 2px 0 #14532d, 0 4px 12px rgba(34,197,94,0.3)',
                color: '#052e16',
              }}
            >
              {isJoining ? 'Entrando...' : 'Entrar no Jogo'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
