import { memo, useCallback, useMemo } from 'react';
import { useRecoilValue } from 'recoil';
import { useForm } from 'react-hook-form';
import { Spinner } from '@librechat/client';
import { useParams } from 'react-router-dom';
import { Constants, buildTree, isAgentsEndpoint } from 'librechat-data-provider';
import type { TMessage } from 'librechat-data-provider';
import type { ChatFormValues } from '~/common';
import {
  ChatContext,
  AddedChatContext,
  useFileMapContext,
  useAgentsMapContext,
  ChatFormProvider,
} from '~/Providers';
import { useAddedResponse, useResumeOnLoad, useAdaptiveSSE, useChatHelpers } from '~/hooks';
import ConversationStarters from './Input/ConversationStarters';
import { useGetMessagesByConvoId } from '~/data-provider';
import MessagesView from './Messages/MessagesView';
import Presentation from './Presentation';
import ChatForm from './Input/ChatForm';
import Landing from './Landing';
import Header from './Header';
import Footer from './Footer';
import { cn } from '~/utils';
import store from '~/store';

const SYNTHETIC_GREETING_MESSAGE_ID = 'agent-greeting-synthetic';

function LoadingSpinner() {
  return (
    <div className="relative flex-1 overflow-hidden overflow-y-auto">
      <div className="relative flex h-full items-center justify-center">
        <Spinner className="text-text-primary" />
      </div>
    </div>
  );
}

function buildAgentGreetingTree(
  greeting: string,
  agentId: string,
  agentName: string | null,
  conversationId: string,
): TMessage[] {
  const synthetic: TMessage = {
    messageId: SYNTHETIC_GREETING_MESSAGE_ID,
    conversationId,
    parentMessageId: null,
    text: greeting,
    isCreatedByUser: false,
    sender: agentName ?? 'AI',
    model: agentId,
    title: 'New Chat',
  };
  const tree = buildTree({ messages: [synthetic], fileMap: undefined });
  return tree ?? [];
}

function ChatView({ index = 0 }: { index?: number }) {
  const { conversationId } = useParams();
  const rootSubmission = useRecoilValue(store.submissionByIndex(index));
  const centerFormOnLanding = useRecoilValue(store.centerFormOnLanding);
  const conversation = useRecoilValue(store.conversationByIndex(index));
  const agentsMap = useAgentsMapContext();

  const fileMap = useFileMapContext();

  const { data: messagesTree = null, isLoading } = useGetMessagesByConvoId(conversationId ?? '', {
    select: useCallback(
      (data: TMessage[]) => {
        const dataTree = buildTree({ messages: data, fileMap });
        return dataTree?.length === 0 ? null : (dataTree ?? null);
      },
      [fileMap],
    ),
    enabled: !!fileMap,
  });

  const agentGreetingTree = useMemo(() => {
    if (
      conversation?.endpoint != null &&
      isAgentsEndpoint(conversation.endpoint) &&
      conversation.agent_id &&
      agentsMap?.[conversation.agent_id]?.greeting
    ) {
      const agent = agentsMap[conversation.agent_id];
      return buildAgentGreetingTree(
        agent.greeting,
        agent.id,
        agent.name ?? null,
        conversationId ?? Constants.NEW_CONVO,
      );
    }
    return null;
  }, [
    conversationId,
    conversation?.endpoint,
    conversation?.agent_id,
    agentsMap,
  ]);

  const effectiveMessagesTree = useMemo(() => {
    const hasRealMessages = messagesTree != null && messagesTree.length > 0;
    if (!hasRealMessages) {
      return agentGreetingTree?.length ? agentGreetingTree : null;
    }
    if (agentGreetingTree?.length) {
      // Make greeting the root with real messages as its children so MultiMessage
      // renders the greeting first and then recurses into the real conversation tree.
      const greetingRoot = { ...agentGreetingTree[0], children: messagesTree };
      return [greetingRoot];
    }
    return messagesTree;
  }, [messagesTree, agentGreetingTree]);

  const chatHelpers = useChatHelpers(index, conversationId);
  const addedChatHelpers = useAddedResponse();

  useAdaptiveSSE(rootSubmission, chatHelpers, false, index);

  // Auto-resume if navigating back to conversation with active job
  // Wait for messages to load before resuming to avoid race condition
  useResumeOnLoad(conversationId, chatHelpers.getMessages, index, !isLoading);

  const methods = useForm<ChatFormValues>({
    defaultValues: { text: '' },
  });

  let content: JSX.Element | null | undefined;
  const hasEffectiveMessages = effectiveMessagesTree != null && effectiveMessagesTree.length > 0;
  const isLandingPage =
    !hasEffectiveMessages && (conversationId === Constants.NEW_CONVO || !conversationId);
  const isNavigating = !hasEffectiveMessages && conversationId != null;
  const isAgentChat =
    conversation?.agent_id != null && isAgentsEndpoint(conversation.endpoint ?? '');

  if (isLoading && conversationId !== Constants.NEW_CONVO) {
    content = <LoadingSpinner />;
  } else if ((isLoading || isNavigating) && !isLandingPage) {
    content = <LoadingSpinner />;
  } else if (!isLandingPage) {
    content = <MessagesView messagesTree={effectiveMessagesTree} />;
  } else {
    content = <Landing centerFormOnLanding={centerFormOnLanding} />;
  }

  return (
    <ChatFormProvider {...methods}>
      <ChatContext.Provider value={chatHelpers}>
        <AddedChatContext.Provider value={addedChatHelpers}>
          <Presentation>
            <div className="relative flex h-full w-full flex-col">
              {!isLoading && !isAgentChat && <Header />}
              <>
                <div
                  className={cn(
                    'flex flex-col',
                    isLandingPage
                      ? 'flex-1 items-center justify-end sm:justify-center'
                      : 'h-full overflow-y-auto',
                  )}
                >
                  {content}
                  <div
                    className={cn(
                      'w-full',
                      isLandingPage && 'max-w-3xl transition-all duration-200 xl:max-w-4xl',
                    )}
                  >
                    <ChatForm index={index} />
                    {isLandingPage ? <ConversationStarters /> : <Footer />}
                  </div>
                </div>
                {isLandingPage && <Footer />}
              </>
            </div>
          </Presentation>
        </AddedChatContext.Provider>
      </ChatContext.Provider>
    </ChatFormProvider>
  );
}

export default memo(ChatView);
