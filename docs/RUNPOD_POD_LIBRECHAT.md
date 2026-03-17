# RunPod Pod + LibreChat

Usar um **Pod** (GPU dedicada 24/7) no RunPod com vLLM e LibreChat. O pod fica ligado enquanto você não parar; dá para desligar depois do uso para economizar e reativar quando precisar.

---

## 1. URL do Pod

No RunPod, ao criar ou iniciar um pod com vLLM na porta 8000:

- Abra o pod → aba **Connect** (ou **TCP Port Mappings**).
- A URL costuma ser: `https://SEU_POD_ID-8000.proxy.runpod.net`
- Para o LibreChat use **sempre com `/v1` no final**:  
  `https://SEU_POD_ID-8000.proxy.runpod.net/v1`

Exemplo: se o Pod ID for `5u3pybk1k08oav`, a URL é:  
`https://5u3pybk1k08oav-8000.proxy.runpod.net/v1`

---

## 2. Configurar o LibreChat (Railway)

Defina no Railway:

| Variável | Valor |
|----------|--------|
| `OPENAI_REVERSE_PROXY` | `https://SEU_POD_ID-8000.proxy.runpod.net/v1` |
| `OPENAI_API_KEY` | RunPod API Key (ou deixe um valor qualquer se o vLLM no pod não exigir auth) |
| `OPENAI_MODELS` | `llmfan46/Qwen3.5-27B-heretic-v2` (ou o nome exato do modelo no vLLM) |

Depois: **Redeploy** do serviço no Railway.

**Script no repo:** na raiz do projeto, com o Railway logado:

```bash
./config/runpod-set-pod-url.sh "https://SEU_POD_ID-8000.proxy.runpod.net/v1"
```

Isso define `OPENAI_REVERSE_PROXY` e dispara o redeploy.

---

## 3. “Ficar ligado 10 minutos depois da última mensagem”

- **Pod** não tem idle timeout nativo: ele fica ligado até você **parar** manualmente (ou via API).
- No KYNS, há um watcher no backend que pode pedir `stop` do pod após inatividade real de chat.
- Para isso funcionar, no Railway você precisa definir:
  - `RUNPOD_API_KEY`
  - `RUNPOD_POD_ID`
  - `RUNPOD_IDLE_TIMEOUT_MINUTES=10` (ou outro valor)
- O watcher só atua quando `OPENAI_REVERSE_PROXY` aponta para uma URL de **pod** (`*.proxy.runpod.net`) e quando não há geração em andamento.
- Se essas variáveis não estiverem configuradas, o comportamento volta a ser manual.

**Parar o pod por script (opcional):**

```bash
RUNPOD_POD_ID=seu_pod_id node config/runpod-stop-pod.js
```

Ou configure um cron para rodar esse script (ex.: todo dia à meia-noite) se quiser desligar o pod automaticamente em horários definidos.

---

## 4. Cold start menos ruim

O cold start do pod acontece **só quando você inicia (ou reinicia) o pod**. Para deixar menos ruim:

1. **Network volume com o modelo**
   - No RunPod, crie um **Network Volume** e monte no pod (ex.: `/workspace`).
   - Configure o vLLM para carregar o modelo desse volume (ou baixe o modelo uma vez no volume).
   - Na próxima vez que iniciar o pod, o modelo já está no volume e o carregamento é bem mais rápido (só GPU RAM).

2. **Manter o pod ligado quando estiver usando**
   - Enquanto o pod estiver **Running**, não há cold start: toda mensagem é atendida na hora.
   - Desligue o pod só quando for ficar um tempo sem usar (ex.: fim do dia).

3. **Primeira mensagem depois de ligar**
   - A primeira request após iniciar o pod pode levar 1–2 minutos (modelo carregando na GPU).
   - As seguintes são normais.

---

## 5. Resumo

| Objetivo | Como |
|----------|------|
| Usar Pod com LibreChat | Definir `OPENAI_REVERSE_PROXY` = `https://POD_ID-8000.proxy.runpod.net/v1` no Railway e redeploy. |
| “Ligado 10 min depois da última mensagem” | Definir `RUNPOD_API_KEY`, `RUNPOD_POD_ID` e `RUNPOD_IDLE_TIMEOUT_MINUTES=10` para o watcher pedir `stop` automático após idle. |
| Cold start menos ruim | Network volume com modelo; manter pod ligado durante o uso; desligar só quando não for usar por um tempo. |
