# Tauri 2 + React Flow + SQLite locale, senza sincronizzazione

TaskPrio è un'app desktop (prima Windows, poi multipiattaforma) costruita con Tauri 2, interfaccia React + TypeScript e grafo con React Flow; i dati stanno in un file SQLite locale non cifrato, e passano tra dispositivi solo con Esporta/Importa manuale. Tauri è stato preferito a Electron per installer e aggiornamenti firmati già inclusi, superficie d'attacco minore e dimensione ridotta; a una UI nativa Rust perché il grafo modificabile col drag & drop andrebbe scritto da zero.

## Consequences

- Sincronizzazione tra dispositivi e cifratura dei dati sono escluse dalla prima versione; aggiungerle cambia il formato del backup.
