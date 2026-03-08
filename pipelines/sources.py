"""
Provider configs for dlt REST API sources.

To add a new provider, add an entry to SOURCES with:
- client: base_url, auth config, paginator
- resources: list of API endpoints to pull
- setup(creds): optional function to customize client config from Nango creds
"""

SOURCES = {
    "shopify": {
        "client": {
            "auth": {
                "type": "api_key",
                "name": "X-Shopify-Access-Token",
                "location": "header",
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
                    "params": {"status": "any", "limit": 250},
                    "data_selector": "orders",
                },
                "write_disposition": "replace",
            },
            {
                "name": "products",
                "endpoint": {
                    "path": "products.json",
                    "params": {"limit": 250},
                    "data_selector": "products",
                },
                "write_disposition": "replace",
            },
            {
                "name": "customers",
                "endpoint": {
                    "path": "customers.json",
                    "params": {"limit": 250},
                    "data_selector": "customers",
                },
                "write_disposition": "replace",
            },
        ],
        # Shopify needs the shop domain to build the base_url
        "setup": lambda creds: {
            "base_url": f"https://{_shopify_domain(creds)}/admin/api/2024-01/",
            "auth_key": creds["access_token"],
        },
    },
    "hubspot": {
        "client": {
            "base_url": "https://api.hubapi.com/crm/v3/",
            "auth": {
                "type": "bearer",
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
        "setup": lambda creds: {
            "auth_key": creds["access_token"],
        },
    },
    "stripe": {
        "client": {
            "base_url": "https://api.stripe.com/v1/",
            "auth": {
                "type": "bearer",
            },
            "paginator": {
                "type": "json_link",
                "next_url_path": "url",
            },
        },
        "resources": [
            {
                "name": "charges",
                "endpoint": {
                    "path": "charges",
                    "params": {"limit": 100},
                    "data_selector": "data",
                },
                "write_disposition": "replace",
            },
            {
                "name": "customers",
                "endpoint": {
                    "path": "customers",
                    "params": {"limit": 100},
                    "data_selector": "data",
                },
                "write_disposition": "replace",
            },
            {
                "name": "subscriptions",
                "endpoint": {
                    "path": "subscriptions",
                    "params": {"limit": 100},
                    "data_selector": "data",
                },
                "write_disposition": "replace",
            },
            {
                "name": "invoices",
                "endpoint": {
                    "path": "invoices",
                    "params": {"limit": 100},
                    "data_selector": "data",
                },
                "write_disposition": "replace",
            },
        ],
        "setup": lambda creds: {
            "auth_key": creds["access_token"],
        },
    },
    "google-ads": {
        "client": {
            "base_url": "https://googleads.googleapis.com/v16/",
            "auth": {
                "type": "bearer",
            },
            "paginator": {
                "type": "json_link",
                "next_url_path": "nextPageToken",
            },
        },
        "resources": [
            {
                "name": "campaigns",
                "endpoint": {
                    "path": "customers/{customer_id}/googleAds:searchStream",
                    "method": "POST",
                    "json": {
                        "query": "SELECT campaign.id, campaign.name, campaign.status, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions FROM campaign WHERE segments.date DURING LAST_30_DAYS",
                    },
                    "data_selector": "results",
                },
                "write_disposition": "replace",
            },
        ],
        "setup": lambda creds: {
            "auth_key": creds["access_token"],
        },
    },
    "facebook-ads": {
        "client": {
            "base_url": "https://graph.facebook.com/v19.0/",
            "auth": {
                "type": "bearer",
            },
            "paginator": {
                "type": "json_link",
                "next_url_path": "paging.next",
            },
        },
        "resources": [
            {
                "name": "campaigns",
                "endpoint": {
                    "path": "act_{ad_account_id}/campaigns",
                    "params": {
                        "fields": "id,name,status,objective,daily_budget,lifetime_budget,created_time,updated_time",
                        "limit": 100,
                    },
                    "data_selector": "data",
                },
                "write_disposition": "replace",
            },
            {
                "name": "adsets",
                "endpoint": {
                    "path": "act_{ad_account_id}/adsets",
                    "params": {
                        "fields": "id,name,status,daily_budget,lifetime_budget,targeting,created_time",
                        "limit": 100,
                    },
                    "data_selector": "data",
                },
                "write_disposition": "replace",
            },
            {
                "name": "insights",
                "endpoint": {
                    "path": "act_{ad_account_id}/insights",
                    "params": {
                        "fields": "campaign_name,impressions,clicks,spend,actions,cpc,cpm,ctr",
                        "time_range": '{"since":"2025-01-01","until":"2026-12-31"}',
                        "level": "campaign",
                        "limit": 100,
                    },
                    "data_selector": "data",
                },
                "write_disposition": "replace",
            },
        ],
        "setup": lambda creds: {
            "auth_key": creds["access_token"],
        },
    },
}


def _shopify_domain(creds: dict) -> str:
    """Extract Shopify domain from Nango credentials."""
    domain = (
        creds.get("connection_config", {}).get("subdomain")
        or creds.get("raw", {}).get("shop", "")
    )
    if not domain.endswith(".myshopify.com"):
        domain = f"{domain}.myshopify.com"
    return domain
