"use client";
import { AgentPanel } from "@/components/agent/AgentPanel";
import { Studio } from "@/components/studio/Studio";
export function StudioApp() { return <Studio agent={(ctx) => <AgentPanel ctx={ctx} />} />; }
