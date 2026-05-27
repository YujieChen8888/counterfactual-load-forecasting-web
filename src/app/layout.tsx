import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NACF | Counterfactual Load Forecasting",
  description:
    "Academic project website for news-aware counterfactual load forecasting and event-driven demand perturbation analysis.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
