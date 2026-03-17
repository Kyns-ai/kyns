# Referência: agents.json para seed em massa

Ficheiro: **array JSON** (lista de objetos). Cada objeto = um agente.

Uso do script: `node config/seed-agents.js [caminho/para/agents.json]`

---

## Campos que podes preencher

### Obrigatórios (sem isto o script ignora o item)

| Campo        | Tipo   | Exemplo                          |
|-------------|--------|-----------------------------------|
| **name**    | string | `"Luna"`                          |
| **provider**| string | `"openai"` (endpoint do modelo)   |
| **model**   | string | `"gpt-4o"` ou id do modelo custom  |

---

### Opcionais (todos podem ser omitidos)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| **description** | string | Texto curto que aparece no card do agente. |
| **instructions** | string | System prompt / instruções do agente (pode ser muito longo). |
| **category** | string | Categoria para filtros. Valores do KYNS: `general`, `romance`, `rpg`, `anime`, `wellbeing`, `mysticism`, `relationship`. Default: `general`. |
| **authorName** | string | Nome do autor (exibição). O dono real é sempre o admin/user do seed. |
| **model_parameters** | object | Parâmetros do modelo (temperature, max_tokens, etc.). |
| **tools** | string[] | Lista de IDs de ferramentas. Ex: `["web_search", "code_interpreter"]`. Default: `[]`. |
| **conversation_starters** | string[] | Frases sugeridas para iniciar conversa. |
| **greeting** | string | Primeira mensagem do agente ao abrir um chat novo (estilo Character.AI). Só aparece em conversas de agentes; o chat geral não é afectado. |
| **support_contact** | object | Ver formato abaixo. |
| **edges** | object[] | Handoffs entre agentes (grafo). Ver formato abaixo. |
| **end_after_tools** | boolean | Se deve terminar resposta após usar ferramentas. |
| **hide_sequential_outputs** | boolean | Ocultar saídas intermediárias. |
| **artifacts** | string | Config de artefatos. |
| **recursion_limit** | number | Limite de recursão. |
| **avatar** | object | Só URL/ficheiro; upload é à parte. Ver formato abaixo. |
| **is_promoted** | boolean | Se aparece em “Top Picks”. Default: false. |
| **tool_resources** | object | Recursos por ferramenta (file_search, etc.). Ver formato abaixo. |
| **tool_options** | object | Opções por ferramenta (defer_loading, etc.). |
| **agent_ids** | string[] | (Deprecated) usar **edges** para handoffs. |

---

## Formatos de objetos aninhados

### support_contact

```json
{
  "name": "Suporte KYNS",
  "email": "suporte@kyns.example.com"
}
```

Qualquer um dos dois pode ser omitido.

---

### avatar (apenas se já tiveres URL/ficheiro)

```json
{
  "filepath": "/path/or/url/to/image.png",
  "source": "local"
}
```

`source` costuma ser `"local"` ou `"s3"`. Para criar agentes sem avatar, não envies `avatar`.

---

### model_parameters (exemplos)

Depende do provider/modelo. Exemplos comuns:

```json
{
  "temperature": 0.8,
  "top_p": 0.95,
  "max_tokens": 600,
  "max_context_tokens": 8192,
  "max_output_tokens": 1024,
  "frequency_penalty": 0.1,
  "presence_penalty": 0.1
}
```

Nomes exatos podem variar por backend (ex.: `maxContextTokens` vs `max_context_tokens`). O que envias é guardado como está.

---

### edges (handoffs entre agentes)

Array de arestas do grafo (quem passa para quem):

```json
[
  {
    "from": "agent_abc123",
    "to": "agent_def456",
    "description": "Passar para o especialista",
    "edgeType": "handoff"
  }
]
```

- **from**: id do agente de origem (ou array de ids).
- **to**: id do agente de destino (ou array de ids).
- **description**, **edgeType** (`handoff` | `direct`), **prompt**, **excludeResults**, **promptKey**: opcionais.

Só faz sentido preencher depois de os agentes existirem e conheceres os `id` (ex.: após o primeiro seed).

---

### tool_resources (exemplo)

Para ferramentas que usam ficheiros (ex.: file_search, context):

```json
{
  "file_search": {
    "file_ids": ["file-xxx"],
    "vector_store_ids": ["vs-xxx"]
  },
  "context": {
    "file_ids": ["file-yyy"]
  }
}
```

Normalmente preenches isto na UI depois de criar o agente; no JSON podes deixar vazio ou omitir.

---

## Exemplo mínimo (1 agente)

```json
[
  {
    "name": "Luna",
    "provider": "openai",
    "model": "gpt-4o"
  }
]
```

---

## Exemplo completo (todos os campos que costumas usar)

```json
[
  {
    "name": "Luna",
    "description": "Tua namorada. Vocês moram juntos.",
    "instructions": "You are Luna...",
    "category": "romance",
    "provider": "openai",
    "model": "gpt-4o",
    "model_parameters": {
      "temperature": 0.8,
      "top_p": 0.95,
      "max_tokens": 600,
      "max_context_tokens": 8192
    },
    "tools": [],
    "authorName": "Admin",
    "conversation_starters": ["Oi amor!", "O que vamos fazer hoje?"],
    "support_contact": {
      "name": "KYNS",
      "email": "suporte@example.com"
    },
    "is_promoted": false
  }
]
```

---

## O que não precisas mandar

- **id**: o script gera (`agent_` + nanoid).
- **author**: o script usa o user admin da base.
- **versions**, **mcpServerNames**: preenchidos pelo `createAgent()`.
- **createdAt** / **updatedAt**: definidos pelo MongoDB.

---

## Resumo: mínimo para criar um agente

Precisas mandar **só isto** (num array):

- **name** (string)
- **provider** (string, ex.: `"openai"`)
- **model** (string, ex.: `"gpt-4o"` ou o id do teu modelo)

Todo o resto é opcional. O teu ficheiro com a Luna (e os outros) já está no formato certo; só garante que `provider` está como o endpoint no teu LibreChat (normalmente `openai` em minúsculas).
