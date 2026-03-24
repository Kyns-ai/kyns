#!/usr/bin/env python3
"""
Benchmark de carga estilo OpenClaw contra um endpoint OpenAI-compatível (llama.cpp, vLLM, SGLang).

Uso:
  export OPENAI_BASE_URL=https://SEU-POD-8000.proxy.runpod.net/v1
  export OPENAI_API_KEY=sk-local  # qualquer string se o servidor não validar
  export BENCHMARK_MODEL=llmfan46/Qwen3.5-35B-A3B-heretic-v2
  python scripts/benchmark_openclaw.py

  # Local:
  python scripts/benchmark_openclaw.py --base-url http://127.0.0.1:8000/v1 --model ...

  # Teste rápido (3 requests por cenário):
  python scripts/benchmark_openclaw.py --requests-per-scenario 3

  # Exportar JSON:
  python scripts/benchmark_openclaw.py --json-out results.json

Dependências:
  pip install openai
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import statistics
import sys
import time
from dataclasses import asdict, dataclass, field
from typing import Any

try:
    from openai import AsyncOpenAI
except ImportError as e:
    raise SystemExit("Instale: pip install openai") from e


# ---------------------------------------------------------------------------
# System prompt ~5k tokens (heurística ~4 chars/token EN; bloco repetido)
# ---------------------------------------------------------------------------
_OPENCLAW_CHUNK = """
## Skill: calendar_read
```json
{"name":"calendar_read","description":"List events for a date range","parameters":{"type":"object","properties":{"start":{"type":"string"},"end":{"type":"string"}}}}
```
## Skill: email_summarize
```json
{"name":"email_summarize","description":"Summarize inbox by priority","parameters":{"type":"object","properties":{"folder":{"type":"string"},"limit":{"type":"integer"}}}}
```
## Skill: todo_create
```json
{"name":"todo_create","description":"Create a task","parameters":{"type":"object","properties":{"title":{"type":"string"},"due":{"type":"string"}}}}
```
## Skill: weather_lookup
```json
{"name":"weather_lookup","description":"Weather for city","parameters":{"type":"object","properties":{"city":{"type":"string"}}}}
```
## Skill: file_search
```json
{"name":"file_search","description":"Search files by name or content","parameters":{"type":"object","properties":{"query":{"type":"string"},"path":{"type":"string"},"regex":{"type":"boolean"}}}}
```
## Skill: web_browse
```json
{"name":"web_browse","description":"Open URL and extract content","parameters":{"type":"object","properties":{"url":{"type":"string"},"selector":{"type":"string"}}}}
```
## Policy
You are a desktop agent. Prefer tools over guessing. Never expose secrets. Confirm destructive actions.
Always respond in the user's language. Use structured output when calling tools.
"""


def build_openclaw_like_system_prompt(target_tokens: int = 5000) -> tuple[str, int]:
    """Aproxima N tokens com repetição (sem tiktoken)."""
    chars_per_token = 4
    target_chars = target_tokens * chars_per_token
    parts: list[str] = [
        "You are OpenClaw, a local-first automation agent with filesystem, browser, and API tools.\n",
        "Below are tool definitions, skills, and policies (repeated blocks for context stress).\n\n",
    ]
    body: list[str] = []
    i = 0
    while sum(len(s) for s in body) < target_chars:
        body.append(f"<!-- block {i} -->\n{_OPENCLAW_CHUNK}\n")
        i += 1
    parts.append("".join(body))
    text = "".join(parts)
    approx_tokens = len(text) // chars_per_token
    return text, approx_tokens


USER_PROMPT_OPENCLAW = (
    "Check my calendar for today, summarize my top 3 emails by priority, and create a task in my "
    "todo list for the most urgent item. Also check the weather in São Paulo. "
    "For each action, explain your reasoning step by step."
)


@dataclass
class RequestMetrics:
    ok: bool = True
    error: str = ""
    ttft_s: float | None = None
    total_s: float = 0.0
    prompt_tokens: int = 0
    completion_tokens: int = 0
    reasoning_tokens: int = 0
    streamed_chunks: int = 0
    gen_s: float = 0.0
    tok_per_s: float = 0.0


@dataclass
class ScenarioResult:
    name: str
    thinking: bool
    concurrency: int
    wall_s: float
    requests: int
    successes: int
    errors: list[str] = field(default_factory=list)
    metrics: list[RequestMetrics] = field(default_factory=list)


def _usage_reasoning_tokens(usage: Any) -> int:
    if usage is None:
        return 0
    if isinstance(usage, dict):
        u = usage
    else:
        d = getattr(usage, "model_dump", None)
        u = d() if callable(d) else {}
    details = u.get("completion_tokens_details")
    if details is None and not isinstance(usage, dict):
        details = getattr(usage, "completion_tokens_details", None)
    if details is None:
        return 0
    if hasattr(details, "reasoning_tokens"):
        r = getattr(details, "reasoning_tokens", None)
        return int(r) if r is not None else 0
    if isinstance(details, dict):
        r = details.get("reasoning_tokens")
        return int(r) if r is not None else 0
    return 0


async def one_streamed_request(
    client: AsyncOpenAI,
    model: str,
    system_prompt: str,
    thinking_on: bool,
    timeout_s: float,
) -> RequestMetrics:
    m = RequestMetrics()
    t0 = time.perf_counter()
    first_token_t: float | None = None
    usage_obj: Any = None
    chunk_count = 0

    kwargs: dict[str, Any] = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": USER_PROMPT_OPENCLAW},
        ],
        "max_tokens": 2048,
        "temperature": 0.7,
        "stream": True,
        "timeout": timeout_s,
    }
    if thinking_on:
        kwargs["extra_body"] = {"chat_template_kwargs": {"enable_thinking": True}}
    else:
        kwargs["extra_body"] = {"chat_template_kwargs": {"enable_thinking": False}}

    stream = None
    has_stream_options = True
    try:
        stream = await client.chat.completions.create(
            **kwargs, stream_options={"include_usage": True}
        )
    except TypeError as exc:
        if "stream_options" in str(exc):
            has_stream_options = False
            try:
                stream = await client.chat.completions.create(**kwargs)
            except Exception as inner:
                m.ok = False
                m.error = str(inner)[:200]
                m.total_s = time.perf_counter() - t0
                return m
        else:
            m.ok = False
            m.error = str(exc)[:200]
            m.total_s = time.perf_counter() - t0
            return m
    except Exception as exc:
        m.ok = False
        m.error = str(exc)[:200]
        m.total_s = time.perf_counter() - t0
        return m

    try:
        async for chunk in stream:
            now = time.perf_counter()
            ch0 = chunk.choices[0] if chunk.choices else None
            delta = ch0.delta if ch0 else None
            if delta:
                has_content = getattr(delta, "content", None)
                has_reasoning = getattr(delta, "reasoning_content", None)
                if (has_content or has_reasoning) and first_token_t is None:
                    first_token_t = now - t0
                if has_content or has_reasoning:
                    chunk_count += 1
            if getattr(chunk, "usage", None):
                usage_obj = chunk.usage
        m.total_s = time.perf_counter() - t0
        m.ttft_s = first_token_t
        m.streamed_chunks = chunk_count

        if usage_obj:
            m.prompt_tokens = int(getattr(usage_obj, "prompt_tokens", 0) or 0)
            m.completion_tokens = int(getattr(usage_obj, "completion_tokens", 0) or 0)
            m.reasoning_tokens = _usage_reasoning_tokens(usage_obj)
        elif not has_stream_options and chunk_count > 0:
            m.completion_tokens = chunk_count

        if m.completion_tokens > 0 and m.ttft_s is not None:
            m.gen_s = max(m.total_s - m.ttft_s, 1e-6)
            m.tok_per_s = m.completion_tokens / m.gen_s
    except Exception as e:
        m.ok = False
        m.error = str(e)[:200]
        m.total_s = time.perf_counter() - t0
        m.ttft_s = None

    return m


async def run_scenario(
    client: AsyncOpenAI,
    model: str,
    system_prompt: str,
    name: str,
    thinking_on: bool,
    concurrency: int,
    num_requests: int,
    timeout_s: float,
) -> ScenarioResult:
    sem = asyncio.Semaphore(concurrency)
    results: list[RequestMetrics] = []

    async def wrapped() -> RequestMetrics:
        async with sem:
            return await one_streamed_request(
                client, model, system_prompt, thinking_on, timeout_s
            )

    wall0 = time.perf_counter()
    tasks = [asyncio.create_task(wrapped()) for _ in range(num_requests)]
    raw = await asyncio.gather(*tasks, return_exceptions=True)
    results = []
    for r in raw:
        if isinstance(r, BaseException):
            failed = RequestMetrics(ok=False, error=str(r)[:200])
            results.append(failed)
        else:
            results.append(r)
    wall_s = time.perf_counter() - wall0

    errs = [r.error for r in results if not r.ok]
    return ScenarioResult(
        name=name,
        thinking=thinking_on,
        concurrency=concurrency,
        wall_s=wall_s,
        requests=num_requests,
        successes=sum(1 for r in results if r.ok),
        errors=errs,
        metrics=results,
    )


def _median(xs: list[float]) -> float:
    return statistics.median(xs) if xs else 0.0


def _mean(xs: list[float]) -> float:
    return statistics.mean(xs) if xs else 0.0


def _p(xs: list[float], pct: float) -> float:
    if not xs:
        return 0.0
    s = sorted(xs)
    idx = int(len(s) * pct / 100.0)
    return s[min(idx, len(s) - 1)]


def print_table(rows: list[ScenarioResult], monthly_usd: float) -> None:
    print()
    title = "BENCHMARK: OpenClaw-like Load Test"
    box_w = 90
    print(f"{'=' * box_w}")
    print(f"{title:^{box_w}}")
    print(f"{'=' * box_w}")
    print()

    header = (
        f"{'Cenario':<18} | {'OK':>4} | {'TTFT':>6} | {'P95':>6} | "
        f"{'Total':>7} | {'P95':>7} | {'InTok':>6} | "
        f"{'OutTok':>6} | {'Think':>6} | {'tok/s':>6}"
    )
    print(header)
    print("-" * len(header))

    for sr in rows:
        ok_m = [m for m in sr.metrics if m.ok]
        label = sr.name
        rate = f"{sr.successes}/{sr.requests}"
        if not ok_m:
            print(
                f"{label:<18} | {rate:>4} | {'ERR':>6} | {'--':>6} | "
                f"{'--':>7} | {'--':>7} | {'--':>6} | "
                f"{'--':>6} | {'--':>6} | {'--':>6}"
            )
            continue

        ttft_vals = [m.ttft_s for m in ok_m if m.ttft_s is not None]
        total_vals = [m.total_s for m in ok_m]

        ttft_med = _median(ttft_vals)
        ttft_p95 = _p(ttft_vals, 95)
        tot_med = _median(total_vals)
        tot_p95 = _p(total_vals, 95)
        pt = int(round(_mean([float(m.prompt_tokens) for m in ok_m])))
        ct = int(round(_mean([float(m.completion_tokens) for m in ok_m])))
        rt = int(round(_mean([float(m.reasoning_tokens) for m in ok_m])))
        tps = _mean([m.tok_per_s for m in ok_m if m.tok_per_s > 0])

        print(
            f"{label:<18} | {rate:>4} | {ttft_med:5.1f}s | {ttft_p95:5.1f}s | "
            f"{tot_med:6.1f}s | {tot_p95:6.1f}s | {pt:6d} | "
            f"{ct:6d} | {rt:6d} | {tps:6.1f}"
        )

    print()

    # Projeções
    print(f"{'PROJECAO DE CAPACIDADE':^{box_w}}")
    print("-" * box_w)
    req_per_hour_active = 4
    peak_fraction = 0.25

    for sr in rows:
        ok_m = [m for m in sr.metrics if m.ok]
        if not ok_m:
            continue
        mean_total = _mean([m.total_s for m in ok_m])
        if mean_total <= 0:
            continue
        wall_rph = (sr.successes / sr.wall_s) * 3600.0 if sr.wall_s > 0 else 0
        rph_single = 3600.0 / mean_total
        rph = wall_rph if sr.concurrency > 1 else rph_single
        day_16h = rph * 16
        users_equiv = rph / req_per_hour_active if req_per_hour_active else 0
        users_peak = users_equiv / peak_fraction if peak_fraction else users_equiv
        cost = monthly_usd / users_peak if users_peak > 0 else 0
        print(
            f"  {sr.name:<18}: ~{rph:>5.0f} req/h  |  ~{day_16h:>6.0f} req/dia (16h)  |  "
            f"users ~{users_peak:>4.0f} (25% pico)  |  ~${cost:.2f}/user/mes"
        )

    print()


def recommendation_from_rows(rows: list[ScenarioResult], monthly_usd: float) -> None:
    good_conc: list[int] = []
    ok120_conc: list[int] = []
    best_tps: float = 0
    best_tps_scenario = ""

    for sr in rows:
        ok_m = [m for m in sr.metrics if m.ok]
        if not ok_m:
            continue

        avg_tps = _mean([m.tok_per_s for m in ok_m if m.tok_per_s > 0])
        if avg_tps > best_tps:
            best_tps = avg_tps
            best_tps_scenario = sr.name

        if sr.thinking:
            continue
        med = _median([m.total_s for m in ok_m])
        if med < 60:
            good_conc.append(sr.concurrency)
        if med < 120:
            ok120_conc.append(sr.concurrency)

    x_good = max(good_conc, default=0)
    x_120 = max(ok120_conc, default=0)

    print("RECOMENDACAO:")
    print(f"  - Max req paralelos com mediana < 60s  (thinking OFF): ~{x_good}")
    print(f"  - Max req paralelos com mediana < 120s (thinking OFF): ~{x_120}")
    if best_tps > 0:
        print(f"  - Melhor tok/s: {best_tps:.1f} em '{best_tps_scenario}'")
    print(
        f"  - Custo GPU ~${monthly_usd:.0f}/mes -> divida pelo numero de users ativos"
    )

    # Degradação sob carga
    off_scenarios = [sr for sr in rows if not sr.thinking]
    if len(off_scenarios) >= 2:
        first = off_scenarios[0]
        last = off_scenarios[-1]
        first_ok = [m for m in first.metrics if m.ok]
        last_ok = [m for m in last.metrics if m.ok]
        if first_ok and last_ok:
            t1 = _median([m.total_s for m in first_ok])
            tn = _median([m.total_s for m in last_ok])
            if t1 > 0:
                degradation = ((tn - t1) / t1) * 100
                print(
                    f"  - Degradacao 1->{last.concurrency} users (OFF): "
                    f"{t1:.1f}s -> {tn:.1f}s ({degradation:+.0f}%)"
                )

    print()


async def check_server(client: AsyncOpenAI, model: str) -> bool:
    """Verifica se o servidor está acessível e o modelo disponível."""
    try:
        models = await client.models.list()
        available = [m.id for m in models.data]
        if model in available:
            print(f"Servidor OK. Modelo '{model}' encontrado.")
            return True
        print(f"AVISO: Modelo '{model}' nao encontrado. Disponiveis: {available[:5]}")
        print("Continuando mesmo assim (o servidor pode aceitar qualquer nome)...")
        return True
    except Exception as exc:
        print(f"ERRO ao conectar no servidor: {exc}")
        return False


def export_json(rows: list[ScenarioResult], path: str) -> None:
    data = []
    for sr in rows:
        entry = {
            "name": sr.name,
            "thinking": sr.thinking,
            "concurrency": sr.concurrency,
            "wall_s": round(sr.wall_s, 3),
            "requests": sr.requests,
            "successes": sr.successes,
            "error_count": len(sr.errors),
            "metrics": [asdict(m) for m in sr.metrics],
        }
        data.append(entry)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"Resultados exportados para {path}")


async def async_main(args: argparse.Namespace) -> None:
    base = args.base_url.rstrip("/")
    if not base.endswith("/v1"):
        base = base + "/v1"

    model = args.model
    client = AsyncOpenAI(base_url=base, api_key=args.api_key or "sk-local")

    system_prompt, approx_tok = build_openclaw_like_system_prompt(args.target_system_tokens)
    print(f"System prompt ~{approx_tok} tokens (heuristica). User prompt: OpenClaw multi-tool.")
    print(f"Endpoint: {base} | Model: {model}")
    print(f"Cenarios: {args.requests_per_scenario} requests cada | Timeout: {args.timeout}s")
    print()

    ok = await check_server(client, model)
    if not ok:
        print("Abortando. Verifique o servidor e tente novamente.")
        sys.exit(1)
    print()

    # Warmup com system prompt completo para aquecer o KV cache de verdade
    print("Warmup: 2 requests (system prompt completo)...")
    for i in range(2):
        wm = await one_streamed_request(
            client, model, system_prompt, thinking_on=False, timeout_s=args.timeout
        )
        status = "OK" if wm.ok else f"ERRO: {wm.error[:60]}"
        print(f"  warmup {i + 1}/2: {wm.total_s:.1f}s — {status}")
    await asyncio.sleep(2)
    print()

    scenarios: list[tuple[str, bool, int]] = [
        ("OFF - 1 user", False, 1),
        ("OFF - 5 sim", False, 5),
        ("OFF - 10 sim", False, 10),
        ("OFF - 20 sim", False, 20),
        ("ON  - 1 user", True, 1),
        ("ON  - 5 sim", True, 5),
        ("ON  - 10 sim", True, 10),
        ("ON  - 20 sim", True, 20),
    ]

    results: list[ScenarioResult] = []
    for name, thinking, conc in scenarios:
        print(f">> {name} ({args.requests_per_scenario} requests, conc={conc})...")
        sr = await run_scenario(
            client,
            model,
            system_prompt,
            name,
            thinking,
            conc,
            args.requests_per_scenario,
            args.timeout,
        )
        ok_m = [m for m in sr.metrics if m.ok]
        med = _median([m.total_s for m in ok_m]) if ok_m else 0
        tps = _mean([m.tok_per_s for m in ok_m if m.tok_per_s > 0]) if ok_m else 0
        print(
            f"   wall={sr.wall_s:.1f}s | OK={sr.successes}/{sr.requests} | "
            f"mediana={med:.1f}s | tok/s={tps:.1f}"
        )
        if sr.errors:
            print(f"   erros: {len(sr.errors)} — ex: {sr.errors[0][:80]}")
        results.append(sr)
        await asyncio.sleep(args.cooldown_s)

    print_table(results, args.monthly_gpu_usd)
    recommendation_from_rows(results, args.monthly_gpu_usd)

    if args.json_out:
        export_json(results, args.json_out)


def main() -> None:
    p = argparse.ArgumentParser(description="Benchmark OpenClaw-like load vs OpenAI-compatible LLM")
    p.add_argument(
        "--base-url",
        default=os.environ.get("OPENAI_BASE_URL", "http://127.0.0.1:8000/v1"),
        help="Base URL com /v1 (ex: http://127.0.0.1:8000/v1)",
    )
    p.add_argument("--api-key", default=os.environ.get("OPENAI_API_KEY", ""))
    p.add_argument(
        "--model",
        default=os.environ.get(
            "BENCHMARK_MODEL",
            "llmfan46/Qwen3.5-35B-A3B-heretic-v2",
        ),
    )
    p.add_argument("--requests-per-scenario", type=int, default=10)
    p.add_argument("--timeout", type=float, default=600.0)
    p.add_argument("--cooldown-s", type=float, default=5.0)
    p.add_argument("--target-system-tokens", type=int, default=5000)
    p.add_argument(
        "--monthly-gpu-usd",
        type=float,
        default=float(os.environ.get("BENCHMARK_MONTHLY_GPU_USD", "292")),
    )
    p.add_argument("--json-out", default="", help="Caminho para exportar resultados em JSON")
    args = p.parse_args()
    asyncio.run(async_main(args))


if __name__ == "__main__":
    main()
