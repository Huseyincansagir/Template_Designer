import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { foundationDeviceProfile } from "./Domain/factories";
import { App } from "./App/App";
import { createDeviceProfileRegistry } from "./App/profile-registry";
import "./App/app.css";

const profileRegistry = createDeviceProfileRegistry([foundationDeviceProfile]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App profileRegistry={profileRegistry} />
  </StrictMode>,
);
