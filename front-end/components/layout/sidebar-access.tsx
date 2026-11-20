"use client";

import { createContext, useContext } from "react";

export const SidebarAccessContext = createContext({ canViewUsers: false, loading: true });
export function useSidebarAccess() { return useContext(SidebarAccessContext); }
