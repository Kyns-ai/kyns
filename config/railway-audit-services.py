#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
import sys
from dataclasses import dataclass
from typing import Any


VALID_REGION_NAMES = {
    "europe-west4-drams3a",
    "europe-west4",
    "asia-southeast1",
    "us-east4",
    "us-west1",
    "us-west2",
    "asia-southeast1-eqsg3a",
    "us-west2-aws",
    "us-east4-eqdc4a",
}


@dataclass(frozen=True)
class ServiceExpectation:
    builder: str | None = None
    dockerfile_path: str | None = None
    allow_railpack: bool = False


EXPECTED_SERVICES: dict[str, ServiceExpectation] = {
    "LibreChat": ServiceExpectation(builder="DOCKERFILE", dockerfile_path="Dockerfile"),
    "kyns-analytics": ServiceExpectation(builder="DOCKERFILE", dockerfile_path="Dockerfile"),
    "kyns-tts": ServiceExpectation(builder="DOCKERFILE", dockerfile_path="Dockerfile"),
    "firecrawl-worker": ServiceExpectation(builder="DOCKERFILE", dockerfile_path="Dockerfile"),
    "firecrawl-puppeteer": ServiceExpectation(allow_railpack=True),
    "searxng": ServiceExpectation(allow_railpack=True),
}


def run_railway_json(*args: str) -> Any:
    output = subprocess.check_output(["railway", *args], text=True)
    return json.loads(output)


def get_latest_deployment(service: str) -> dict[str, Any]:
    deployments = run_railway_json("deployment", "list", "--service", service, "--json", "--limit", "1")
    if not deployments:
        raise RuntimeError(f"No deployments found for service {service}")
    return deployments[0]


def get_service_regions(deployment: dict[str, Any]) -> list[str]:
    meta = deployment.get("meta", {})
    deploy = meta.get("serviceManifest", {}).get("deploy", {})
    region_config = deploy.get("multiRegionConfig") or {}
    return list(region_config.keys())


def summarize_service(service: str) -> list[str]:
    issues: list[str] = []
    deployment = get_latest_deployment(service)
    expectation = EXPECTED_SERVICES[service]
    status = deployment.get("status")
    meta = deployment.get("meta", {})
    build = meta.get("serviceManifest", {}).get("build", {})
    config_errors = meta.get("configErrors") or []
    builder = build.get("builder")
    dockerfile_path = build.get("dockerfilePath")

    if status in {"FAILED", "CRASHED"}:
        issues.append(f"latest deployment is {status}")

    if config_errors:
        issues.append(f"configErrors={config_errors}")

    if expectation.builder and builder != expectation.builder:
        issues.append(f"builder={builder!r} expected {expectation.builder!r}")

    if expectation.dockerfile_path and dockerfile_path != expectation.dockerfile_path:
        issues.append(
            f"dockerfilePath={dockerfile_path!r} expected {expectation.dockerfile_path!r}",
        )

    if builder == "RAILPACK" and not expectation.allow_railpack:
        issues.append("unexpected RAILPACK builder")

    invalid_regions = [region for region in get_service_regions(deployment) if region not in VALID_REGION_NAMES]
    if invalid_regions:
        issues.append(f"invalid regions={invalid_regions}")

    summary = {
        "status": status,
        "configFile": meta.get("configFile"),
        "rootDirectory": meta.get("rootDirectory"),
        "builder": builder,
        "dockerfilePath": dockerfile_path,
        "regions": get_service_regions(deployment),
    }
    print(f"[{service}] {json.dumps(summary, ensure_ascii=True)}")
    return issues


def summarize_librechat_env() -> list[str]:
    issues: list[str] = []
    variables = run_railway_json("variable", "list", "--service", "LibreChat", "--json")
    required = {
        "MONGO_URI": True,
        "FIRECRAWL_API_URL": True,
        "FIRECRAWL_API_KEY": True,
        "SEARXNG_INSTANCE_URL": True,
        "RUNPOD_IMAGE_ENDPOINT_ID": True,
        "RUNPOD_API_KEY": True,
        "TTS_BASE_URL": True,
        "TTS_API_KEY": True,
    }

    env_summary = {key: bool(variables.get(key)) for key in required}
    print(f"[LibreChat env] {json.dumps(env_summary, ensure_ascii=True)}")

    for key, mandatory in required.items():
        if mandatory and not variables.get(key):
            issues.append(f"missing required env {key}")

    return issues


def main() -> int:
    all_issues: list[str] = []

    for service in EXPECTED_SERVICES:
        try:
            issues = summarize_service(service)
            for issue in issues:
                all_issues.append(f"{service}: {issue}")
        except Exception as exc:  # noqa: BLE001
            all_issues.append(f"{service}: failed to inspect deployment ({exc})")

    try:
        all_issues.extend(f"LibreChat env: {issue}" for issue in summarize_librechat_env())
    except Exception as exc:  # noqa: BLE001
        all_issues.append(f"LibreChat env: failed to inspect variables ({exc})")

    if not all_issues:
        print("Railway audit passed.")
        return 0

    print("\nRailway audit found issues:")
    for issue in all_issues:
        print(f"- {issue}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
