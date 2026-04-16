import { motion } from 'framer-motion';
import type { Category } from '@jeopardy/shared';

interface Props {
  categories: Category[];
  onSelectQuestion?: (categoryId: string, questionId: string) => void;
  activeQuestionId?: string | null;
}

export function GameBoard({ categories, onSelectQuestion, activeQuestionId }: Props) {
  return (
    <div
      className="grid gap-1 w-full"
      style={{ gridTemplateColumns: `repeat(${categories.length}, 1fr)` }}
    >
      {/* Headers das categorias */}
      {categories.map((cat) => (
        <div
          key={cat.id}
          className="bg-jeopardy-blue-light border-4 border-slate-800 flex items-center justify-center text-center p-3 min-h-[80px]"
        >
          {cat.media ? (
            <img src={`/media/${cat.media.filename}`} alt={cat.name} className="max-h-16 object-contain" />
          ) : (
            <span className="font-bold text-jeopardy-gold uppercase text-sm leading-tight">
              {cat.name}
            </span>
          )}
        </div>
      ))}

      {/* Questões */}
      {(() => {
        const maxQuestions = Math.max(...categories.map((c) => c.questions.length));
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
                className={`question-cell aspect-[4/3] ${q.used ? 'used' : ''} ${
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
