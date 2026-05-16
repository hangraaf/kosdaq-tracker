"use client";

import Link from "next/link";

export default function Footer() {
  return (
    <footer className="psl-footer">
      <div>
        <Link href="/terms">이용약관</Link>
        <Link href="/privacy">개인정보처리방침</Link>
      </div>
      <div>© PUPLE STOCK SLIME · v2.0</div>
    </footer>
  );
}
