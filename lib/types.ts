export type Result = Record<string, string | number>;

export type Config = {
  type: "bar" | "line" | "area" | "pie";
  xKey: string;
  yKeys: string[];
  title: string;
  description: string;
  takeaway: string;
  legend: boolean;
  multipleLines?: boolean;
  lineCategories?: string[];
  measurementColumn?: string;
};

export type QueryExplanation = {
  section: string;
  explanation: string;
};
