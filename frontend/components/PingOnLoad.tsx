"use client";
import { useEffect } from "react";
import { pingBackend } from "@/lib/keepAlive";

export default function PingOnLoad() {
  useEffect(() => { pingBackend(); }, []);
  return null;
}
