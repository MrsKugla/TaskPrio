// Persistenza: ponte verso i comandi Tauri (SQLite). Nessuna logica di dominio.
import { invoke } from "@tauri-apps/api/core";
import type { Progetto } from "./regole";

export type Tema = "chiaro" | "scuro";
// Aspetto dell'interfaccia: «arcade» (tasti 3D e CRT) o «tern» (i componenti di tern-ui).
export type Stile = "arcade" | "tern";

// «giorniPrestoAlta», «stile», «tema» e «crt» sono assenti finché non si cambiano.
export type DatiSalvati = {
  progetti: Progetto[];
  ultimoProgettoId: string | null;
  giorniPrestoAlta: number | null;
  stile: Stile | null;
  tema: Tema | null;
  // Intensità dell'effetto CRT, da 0 (spento) a 100.
  crt: number | null;
};

export const caricaDati = () => invoke<DatiSalvati>("carica_dati");
export const salvaProgetto = (progetto: Progetto) => invoke<void>("salva_progetto", { progetto });
export const eliminaProgetto = (id: string) => invoke<void>("elimina_progetto", { id });
export const impostaUltimoProgetto = (id: string | null) => invoke<void>("imposta_ultimo_progetto", { id });
export const impostaGiorniPrestoAlta = (giorni: number) => invoke<void>("imposta_giorni_presto_alta", { giorni });
export const impostaStile = (stile: Stile) => invoke<void>("imposta_stile", { stile });
export const impostaTema = (tema: Tema) => invoke<void>("imposta_tema", { tema });
export const impostaCrt = (crt: number) => invoke<void>("imposta_crt", { crt });
export const esportaDati = (percorso: string) => invoke<void>("esporta_dati", { percorso });
// Sostituisce tutti i dati con quelli del file, dopo averne salvato una copia in «backupAutomatico».
// Un file non valido viene rifiutato con un messaggio e i dati restano com'erano.
export const importaDati = (percorso: string) =>
  invoke<{ dati: DatiSalvati; backupAutomatico: string }>("importa_dati", { percorso });
