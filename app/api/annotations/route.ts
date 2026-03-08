import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const ANNOTATIONS_PATH = path.join(process.cwd(), "data", "annotations.json");

export type Annotations = Record<string, TableAnnotation>;

export interface TableAnnotation {
  description?: string;
  columns?: Record<string, string>;
}

async function readAnnotations(): Promise<Annotations> {
  try {
    const data = await readFile(ANNOTATIONS_PATH, "utf-8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function writeAnnotations(annotations: Annotations) {
  const dir = path.dirname(ANNOTATIONS_PATH);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(ANNOTATIONS_PATH, JSON.stringify(annotations, null, 2));
}

export async function GET() {
  const annotations = await readAnnotations();
  return Response.json(annotations);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { table, description, column, columnDescription } = body;

    if (!table) {
      return Response.json({ error: "table is required" }, { status: 400 });
    }

    const annotations = await readAnnotations();

    if (!annotations[table]) {
      annotations[table] = {};
    }

    // Update table description
    if (description !== undefined) {
      if (description === "") {
        delete annotations[table].description;
      } else {
        annotations[table].description = description;
      }
    }

    // Update column description
    if (column && columnDescription !== undefined) {
      if (!annotations[table].columns) {
        annotations[table].columns = {};
      }
      if (columnDescription === "") {
        delete annotations[table].columns![column];
        if (Object.keys(annotations[table].columns!).length === 0) {
          delete annotations[table].columns;
        }
      } else {
        annotations[table].columns![column] = columnDescription;
      }
    }

    // Clean up empty entries
    if (!annotations[table].description && !annotations[table].columns) {
      delete annotations[table];
    }

    await writeAnnotations(annotations);
    return Response.json(annotations);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to save" },
      { status: 500 }
    );
  }
}
