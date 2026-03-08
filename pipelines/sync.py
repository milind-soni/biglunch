"""
Unified dlt pipeline runner — config-driven, works with any provider in sources.py.

Usage:
    uv run python sync.py --provider hubspot --nango-secret-key <key> --connection-id <id>
"""

import argparse
import copy
import os
import requests
import dlt
from dlt.sources.rest_api import rest_api_source
from sources import SOURCES


def get_nango_credentials(secret_key: str, connection_id: str, provider: str) -> dict:
    """Fetch full connection details from Nango."""
    resp = requests.get(
        f"https://api.nango.dev/connection/{connection_id}",
        headers={"Authorization": f"Bearer {secret_key}"},
        params={"provider_config_key": provider},
    )
    resp.raise_for_status()
    data = resp.json()
    credentials = data.get("credentials", {})
    return {
        "access_token": credentials.get("access_token"),
        "raw": credentials.get("raw", {}),
        "connection_config": data.get("connection_config", {}),
    }


def build_source(provider: str, creds: dict):
    """Build a dlt REST API source from provider config + Nango credentials."""
    if provider not in SOURCES:
        raise ValueError(
            f"Unknown provider: {provider}. Available: {list(SOURCES.keys())}"
        )

    config = copy.deepcopy(SOURCES[provider])
    client = config["client"]
    resources = config["resources"]

    # Run provider-specific setup to get auth key and any overrides
    setup_fn = config.get("setup", lambda c: {"auth_key": c["access_token"]})
    setup = setup_fn(creds)

    # Apply base_url override (e.g. Shopify needs the shop domain)
    if "base_url" in setup:
        client["base_url"] = setup["base_url"]

    # Inject the auth token
    auth_key = setup.get("auth_key", creds["access_token"])
    auth_type = client["auth"].get("type", "bearer")

    if auth_type == "bearer":
        client["auth"]["token"] = auth_key
    elif auth_type == "api_key":
        client["auth"]["api_key"] = auth_key

    return rest_api_source({"client": client, "resources": resources})


def run(provider: str, nango_secret_key: str, connection_id: str, data_dir: str = None):
    """Run a sync pipeline for any configured provider."""
    if data_dir is None:
        data_dir = os.path.join(os.path.dirname(__file__), "..", "data")

    print(f"Fetching credentials for {provider}...")
    creds = get_nango_credentials(nango_secret_key, connection_id, provider)

    print(f"Building {provider} source...")
    source = build_source(provider, creds)

    pipeline = dlt.pipeline(
        pipeline_name=provider,
        destination=dlt.destinations.filesystem(
            bucket_url=data_dir,
            layout="{table_name}/{load_id}.{file_id}.{ext}",
        ),
        dataset_name=provider,
    )

    print(f"Running {provider} pipeline...")
    info = pipeline.run(source, loader_file_format="parquet")

    print(f"Pipeline completed: {info}")
    return {
        "status": "success",
        "provider": provider,
        "loads": str(info),
        "data_dir": data_dir,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Unified dlt sync runner")
    parser.add_argument("--provider", required=True, help="Provider name (e.g. hubspot, shopify)")
    parser.add_argument("--nango-secret-key", required=True)
    parser.add_argument("--connection-id", required=True)
    parser.add_argument("--data-dir", default=None)
    args = parser.parse_args()

    result = run(args.provider, args.nango_secret_key, args.connection_id, args.data_dir)
    print(result)
