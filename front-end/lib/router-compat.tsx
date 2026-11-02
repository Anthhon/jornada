"use client";

import NextLink from "next/link";
import { useParams,usePathname,useRouter } from "next/navigation";
import type { ComponentProps,ComponentType } from "react";

const routeAliases: Record<string, string> = {
  "/professor": "/login",
  "/salao": "/dashboard",
  "/missoes": "/missions",
  "/aventureiros": "/students",
  "/grupos": "/groups",
  "/herois": "/heroes",
  "/habilidades": "/skills",
  "/chefes": "/bosses",
  "/perguntas": "/questions",
};

function resolveHref(to: string, params?: Record<string, string>) {
  const alias = Object.entries(routeAliases).find(([source]) => to === source || to.startsWith(`${source}/`));
  let href = alias ? `${alias[1]}${to.slice(alias[0].length)}` : to;

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      href = href.replace(`$${key}`, encodeURIComponent(value));
    }
  }

  return href;
}

type CompatLinkProps = Omit<ComponentProps<typeof NextLink>, "href"> & {
  to: string;
  params?: Record<string, string>;
  activeProps?: { className?: string };
};

export function Link({ to, params, activeProps, className, ...props }: CompatLinkProps) {
  const pathname = usePathname();
  const href = resolveHref(to, params);
  const active = href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  const classes = [className, active ? activeProps?.className : undefined].filter(Boolean).join(" ");

  return <NextLink href={href} className={classes || undefined} {...props} />;
}

export function useNavigate() {
  const router = useRouter();

  return ({ to, params, replace = false }: { to: string; params?: Record<string, string>; replace?: boolean }) => {
    const href = resolveHref(to, params);
    if (replace) router.replace(href);
    else router.push(href);
  };
}

type RouteOptions = {
  component?: ComponentType;
  head?: () => unknown;
};

export function createFileRoute(_path: string) {
  void _path;
  return <T extends RouteOptions>(options: T) => ({
    ...options,
    useParams: () => useParams<Record<string, string>>(),
  });
}
