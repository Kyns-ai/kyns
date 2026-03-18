import { memo, useCallback } from 'react';
import { cn } from '~/utils';

type SuggestionChipsProps = {
  suggestions: string[];
  onSuggestionClick: (text: string) => void;
};

const SuggestionChips = memo(({ suggestions, onSuggestionClick }: SuggestionChipsProps) => {
  const handleClick = useCallback(
    (text: string) => () => onSuggestionClick(text),
    [onSuggestionClick],
  );

  if (!suggestions.length) {
    return null;
  }

  return (
    <div
      className={cn(
        'mt-3 flex flex-wrap gap-2',
        'animate-fade-in',
      )}
      role="group"
      aria-label="Sugestões de continuação"
    >
      {suggestions.map((text, idx) => (
        <button
          key={idx}
          type="button"
          onClick={handleClick(text)}
          className={cn(
            'cursor-pointer rounded-[20px] border px-4 py-2 text-sm transition-all duration-200',
            'border-[#C8A86E]/30 bg-transparent text-[#E8DCC8]',
            'hover:border-[#C8A86E]/60 hover:shadow-[0_0_8px_rgba(200,168,110,0.3)]',
            'focus:outline-none focus:ring-2 focus:ring-[#C8A86E]/40',
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
});

export default SuggestionChips;
