import { motion } from "framer-motion";
import { Button } from "./ui/button";

export const SuggestedQueries = ({
  handleSuggestionClick,
}: {
  handleSuggestionClick: (suggestion: string) => void;
}) => {
  const suggestionQueries = [
    {
      desktop: "Top 5 products by revenue",
      mobile: "Top products",
    },
    {
      desktop: "Ad spend vs conversions by platform",
      mobile: "Ad performance",
    },
    {
      desktop: "Revenue breakdown by sales channel",
      mobile: "By channel",
    },
    {
      desktop: "Which ad campaign has the best ROAS?",
      mobile: "Best ROAS",
    },
    {
      desktop: "Monthly revenue trend",
      mobile: "Revenue trend",
    },
    {
      desktop: "Customer acquisition cost by source",
      mobile: "CAC by source",
    },
    {
      desktop: "Compare Shopify vs Amazon sales by category",
      mobile: "Shopify vs Amazon",
    },
    {
      desktop: "Revenue by region",
      mobile: "By region",
    },
    {
      desktop: "Top customers by lifetime value",
      mobile: "Top customers",
    },
  ];

  return (
    <motion.div
      key="suggestions"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      layout
      exit={{ opacity: 0 }}
      className="h-full overflow-y-auto"
    >
      <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-4">
        Ask anything about your data:
      </h2>
      <div className="flex flex-wrap gap-2">
        {suggestionQueries.map((suggestion, index) => (
          <Button
            key={index}
            className={index > 5 ? "hidden sm:inline-block" : ""}
            type="button"
            variant="outline"
            onClick={() => handleSuggestionClick(suggestion.desktop)}
          >
            <span className="sm:hidden">{suggestion.mobile}</span>
            <span className="hidden sm:inline">{suggestion.desktop}</span>
          </Button>
        ))}
      </div>
    </motion.div>
  );
};
