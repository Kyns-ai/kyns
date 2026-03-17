# Schema do Agente no MongoDB (LibreChat)

## Collection

- **Nome:** `agents` (Mongoose deriva do model name `Agent` → pluralizado em minúsculas)

## Schema (packages/data-schemas/src/schema/agent.ts)

| Campo | Tipo | Obrigatório | Default | Notas |
|-------|------|-------------|---------|-------|
| **id** | String | ✅ | — | Único, indexado. Na API é gerado como `agent_${nanoid()}` |
| **name** | String | | | Nome do agente |
| **description** | String | | | Descrição |
| **instructions** | String | | | Instruções de sistema |
| **avatar** | Mixed | | undefined | `{ filepath: string, source: string }` ou undefined |
| **provider** | String | ✅ | | Ex: `openai`, `anthropic` |
| **model** | String | ✅ | | Ex: `gpt-4o` |
| **model_parameters** | Object | | | Ex: `{ temperature: 0.7, max_context_tokens: 4096 }` |
| **artifacts** | String | | | |
| **access_level** | Number | | | |
| **recursion_limit** | Number | | | |
| **tools** | [String] | | [] | Lista de IDs de ferramentas |
| **tool_kwargs** | [Mixed] | | | |
| **actions** | [String] | | | |
| **author** | ObjectId | ✅ | | Ref: `User` — dono do agente |
| **authorName** | String | | | Nome do autor (exibição) |
| **hide_sequential_outputs** | Boolean | | | |
| **end_after_tools** | Boolean | | | |
| **agent_ids** | [String] | | | (deprecated) usar edges |
| **edges** | [Mixed] | | [] | Handoffs entre agentes (graph edges) |
| **isCollaborative** | Boolean | | | |
| **conversation_starters** | [String] | | [] | |
| **tool_resources** | Mixed | | {} | |
| **projectIds** | [ObjectId] | | | Ref: Project |
| **versions** | [Mixed] | | [] | Histórico de versões (preenchido pelo createAgent) |
| **category** | String | | `'general'` | Ex: `general`, `romance`, `rpg`, `anime`, `wellbeing`, `mysticism`, `relationship` |
| **support_contact** | Mixed | | | `{ name?: string, email?: string }` |
| **is_promoted** | Boolean | | false | |
| **mcpServerNames** | [String] | | [] | Preenchido automaticamente a partir de `tools` |
| **tool_options** | Mixed | | | |
| **createdAt** | Date | | | Timestamps |
| **updatedAt** | Date | | | Timestamps |

## API de criação

- **POST /api/agents** (autenticado)
- Controller: `api/server/controllers/agents/v1.js` → `createAgentHandler`
- Model: `api/models/Agent.js` → `createAgent(agentData)`
- Após criar o documento, a API chama `grantPermission` para o utilizador atual (AGENT_OWNER e REMOTE_AGENT_OWNER).

## Permissões (ACL)

Cada agente precisa de entradas na collection `aclentries` para o autor ter acesso:

- `resourceType: 'agent'`, `accessRoleId: AccessRoleIds.AGENT_OWNER` (`'agent_owner'`)
- `resourceType: 'remoteAgent'`, `accessRoleId: AccessRoleIds.REMOTE_AGENT_OWNER` (`'remoteAgent_owner'`)

Sem isto, o agente não aparece na lista nem pode ser usado pelo autor.

## Notas para seed em massa

1. **id**: gerar único, ex: `agent_` + nanoid().
2. **author**: ObjectId de um User (ex: primeiro user com role ADMIN).
3. **versions**: o método `createAgent` em `api/models/Agent.js` preenche automaticamente com um snapshot dos dados atuais.
4. **mcpServerNames**: preenchido em `createAgent` a partir de `tools` (ferramentas com `mcp_delimiter`).
5. **category**: deve ser um dos valores existentes em `AgentCategory` (ex: `general`, `romance`, `rpg`, etc.).
