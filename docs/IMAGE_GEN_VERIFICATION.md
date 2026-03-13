# Verificação da geração de imagens (KYNS)

## O que foi verificado

### Railway (LibreChat)

- **Serviço**: LibreChat
- **Variáveis** (todas presentes):
  - `RUNPOD_IMAGE_ENDPOINT_ID` = `c6t2y6a1q124re`
  - `RUNPOD_API_KEY` = definida (usada também para imagem quando `RUNPOD_IMAGE_API_KEY` não está definida)
  - `OPENAI_REVERSE_PROXY` = URL do endpoint de chat RunPod
- **Auditoria**: `python3 config/railway-audit-services.py` passou.

### RunPod (endpoint de imagem)

- **Endpoint ID**: `c6t2y6a1q124re`
- **Submit**: `POST .../run` retorna `200` e job ID.
- **Health**: workers idle/ready presentes; endpoint ativo.

Conclusão: configuração Railway + RunPod está correta. O erro "Connection error." que o usuário vê costuma vir da **chamada ao LLM** (RunPod chat) quando o agente decide usar a ferramenta de imagem, não do endpoint de imagem em si.

## Alterações feitas no código

1. **KynsImageGen** (`api/app/clients/tools/structured/KynsImageGen.js`)
   - Timeouts: 30s no submit, 15s em cada poll.
   - Retry: 2 tentativas no submit com 2s de espera.
   - Mensagens em português para timeout e falha de conexão.

2. **imageProxy** (`api/server/routes/imageProxy.js`)
   - Timeouts nas chamadas axios ao RunPod (submit e poll).

3. **Agents client** (`api/server/controllers/agents/client.js`)
   - Para erros de rede (Connection error, terminated, ECONNRESET, etc.): mensagem amigável em português.

## Como testar

1. Aguardar o deploy no Railway concluir (ou conferir em: Railway → LibreChat → Deployments).
2. Em https://chat.kyns.ai, abrir um chat com o agente **KYNS Image** (ou modelo de imagem).
3. Pedir uma imagem (ex.: "um gato laranja").
4. Se aparecer "Falha de conexão com o servidor. Pode ser temporário — tente novamente em alguns instantes.", é a nova mensagem; tentar de novo.
5. Se o problema for só rede Railway ↔ RunPod, um **redeploy** pode ajudar: `railway redeploy --service LibreChat --yes` (a partir da raiz do repo, com `railway link` no projeto).

## Como ver os logs de build no Railway

Pelo CLI (no diretório do projeto, com `railway link` no projeto certo):

```bash
railway logs --service LibreChat --build --latest --lines 300
```

Isso mostra os logs do **último** deployment (incluindo se falhou). Para um deployment específico:

```bash
railway logs --service LibreChat --build <DEPLOYMENT_ID> --lines 300
```

O link dos Build Logs também aparece no output do `railway up`.

## Se o deploy falhar

Ver os **Build Logs** (comando acima ou no dashboard). Causa comum já encontrada: **package-lock.json desatualizado** — o build falhava com:

- `npm ci can only install packages when your package.json and package-lock.json are in sync`
- `Invalid: lock file's winston@3.11.0 does not satisfy winston@3.19.0`
- `Missing: winston-daily-rotate-file@5.0.0 from lock file`

Foi corrigido alinhando `packages/data-schemas` a `winston@^3.11.0` (igual ao restante do monorepo) e a entrada correspondente no lock. Se surgirem novos erros de lock, rodar `npm install --legacy-peer-deps` na raiz e commitar o novo `package-lock.json`.
