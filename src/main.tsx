import { Component, StrictMode, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { foundationDeviceProfile } from "./Domain/factories";
import { App } from "./App/App";
import { createDeviceProfileRegistry } from "./App/profile-registry";
import "./App/app.css";

const profileRegistry = createDeviceProfileRegistry([foundationDeviceProfile]);

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Template Designer render failure", error, info);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: "Segoe UI, sans-serif", color: "#1b2c33", background: "#e9eef0", minHeight: "100vh" }}>
          <h2>Template Designer stopped</h2>
          <p>The editor hit an unexpected error. Your document state is preserved in the browser storage; reload to continue.</p>
          <pre style={{ whiteSpace: "pre-wrap", color: "#b64c4c" }}>{this.state.error.message}</pre>
          <button type="button" onClick={() => window.location.reload()} style={{ padding: "8px 14px" }}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App profileRegistry={profileRegistry} />
    </AppErrorBoundary>
  </StrictMode>,
);
