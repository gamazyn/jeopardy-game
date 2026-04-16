import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../socket.js';
import { useGameStore } from '../store/gameStore.js';
import { usePlayerStore } from '../store/playerStore.js';
import type { GameConfig } from '@jeopardy/shared';

interface GameSummary {
  id: string;
  name: string;
  description?: string;
  updatedAt: string;
}

export function HostSetupView() {
  const navigate = useNavigate();
  const { setSession } = useGameStore();
  const { setMyId } = usePlayerStore();
  const [games, setGames] = useState<GameSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/games')
      .then((r) => r.json())
      .then(setGames)
      .catch(() => setGames([]));
  }, []);

  function handleHost() {
    if (!selected) return;
    setLoading(true);
    setError('');

    socket.connect();

    socket.once('connect', () => {
      setMyId(socket.id ?? '');
      socket.emit('host:create', { gameConfigId: selected }, (res) => {
        if ('code' in res) {
          setError(res.message);
          setLoading(false);
          socket.disconnect();
          return;
        }
        setSession(res.sessionId, res.hostToken, res.tunnelUrl, true);
        navigate(`/host/${res.sessionId}`);
      });
    });
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <h1 className="text-4xl font-bold text-jeopardy-gold mb-8 text-center">Hospedar Jogo</h1>

        {games.length === 0 ? (
          <div className="card text-center text-slate-300">
            <p className="mb-4">Nenhum jogo salvo. Crie um primeiro!</p>
            <button className="btn-primary" onClick={() => navigate('/editor')}>
              Criar Jogo
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 mb-6">
            {games.map((g) => (
              <button
                key={g.id}
                onClick={() => setSelected(g.id)}
                className={`card text-left transition-all ${
                  selected === g.id
                    ? 'border-jeopardy-gold bg-jeopardy-blue-light'
                    : 'border-slate-600 hover:border-slate-500'
                }`}
              >
                <div className="font-bold text-lg">{g.name}</div>
                {g.description && <div className="text-slate-400 text-sm mt-1">{g.description}</div>}
                <div className="text-slate-500 text-xs mt-2">
                  Atualizado: {new Date(g.updatedAt).toLocaleDateString('pt-BR')}
                </div>
              </button>
            ))}
          </div>
        )}

        {error && <p className="text-red-400 mb-4 text-center">{error}</p>}

        <div className="flex gap-3">
          <button className="btn-ghost flex-1" onClick={() => navigate('/')}>
            Voltar
          </button>
          {games.length > 0 && (
            <button
              className="btn-primary flex-1"
              disabled={!selected || loading}
              onClick={handleHost}
            >
              {loading ? 'Criando sala...' : 'Criar Sala'}
            </button>
          )}
          <button className="btn-ghost" onClick={() => navigate('/editor')}>
            + Novo Jogo
          </button>
        </div>
      </div>
    </div>
  );
}
