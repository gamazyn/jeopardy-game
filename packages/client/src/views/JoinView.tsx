import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { socket } from '../socket.js';
import { useGameStore } from '../store/gameStore.js';
import { usePlayerStore } from '../store/playerStore.js';

export function JoinView() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { setSession, reset: resetGame } = useGameStore();
  const { myName, setMyName, setMyId, setBuzzerPosition } = usePlayerStore();
  const [error, setError] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!myName.trim() || !sessionId) return;
    setIsJoining(true);
    setError('');

    resetGame();
    setBuzzerPosition(null);
    socket.disconnect();
    socket.connect();

    socket.once('connect', () => {
      setMyId(socket.id ?? '');
      socket.emit('player:join', { joinCode: sessionId.toUpperCase(), playerName: myName });
    });

    socket.once('player:joined', ({ allPlayers }) => {
      const me = allPlayers.find((p) => p.id === socket.id);
      if (me) {
        setSession(sessionId.toUpperCase(), null, null, null, false);
        navigate(`/game/${sessionId.toUpperCase()}/player`);
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
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-8">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-jeopardy-gold tracking-wider mb-2">JEOPARDY!</h1>
        <p className="text-slate-400 text-sm">Sala</p>
        <p className="text-3xl font-bold tracking-widest mt-1">{sessionId?.toUpperCase()}</p>
      </div>

      <div className="card w-full max-w-sm">
        <h2 className="text-xl font-bold text-jeopardy-gold mb-4">Entrar na sala</h2>
        <form onSubmit={handleJoin} className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Seu nome"
            value={myName}
            onChange={(e) => setMyName(e.target.value)}
            maxLength={30}
            autoFocus
            className="bg-jeopardy-blue border-2 border-slate-500 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-jeopardy-gold"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            className="btn-primary"
            disabled={isJoining || !myName.trim()}
          >
            {isJoining ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>

      <button className="btn-ghost text-sm" onClick={() => navigate('/')}>
        ← Voltar ao menu
      </button>
    </div>
  );
}
