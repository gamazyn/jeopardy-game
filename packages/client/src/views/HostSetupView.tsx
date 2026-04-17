import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../socket.js';
import { useGameStore } from '../store/gameStore.js';
import { usePlayerStore } from '../store/playerStore.js';
import { ConfirmModal } from '../components/ui/ConfirmModal.js';

interface GameSummary {
  id: string;
  name: string;
  description?: string;
  updatedAt: string;
}

export function HostSetupView() {
  const navigate = useNavigate();
  const { setSession, reset: resetGame } = useGameStore();
  const { setMyId } = usePlayerStore();
  const [games, setGames] = useState<GameSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GameSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  function loadGames() {
    fetch('/api/games')
      .then((r) => r.json())
      .then(setGames)
      .catch(() => setGames([]));
  }

  useEffect(() => {
    loadGames();
  }, []);

  function handleHost() {
    if (!selected) return;
    setLoading(true);
    setError('');

    resetGame();
    socket.disconnect();
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
        setSession(res.sessionId, res.hostToken, res.tunnelUrl, res.localUrl, true);
        navigate(`/host/${res.sessionId}`);
      });
    });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch(`/api/games/${deleteTarget.id}`, { method: 'DELETE' });
      if (selected === deleteTarget.id) setSelected(null);
      setGames((gs) => gs.filter((g) => g.id !== deleteTarget.id));
    } catch {
      setError('Erro ao deletar jogo');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(232,184,75,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(232,184,75,0.03) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div className="w-full max-w-2xl relative z-10">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/')}
            className="text-slate-500 hover:text-slate-300 text-sm font-ui transition-colors mb-4 flex items-center gap-1"
          >
            ← Voltar
          </button>
          <p className="text-slate-500 font-ui text-xs uppercase tracking-widest mb-1">🎙️ Hospedar</p>
          <h1
            className="font-arcade text-4xl text-jeopardy-gold"
            style={{ textShadow: '0 0 20px rgba(232,184,75,0.4), 0 2px 0 #8a6a1a' }}
          >
            ESCOLHA UM JOGO
          </h1>
        </div>

        {games.length === 0 ? (
          <div
            className="rounded-2xl p-8 text-center"
            style={{
              background: 'linear-gradient(160deg, #1a2e45 0%, #0f1f33 100%)',
              border: '1px solid rgba(232,184,75,0.15)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}
          >
            <div className="text-4xl mb-4">📋</div>
            <p className="text-slate-300 font-ui mb-2">Nenhum jogo salvo ainda.</p>
            <p className="text-slate-500 font-ui text-sm mb-6">Crie seu primeiro quiz para começar.</p>
            <button className="btn-primary" onClick={() => navigate('/editor')}>
              Criar Jogo
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 mb-6">
            {games.map((g) => {
              const isSelected = selected === g.id;
              return (
                <div
                  key={g.id}
                  onClick={() => setSelected(g.id)}
                  className="rounded-2xl cursor-pointer transition-all duration-200"
                  style={{
                    background: isSelected
                      ? 'linear-gradient(160deg, #1e3a5f 0%, #0d1f33 100%)'
                      : 'linear-gradient(160deg, #141f30 0%, #0e1823 100%)',
                    border: isSelected ? '1px solid rgba(232,184,75,0.6)' : '1px solid rgba(255,255,255,0.06)',
                    boxShadow: isSelected
                      ? '0 0 0 1px rgba(232,184,75,0.2), 0 8px 24px rgba(0,0,0,0.4)'
                      : '0 2px 8px rgba(0,0,0,0.3)',
                    borderLeft: isSelected ? '3px solid #E8B84B' : '3px solid transparent',
                  }}
                >
                  <div className="flex items-start justify-between gap-3 p-5">
                    <div className="flex-1 min-w-0">
                      <div
                        className="font-ui font-bold text-lg truncate"
                        style={{ color: isSelected ? '#E8B84B' : '#e2e8f0' }}
                      >
                        {g.name}
                      </div>
                      {g.description && (
                        <div className="text-slate-400 font-ui text-sm mt-1 truncate">{g.description}</div>
                      )}
                      <div className="text-slate-600 font-ui text-xs mt-2 uppercase tracking-wider">
                        Atualizado {new Date(g.updatedAt).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="text-xs py-1.5 px-3 rounded-lg font-ui transition-all duration-150"
                        style={{
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: '#94a3b8',
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(232,184,75,0.5)';
                          (e.currentTarget as HTMLElement).style.color = '#E8B84B';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)';
                          (e.currentTarget as HTMLElement).style.color = '#94a3b8';
                        }}
                        onClick={() => navigate(`/editor/${g.id}`)}
                      >
                        Editar
                      </button>
                      <button
                        className="text-xs py-1.5 px-3 rounded-lg font-ui transition-all duration-150"
                        style={{ border: '1px solid rgba(239,68,68,0.4)', color: '#f87171' }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.15)';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.background = 'transparent';
                        }}
                        onClick={() => setDeleteTarget(g)}
                      >
                        Deletar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {error && (
          <p className="text-red-400 mb-4 text-center font-ui text-sm">{error}</p>
        )}

        <div className="flex gap-3 mt-2">
          {games.length > 0 && (
            <button
              className="btn-primary flex-1 text-base"
              disabled={!selected || loading}
              onClick={handleHost}
            >
              {loading ? 'Criando sala...' : '🎙️ Criar Sala'}
            </button>
          )}
          <button
            className="btn-ghost"
            onClick={() => navigate('/editor')}
            style={{ whiteSpace: 'nowrap' }}
          >
            + Novo Jogo
          </button>
        </div>
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        title={`Deletar "${deleteTarget?.name}"?`}
        description="O jogo e todas as mídias serão deletados permanentemente. Esta ação não pode ser desfeita."
        confirmLabel={deleting ? 'Deletando...' : 'Deletar'}
        cancelLabel="Cancelar"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
