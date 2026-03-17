# Plano: corrigir healthcheck no Railway

## O que não estamos vendo

- **Deploy Logs de runtime**: os logs que o CLI retorna misturam build com healthcheck; não aparece o que o processo Node imprime ao subir (ex.: "Server listening", erros de MongoDB, etc.).
- **Ordem de execução**: o servidor só chama `app.listen()` depois de carregar todo o `index.js`. Todos os `require()` (routes, db, @librechat/api, etc.) rodam **antes** do `listen()`. Se algum travar ou falhar, o processo nunca escuta na porta → healthcheck sempre "service unavailable".

## Plano de correção

### Opção A – Listen antes dos requires pesados (recomendada)

1. **Criar `api/server/bootstrap.js`** (entrada mínima):
   - `require('dotenv').config()` e `module-alias`.
   - `require('express')`, ler `PORT` / `HOST`.
   - `const app = express(); app.get('/health', ...); app.listen(port, host, ...)`.
   - No callback do `listen`, fazer `require('./index.js').attach(app)`.

2. **Ajustar `api/server/index.js`**:
   - Exportar `attach(app)` que faz todo o init (connectDb, rotas, etc.) e usa o `app` recebido em vez de criar um novo.
   - Manter `module.exports = app` para testes.
   - No `package.json`, script `backend` apontar para `node api/server/bootstrap.js`.

Assim o processo escuta em `/health` em poucos segundos; o restante do init roda depois.

### Opção B – Ver runtime no Railway

- No dashboard do Railway: **LibreChat → Deployments → deployment que falhou → aba "Deploy Logs"** (não Build Logs).
- Ver se aparece "Server listening", erro de MongoDB, ou crash antes do listen.
- Se aparecer crash/erro, corrigir a causa (ex.: MONGO_URI, timeout de conexão).

### Opção C – Desativar healthcheck (só para destravar)

- Em **Settings** do serviço LibreChat, remover ou desativar o healthcheck (se a UI permitir).
- O deploy passa; aí dá para ver os Deploy Logs do container rodando e debugar.
- Depois reativar o healthcheck e aplicar a Opção A.

## Próximo passo

Implementar **Opção A** (bootstrap + `attach(app)`) para o healthcheck passar de forma estável.
