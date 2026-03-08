import { Database } from "duckdb-async";
import { existsSync, readdirSync } from "fs";
import path from "path";

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.create(":memory:");
    await seedSampleData(db);
    await loadParquetData(db);
  }
  return db;
}

/** Reload Parquet data from data/ directory (call after a sync) */
export async function reloadParquetData(): Promise<void> {
  const database = await getDb();
  await loadParquetData(database);
}

async function loadParquetData(database: Database) {
  const dataDir = path.join(process.cwd(), "data");
  if (!existsSync(dataDir)) return;

  // Look for dataset directories (e.g., data/shopify/orders/*.parquet)
  const datasets = readdirSync(dataDir, { withFileTypes: true })
    .filter((d) => d.isDirectory());

  for (const dataset of datasets) {
    const datasetPath = path.join(dataDir, dataset.name);
    const tables = readdirSync(datasetPath, { withFileTypes: true })
      .filter((d) => d.isDirectory());

    for (const table of tables) {
      const tablePath = path.join(datasetPath, table.name);
      const parquetFiles = readdirSync(tablePath).filter((f) =>
        f.endsWith(".parquet")
      );
      if (parquetFiles.length === 0) continue;

      // Use a prefixed name to avoid clashing with sample data
      const viewName = `${dataset.name}_${table.name}`;
      const globPath = path.join(tablePath, "*.parquet");

      try {
        // Drop and recreate view to pick up new data
        await database.exec(`DROP VIEW IF EXISTS "${viewName}"`);
        await database.exec(
          `CREATE VIEW "${viewName}" AS SELECT * FROM read_parquet('${globPath}')`
        );
        console.log(`Loaded parquet view: ${viewName}`);
      } catch (err) {
        console.error(`Failed to load parquet for ${viewName}:`, err);
      }
    }
  }
}

export async function queryDuckDB(
  sql: string
): Promise<Record<string, unknown>[]> {
  const database = await getDb();
  const rows = await database.all(sql);
  // Convert BigInt values to numbers (DuckDB returns BigInt for COUNT, SUM, etc.)
  return rows.map((row) => {
    const converted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      converted[key] = typeof value === "bigint" ? Number(value) : value;
    }
    return converted;
  });
}

async function seedSampleData(database: Database) {
  await database.exec(`
    CREATE TABLE orders (
      order_id INTEGER,
      customer_name VARCHAR,
      product VARCHAR,
      category VARCHAR,
      quantity INTEGER,
      unit_price DECIMAL(10,2),
      total DECIMAL(10,2),
      channel VARCHAR,
      region VARCHAR,
      order_date DATE
    );

    INSERT INTO orders VALUES
    (1001, 'Alice Johnson', 'Wireless Earbuds', 'Electronics', 2, 49.99, 99.98, 'Shopify', 'US-East', '2026-01-05'),
    (1002, 'Bob Smith', 'Organic Face Cream', 'Beauty', 1, 34.99, 34.99, 'Shopify', 'US-West', '2026-01-07'),
    (1003, 'Carol White', 'Running Shoes', 'Footwear', 1, 129.99, 129.99, 'Shopify', 'US-East', '2026-01-08'),
    (1004, 'David Brown', 'Wireless Earbuds', 'Electronics', 3, 49.99, 149.97, 'Amazon', 'US-West', '2026-01-10'),
    (1005, 'Eve Davis', 'Yoga Mat', 'Fitness', 2, 29.99, 59.98, 'Shopify', 'EU', '2026-01-12'),
    (1006, 'Frank Miller', 'Protein Powder', 'Fitness', 1, 44.99, 44.99, 'Amazon', 'US-East', '2026-01-14'),
    (1007, 'Grace Lee', 'Organic Face Cream', 'Beauty', 3, 34.99, 104.97, 'Shopify', 'EU', '2026-01-15'),
    (1008, 'Henry Wilson', 'Running Shoes', 'Footwear', 1, 129.99, 129.99, 'Shopify', 'US-West', '2026-01-18'),
    (1009, 'Iris Taylor', 'Phone Case', 'Electronics', 5, 19.99, 99.95, 'Amazon', 'US-East', '2026-01-20'),
    (1010, 'Jack Anderson', 'Wireless Earbuds', 'Electronics', 1, 49.99, 49.99, 'Shopify', 'EU', '2026-01-22'),
    (1011, 'Karen Thomas', 'Yoga Mat', 'Fitness', 1, 29.99, 29.99, 'Shopify', 'US-East', '2026-01-25'),
    (1012, 'Leo Martinez', 'Organic Face Cream', 'Beauty', 2, 34.99, 69.98, 'Amazon', 'US-West', '2026-01-27'),
    (1013, 'Mia Robinson', 'Protein Powder', 'Fitness', 2, 44.99, 89.98, 'Shopify', 'EU', '2026-02-01'),
    (1014, 'Noah Clark', 'Running Shoes', 'Footwear', 2, 129.99, 259.98, 'Shopify', 'US-East', '2026-02-03'),
    (1015, 'Olivia Lewis', 'Phone Case', 'Electronics', 3, 19.99, 59.97, 'Shopify', 'US-West', '2026-02-05'),
    (1016, 'Paul Walker', 'Wireless Earbuds', 'Electronics', 2, 49.99, 99.98, 'Amazon', 'EU', '2026-02-08'),
    (1017, 'Quinn Hall', 'Yoga Mat', 'Fitness', 4, 29.99, 119.96, 'Shopify', 'US-East', '2026-02-10'),
    (1018, 'Rachel Allen', 'Organic Face Cream', 'Beauty', 1, 34.99, 34.99, 'Shopify', 'US-West', '2026-02-12'),
    (1019, 'Sam Young', 'Protein Powder', 'Fitness', 3, 44.99, 134.97, 'Amazon', 'US-East', '2026-02-15'),
    (1020, 'Tina King', 'Running Shoes', 'Footwear', 1, 129.99, 129.99, 'Shopify', 'EU', '2026-02-18'),
    (1021, 'Uma Wright', 'Phone Case', 'Electronics', 2, 19.99, 39.98, 'Shopify', 'US-East', '2026-02-20'),
    (1022, 'Victor Scott', 'Wireless Earbuds', 'Electronics', 1, 49.99, 49.99, 'Amazon', 'US-West', '2026-02-22'),
    (1023, 'Wendy Green', 'Yoga Mat', 'Fitness', 2, 29.99, 59.98, 'Shopify', 'EU', '2026-02-25'),
    (1024, 'Xander Adams', 'Organic Face Cream', 'Beauty', 4, 34.99, 139.96, 'Shopify', 'US-East', '2026-02-28'),
    (1025, 'Yara Nelson', 'Protein Powder', 'Fitness', 1, 44.99, 44.99, 'Shopify', 'US-West', '2026-03-01'),
    (1026, 'Zach Carter', 'Running Shoes', 'Footwear', 1, 129.99, 129.99, 'Amazon', 'US-East', '2026-03-03'),
    (1027, 'Alice Johnson', 'Phone Case', 'Electronics', 4, 19.99, 79.96, 'Shopify', 'EU', '2026-03-05'),
    (1028, 'Bob Smith', 'Wireless Earbuds', 'Electronics', 2, 49.99, 99.98, 'Shopify', 'US-East', '2026-03-06'),
    (1029, 'Carol White', 'Yoga Mat', 'Fitness', 1, 29.99, 29.99, 'Amazon', 'US-West', '2026-03-07'),
    (1030, 'David Brown', 'Organic Face Cream', 'Beauty', 2, 34.99, 69.98, 'Shopify', 'US-East', '2026-03-08');

    CREATE TABLE ad_spend (
      campaign_id INTEGER,
      platform VARCHAR,
      campaign_name VARCHAR,
      spend DECIMAL(10,2),
      impressions INTEGER,
      clicks INTEGER,
      conversions INTEGER,
      date DATE
    );

    INSERT INTO ad_spend VALUES
    (1, 'Meta Ads', 'Spring Earbuds Promo', 250.00, 45000, 1200, 32, '2026-01-15'),
    (1, 'Meta Ads', 'Spring Earbuds Promo', 300.00, 52000, 1400, 38, '2026-02-15'),
    (1, 'Meta Ads', 'Spring Earbuds Promo', 275.00, 48000, 1350, 35, '2026-03-01'),
    (2, 'Google Ads', 'Running Shoes Search', 400.00, 30000, 900, 28, '2026-01-15'),
    (2, 'Google Ads', 'Running Shoes Search', 450.00, 35000, 1100, 33, '2026-02-15'),
    (2, 'Google Ads', 'Running Shoes Search', 420.00, 32000, 950, 30, '2026-03-01'),
    (3, 'Meta Ads', 'Beauty Bundle', 180.00, 38000, 950, 22, '2026-01-15'),
    (3, 'Meta Ads', 'Beauty Bundle', 200.00, 42000, 1050, 25, '2026-02-15'),
    (3, 'Meta Ads', 'Beauty Bundle', 190.00, 40000, 1000, 24, '2026-03-01'),
    (4, 'Google Ads', 'Fitness Gear Brand', 320.00, 28000, 750, 18, '2026-01-15'),
    (4, 'Google Ads', 'Fitness Gear Brand', 350.00, 31000, 820, 21, '2026-02-15'),
    (4, 'Google Ads', 'Fitness Gear Brand', 330.00, 29000, 780, 19, '2026-03-01'),
    (5, 'TikTok Ads', 'Viral Earbuds', 150.00, 80000, 2000, 15, '2026-01-15'),
    (5, 'TikTok Ads', 'Viral Earbuds', 200.00, 95000, 2500, 20, '2026-02-15'),
    (5, 'TikTok Ads', 'Viral Earbuds', 180.00, 88000, 2200, 18, '2026-03-01');

    CREATE TABLE customers (
      customer_id INTEGER,
      name VARCHAR,
      email VARCHAR,
      total_orders INTEGER,
      total_spent DECIMAL(10,2),
      first_order DATE,
      last_order DATE,
      source VARCHAR
    );

    INSERT INTO customers VALUES
    (1, 'Alice Johnson', 'alice@email.com', 3, 179.94, '2026-01-05', '2026-03-05', 'Meta Ads'),
    (2, 'Bob Smith', 'bob@email.com', 2, 134.97, '2026-01-07', '2026-03-06', 'Google Ads'),
    (3, 'Carol White', 'carol@email.com', 2, 159.98, '2026-01-08', '2026-03-07', 'Meta Ads'),
    (4, 'David Brown', 'david@email.com', 2, 219.95, '2026-01-10', '2026-03-08', 'Google Ads'),
    (5, 'Eve Davis', 'eve@email.com', 1, 59.98, '2026-01-12', '2026-01-12', 'TikTok Ads'),
    (6, 'Frank Miller', 'frank@email.com', 1, 44.99, '2026-01-14', '2026-01-14', 'Organic'),
    (7, 'Grace Lee', 'grace@email.com', 1, 104.97, '2026-01-15', '2026-01-15', 'Meta Ads'),
    (8, 'Henry Wilson', 'henry@email.com', 1, 129.99, '2026-01-18', '2026-01-18', 'Google Ads'),
    (9, 'Iris Taylor', 'iris@email.com', 1, 99.95, '2026-01-20', '2026-01-20', 'Meta Ads'),
    (10, 'Jack Anderson', 'jack@email.com', 1, 49.99, '2026-01-22', '2026-01-22', 'TikTok Ads'),
    (11, 'Karen Thomas', 'karen@email.com', 1, 29.99, '2026-01-25', '2026-01-25', 'Organic'),
    (12, 'Leo Martinez', 'leo@email.com', 1, 69.98, '2026-01-27', '2026-01-27', 'Google Ads'),
    (13, 'Mia Robinson', 'mia@email.com', 1, 89.98, '2026-02-01', '2026-02-01', 'Meta Ads'),
    (14, 'Noah Clark', 'noah@email.com', 1, 259.98, '2026-02-03', '2026-02-03', 'Google Ads'),
    (15, 'Olivia Lewis', 'olivia@email.com', 1, 59.97, '2026-02-05', '2026-02-05', 'TikTok Ads');
  `);
}
