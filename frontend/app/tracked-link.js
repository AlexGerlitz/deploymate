"use client";

import Link from "next/link";

import { trackFunnelEvent } from "./lib/funnel-telemetry";

function isExternalHref(href) {
  return (
    typeof href === "string" &&
    (href.startsWith("http://") ||
      href.startsWith("https://") ||
      href.startsWith("mailto:") ||
      href.startsWith("#"))
  );
}

export default function TrackedLink({
  href,
  eventName,
  eventProps,
  onClick,
  children,
  ...props
}) {
  function handleClick(event) {
    trackFunnelEvent(eventName, {
      destination: typeof href === "string" ? href : String(href),
      ...eventProps,
    });

    if (onClick) {
      onClick(event);
    }
  }

  if (isExternalHref(href)) {
    return (
      <a href={href} onClick={handleClick} {...props}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
}
