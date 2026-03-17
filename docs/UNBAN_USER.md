# Como desbanir um utilizador (remover ban do rate limiter)

O ban temporário por excesso de requests é guardado em **MongoDB**, na coleção **`logs`** (usada pelo Keyv para caches). Não há coleção `banLogs` separada; os bans ficam nessa coleção com chaves prefixadas.

---

## Outra forma: esperar o ban expirar

O ban é **temporário**. A duração vem da variável de ambiente **`BAN_DURATION`** (em milissegundos).

- **Valor por defeito:** `7200000` = **2 horas**.
- No `.env.example`: `BAN_DURATION=1000 * 60 * 60 * 2` (também 2 horas).

Se não fizeres nada, o ban termina sozinho após esse tempo. Na prática: **espera até 2 horas** (ou o valor configurado no servidor do KYNS). Depois disso podes voltar a usar a API/login normalmente.

---

## Onde está o ban

- **Store:** MongoDB, coleção **`logs`** (configuração do `keyvMongo` em `packages/api/src/cache/keyvMongo.ts`).
- **Chaves:** Cada documento tem um campo `key`. Os bans usam o namespace `BANS`:
  - Por **utilizador:** `key = "BANS:<userId>"` (o `_id` do user em string).
  - Por **IP:** `key = "BANS:<endereço IP>"`.

O middleware `checkBan` também usa uma cache com namespace `ban` (cópias em memória/Redis); ao apagar da BD, o ban deixa de ser encontrado na próxima leitura.

---

## Opção 1: Script `config/unban.js`

Na raiz do projeto:

```bash
# Desbanir por email do utilizador (remove ban por userId)
node config/unban.js --email teu-email@exemplo.com

# Desbanir por ID do utilizador (ObjectId do MongoDB)
node config/unban.js --user 507f1f77bcf86cd799439011

# Desbanir por IP
node config/unban.js --ip 192.168.1.1

# Remover TODOS os bans (limpa todas as chaves BANS na coleção logs)
node config/unban.js --all
```

Requer `.env` com `MONGO_URI` e ligação ao mesmo MongoDB do LibreChat.

---

## Opção 2: MongoDB shell (mongosh)

Ligar à base do LibreChat e correr:

```javascript
// Ver bans existentes
db.logs.find({ key: /^BANS:/ });

// Desbanir um utilizador (substituir <userId> pelo _id do user)
db.logs.deleteMany({ key: "BANS:<userId>" });

// Desbanir um IP (substituir pelo IP)
db.logs.deleteMany({ key: "BANS:<ip>" });

// Remover TODOS os bans
db.logs.deleteMany({ key: /^BANS:/ });
```

Para descobrir o `userId`: `db.users.findOne({ email: "teu-email@exemplo.com" }, { _id: 1 })` e usar o `_id` em string.

---

## Opção 3: Redis (se usares Redis)

Se tens `USE_REDIS=true`, o `checkBan` pode usar também chaves em Redis (prefixo `ban_cache:ip:` e `ban_cache:user:`). Apagar só da MongoDB pode ser suficiente, pois o ban é re-lido do store (Keyv com MongoDB). Se quiseres limpar também Redis:

```bash
# Listar chaves de ban (com prefixo do teu REDIS_KEY_PREFIX, se existir)
redis-cli KEYS "*ban*"

# Apagar (exemplo com prefixo vazio)
redis-cli DEL "ban_cache:user:507f1f77bcf86cd799439011"
redis-cli DEL "ban_cache:ip:192.168.1.1"
```

---

## Resumo

| Onde        | Coleção / Store | Chave / Padrão      |
|------------|------------------|----------------------|
| MongoDB    | `logs`           | `key: "BANS:<userId>"` ou `"BANS:<ip>"` |
| Redis (opcional) | Keys com prefixo | `ban_cache:user:<id>`, `ban_cache:ip:<ip>` |

Remover os documentos em `logs` com `key` começando por `BANS:` remove o ban; o script `config/unban.js` automatiza isso.
