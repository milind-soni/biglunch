"""
Google Ads pipeline — custom dlt resource using GAQL via the Google Ads REST API.

Google Ads doesn't fit the generic rest_api_source pattern because:
1. It requires a customer_id in every path
2. Data is fetched via POST with GAQL queries
3. The searchStream endpoint returns all results in one response (no pagination)
"""

import os
import dlt
import requests


API_VERSION = "v23"
DEVELOPER_TOKEN = os.environ.get("GOOGLE_ADS_DEVELOPER_TOKEN", "")
BASE_URL = f"https://googleads.googleapis.com/{API_VERSION}"

# GAQL queries for each resource
QUERIES = {
    "campaigns": """
        SELECT
            campaign.id,
            campaign.name,
            campaign.status,
            campaign.advertising_channel_type,
            campaign.start_date,
            campaign.end_date,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            metrics.conversions_value
        FROM campaign
        WHERE segments.date DURING LAST_30_DAYS
        ORDER BY metrics.impressions DESC
    """,
    "ad_groups": """
        SELECT
            ad_group.id,
            ad_group.name,
            ad_group.status,
            ad_group.campaign,
            campaign.name,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions
        FROM ad_group
        WHERE segments.date DURING LAST_30_DAYS
        ORDER BY metrics.impressions DESC
    """,
    "keywords": """
        SELECT
            ad_group_criterion.keyword.text,
            ad_group_criterion.keyword.match_type,
            ad_group.name,
            campaign.name,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions
        FROM keyword_view
        WHERE segments.date DURING LAST_30_DAYS
        ORDER BY metrics.impressions DESC
    """,
}


def _flatten_row(row: dict) -> dict:
    """Flatten nested Google Ads response (e.g. campaign.name -> campaign_name)."""
    flat = {}
    for key, value in row.items():
        if isinstance(value, dict):
            for subkey, subvalue in value.items():
                flat[f"{key}_{subkey}"] = subvalue
        else:
            flat[key] = value
    return flat


def _fetch_gaql(access_token: str, customer_id: str, query: str) -> list[dict]:
    """Execute a GAQL query via the Google Ads REST API."""
    url = f"{BASE_URL}/customers/{customer_id}/googleAds:searchStream"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "developer-token": DEVELOPER_TOKEN,
        "Content-Type": "application/json",
    }
    resp = requests.post(url, headers=headers, json={"query": query})
    resp.raise_for_status()

    results = []
    for batch in resp.json():
        for row in batch.get("results", []):
            results.append(_flatten_row(row))

    return results


def _get_customer_ids(access_token: str) -> list[str]:
    """List accessible customer IDs."""
    url = f"{BASE_URL}/customers:listAccessibleCustomers"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "developer-token": DEVELOPER_TOKEN,
    }
    resp = requests.get(url, headers=headers)
    resp.raise_for_status()

    # Response: {"resourceNames": ["customers/1234567890", ...]}
    resource_names = resp.json().get("resourceNames", [])
    return [name.split("/")[-1] for name in resource_names]


def build_google_ads_source(creds: dict):
    """Build dlt resources for Google Ads."""
    access_token = creds["access_token"]

    # Get the first accessible customer ID
    customer_ids = _get_customer_ids(access_token)
    if not customer_ids:
        raise ValueError("No accessible Google Ads customer accounts found")

    customer_id = customer_ids[0]
    print(f"Using Google Ads customer ID: {customer_id}")

    @dlt.resource(name="campaigns", write_disposition="replace")
    def campaigns():
        yield _fetch_gaql(access_token, customer_id, QUERIES["campaigns"])

    @dlt.resource(name="ad_groups", write_disposition="replace")
    def ad_groups():
        yield _fetch_gaql(access_token, customer_id, QUERIES["ad_groups"])

    @dlt.resource(name="keywords", write_disposition="replace")
    def keywords():
        yield _fetch_gaql(access_token, customer_id, QUERIES["keywords"])

    return [campaigns, ad_groups, keywords]
