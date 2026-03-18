import { PermissionBits, QueryKeys } from 'librechat-data-provider';
import type { QueryClient } from '@tanstack/react-query';
import type { Agent, AgentListResponse } from 'librechat-data-provider';

const createAgentListResponse = (agent: Agent): AgentListResponse => ({
  object: 'list',
  data: [agent],
  first_id: agent.id,
  last_id: agent.id,
  has_more: false,
});

export function upsertAgentListCache(
  queryClient: QueryClient,
  requiredPermission: number,
  agent: Agent,
) {
  const cacheKey = [QueryKeys.agents, { requiredPermission }];

  queryClient.setQueryData<AgentListResponse>(cacheKey, (existingCache) => {
    if (!existingCache) {
      return createAgentListResponse(agent);
    }

    if (existingCache.data.some((cachedAgent) => cachedAgent.id === agent.id)) {
      return existingCache;
    }

    return {
      ...existingCache,
      data: [agent, ...existingCache.data],
      first_id: agent.id,
      last_id: existingCache.last_id || agent.id,
    };
  });
}

export function upsertAgentListCaches(queryClient: QueryClient, agent: Agent) {
  upsertAgentListCache(queryClient, PermissionBits.VIEW, agent);
  upsertAgentListCache(queryClient, PermissionBits.EDIT, agent);
}
