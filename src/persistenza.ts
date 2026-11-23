// Persistenza: ponte verso i comandi Tauri (SQLite). Nessuna logica di dominio.
import { invoke } from "@tauri-apps/api/core";
import type { Progetto } from "./regole";

// «giorniPrestoAlta» è assente finché non si cambia nelle Impostazioni.
export type DatiSalvati = { progetti: Progetto[]; ultimoProgettoId: string | null; giorniPrestoAlta: number | null };

export const caricaDati = () => invoke<DatiSalvati>("carica_dati");
export const salvaProgetto = (progetto: Progetto) => invoke<void>("salva_progetto", { progetto });
export const eliminaProgetto = (id: string) => invoke<void>("elimina_progetto", { id });
export const impostaUltimoProgetto = (id: string | null) => invoke<void>("imposta_ultimo_progetto", { id });
export const impostaGiorniPrestoAlta = (giorni: number) => invoke<void>("imposta_giorni_presto_alta", { giorni });
