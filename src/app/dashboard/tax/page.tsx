import { Metadata } from "next";
import TaxClient from "./TaxClient";

export const metadata: Metadata = {
  title: "Tax Summary | Finance Dashboard",
  description: "Capital gains tax calculations and summary",
};

export default function TaxPage() {
  return <TaxClient />;
}
