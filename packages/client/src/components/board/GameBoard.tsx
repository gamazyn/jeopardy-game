import { motion } from 'framer-motion';
import type { Category } from '@jeopardy/shared';

interface Props {
  categories: Category[];
  gameId?: string;
  onSelectQuestion?: (categoryId: string, questionId: string) => void;
  activeQuestionId?: string | null;
  fillHeight?: boolean;
}

export function GameBoard({ categories, gameId, onSelectQuestion, activeQuestionId, fillHeight = false }: Props) {
  const maxQuestions = Math.max(...categories.map((c) => c.questions.length));
  return (
    <div
      className={`grid gap-1 w-full ${fillHeight ? 'h-full' : ''}`}
      style={{
        gridTemplateColumns: `repeat(${categories.length}, 1fr)`,
        ...(fillHeight ? { gridTemplateRows: `repeat(${maxQuestions + 1}, 1fr)` } : {}),
      }}
    >
      {/* Headers das categorias */}
      {categories.map((cat) => (
        <div
          key={cat.id}
          className={`border-4 border-slate-800 flex items-center justify-center text-center p-1 md:p-3 overflow-hidden ${fillHeight ? '' : 'min-h-[80px]'}`}
          style={{
            background: 'linear-gradient(180deg, #1e3a5f 0%, #0d1f33 100%)',
            boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.08), inset 0 -3px 0 rgba(0,0,0,0.5)',
          }}
        >
          {cat.media ? (
            <img src={`/media/${gameId}/${cat.media.filename}`} alt={cat.name} className="max-h-16 object-contain" />
          ) : (
            <span
              className="font-arcade text-white uppercase text-xs md:text-sm leading-tight tracking-widest"
              style={{ textShadow: '0 1px 8px rgba(0,0,0,0.9), 0 0 20px rgba(255,255,255,0.1)' }}
            >
              {cat.name}
            </span>
          )}
        </div>
      ))}

      {/* Questões */}
      {(() => {
        return Array.from({ length: maxQuestions }, (_, rowIdx) =>
          categories.map((cat) => {
            const q = cat.questions[rowIdx];
            if (!q) return <div key={`${cat.id}-empty-${rowIdx}`} />;

            const isActive = q.id === activeQuestionId;

            return (
              <motion.div
                key={q.id}
                whileHover={!q.used ? { scale: 1.03 } : {}}
                whileTap={!q.used ? { scale: 0.97 } : {}}
                className={`question-cell ${fillHeight ? '' : 'aspect-[4/3]'} ${q.used ? 'used' : ''} ${
                  isActive ? 'ring-4 ring-jeopardy-gold' : ''
                }`}
                onClick={() => {
                  if (!q.used && onSelectQuestion) {
                    onSelectQuestion(cat.id, q.id);
                  }
                }}
              >
                {q.used ? '' : `$${q.value}`}
              </motion.div>
            );
          }),
        );
      })()}
    </div>
  );
}
