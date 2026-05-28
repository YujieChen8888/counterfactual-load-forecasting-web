import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NACF | Counterfactual Load Forecasting",
  description:
    "Academic project website for the News-Aware Counterfactual Load Analysis Framework with LLM-structured events and representation learning.",
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
