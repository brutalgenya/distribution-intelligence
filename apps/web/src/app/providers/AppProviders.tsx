import type { PropsWithChildren } from "react";
import { QueryClientProvider } from "@tanstack/react-query";

import { SessionProvider } from "../../features/session/SessionProvider";
import { queryClient } from "../../lib/query/query-client";

export const AppProviders = ({ children }: PropsWithChildren): JSX.Element => (
  <SessionProvider>
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  </SessionProvider>
);
