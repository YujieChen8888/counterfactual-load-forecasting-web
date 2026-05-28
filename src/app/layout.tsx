import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NACF | Counterfactual Load Forecasting",
  description:
    "News-aware counterfactual load analysis with structured event treatments and representation-balanced forecasting.",
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
