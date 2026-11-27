// Come si presenta l'app: stile (arcade o tern), tema chiaro o scuro, intensità del CRT.
// Vivono nel database; la copia in localStorage serve a dipingere l'app giusta prima che i dati arrivino,
// senza un lampo di tema chiaro o di CRT spento a ogni avvio.
//
// Lo stile si sceglie una volta, all'avvio (main.tsx carica il suo foglio e, per tern, tern-ui.js):
// i due fogli toccano tutta la pagina, quindi cambiare stile salva e ricarica la finestra.
import { useLayoutEffect, useRef, type SelectHTMLAttributes } from "react";
import type { Stile, Tema } from "../persistenza";

export type Schermo = { stile: Stile; tema: Tema; crt: number };
const CHIAVE_SCHERMO_RAPIDO = "schermo";

export const leggiSchermo = (dati: { stile?: string | null; tema?: string | null; crt?: number | null } | null): Schermo => ({
  stile: dati?.stile === "tern" ? "tern" : "arcade",
  tema: dati?.tema === "scuro" ? "scuro" : "chiaro",
  crt: Math.min(100, Math.max(0, Math.round(Number(dati?.crt) || 0))),
});

export const schermoIniziale = (): Schermo => {
  try {
    return leggiSchermo(JSON.parse(localStorage.getItem(CHIAVE_SCHERMO_RAPIDO) ?? "null"));
  } catch {
    return leggiSchermo(null);
  }
};

export const applicaSchermo = ({ stile, tema, crt }: Schermo) => {
  const radice = document.documentElement;
  radice.dataset.tema = tema;
  // tern-ui legge il tema da data-theme.
  radice.dataset.theme = tema === "scuro" ? "dark" : "light";
  // Con il CRT a 0, o nello stile tern che non lo prevede, l'effetto non c'è proprio: niente strato sopra l'app né animazione.
  if (crt > 0 && stile === "arcade") radice.dataset.crt = "";
  else delete radice.dataset.crt;
  radice.style.setProperty("--crt", String(crt / 100));
  localStorage.setItem(CHIAVE_SCHERMO_RAPIDO, JSON.stringify({ stile, tema, crt }));
};

// Lo stile con cui questa finestra è partita: resta fisso fino al prossimo caricamento.
export const STILE: Stile = schermoIniziale().stile;
export const TERN = STILE === "tern";

// Icona di tern-ui (icons.js mette nella pagina lo sprite con i simboli «i-<nome>»). Nello stile arcade non c'è.
export function Icona({ nome }: { nome: string }) {
  if (!TERN) return null;
  return (
    <svg className="ico" aria-hidden="true">
      <use href={`#i-${nome}`} />
    </svg>
  );
}

declare global {
  // tern-ui.js: aggiorna(radice) monta le scelte nuove e riallinea il bottone al valore del <select>.
  var TernUI: { aggiorna: (radice?: ParentNode) => void } | undefined;
}

// <select> della scelta di tern-ui. React cambia la voce scelta con option.selected, che tern-ui.js non vede:
// dopo ogni disegno gli si chiede di riallineare il suo bottone. Nello stile arcade resta un <select> normale.
export function Scelta({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  const ref = useRef<HTMLSelectElement>(null);
  useLayoutEffect(() => {
    const genitore = ref.current?.parentElement;
    if (TERN && genitore) globalThis.TernUI?.aggiorna(genitore);
  });
  return <select ref={ref} className={`t-select${className ? ` ${className}` : ""}`} {...props} />;
}
