# Rate Limiting — KYNS.ai

## Visão Geral

O LibreChat já possui sistema de rate limiting completo usando `express-rate-limit` com suporte a Redis (via `limiterCache`). **Nenhum sistema novo foi criado** — apenas os valores foram auditados e as variáveis de ambiente explicitadas no `.env`.

---

## Autenticação (via variáveis de ambiente)

Controlado pelos arquivos em `api/server/middleware/limiters/` e aplicado diretamente nas rotas em `api/server/routes/auth.js`.

| Rota | Variável | Valor | Janela |
|---|---|---|---|
| `POST /api/auth/login` | `LOGIN_MAX` | **10 tentativas** | `LOGIN_WINDOW` = **15 min** |
| `POST /api/auth/register` | `REGISTER_MAX` | **3 contas** | `REGISTER_WINDOW` = **60 min** |
| `POST /api/auth/reset-password` | padrão | 2 tentativas | 2 min |
| `POST /api/auth/verify-email` | padrão | 2 tentativas | 2 min |

Quando o limite é atingido: HTTP `429` + log de violação. Com `BAN_VIOLATIONS=true`, violações repetidas resultam em banimento automático.

---

## Mensagens (via variáveis de ambiente)

| Limitador | Variável | Valor | Janela |
|---|---|---|---|
| Por IP (`LIMIT_MESSAGE_IP=true`) | `MESSAGE_IP_MAX` | **30 mensagens** | `MESSAGE_IP_WINDOW` = **1 min** |
| Por usuário (`LIMIT_MESSAGE_USER=true`) | `MESSAGE_USER_MAX` | **20 mensagens** | `MESSAGE_USER_WINDOW` = **1 min** |

---

## Uploads, TTS, STT e outros (via `librechat.yaml`)

```yaml
rateLimits:
  fileUploads:
    ipMax: 10          # 10 uploads por IP
    ipWindowInMinutes: 60
    userMax: 5         # 5 uploads por usuário
    userWindowInMinutes: 60
  conversationsImport:
    ipMax: 5
    ipWindowInMinutes: 60
    userMax: 2
    userWindowInMinutes: 60
  stt:
    ipMax: 20          # 20 transcrições por IP
    ipWindowInMinutes: 1
    userMax: 10        # 10 transcrições por usuário
    userWindowInMinutes: 1
  tts:
    ipMax: 20          # 20 sínteses de voz por IP
    ipWindowInMinutes: 1
    userMax: 10        # 10 sínteses de voz por usuário
    userWindowInMinutes: 1
  imageGenerations:
    ipMax: 15
    ipWindowInMinutes: 1440  # por dia
    userMax: 10
    userWindowInMinutes: 1440
```

---

## Sistema de Violações

Com `BAN_VIOLATIONS=true`, cada violação de rate limit gera um score:

| Tipo | Score |
|---|---|
| Login excessivo | 1 |
| Registro excessivo | 1 |
| Mensagens excessivas | 1 |
| Requisições concorrentes | 1 |
| Non-browser agent | 20 |
| TTS/STT/Upload/Import | 0 (só log, sem ban) |

Violações são registradas via `logViolation()` e armazenadas no Redis/cache.

---

## Arquivos Relevantes

```
api/server/middleware/limiters/
├── loginLimiter.js        # Login — lê LOGIN_MAX, LOGIN_WINDOW
├── registerLimiter.js     # Registro — lê REGISTER_MAX, REGISTER_WINDOW
├── messageLimiters.js     # Mensagens — lê MESSAGE_IP_MAX, MESSAGE_USER_MAX...
├── uploadLimiters.js      # Uploads — lê FILE_UPLOAD_IP_MAX...
├── ttsLimiters.js         # TTS — configurado via librechat.yaml
├── sttLimiters.js         # STT — configurado via librechat.yaml
└── index.js               # Exporta todos os limitadores
```
