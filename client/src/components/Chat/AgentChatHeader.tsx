import React, { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { isAgentsEndpoint } from 'librechat-data-provider';
import { OGDialog, OGDialogTrigger } from '@librechat/client';
import type { TConversation } from 'librechat-data-provider';
import type { ContextType } from '~/common';
import AgentDetailContent from '~/components/Agents/AgentDetailContent';
import { useAgentsMapContext } from '~/Providers/AgentsMapContext';
import { OpenSidebar, HeaderNewChat } from '~/components/Chat/Menus';
import CallButton from '~/components/Chat/Header/CallButton';
import { renderAgentAvatar } from '~/utils';

interface AgentChatHeaderProps {
  conversation: TConversation | null;
}

const AgentChatHeader: React.FC<AgentChatHeaderProps> = ({ conversation }) => {
  const agentsMap = useAgentsMapContext();
  const [isOpen, setIsOpen] = useState(false);
  const { navVisible, setNavVisible } = useOutletContext<ContextType>();

  const agent = useMemo(() => {
    if (!conversation?.agent_id || !isAgentsEndpoint(conversation.endpoint)) {
      return null;
    }
    return agentsMap?.[conversation.agent_id] ?? null;
  }, [conversation?.agent_id, conversation?.endpoint, agentsMap]);

  if (!agent) {
    return null;
  }

  return (
    <OGDialog open={isOpen} onOpenChange={setIsOpen}>
      <div className="sticky top-0 z-20 flex w-full items-center bg-surface-primary/80 px-4 py-3 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-2">
          <AnimatePresence initial={false}>
            {!navVisible && (
              <motion.div
                className="flex items-center gap-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <OpenSidebar setNavVisible={setNavVisible} className="max-md:hidden" />
                <HeaderNewChat />
              </motion.div>
            )}
          </AnimatePresence>
          <OGDialogTrigger asChild>
            <button
              type="button"
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 transition-colors hover:bg-surface-hover"
              aria-label={`Ver detalhes de ${agent.name}`}
            >
              <div className="flex-shrink-0 overflow-hidden rounded-full shadow-md">
                {renderAgentAvatar(agent, { size: 'md', showBorder: false })}
              </div>
              <div className="flex min-w-0 flex-col items-start overflow-hidden">
                <span className="truncate text-base font-semibold text-text-primary">
                  {agent.name}
                </span>
                {agent.description && (
                  <span className="truncate text-sm text-text-secondary">{agent.description}</span>
                )}
              </div>
            </button>
          </OGDialogTrigger>
          <CallButton hasVoice={!!agent?.voice} />
        </div>
      </div>
      <AgentDetailContent agent={agent} hideStartChat />
    </OGDialog>
  );
};

export default AgentChatHeader;
