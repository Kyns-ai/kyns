# Regras universais nos characters KYNS

## O que foi aplicado

O script `apply-universal-rules-to-agents.js` aplica as alterações 1, 2, 3 e o bloco Safety unificado do `cursor-prompt-aplicar-regras-universais-characters.md` em cada agente.

- **Alteração 1:** Regra de resposta aberta (open hook) no final de `## Rules`
- **Alteração 2:** Seção `## In-conversation memory` antes de `## Example exchanges`
- **Alteração 3:** Regra anti-LLM em `## Rules`
- **Safety:** Bloco único em todos (CVV 188, “respond with genuine concern”, “Do NOT continue the roleplay until addressing this directly”)

## Alteração 4 (exemplos com final aberto)

A alteração 4 (revisar cada exemplo para terminar com pergunta/gancho) **não** foi aplicada automaticamente. Os exemplos continuam como no `agents.json` original. Com as regras 1 e 3, o modelo já é instruído a terminar respostas com gancho; se quiser, você pode editar à mão os exemplos em `agents-with-universal-rules.json` seguindo o guia do cursor-prompt.

## Como usar

1. **Gerar o JSON com regras aplicadas** (já feito):
   ```bash
   node config/apply-universal-rules-to-agents.js ~/Downloads/agents.json config/agents-with-universal-rules.json
   ```

2. **Atualizar os agentes no LibreChat:**
   - **Opção A:** Usar o Agent Builder na UI: para cada agente, colar as `instructions` do `agents-with-universal-rules.json`.
   - **Opção B:** Se tiver um fluxo de PATCH/update por API, usar esse JSON como fonte das instruções.

3. **Dr. Mente v2, Oráculo v2:** Continuam em arquivos `.md` separados. **Cael** está incluído no `agents-11-final.json` quando o MD de origem for o `KYNS-11-characters-FINAL-com-regras-2.md` (versão com prompt completo do Cael).

## Ficheiros

- `apply-universal-rules-to-agents.js` — script que aplica as regras 1–3 e Safety a um `agents.json`
- `build-agents-from-final-md.js` — extrai os prompts completos do MD (1–7, 10 e 11 Cael) e gera `agents-11-final.json`
- `agents-with-universal-rules.json` — 10 agentes com regras 1–3 e Safety (exemplos não revistos)
- `agents-11-final.json` — **9 agentes versão FINAL** (Luna, Marina, Ísis, Viktor, Gojo, Dante, O Mestre, Nala, **Cael**) quando gerado a partir de `KYNS-11-characters-FINAL-com-regras-2.md`
