"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthModalStore } from "@/lib/store";

export default function SignupRedirect() {
  const router = useRouter();
  const { openSignup } = useAuthModalStore();

  useEffect(() => {
    openSignup();
    router.replace("/");
  }, [openSignup, router]);

  return null;
}
