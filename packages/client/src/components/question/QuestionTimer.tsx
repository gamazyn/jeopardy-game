import { motion } from 'framer-motion';

interface Props {
  remainingMs: number;
  totalMs: number;
  isPaused: boolean;
}

export function QuestionTimer({ remainingMs, totalMs, isPaused }: Props) {
  const seconds = Math.ceil(remainingMs / 1000);
  const pct = totalMs > 0 ? remainingMs / totalMs : 0;

  const color =
    pct > 0.5 ? '#22C55E' : pct > 0.25 ? '#EAB308' : '#EF4444';

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="text-5xl font-bold tabular-nums"
        style={{ color }}
      >
        {seconds}
      </div>
      <div className="w-full h-3 bg-blue-900 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          animate={{ width: `${pct * 100}%` }}
          transition={{ duration: 0.4, ease: 'linear' }}
        />
      </div>
      {isPaused && (
        <span className="text-yellow-400 text-sm font-bold uppercase tracking-wider">
          ⏸ Pausado
        </span>
      )}
    </div>
  );
}
