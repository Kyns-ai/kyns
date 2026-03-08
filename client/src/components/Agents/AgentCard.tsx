import React, { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Label, OGDialog, OGDialogTrigger } from '@librechat/client';
import {
  QueryKeys,
  Constants,
  EModelEndpoint,
  PermissionBits,
  LocalStorageKeys,
  AgentListResponse,
} from 'librechat-data-provider';
import type t from 'librechat-data-provider';
import { useLocalize, TranslationKeys, useAgentCategories } from '~/hooks';
import { cn, renderAgentAvatar, getContactDisplayName } from '~/utils';
import AgentDetailContent from './AgentDetailContent';
import { Info } from 'lucide-react';

interface AgentCardProps {
  agent: t.Agent;
  onSelect?: (agent: t.Agent) => void;
  className?: string;
}

/**
 * Card component — click goes directly to chat (Character.AI style).
 * Info button opens detail modal.
 */
const AgentCard: React.FC<AgentCardProps> = ({ agent, onSelect, className = '' }) => {
  const localize = useLocalize();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { categories } = useAgentCategories();
  const [isOpen, setIsOpen] = useState(false);

  const categoryLabel = useMemo(() => {
    if (!agent.category) return '';

    const category = categories.find((cat) => cat.value === agent.category);
    if (category) {
      if (category.label && category.label.startsWith('com_')) {
        return localize(category.label as TranslationKeys);
      }
      return category.label;
    }

    return agent.category.charAt(0).toUpperCase() + agent.category.slice(1);
  }, [agent.category, categories, localize]);

  const displayName = getContactDisplayName(agent);

  const handleStartChat = useCallback(() => {
    if (!agent) {
      return;
    }

    const keys = [QueryKeys.agents, { requiredPermission: PermissionBits.EDIT }];
    const listResp = queryClient.getQueryData<AgentListResponse>(keys);
    if (listResp != null && !listResp.data.some((a) => a.id === agent.id)) {
      const currentAgents = [agent, ...JSON.parse(JSON.stringify(listResp.data))];
      queryClient.setQueryData<AgentListResponse>(keys, { ...listResp, data: currentAgents });
    }

    localStorage.setItem(`${LocalStorageKeys.AGENT_ID_PREFIX}0`, agent.id);
    localStorage.setItem(
      `${LocalStorageKeys.LAST_CONVO_SETUP}_0`,
      JSON.stringify({
        endpoint: EModelEndpoint.agents,
        agent_id: agent.id,
        conversationId: Constants.NEW_CONVO,
      }),
    );

    queryClient.invalidateQueries([QueryKeys.messages]);
    navigate(`/c/${Constants.NEW_CONVO}`, { state: { focusChat: true } });
  }, [agent, queryClient, navigate]);

  const handleInfoClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsOpen(true);
    },
    [],
  );

  return (
    <OGDialog open={isOpen} onOpenChange={setIsOpen}>
      <div
        className={cn(
          'group relative flex h-32 gap-5 overflow-hidden rounded-xl',
          'cursor-pointer select-none px-6 py-4',
          'bg-surface-tertiary transition-colors duration-150 hover:bg-surface-hover',
          'md:h-36 lg:h-40',
          '[&_*]:cursor-pointer',
          className,
        )}
        aria-label={localize('com_agents_agent_card_label', {
          name: agent.name,
          description: agent.description ?? '',
        })}
        aria-describedby={agent.description ? `agent-${agent.id}-description` : undefined}
        tabIndex={0}
        role="button"
        onClick={handleStartChat}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleStartChat();
          }
        }}
      >
        {/* Info button - top right */}
        <OGDialogTrigger asChild>
          <button
            className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-text-tertiary opacity-0 transition-opacity hover:bg-surface-hover hover:text-text-primary group-hover:opacity-100"
            onClick={handleInfoClick}
            aria-label={localize('com_ui_info')}
          >
            <Info className="h-4 w-4" />
          </button>
        </OGDialogTrigger>

        {/* Category badge */}
        {categoryLabel && (
          <span className="absolute bottom-3 right-4 rounded-md bg-surface-hover px-2 py-0.5 text-xs text-text-secondary">
            {categoryLabel}
          </span>
        )}

        {/* Avatar */}
        <div className="flex-shrink-0 self-center">
          <div className="overflow-hidden rounded-full shadow-[0_0_15px_rgba(0,0,0,0.3)] dark:shadow-[0_0_15px_rgba(0,0,0,0.5)]">
            {renderAgentAvatar(agent, { size: 'card', showBorder: false })}
          </div>
        </div>

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col justify-center overflow-hidden">
          <Label className="line-clamp-2 text-base font-semibold text-text-primary md:text-lg">
            {agent.name}
          </Label>

          {agent.description && (
            <p
              id={`agent-${agent.id}-description`}
              className="mt-0.5 line-clamp-2 text-sm leading-snug text-text-secondary md:line-clamp-5"
              aria-label={localize('com_agents_description_card', {
                description: agent.description,
              })}
            >
              {agent.description}
            </p>
          )}

          {displayName && (
            <div className="mt-1 text-xs text-text-tertiary">
              <span className="truncate">
                {localize('com_ui_by_author', { 0: displayName || '' })}
              </span>
            </div>
          )}
        </div>
      </div>

      <AgentDetailContent agent={agent} />
    </OGDialog>
  );
};

export default AgentCard;
