import type { Metadata } from "next";
import "../studio.css";
import { StudioApp } from "./StudioApp";
export const metadata: Metadata = { title: "Studio" };
export default function Page() { return <StudioApp />; }
