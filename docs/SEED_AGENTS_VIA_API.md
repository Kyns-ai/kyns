# Seed de agentes via API (backend a correr)

Quando o LibreChat está em produção (ex.: https://chat.kyns.ai), podes criar agentes em massa chamando a API com um script que não depende do build do monorepo.

---

## 1. Endpoint para criar um agente

**POST** `/api/agents`

- **URL completa (ex.):** `https://chat.kyns.ai/api/agents`
- **Headers:** `Content-Type: application/json`, `Authorization: Bearer <token>`
- **Body:** JSON conforme o schema de criação (ver [AGENTS_JSON_REFERENCE.md](./AGENTS_JSON_REFERENCE.md)). Não envies `id` nem `author` — a API define-os.

---

## 2. Como obter o token de autenticação (admin)

1. **Login:** **POST** `/api/auth/login`  
   - Body: `{ "email": "teu-email-admin@exemplo.com", "password": "tua-password" }`
   - Resposta de sucesso: `{ "token": "...", "user": { ... } }`
   - O **token** é o que usas no header `Authorization: Bearer <token>`.

2. **Credenciais:** O LibreChat não guarda email/password de admin no `.env`. As credenciais são as do **utilizador admin** que já existe na base de dados (o que usas para entrar na UI). Usa esse email e password no login.

3. Para o script, define variáveis de ambiente (ou passa de outra forma):
   - `LIBRECHAT_ADMIN_EMAIL` – email do utilizador admin
   - `LIBRECHAT_ADMIN_PASSWORD` – password desse utilizador

---

## 3. Script: seed via API

Ficheiro: **`config/seed-agents-api.js`**

- Lê `~/Downloads/agents.json` (ou o caminho que passares como argumento).
- Faz login em **POST /api/auth/login** com `LIBRECHAT_ADMIN_EMAIL` e `LIBRECHAT_ADMIN_PASSWORD`.
- Para cada agente no JSON, faz **POST /api/agents** com o token obtido.
- Mostra o resultado de cada criação (OK ou erro).

**Uso (na raiz do projeto):**

```bash
# Definir base URL (opcional; default: https://chat.kyns.ai)
export LIBRECHAT_BASE_URL="https://chat.kyns.ai"

# Credenciais do admin (obrigatório)
export LIBRECHAT_ADMIN_EMAIL="admin@exemplo.com"
export LIBRECHAT_ADMIN_PASSWORD="tua-password"

# Executar (caminho default: ~/Downloads/agents.json)
node config/seed-agents-api.js

# Ou com ficheiro explícito
node config/seed-agents-api.js /caminho/para/agents.json
```

Requisitos: Node 18+ (fetch nativo). Sem dependências do monorepo.

O script normaliza o campo `provider` para minúsculas antes de enviar (ex.: `openAI` → `openai`).

---

## 4. Agentes criados mas não aparecem na interface

A lista do marketplace mostra só agentes em que **tens permissão de visualização (ACL)**. Ao criar via API, o backend deve atribuir **AGENT_OWNER** ao teu user; se essa atribuição falhar (ex.: roles não existirem na BD, ou erro ao escrever em `aclentries`), o agente fica sem entrada de permissão e **não aparece** na lista, mesmo existindo na coleção `agents`.

**O que fazer:**

1. **Correr a migração de permissões** (no ambiente onde o projeto está buildado, ex. Railway ou local com `npm run build`):
   ```bash
   npm run migrate:agent-permissions
   ```
   Sem `--dry-run`, o script encontra agentes com `author` definido mas **sem entradas de ACL** e atribui **AGENT_OWNER** ao autor. Depois disso, esses agentes passam a aparecer para o utilizador que os criou.

2. **Confirmar que os roles existem**  
   Se ao correr a migração aparecer *"Required roles not found. Run role seeding first"*, é preciso garantir que os roles (AGENT_OWNER, AGENT_VIEWER, AGENT_EDITOR, etc.) estão criados na base (seeding de roles do LibreChat).

3. **Ver logs do backend**  
   Se quiseres perceber por que é que a atribuição falhou ao criar: procura no log por mensagens como *"Failed to grant owner permissions for agent"*.

Em resumo: os agentes estão na BD, mas sem permissões; a migração `migrate:agent-permissions` corrige isso e eles passam a aparecer na interface.
