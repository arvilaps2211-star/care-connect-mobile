import React from "react";
import { Button } from "@/components/ui/button";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  message?: string;
};

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : String(error);
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: unknown) {
    // This will show up in Lovable console logs so we can debug the real crash.
    console.error("AppErrorBoundary caught error:", error);
    console.error("AppErrorBoundary info:", info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-lg border bg-card p-6 space-y-3">
            <h1 className="text-lg font-semibold">Something went wrong</h1>
            <p className="text-sm text-muted-foreground break-words">
              {this.state.message ?? "Unknown error"}
            </p>
            <Button className="w-full" onClick={() => window.location.reload()}>
              Reload
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
