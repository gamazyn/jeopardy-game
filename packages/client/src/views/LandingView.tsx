import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../socket.js';
import { useGameStore } from '../store/gameStore.js';
import { usePlayerStore } from '../store/playerStore.js';

export function LandingView() {
  const navigate = useNavigate();
  const { setSession } = useGameStore();
  const { myName, setMyName, setMyId } = usePlayerStore();
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!joinCode.trim() || !myName.trim()) return;
    setIsJoining(true);
    setError('');

    socket.connect();

    socket.once('connect', () => {
      setMyId(socket.id ?? '');
      socket.emit('player:join', { joinCode: joinCode.toUpperCase(), playerName: myName });
    });

    socket.once('player:joined', ({ allPlayers }) => {
      const me = allPlayers.find((p) => p.id === socket.id);
      if (me) {
        setSession(joinCode.toUpperCase(), null, null, false);
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
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-8">
      <div className="text-center">
        <h1 className="text-7xl font-bold text-jeopardy-gold mb-2 tracking-wider">JEOPARDY!</h1>
        <p className="text-slate-300 text-lg">O quiz show mais divertido com seus amigos</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6 w-full max-w-2xl">
        {/* Card: Hospedar */}
        <div className="card flex-1 flex flex-col gap-4">
          <h2 className="text-2xl font-bold text-jeopardy-gold">Hospedar Jogo</h2>
          <p className="text-slate-300 text-sm">Crie uma sala e convide seus amigos</p>
          <button
            className="btn-primary mt-auto"
            onClick={() => navigate('/host')}
          >
            Criar Sala
          </button>
          <button
            className="btn-ghost"
            onClick={() => navigate('/editor')}
          >
            Editor de Jogos
          </button>
        </div>

        {/* Card: Entrar */}
        <div className="card flex-1 flex flex-col gap-4">
          <h2 className="text-2xl font-bold text-jeopardy-gold">Entrar em Jogo</h2>
          <form onSubmit={handleJoin} className="flex flex-col gap-3">
            <input
              type="text"
              placeholder="Seu nome"
              value={myName}
              onChange={(e) => setMyName(e.target.value)}
              maxLength={30}
              className="bg-jeopardy-blue border-2 border-slate-500 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-jeopardy-gold"
            />
            <input
              type="text"
              placeholder="Código da sala (ex: ABC123)"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="bg-jeopardy-blue border-2 border-slate-500 rounded-lg px-4 py-3 text-white placeholder-slate-500 uppercase tracking-widest text-center text-xl focus:outline-none focus:border-jeopardy-gold"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              className="btn-primary mt-auto"
              disabled={isJoining || !joinCode.trim() || !myName.trim()}
            >
              {isJoining ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
