import { useMemo, memo, type FC, useCallback, useEffect, useRef } from 'react';
import throttle from 'lodash/throttle';
import { useRecoilValue } from 'recoil';
import { Spinner, useMediaQuery } from '@librechat/client';
import { List, AutoSizer, CellMeasurer, CellMeasurerCache } from 'react-virtualized';
import { isAgentsEndpoint } from 'librechat-data-provider';
import type { TConversation } from 'librechat-data-provider';
import { useLocalize, TranslationKeys, useFavorites, useShowMarketplace, useLocalStorage } from '~/hooks';
import FavoritesList from '~/components/Nav/Favorites/FavoritesList';
import { useActiveJobs } from '~/data-provider';
import { groupConversationsByDate, cn } from '~/utils';
import Convo from './Convo';
import store from '~/store';

export type CellPosition = {
  columnIndex: number;
  rowIndex: number;
};

export type MeasuredCellParent = {
  invalidateCellSizeAfterRender?: ((cell: CellPosition) => void) | undefined;
  recomputeGridSize?: ((cell: CellPosition) => void) | undefined;
};

interface ConversationsProps {
  conversations: Array<TConversation | null>;
  moveToTop: () => void;
  toggleNav: () => void;
  containerRef: React.RefObject<List>;
  loadMoreConversations: () => void;
  isLoading: boolean;
  isSearchLoading: boolean;
}

interface MeasuredRowProps {
  cache: CellMeasurerCache;
  rowKey: string;
  parent: MeasuredCellParent;
  index: number;
  style: React.CSSProperties;
  children: React.ReactNode;
}

/** Reusable wrapper for virtualized row measurement */
const MeasuredRow: FC<MeasuredRowProps> = memo(
  ({ cache, rowKey, parent, index, style, children }) => (
    <CellMeasurer cache={cache} columnIndex={0} key={rowKey} parent={parent} rowIndex={index}>
      {({ registerChild }) => (
        <div ref={registerChild as React.LegacyRef<HTMLDivElement>} style={style}>
          {children}
        </div>
      )}
    </CellMeasurer>
  ),
);

MeasuredRow.displayName = 'MeasuredRow';

const LoadingSpinner = memo(() => {
  const localize = useLocalize();

  return (
    <div className="mx-auto mt-2 flex items-center justify-center gap-2">
      <Spinner className="text-text-primary" />
      <span className="animate-pulse text-text-primary">{localize('com_ui_loading')}</span>
    </div>
  );
});

LoadingSpinner.displayName = 'LoadingSpinner';

type ActiveTab = 'chats' | 'characters';

interface TabBarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

const TabBar: FC<TabBarProps> = memo(({ activeTab, onTabChange }) => {
  const localize = useLocalize();
  return (
    <div className="flex gap-1 px-1 py-1.5">
      <button
        type="button"
        onClick={() => onTabChange('chats')}
        className={cn(
          'flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors',
          activeTab === 'chats'
            ? 'bg-surface-active-alt text-text-primary'
            : 'text-text-secondary hover:bg-surface-active-alt hover:text-text-primary',
        )}
      >
        {localize('com_ui_chats')}
      </button>
      <button
        type="button"
        onClick={() => onTabChange('characters')}
        className={cn(
          'flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors',
          activeTab === 'characters'
            ? 'bg-surface-active-alt text-text-primary'
            : 'text-text-secondary hover:bg-surface-active-alt hover:text-text-primary',
        )}
      >
        {localize('com_agents_marketplace')}
      </button>
    </div>
  );
});

TabBar.displayName = 'TabBar';

const DateLabel: FC<{ groupName: string; isFirst?: boolean }> = memo(({ groupName, isFirst }) => {
  const localize = useLocalize();
  return (
    <h2
      className={cn('pl-1 pt-1 text-text-secondary', isFirst === true ? 'mt-0' : 'mt-2')}
      style={{ fontSize: '0.7rem' }}
    >
      {localize(groupName as TranslationKeys) || groupName}
    </h2>
  );
});

DateLabel.displayName = 'DateLabel';

type FlattenedItem =
  | { type: 'favorites' }
  | { type: 'tab-bar' }
  | { type: 'header'; groupName: string; section: 'chats' | 'characters' }
  | { type: 'convo'; convo: TConversation }
  | { type: 'loading' };

const MemoizedConvo = memo(
  ({
    conversation,
    retainView,
    toggleNav,
    isGenerating,
  }: {
    conversation: TConversation;
    retainView: () => void;
    toggleNav: () => void;
    isGenerating: boolean;
  }) => {
    return (
      <Convo
        conversation={conversation}
        retainView={retainView}
        toggleNav={toggleNav}
        isGenerating={isGenerating}
      />
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.conversation.conversationId === nextProps.conversation.conversationId &&
      prevProps.conversation.title === nextProps.conversation.title &&
      prevProps.conversation.endpoint === nextProps.conversation.endpoint &&
      prevProps.isGenerating === nextProps.isGenerating
    );
  },
);

const Conversations: FC<ConversationsProps> = ({
  conversations: rawConversations,
  moveToTop,
  toggleNav,
  containerRef,
  loadMoreConversations,
  isLoading,
  isSearchLoading,
}) => {
  const localize = useLocalize();
  const search = useRecoilValue(store.search);
  const { favorites, isLoading: isFavoritesLoading } = useFavorites();
  const isSmallScreen = useMediaQuery('(max-width: 768px)');
  const convoHeight = isSmallScreen ? 44 : 34;
  const showAgentMarketplace = useShowMarketplace();
  const [activeTab, setActiveTab] = useLocalStorage<ActiveTab>('convoActiveTab', 'chats');

  const { data: activeJobsData } = useActiveJobs();
  const activeJobIds = useMemo(
    () => new Set(activeJobsData?.activeJobIds ?? []),
    [activeJobsData?.activeJobIds],
  );

  const shouldShowFavorites =
    !search.query && (isFavoritesLoading || favorites.length > 0 || showAgentMarketplace);

  const filteredConversations = useMemo(
    () => rawConversations.filter(Boolean) as TConversation[],
    [rawConversations],
  );

  const { agentConversations, chatConversations } = useMemo(() => {
    const agents: TConversation[] = [];
    const chats: TConversation[] = [];
    for (const convo of filteredConversations) {
      if (isAgentsEndpoint(convo.endpoint)) {
        agents.push(convo);
      } else {
        chats.push(convo);
      }
    }
    return { agentConversations: agents, chatConversations: chats };
  }, [filteredConversations]);

  const groupedAgentConversations = useMemo(
    () => groupConversationsByDate(agentConversations),
    [agentConversations],
  );

  const groupedChatConversations = useMemo(
    () => groupConversationsByDate(chatConversations),
    [chatConversations],
  );

  const flattenedItems = useMemo(() => {
    const items: FlattenedItem[] = [];
    if (shouldShowFavorites) {
      items.push({ type: 'favorites' });
    }
    items.push({ type: 'tab-bar' });

    const activeGroups =
      activeTab === 'characters' ? groupedAgentConversations : groupedChatConversations;

    activeGroups.forEach(([groupName, convos]) => {
      items.push({
        type: 'header',
        groupName,
        section: activeTab === 'characters' ? 'characters' : 'chats',
      });
      items.push(...convos.map((convo) => ({ type: 'convo' as const, convo })));
    });

    if (isLoading) {
      items.push({ type: 'loading' });
    }
    return items;
  }, [
    groupedAgentConversations,
    groupedChatConversations,
    isLoading,
    activeTab,
    shouldShowFavorites,
  ]);

  const flattenedItemsRef = useRef(flattenedItems);
  flattenedItemsRef.current = flattenedItems;

  const cache = useMemo(
    () =>
      new CellMeasurerCache({
        fixedWidth: true,
        defaultHeight: convoHeight,
        keyMapper: (index) => {
          const item = flattenedItemsRef.current[index];
          if (!item) {
            return `unknown-${index}`;
          }
          if (item.type === 'favorites') {
            return 'favorites';
          }
          if (item.type === 'tab-bar') {
            return 'tab-bar';
          }
          if (item.type === 'header') {
            return `header-${item.section}-${item.groupName}`;
          }
          if (item.type === 'convo') {
            return `convo-${item.convo.conversationId}`;
          }
          if (item.type === 'loading') {
            return 'loading';
          }
          return `unknown-${index}`;
        },
      }),
    [convoHeight],
  );

  const clearFavoritesCache = useCallback(() => {
    if (cache) {
      cache.clear(0, 0);
      if (containerRef.current && 'recomputeRowHeights' in containerRef.current) {
        containerRef.current.recomputeRowHeights(0);
      }
    }
  }, [cache, containerRef]);

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      clearFavoritesCache();
    });
    return () => cancelAnimationFrame(frameId);
  }, [favorites.length, isFavoritesLoading, clearFavoritesCache]);

  useEffect(() => {
    cache.clearAll();
    if (containerRef.current && 'recomputeRowHeights' in containerRef.current) {
      (containerRef.current as unknown as { recomputeRowHeights: (idx: number) => void }).recomputeRowHeights(0);
    }
  }, [activeTab, cache, containerRef]);

  const rowRenderer = useCallback(
    ({ index, key, parent, style }) => {
      const item = flattenedItems[index];
      const rowProps = { cache, rowKey: key, parent, index, style };

      if (item.type === 'loading') {
        return (
          <MeasuredRow key={key} {...rowProps}>
            <LoadingSpinner />
          </MeasuredRow>
        );
      }

      if (item.type === 'favorites') {
        return (
          <MeasuredRow key={key} {...rowProps}>
            <FavoritesList
              isSmallScreen={isSmallScreen}
              toggleNav={toggleNav}
              onHeightChange={clearFavoritesCache}
            />
          </MeasuredRow>
        );
      }

      if (item.type === 'tab-bar') {
        return (
          <MeasuredRow key={key} {...rowProps}>
            <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
          </MeasuredRow>
        );
      }

      if (item.type === 'header') {
        const firstHeaderIndex = shouldShowFavorites ? 2 : 1;
        return (
          <MeasuredRow key={key} {...rowProps}>
            <DateLabel groupName={item.groupName} isFirst={index === firstHeaderIndex} />
          </MeasuredRow>
        );
      }

      if (item.type === 'convo') {
        const isGenerating = activeJobIds.has(item.convo.conversationId ?? '');
        return (
          <MeasuredRow key={key} {...rowProps}>
            <MemoizedConvo
              conversation={item.convo}
              retainView={moveToTop}
              toggleNav={toggleNav}
              isGenerating={isGenerating}
            />
          </MeasuredRow>
        );
      }

      return null;
    },
    [
      cache,
      flattenedItems,
      moveToTop,
      toggleNav,
      clearFavoritesCache,
      isSmallScreen,
      activeTab,
      setActiveTab,
      shouldShowFavorites,
      activeJobIds,
    ],
  );

  const getRowHeight = useCallback(
    ({ index }: { index: number }) => cache.getHeight(index, 0),
    [cache],
  );

  const throttledLoadMore = useMemo(
    () => throttle(loadMoreConversations, 300),
    [loadMoreConversations],
  );

  const handleRowsRendered = useCallback(
    ({ stopIndex }: { stopIndex: number }) => {
      if (stopIndex >= flattenedItems.length - 8) {
        throttledLoadMore();
      }
    },
    [flattenedItems.length, throttledLoadMore],
  );

  return (
    <div className="relative flex h-full min-h-0 flex-col pb-2 text-sm text-text-primary">
      {isSearchLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner className="text-text-primary" />
          <span className="ml-2 text-text-primary">{localize('com_ui_loading')}</span>
        </div>
      ) : (
        <div className="flex-1">
          <AutoSizer>
            {({ width, height }) => (
              <List
                ref={containerRef}
                width={width}
                height={height}
                deferredMeasurementCache={cache}
                rowCount={flattenedItems.length}
                rowHeight={getRowHeight}
                rowRenderer={rowRenderer}
                overscanRowCount={10}
                aria-readonly={false}
                className="outline-none"
                aria-label="Conversations"
                onRowsRendered={handleRowsRendered}
                tabIndex={-1}
                style={{ outline: 'none', scrollbarGutter: 'stable' }}
                containerRole="rowgroup"
              />
            )}
          </AutoSizer>
        </div>
      )}
    </div>
  );
};

export default memo(Conversations);
