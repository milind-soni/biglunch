"""
Shopify dlt pipeline — pulls orders, products, and customers from Shopify
using OAuth credentials stored in Nango, writes to local Parquet files.

Usage:
    uv run python shopify_pipeline.py --nango-secret-key <key> --connection-id <id>
"""

import argparse
import os
import requests
import dlt
from dlt.sources.rest_api import rest_api_source


def get_nango_token(secret_key: str, connection_id: str, provider: str = "shopify") -> dict:
    """Fetch OAuth credentials from Nango for a given connection."""
    resp = requests.get(
        f"https://api.nango.dev/connection/{connection_id}",
        headers={"Authorization": f"Bearer {secret_key}"},
        params={"provider_config_key": provider},
    )
    resp.raise_for_status()
    data = resp.json()
    credentials = data.get("credentials", {})
    # Shopify connections give us an access_token and the shop domain
    return {
        "access_token": credentials.get("access_token"),
        "raw": credentials.get("raw", {}),
        "connection_config": data.get("connection_config", {}),
    }


def create_shopify_source(shop_domain: str, access_token: str):
    """Create a dlt REST API source for Shopify Admin API."""
    return rest_api_source(
        {
            "client": {
                "base_url": f"https://{shop_domain}/admin/api/2024-01/",
                "auth": {
                    "type": "api_key",
                    "name": "X-Shopify-Access-Token",
                    "location": "header",
                    "api_key": access_token,
                },
                "paginator": {
                    "type": "header_link",
                    "next_url_path": "link",
                },
            },
            "resources": [
                {
                    "name": "orders",
                    "endpoint": {
                        "path": "orders.json",
                        "params": {
                            "status": "any",
                            "limit": 250,
                        },
                        "data_selector": "orders",
                    },
                    "write_disposition": "replace",
                },
                {
                    "name": "products",
                    "endpoint": {
                        "path": "products.json",
                        "params": {
                            "limit": 250,
                        },
                        "data_selector": "products",
                    },
                    "write_disposition": "replace",
                },
                {
                    "name": "customers",
                    "endpoint": {
                        "path": "customers.json",
                        "params": {
                            "limit": 250,
                        },
                        "data_selector": "customers",
                    },
                    "write_disposition": "replace",
                },
            ],
        }
    )


def run_pipeline(nango_secret_key: str, connection_id: str, data_dir: str = None):
    """Run the Shopify pipeline: fetch token from Nango, pull data, write Parquet."""
    if data_dir is None:
        data_dir = os.path.join(os.path.dirname(__file__), "..", "data")

    # Get credentials from Nango
    creds = get_nango_token(nango_secret_key, connection_id)
    access_token = creds["access_token"]

    # Shop domain comes from the connection config or raw credentials
    shop_domain = (
        creds["connection_config"].get("subdomain")
        or creds["raw"].get("shop", "")
    )
    if not shop_domain.endswith(".myshopify.com"):
        shop_domain = f"{shop_domain}.myshopify.com"

    print(f"Syncing Shopify data from {shop_domain}...")

    # Create dlt pipeline writing to local filesystem as Parquet
    pipeline = dlt.pipeline(
        pipeline_name="shopify",
        destination=dlt.destinations.filesystem(
            bucket_url=data_dir,
            layout="{table_name}/{load_id}.{file_id}.{ext}",
        ),
        dataset_name="shopify",
    )

    # Create source and run
    source = create_shopify_source(shop_domain, access_token)
    info = pipeline.run(source, loader_file_format="parquet")

    print(f"Pipeline completed: {info}")
    return {
        "status": "success",
        "loads": str(info),
        "data_dir": data_dir,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Shopify dlt pipeline")
    parser.add_argument("--nango-secret-key", required=True)
    parser.add_argument("--connection-id", required=True)
    parser.add_argument("--data-dir", default=None)
    args = parser.parse_args()

    result = run_pipeline(args.nango_secret_key, args.connection_id, args.data_dir)
    print(result)
