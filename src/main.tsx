import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@xyflow/react/dist/style.css";
import { TERN } from "./ui/schermo";
import { App } from "./ui/App";

// Ogni stile ha il suo foglio, caricato prima del primo disegno: si vede solo quello scelto, senza lampi dell'altro.
// Import dinamici perché lo stile si sceglie a runtime: con due import statici i due fogli varrebbero insieme.
// tern-ui.js trasforma i <select class="t-select"> in scelte con menu; icons.js mette nella pagina le icone.
if (TERN) {
  await import("./stile-tern.css");
  await import("./tern-ui/icons.js");
  await import("./tern-ui/tern-ui.js");
} else {
  await import("./app.css");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
