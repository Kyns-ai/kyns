import { useState } from 'react';
import { PhoneCall, X, Volume2 } from 'lucide-react';
import { OGDialog, OGDialogContent, OGDialogTitle } from '@librechat/client';
import { useLocalize } from '~/hooks';

interface CallButtonProps {
  hasVoice?: boolean;
}

const CallButton: React.FC<CallButtonProps> = ({ hasVoice = false }) => {
  const localize = useLocalize();
  const [isOpen, setIsOpen] = useState(false);

  if (!hasVoice) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
        className="ml-auto flex-shrink-0 rounded-full p-2 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
        aria-label={localize('com_ui_voice_call')}
        title={localize('com_ui_voice_call')}
      >
        <PhoneCall className="h-4 w-4" />
      </button>

      <OGDialog open={isOpen} onOpenChange={setIsOpen}>
        <OGDialogContent className="max-w-sm">
          <div className="flex flex-col items-center gap-4 p-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-secondary">
              <Volume2 className="h-8 w-8 text-text-secondary" />
            </div>
            <div className="flex flex-col gap-1">
              <OGDialogTitle className="text-xl font-semibold">
                Chamada de Voz
              </OGDialogTitle>
              <span className="inline-flex items-center justify-center rounded-full bg-surface-secondary px-2.5 py-0.5 text-xs font-medium text-text-secondary">
                Em breve
              </span>
            </div>
            <p className="text-sm text-text-secondary">
              Chamadas de voz em tempo real estão chegando. Por enquanto, use o botão de play nas mensagens para ouvir o personagem.
            </p>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="mt-2 rounded-lg bg-surface-secondary px-6 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-hover"
            >
              <X className="mr-1.5 inline h-3.5 w-3.5" />
              Fechar
            </button>
          </div>
        </OGDialogContent>
      </OGDialog>
    </>
  );
};

export default CallButton;
