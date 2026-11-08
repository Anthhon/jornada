"use client";

import { cn } from "@/lib/utils";

/** Maçã dourada da guilda, desenhada em uma grade de pixels. */
export function Crest({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={cn("h-9 w-9", className)} shapeRendering="crispEdges" aria-hidden>
      <path d="M8 2H10V4H11V7H9V5H8Z" fill="#5b3e14" />
      <path d="M11 2H13V1H17V3H16V4H13V5H11Z" fill="#5b3e14" />
      <path d="M12 3H14V2H16V3H15V4H12Z" fill="#c6aa28" />
      <path d="M4 6H7V7H11V6H15V7H17V9H18V14H17V16H15V18H12V19H10V18H8V19H5V18H3V16H2V13H1V9H2V7H4Z" fill="#5b3e14" />
      <path d="M4 7H7V8H11V7H15V8H16V10H17V14H16V16H14V17H12V18H10V17H8V18H5V17H4V15H3V13H2V10H3V8H4Z" fill="#f9cf38" />
      <path d="M15 9H16V10H17V14H16V16H14V17H12V18H10V17H8V18H5V17H4V15H6V16H8V15H12V16H14V14H15Z" fill="#d99518" />
      <path d="M5 8H7V9H5V10H4V13H3V10H4V9H5Z" fill="#fff3a6" />
      <path d="M5 10H6V13H5Z" fill="#ffe76a" />
      <path d="M12 8H14V9H12Z" fill="#ffe76a" />
      <path d="M6 16H8V17H6ZM12 16H14V17H12Z" fill="#b97815" />
    </svg>
  );
}
