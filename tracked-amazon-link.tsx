"use client";

import type { ReactNode, MouseEvent } from "react";

export default function TrackedAmazonLink({ href, productId, children, className }: { href: string; productId: string; children: ReactNode; className?: string }) {
  function recordClick(_event: MouseEvent<HTMLAnchorElement>) {
    void fetch("/api/affiliate-click", {
      method: "POST", keepalive: true, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, destination: href }),
    }).catch((error) => console.warn("No se pudo registrar este clic web:", error));
  }
  return <a className={className} href={href} target="_blank" rel="sponsored nofollow noopener" onClick={recordClick}>{children}</a>;
}
