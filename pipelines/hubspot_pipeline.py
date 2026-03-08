"""
HubSpot dlt pipeline — pulls contacts, companies, and deals from HubSpot
using OAuth credentials stored in Nango, writes to local Parquet files.

Usage:
    uv run python hubspot_pipeline.py --nango-secret-key <key> --connection-id <id>
"""

import argparse
import os
import requests
import dlt
from dlt.sources.rest_api import rest_api_source


def get_nango_token(secret_key: str, connection_id: str, provider: str = "hubspot") -> dict:
    """Fetch OAuth credentials from Nango for a given connection."""
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
    }


def create_hubspot_source(access_token: str):
    """Create a dlt REST API source for HubSpot CRM API v3."""
    return rest_api_source(
        {
            "client": {
                "base_url": "https://api.hubapi.com/crm/v3/",
                "auth": {
                    "type": "bearer",
                    "token": access_token,
                },
                "paginator": {
                    "type": "json_link",
                    "next_url_path": "paging.next.link",
                },
            },
            "resources": [
                {
                    "name": "contacts",
                    "endpoint": {
                        "path": "objects/contacts",
                        "params": {
                            "limit": 100,
                            "properties": "firstname,lastname,email,phone,company,lifecyclestage,createdate,lastmodifieddate",
                        },
                        "data_selector": "results",
                    },
                    "write_disposition": "replace",
                },
                {
                    "name": "companies",
                    "endpoint": {
                        "path": "objects/companies",
                        "params": {
                            "limit": 100,
                            "properties": "name,domain,industry,numberofemployees,annualrevenue,createdate,lastmodifieddate",
                        },
                        "data_selector": "results",
                    },
                    "write_disposition": "replace",
                },
                {
                    "name": "deals",
                    "endpoint": {
                        "path": "objects/deals",
                        "params": {
                            "limit": 100,
                            "properties": "dealname,amount,dealstage,pipeline,closedate,createdate,lastmodifieddate",
                        },
                        "data_selector": "results",
                    },
                    "write_disposition": "replace",
                },
            ],
        }
    )


def run_pipeline(nango_secret_key: str, connection_id: str, data_dir: str = None):
    """Run the HubSpot pipeline: fetch token from Nango, pull data, write Parquet."""
    if data_dir is None:
        data_dir = os.path.join(os.path.dirname(__file__), "..", "data")

    creds = get_nango_token(nango_secret_key, connection_id)
    access_token = creds["access_token"]

    print(f"Syncing HubSpot data...")

    pipeline = dlt.pipeline(
        pipeline_name="hubspot",
        destination=dlt.destinations.filesystem(
            bucket_url=data_dir,
            layout="{table_name}/{load_id}.{file_id}.{ext}",
        ),
        dataset_name="hubspot",
    )

    source = create_hubspot_source(access_token)
    info = pipeline.run(source, loader_file_format="parquet")

    print(f"Pipeline completed: {info}")
    return {
        "status": "success",
        "loads": str(info),
        "data_dir": data_dir,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="HubSpot dlt pipeline")
    parser.add_argument("--nango-secret-key", required=True)
    parser.add_argument("--connection-id", required=True)
    parser.add_argument("--data-dir", default=None)
    args = parser.parse_args()

    result = run_pipeline(args.nango_secret_key, args.connection_id, args.data_dir)
    print(result)
