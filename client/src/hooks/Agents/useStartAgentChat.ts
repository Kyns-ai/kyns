import { useCallback } from 'react';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { Constants, EModelEndpoint, LocalStorageKeys, QueryKeys } from 'librechat-data-provider';
import type { Agent, TConversation } from 'librechat-data-provider';
import { useChatContext } from '~/Providers';
import useNavigateToConvo from '~/hooks/Conversations/useNavigateToConvo';
import useDefaultConvo from '~/hooks/Conversations/useDefaultConvo';
import useLocalize from '~/hooks/useLocalize';
import { clearMessagesCache } from '~/utils';
import { upsertAgentListCaches } from '~/utils/agentCache';
import type { ConversationCursorData } from '~/utils/convos';

function getExistingAgentConversation(
  queryClient: ReturnType<typeof useQueryClient>,
  agentId: string,
): TConversation | undefined {
  const queries = queryClient.getQueryCache().findAll([QueryKeys.allConversations], { exact: false });
  let latestConversation: TConversation | undefined;

  for (const query of queries) {
    const data = queryClient.getQueryData<InfiniteData<ConversationCursorData>>(query.queryKey);
    if (!data) {
      continue;
    }

    for (const page of data.pages) {
      for (const conversation of page.conversations) {
        if (conversation.endpoint !== EModelEndpoint.agents || conversation.agent_id !== agentId) {
          continue;
        }

        if (
          latestConversation == null ||
          new Date(conversation.updatedAt ?? 0).getTime() >
            new Date(latestConversation.updatedAt ?? 0).getTime()
        ) {
          latestConversation = conversation;
        }
      }
    }
  }

  return latestConversation;
}

export default function useStartAgentChat() {
  const localize = useLocalize();
  const queryClient = useQueryClient();
  const getDefaultConversation = useDefaultConvo();
  const { conversation, newConversation } = useChatContext();
  const { navigateToConvo } = useNavigateToConvo();

  return useCallback(
    (agent: Agent) => {
      upsertAgentListCaches(queryClient, agent);

      const existingConversation = getExistingAgentConversation(queryClient, agent.id);
      if (existingConversation) {
        navigateToConvo(existingConversation, {
          currentConvoId: conversation?.conversationId,
          resetLatestMessage: false,
        });
        return;
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

      clearMessagesCache(queryClient, conversation?.conversationId);
      queryClient.invalidateQueries([QueryKeys.messages]);

      const template = {
        conversationId: Constants.NEW_CONVO as string,
        endpoint: EModelEndpoint.agents,
        agent_id: agent.id,
        title: localize('com_agents_chat_with', { name: agent.name || localize('com_ui_agent') }),
      };

      const currentConvo = getDefaultConversation({
        conversation: { ...(conversation ?? {}), ...template },
        preset: template,
      });

      newConversation({
        template: currentConvo,
        preset: template,
      });
    },
    [conversation, getDefaultConversation, localize, navigateToConvo, newConversation, queryClient],
  );
}
