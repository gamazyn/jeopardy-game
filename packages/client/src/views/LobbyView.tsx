import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { socket } from '../socket.js';
import { useGameStore } from '../store/gameStore.js';
import { useSocketEvents } from '../hooks/useSocketEvents.js';

export function LobbyView() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { players, phase, hostToken, tunnelUrl, isHost } = useGameStore();
  useSocketEvents();

  useEffect(() => {
    if (phase === 'board') {
      navigate(isHost ? `/host/${sessionId}/board` : `/game/${sessionId}/player`);
    }
  }, [phase]);

  function handleStart() {
    if (!sessionId || !hostToken) return;
    socket.emit('host:start', { sessionId, hostToken });
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h2 className="text-slate-300 text-lg mb-2">Código da Sala</h2>
          <div className="text-6xl font-bold text-jeopardy-gold tracking-widest border-4 border-jeopardy-gold rounded-2xl py-4 px-8 inline-block">
            {sessionId}
          </div>
          {tunnelUrl && sessionId && (
            <div className="mt-4 flex flex-col items-center gap-3">
              <div className="bg-white p-3 rounded-xl">
                <QRCodeSVG
                  value={`${tunnelUrl}/join/${sessionId}`}
                  size={160}
                  bgColor="#ffffff"
                  fgColor="#1e3a5f"
                />
              </div>
              <p className="text-slate-400 text-xs">Aponte a câmera para entrar na sala</p>
              <button
                className="text-jeopardy-gold underline text-sm"
                onClick={() => navigator.clipboard.writeText(`${tunnelUrl}/join/${sessionId}`)}
              >
                Copiar link
              </button>
            </div>
          )}
        </div>

        <div className="card mb-6">
          <h3 className="text-jeopardy-gold font-bold mb-4">
            Jogadores ({players.length})
          </h3>
          {players.length === 0 ? (
            <p className="text-slate-400 text-center py-4">Aguardando jogadores...</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {players.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 py-2 border-b border-slate-600 last:border-0"
                >
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: p.avatarColor }}
                  />
                  <span className="font-medium">{p.name}</span>
                  {!p.isConnected && (
                    <span className="text-red-400 text-xs ml-auto">desconectado</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {isHost && (
          <button
            className="btn-primary w-full text-xl py-4"
            disabled={players.length === 0}
            onClick={handleStart}
          >
            Iniciar Jogo
          </button>
        )}

        {!isHost && (
          <p className="text-center text-slate-400">Aguardando o host iniciar o jogo...</p>
        )}
      </div>
    </div>
  );
}
