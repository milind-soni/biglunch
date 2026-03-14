import "./globals.css";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { ThemeProvider } from "next-themes";
import { WorkflowProvider } from "@/lib/workflow-context";

export const metadata = {
  title: "biglunch",
  description: "AI-powered e-commerce analytics",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${GeistMono.className} ${GeistSans.className}`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <WorkflowProvider>
            {children}
          </WorkflowProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
