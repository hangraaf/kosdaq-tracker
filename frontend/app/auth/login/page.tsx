"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthModalStore } from "@/lib/store";

export default function LoginRedirect() {
  const router = useRouter();
  const { openLogin } = useAuthModalStore();

  useEffect(() => {
    openLogin();
    router.replace("/");
  }, [openLogin, router]);

  return null;
}
