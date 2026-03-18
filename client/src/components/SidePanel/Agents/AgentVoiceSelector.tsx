import React from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { Dropdown } from '@librechat/client';
import { useVoicesQuery } from '~/data-provider';
import { useLocalize } from '~/hooks';
import type { AgentForm } from '~/common';

const AgentVoiceSelector: React.FC = () => {
  const localize = useLocalize();
  const { control } = useFormContext<AgentForm>();
  const { data: voices = [] } = useVoicesQuery();

  if (!voices.length) {
    return null;
  }

  const voiceOptions = [
    { label: localize('com_ui_none'), value: '' },
    ...voices.map((v) => ({ label: v, value: v })),
  ];

  return (
    <Controller
      name="voice"
      control={control}
      render={({ field }) => (
        <div className="flex items-center justify-between">
          <div id="agent-voice-label" className="text-sm">
            {localize('com_nav_voice_select')}
          </div>
          <Dropdown
            value={field.value ?? ''}
            options={voiceOptions}
            onChange={(newValue) => {
              const val = typeof newValue === 'string' ? newValue : newValue?.value ?? '';
              field.onChange(val || null);
            }}
            sizeClasses="min-w-[160px] !max-w-[280px]"
            testId="AgentVoiceDropdown"
            className="z-50"
            aria-labelledby="agent-voice-label"
          />
        </div>
      )}
    />
  );
};

export default AgentVoiceSelector;
