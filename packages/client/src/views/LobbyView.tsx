import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { socket } from '../socket.js';
import { useGameStore } from '../store/gameStore.js';
import { useSocketEvents } from '../hooks/useSocketEvents.js';

export function LobbyView() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { players, phase, hostToken, tunnelUrl, localUrl, isHost } = useGameStore();
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

  const joinUrl = localUrl ?? tunnelUrl;

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

      <div className="w-full max-w-lg relative z-10 flex flex-col gap-5">
        {/* Room code hero */}
        <div
          className="rounded-2xl p-6 text-center"
          style={{
            background: 'linear-gradient(160deg, #1a2e45 0%, #0f1f33 100%)',
            border: '1px solid rgba(232,184,75,0.25)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
        >
          <p className="text-slate-500 font-ui text-xs uppercase tracking-widest mb-3">Código da Sala</p>
          <div
            className="font-arcade text-6xl md:text-7xl text-jeopardy-gold tracking-[0.15em] leading-none mb-1"
            style={{ textShadow: '0 0 30px rgba(232,184,75,0.7), 0 0 60px rgba(232,184,75,0.3), 0 3px 0 #8a6a1a' }}
          >
            {sessionId}
          </div>
          <p className="text-slate-600 font-ui text-xs mt-2">Digite o código ou escaneie o QR</p>
        </div>

        {/* QR code */}
        {sessionId && joinUrl && (
          <div
            className="rounded-2xl p-5 flex flex-col items-center gap-3"
            style={{
              background: 'linear-gradient(160deg, #141f30 0%, #0e1823 100%)',
              border: '1px solid rgba(255,255,255,0.06)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            }}
          >
            <div
              className="bg-white rounded-xl p-3"
              style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
            >
              <QRCodeSVG
                value={`${joinUrl}/join/${sessionId}`}
                size={148}
                bgColor="#ffffff"
                fgColor="#1e3a5f"
              />
            </div>
            <p className="text-slate-500 font-ui text-xs">Mesma rede Wi-Fi</p>
            {tunnelUrl && (
              <button
                className="font-ui text-sm transition-colors"
                style={{ color: '#E8B84B' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#F0C45A')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#E8B84B')}
                onClick={() => navigator.clipboard.writeText(`${tunnelUrl}/join/${sessionId}`)}
              >
                Copiar link remoto ↗
              </button>
            )}
          </div>
        )}

        {/* Player list */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(160deg, #141f30 0%, #0e1823 100%)',
            border: '1px solid rgba(255,255,255,0.06)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}
        >
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <p className="text-slate-400 font-ui text-xs uppercase tracking-widest">Jogadores</p>
            <span
              className="font-mono text-sm font-bold"
              style={{ color: players.length > 0 ? '#E8B84B' : '#475569' }}
            >
              {players.length}
            </span>
          </div>

          {players.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <div className="text-2xl mb-2">⏳</div>
              <p className="text-slate-500 font-ui text-sm">Aguardando jogadores entrarem...</p>
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {players.map((p, i) => (
                <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="text-slate-600 font-mono text-xs w-4 text-right">{i + 1}</span>
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: p.avatarColor,
                      boxShadow: `0 0 6px ${p.avatarColor}80`,
                    }}
                  />
                  <span className="font-ui font-medium text-slate-200 flex-1">{p.name}</span>
                  {!p.isConnected && (
                    <span className="text-red-400 font-ui text-xs">desconectado</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Action */}
        {isHost ? (
          <button
            className="btn-primary w-full text-lg py-4"
            disabled={players.length === 0}
            onClick={handleStart}
            style={{
              fontSize: '1.1rem',
              letterSpacing: '0.05em',
            }}
          >
            {players.length === 0 ? 'Aguardando jogadores...' : `▶ Iniciar Jogo (${players.length})`}
          </button>
        ) : (
          <div
            className="rounded-2xl px-5 py-4 text-center"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <p className="text-slate-400 font-ui text-sm">Aguardando o host iniciar o jogo...</p>
          </div>
        )}
      </div>
    </div>
  );
}
