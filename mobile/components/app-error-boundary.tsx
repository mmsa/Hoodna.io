import React, { Component, useEffect } from "react";
import { Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { colors } from "@/constants/colors";
import { useTelemetry } from "@/contexts/TelemetryContext";

interface BoundaryProps {
  children: React.ReactNode;
  capture: (error: unknown, kind?: "render" | "unhandled_promise") => void;
}

interface BoundaryState {
  error: Error | null;
}

class Boundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    this.props.capture(error, "render");
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View
        accessibilityLiveRegion="assertive"
        style={{ flex: 1, padding: 24, justifyContent: "center", backgroundColor: colors.background }}
      >
        <Text style={{ color: colors.textMain, fontSize: 22, fontWeight: "700", textAlign: "center" }}>
          Something went wrong
        </Text>
        <Text style={{ color: colors.textMuted, marginVertical: 12, textAlign: "center", lineHeight: 21 }}>
          Your information is safe. Try loading this screen again.
        </Text>
        <Button onPress={() => this.setState({ error: null })}>Try again</Button>
      </View>
    );
  }
}

export function AppErrorBoundary({ children }: { children: React.ReactNode }) {
  const { captureError } = useTelemetry();

  useEffect(() => {
    const globalObject = globalThis as typeof globalThis & {
      onunhandledrejection?: ((event: { reason?: unknown }) => void) | null;
    };
    const previous = globalObject.onunhandledrejection;
    globalObject.onunhandledrejection = (event) => {
      captureError(event.reason, "unhandled_promise");
      previous?.(event);
    };
    return () => {
      globalObject.onunhandledrejection = previous;
    };
  }, [captureError]);

  return <Boundary capture={captureError}>{children}</Boundary>;
}
