import React from 'react';
import { Link, Pin, PinOff } from 'lucide-react';
import { OGDialogContent, Button, useToastContext } from '@librechat/client';
import type t from 'librechat-data-provider';
import { useFavorites, useLocalize } from '~/hooks';
import useStartAgentChat from '~/hooks/Agents/useStartAgentChat';
import { renderAgentAvatar } from '~/utils';

interface SupportContact {
  name?: string;
  email?: string;
}

interface AgentWithSupport extends t.Agent {
  support_contact?: SupportContact;
}

interface AgentDetailContentProps {
  agent: AgentWithSupport;
  hideStartChat?: boolean;
}

/**
 * Dialog content for displaying agent details
 * Used inside OGDialog with OGDialogTrigger for proper focus management
 */
const AgentDetailContent: React.FC<AgentDetailContentProps> = ({ agent, hideStartChat = false }) => {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const { isFavoriteAgent, toggleFavoriteAgent } = useFavorites();
  const startAgentChat = useStartAgentChat();
  const isFavorite = isFavoriteAgent(agent?.id);

  const handleFavoriteClick = () => {
    if (agent) {
      toggleFavoriteAgent(agent.id);
    }
  };

  /**
   * Navigate to chat with the selected agent
   */
  const handleStartChat = () => {
    if (agent) {
      startAgentChat(agent);
    }
  };

  /**
   * Copy the agent's shareable link to clipboard
   */
  const handleCopyLink = () => {
    const baseUrl = new URL(window.location.origin);
    const chatUrl = `${baseUrl.origin}/c/new?agent_id=${agent.id}`;
    navigator.clipboard
      .writeText(chatUrl)
      .then(() => {
        showToast({
          message: localize('com_agents_link_copied'),
        });
      })
      .catch(() => {
        showToast({
          message: localize('com_agents_link_copy_failed'),
        });
      });
  };

  /**
   * Format contact information with mailto links when appropriate
   */
  const formatContact = () => {
    if (!agent?.support_contact) return null;

    const { name, email } = agent.support_contact;

    if (name && email) {
      return (
        <a href={`mailto:${email}`} className="text-primary hover:underline">
          {name}
        </a>
      );
    }

    if (email) {
      return (
        <a href={`mailto:${email}`} className="text-primary hover:underline">
          {email}
        </a>
      );
    }

    if (name) {
      return <span>{name}</span>;
    }

    return null;
  };

  return (
    <OGDialogContent className="max-h-[90vh] w-11/12 max-w-lg overflow-y-auto">
      {/* Agent avatar */}
      <div className="mt-6 flex justify-center">{renderAgentAvatar(agent, { size: 'modal' })}</div>

      {/* Agent name */}
      <div className="mt-3 text-center">
        <h2 className="text-2xl font-bold text-text-primary">
          {agent?.name || localize('com_agents_loading')}
        </h2>
      </div>

      {/* Contact info */}
      {agent?.support_contact && formatContact() && (
        <div className="mt-1 text-center text-sm text-text-secondary">
          {localize('com_agents_contact')}: {formatContact()}
        </div>
      )}

      {/* Agent description */}
      <div className="mt-4 whitespace-pre-wrap px-6 text-center text-base text-text-primary">
        {agent?.description}
      </div>

      {/* Action buttons */}
      <div className="mb-4 mt-6 flex justify-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={handleFavoriteClick}
          title={isFavorite ? localize('com_ui_unpin') : localize('com_ui_pin')}
          aria-label={isFavorite ? localize('com_ui_unpin') : localize('com_ui_pin')}
        >
          {isFavorite ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={handleCopyLink}
          title={localize('com_agents_copy_link')}
          aria-label={localize('com_agents_copy_link')}
        >
          <Link className="h-4 w-4" aria-hidden="true" />
        </Button>
        {!hideStartChat && (
          <Button className="w-full max-w-xs" onClick={handleStartChat} disabled={!agent}>
            {localize('com_agents_start_chat')}
          </Button>
        )}
      </div>
    </OGDialogContent>
  );
};

export default AgentDetailContent;
