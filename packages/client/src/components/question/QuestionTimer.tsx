import { motion } from 'framer-motion';

interface Props {
  remainingMs: number;
  totalMs: number;
  isPaused: boolean;
}

export function QuestionTimer({ remainingMs, totalMs, isPaused }: Props) {
  const seconds = Math.ceil(remainingMs / 1000);
  const pct = totalMs > 0 ? remainingMs / totalMs : 0;

  const color = pct > 0.5 ? '#22C55E' : pct > 0.25 ? '#EAB308' : '#EF4444';
  const glow = pct > 0.5
    ? 'rgba(34,197,94,0.7)'
    : pct > 0.25
    ? 'rgba(234,179,8,0.7)'
    : 'rgba(239,68,68,0.7)';

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="font-mono font-bold tabular-nums"
        style={{
          color,
          fontSize: '3rem',
          textShadow: `0 0 20px ${glow}, 0 0 40px ${glow}`,
          lineHeight: 1,
        }}
      >
        {seconds}
      </div>
      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{
            backgroundColor: color,
            boxShadow: `0 0 8px ${glow}`,
          }}
          animate={{ width: `${pct * 100}%` }}
          transition={{ duration: 0.4, ease: 'linear' }}
        />
      </div>
      {isPaused && (
        <span className="text-yellow-400 text-xs font-bold uppercase tracking-wider font-mono">
          ⏸ PAUSADO
        </span>
      )}
    </div>
  );
}
