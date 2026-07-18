import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode, Component } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { BrokerProvider } from "../hooks/useBroker";
import { RobotProvider } from "../hooks/useRobot";
import { connectLoggerToDaemon } from "../engine/logger";

/**
 * React Error Boundary — catches render errors locally so they don't cascade
 * to TanStack Router's errorComponent (which unmounts the whole app tree).
 */
class ErrorBoundary extends Component<
  { children: ReactNode; onError?: (error: Error) => void },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; onError?: (error: Error) => void }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }
  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error("[REACT ERROR]", error, info.componentStack ?? "");
    this.props.onError?.(error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <div className="max-w-md text-center">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Unexpected error
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The UI caught an error but will continue running. Check the console for details.
            </p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error | null; reset: () => void }) {
  if (error) {
    console.error("[REACT ROUTER ERROR] error:", error, "stack:", error.stack);
    const router = useRouter();
    useEffect(() => {
      reportLovableError(error, { boundary: "tanstack_root_error_component" });
    }, [error]);

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            This page didn't load
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Something went wrong on our end. You can try refreshing or head back home.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button
              onClick={() => {
                router.invalidate();
                reset();
              }}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Try again
            </button>
            <a
              href="/"
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              Go home
            </a>
          </div>
        </div>
      </div>
    );
  }

  // If error is null/undefined, render the simple loading/fallback UI
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Loading page...</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Please wait while we prepare the dashboard.
        </p>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Nexor AI · Fluxo de Continuidade Pro" },
      {
        name: "description",
        content:
          "Painel de operações automatizadas Nexor AI - Fluxo de Continuidade Pro com Smart Recovery.",
      },
      { name: "author", content: "Nexor AI" },
      { property: "og:title", content: "Nexor AI · Fluxo de Continuidade Pro" },
      {
        property: "og:description",
        content:
          "Painel de operações automatizadas Nexor AI - Fluxo de Continuidade Pro com Smart Recovery.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@NexorAI" },
      { name: "twitter:title", content: "Nexor AI · Fluxo de Continuidade Pro" },
      {
        name: "twitter:description",
        content:
          "Painel de operações automatizadas Nexor AI - Fluxo de Continuidade Pro com Smart Recovery.",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    const disconnect = connectLoggerToDaemon();
    return disconnect;
  }, []);

  useEffect(() => {
    return () => {
      console.log("[UNMOUNT] RootComponent");
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrokerProvider>
        <RobotProvider>
          <ErrorBoundary>
            {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
            <Outlet />
          </ErrorBoundary>
        </RobotProvider>
      </BrokerProvider>
    </QueryClientProvider>
  );
}
