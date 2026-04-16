import { motion, AnimatePresence } from 'framer-motion';
import type { Player } from '@jeopardy/shared';

interface Props {
  players: Player[];
  myId?: string;
}

export function Scoreboard({ players, myId }: Props) {
  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-jeopardy-gold font-bold text-sm uppercase tracking-wider mb-2">
        Placar
      </h3>
      <AnimatePresence>
        {sorted.map((player) => (
          <motion.div
            key={player.id}
            layout
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`flex items-center gap-2 py-2 px-3 rounded-lg ${
              player.id === myId ? 'bg-jeopardy-gold/20 border border-jeopardy-gold' : 'bg-blue-900/40'
            }`}
          >
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: player.avatarColor }}
            />
            <span className={`flex-1 text-sm truncate ${!player.isConnected ? 'opacity-50' : ''}`}>
              {player.name}
            </span>
            <motion.span
              key={player.score}
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 0.3 }}
              className={`font-bold text-sm ${
                player.score < 0 ? 'text-red-400' : 'text-jeopardy-gold'
              }`}
            >
              ${player.score.toLocaleString('pt-BR')}
            </motion.span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
