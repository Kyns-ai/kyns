# Agentes não respondem ao enviar mensagem (Railway)

## Deploy falha com «Healthcheck failure»

Se o deploy no Railway falha na fase **Network > Healthcheck** (serviço nunca fica «healthy»), a causa mais provável é:

- **`USE_REDIS=true`** nas variáveis do LibreChat **sem** ter **Redis** configurado (`REDIS_URI` ou `REDIS_URL`).  
  O arranque do backend faz throw e o processo morre antes de abrir a porta, por isso o healthcheck em `/health` nunca recebe resposta.

**O que fazer:**

1. No Railway → serviço **LibreChat** → **Variables**.
2. Se **não** usas Redis: define **`USE_REDIS=false`** (ou remove a variável `USE_REDIS`).
3. Se **quiseres** usar Redis: adiciona o serviço Redis ao projeto e liga-o ao LibreChat (referência `REDIS_URL` ou `REDIS_URI`).
4. Guarda e faz **redeploy**.

Com `USE_REDIS=false` e sem Redis, o backend usa o fluxo legado e os agentes funcionam na mesma.

---

## Comportamento actual (corrigido)

Quando **não** tens Redis configurado (`USE_REDIS` não está definido ou é `false`), o backend usa o **fluxo legado**: a resposta do **POST** `/api/agents/chat` é o próprio stream SSE na mesma ligação. Assim, os agentes funcionam com **qualquer número de réplicas**, sem precisar de Redis nem de reduzir a 1 réplica.

Quando tens **Redis** configurado (`USE_REDIS=true` e `REDIS_URI`/`REDIS_URL`), o backend usa o fluxo resumível (POST devolve `streamId`, o cliente faz GET ao stream). Nesse caso, várias réplicas funcionam porque o estado dos jobs está no Redis.

---

## Se ainda tiveres problemas (fluxo resumível / Redis)

Se usas Redis e os agentes não respondem, a causa pode ser:

1. **POST** `/api/agents/chat` → cria o job na réplica A e devolve `streamId`
2. **GET** `/api/agents/chat/stream/:streamId` → se for atendido por outra réplica (B), essa réplica não tem o job → 404.

Solução: garantir que Redis está correctamente ligado (variáveis e rede) ou usar 1 réplica.

---

## Soluções (para fluxo com Redis)

### 1. Usar uma única réplica (rápido)

No **Railway** → projeto → serviço **LibreChat** → **Settings** (ou **Deploy**):

- Garante que só há **1 réplica** (por exemplo, **Replicas: 1**).

Assim, POST e GET são tratados pelo mesmo processo e o job existe quando o cliente se inscreve no stream.

---

### 2. Usar Redis para partilhar estado (várias réplicas)

Para manter **mais de uma réplica** e os agentes a funcionar:

1. No Railway: **Add Service** → procurar **Redis** (ou [template Redis](https://railway.com/template/redis)) e adicionar ao projeto.
2. **Ligar** o serviço Redis ao serviço **LibreChat**: no LibreChat → **Variables** → **Add Reference** (ou Connect) e escolher a variável do Redis (ex. `REDIS_URL`). O Railway injecta automaticamente `REDIS_URL` quando referencias o Redis.
3. No serviço **LibreChat**, define:
   - `USE_REDIS=true`
   - Se a referência não criou `REDIS_URI`, o código aceita também **`REDIS_URL`** (o Railway usa este nome).
4. Redeploy do LibreChat.

Com Redis, o estado dos jobs de agentes é partilhado entre réplicas e o GET ao stream encontra o job em qualquer instância.

---

## Outras verificações

- **Chave da API do provider**: Os agentes usam um provider (ex.: `openAI`) e um modelo. No Railway, o serviço LibreChat precisa da chave correspondente (ex.: `OPENAI_API_KEY` e, se for o caso, `OPENAI_BASE_URL`). Se faltar, a geração pode falhar; o erro deve aparecer no stream ou nos logs.
- **Logs ao reproduzir**: Com `railway logs` a correr, envia uma mensagem a um agente e procura por:
  - `[ResumableAgentController] Generation error` ou `Initialization error` → problema na geração ou na configuração do agente.
  - `[StreamServices] Created in-memory stream services` → confirma que não estás a usar Redis (e que, com várias réplicas, a solução 1 ou 2 acima é necessária).

---

## Resumo

| Situação                         | O que fazer                                      |
|----------------------------------|--------------------------------------------------|
| Várias réplicas, sem Redis       | Reduzir a 1 réplica **ou** ativar Redis (1 e 2)  |
| Uma réplica                      | Verificar API keys e logs de erro (Outras verificações) |
