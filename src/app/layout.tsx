import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NACF | Counterfactual Load Forecasting",
  description:
    "Academic project website for the News-Aware Context-Balancing Framework and model-estimated event-driven demand perturbation analysis.",
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
