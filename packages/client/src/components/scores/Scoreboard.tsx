import { motion, AnimatePresence } from 'framer-motion';
import type { Player } from '@responde-ai/shared';

interface Props {
  players: Player[];
  myId?: string;
  compact?: boolean;
}

const RANK_STYLES = [
  { border: '#E8B84B', bg: 'rgba(232,184,75,0.08)', glow: '0 0 12px rgba(232,184,75,0.3)' },  // 1st gold
  { border: '#94a3b8', bg: 'rgba(148,163,184,0.06)', glow: 'none' },                           // 2nd silver
  { border: '#f97316', bg: 'rgba(249,115,22,0.06)', glow: 'none' },                            // 3rd coral
];

export function Scoreboard({ players, myId, compact = false }: Props) {
  const sorted = [...players].sort((a, b) => b.score - a.score);

  if (compact) {
    return (
      <div className="flex gap-2 overflow-x-auto pb-1">
        {sorted.map((player, i) => {
          const rank = RANK_STYLES[i];
          return (
            <motion.div
              key={player.id}
              layout
              className="flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-lg min-w-[72px]"
              style={{
                borderLeft: `3px solid ${rank?.border ?? '#334155'}`,
                background: rank?.bg ?? 'rgba(51,65,85,0.4)',
                boxShadow: player.id === myId ? '0 0 0 1px rgba(232,184,75,0.5)' : 'none',
              }}
            >
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: player.avatarColor }} />
              <span className={`text-xs truncate max-w-[64px] font-ui ${!player.isConnected ? 'opacity-50' : ''}`}>
                {player.name}
              </span>
              <motion.span
                key={player.score}
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 0.3 }}
                className={`font-mono font-bold text-xs ${player.score < 0 ? 'text-red-400' : 'text-jeopardy-gold'}`}
              >
                ${player.score.toLocaleString('pt-BR')}
              </motion.span>
            </motion.div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-jeopardy-gold font-arcade text-xs uppercase tracking-widest mb-2">
        Placar
      </h3>
      <AnimatePresence>
        {sorted.map((player, i) => {
          const rank = RANK_STYLES[i];
          const isMe = player.id === myId;
          return (
            <motion.div
              key={player.id}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`flex items-center gap-2 py-2 px-3 rounded-lg ${!player.isConnected ? 'opacity-60' : ''}`}
              style={{
                borderLeft: `3px solid ${rank?.border ?? '#334155'}`,
                background: rank?.bg ?? 'rgba(51,65,85,0.4)',
                boxShadow: isMe
                  ? `0 0 0 1px rgba(232,184,75,0.5), ${rank?.glow ?? 'none'}`
                  : rank?.glow ?? 'none',
              }}
            >
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: player.avatarColor }}
              />
              <span className="flex-1 text-sm truncate font-ui">
                {player.name}
                {isMe && <span className="text-jeopardy-gold text-xs ml-1 opacity-70">●</span>}
              </span>
              <motion.span
                key={player.score}
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 0.3 }}
                className={`font-mono font-bold text-sm ${player.score < 0 ? 'text-red-400' : 'text-jeopardy-gold'}`}
              >
                ${player.score.toLocaleString('pt-BR')}
              </motion.span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
