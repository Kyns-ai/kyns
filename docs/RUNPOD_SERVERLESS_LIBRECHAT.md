# RunPod Serverless + LibreChat

Guia rápido para usar RunPod Serverless (vLLM) com LibreChat.

## Compatibilidade

- **RunPod Serverless** expõe API **OpenAI-compatible** em:
  ```
  https://api.runpod.ai/v2/ENDPOINT_ID/openai/v1
  ```
- Endpoints suportados: `/chat/completions`, `/completions`, `/models` (incluindo **streaming**).
- LibreChat usa essa mesma interface; basta apontar o reverse proxy para essa URL e usar a **RunPod API Key** no lugar da chave OpenAI.

## Configuração no LibreChat

### 1. RunPod Serverless

1. Crie um **Serverless Endpoint** no RunPod com vLLM.
2. Escolha o modelo (ex.: `llmfan46/Qwen3.5-27B-heretic-v2`) ou use um template que suporte o modelo.
3. Anote o **Endpoint ID** e a **RunPod API Key**.

### 2. Variáveis de ambiente (Railway / .env)

| Variável | Valor |
|----------|--------|
| `OPENAI_API_KEY` | Sua **RunPod API Key** (não a chave OpenAI) |
| `OPENAI_REVERSE_PROXY` | `https://api.runpod.ai/v2/SEU_ENDPOINT_ID/openai/v1` |
| `OPENAI_MODELS` | Nome **exato** do modelo (ex.: `llmfan46/Qwen3.5-27B-heretic-v2`) |

A autenticação é `Authorization: Bearer RUNPOD_API_KEY`, igual à OpenAI, então o LibreChat já envia no formato correto.

### 3. librechat.yaml

No `librechat.yaml`, em todos os lugares onde hoje está a URL do **pod** (ex.: `https://xxx.proxy.runpod.net/v1`), troque pela URL do **Serverless**:

- `endpoints.openAI` (ou custom): `baseURL: "https://api.runpod.ai/v2/ENDPOINT_ID/openai/v1"`
- `endpoints.agents.model` e `titleModel`/`summaryModel`: use o **mesmo nome de modelo** configurado no endpoint RunPod (geralmente o nome do repositório no Hugging Face, ou o override se você definiu `OPENAI_SERVED_MODEL_NAME_OVERRIDE` no worker).

## Por que o GLM pode ter “não funcionado”

Possíveis causas (config, LibreChat ou modelo):

1. **URL errada**  
   - Serverless: base deve ser `https://api.runpod.ai/v2/ENDPOINT_ID/openai/v1` (com `/v1` no final).  
   - Pod: era algo como `https://xxx-8000.proxy.runpod.net` (sem `/v1` no path, dependendo de como você montou).  
   - Se a base URL estiver errada, todas as chamadas falham (404, connection refused, etc.).

2. **Nome do modelo**  
   - No RunPod, o nome usado nas respostas é o do Hugging Face (ex.: `THUDM/glm-4-9b-chat`) ou o valor de `OPENAI_SERVED_MODEL_NAME_OVERRIDE`.  
   - No LibreChat e no `librechat.yaml` o `model` tem que ser **exatamente** esse nome. Nome diferente → “model not found” ou erro equivalente.

3. **Cold start (Serverless)**  
   - No Serverless o worker pode estar “frio”; a primeira requisição pode demorar 30–60 s ou mais e dar **timeout** no cliente.  
   - Ajuste timeouts no LibreChat/proxy se necessário; às vezes é preciso dar um “warm-up” (uma chamada simples antes do usuário).

4. **Chat template / thinking**  
   - Modelos como GLM-4 e alguns Qwen usam formato próprio (ex. `<think>`) ou template específico.  
   - O vLLM no RunPod aplica o chat template do modelo. Se o modelo exigir algo que o vLLM não suporta bem, pode haver incompatibilidade (respostas estranhas ou vazias).  
   - Isso é mais “problema do modelo/template” do que do LibreChat em si.

5. **RunPod API Key**  
   - Tem que ser a **RunPod API Key** (Settings → API Keys no console), não a chave da OpenAI.  
   - Key errada → 401 Unauthorized.

## Modelo Qwen no Serverless

- **Funciona com LibreChat?** Sim, desde que:
  - O endpoint Serverless use vLLM com esse modelo (ou um template compatível).
  - `OPENAI_REVERSE_PROXY` aponte para `https://api.runpod.ai/v2/ENDPOINT_ID/openai/v1`.
  - `OPENAI_API_KEY` = RunPod API Key.
  - O campo `model` em todas as configs (LibreChat + `librechat.yaml`) seja o **mesmo nome** que o RunPod retorna em `/models` (ex.: `llmfan46/Qwen3.5-27B-heretic-v2`).

- **Parâmetros extras (ex.: `repetition_penalty`, `enable_thinking`)**  
  - Podem ser enviados via `addParams` no `librechat.yaml` para o endpoint customizado.  
  - O RunPod Serverless vLLM suporta parâmetros extras do vLLM na request; confira a doc do RunPod para a versão exata.

## Checklist rápido

- [ ] Endpoint Serverless criado com o modelo desejado (Qwen/GLM/outro).
- [ ] `OPENAI_REVERSE_PROXY` = `https://api.runpod.ai/v2/ENDPOINT_ID/openai/v1`.
- [ ] `OPENAI_API_KEY` = RunPod API Key.
- [ ] `OPENAI_MODELS` e `librechat.yaml` usam o **mesmo** `model` que aparece em `/models` do endpoint.
- [ ] Se der timeout: aumentar timeout no cliente/proxy; considerar warm-up no Serverless.
- [ ] Se der “model not found”: conferir nome do modelo e `OPENAI_SERVED_MODEL_NAME_OVERRIDE` no worker (se usar).

Se quiser, na próxima etapa dá para descrever exatamente onde colocar a URL do Serverless no seu `librechat.yaml` atual (por exemplo, substituir a URL do pod pela do Serverless em cada endpoint).
