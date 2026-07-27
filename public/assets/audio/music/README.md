# Rune Deep – Musikmaster

## Dateien

- `runedeep-vault.mp3` – Erkundung, Hauptmenü und ruhige Spielsituationen
- `runedeep-clash.mp3` – normale Kämpfe
- `runedeep-crown.mp3` – Bossbegegnungen

Alle drei Dateien wurden vom Projektinhaber mit Suno AI erzeugt und am 23. Juli 2026 für die lokale Spieleintegration bereitgestellt.

## Laufzeitverhalten

Die zentrale Zuordnung steht in `src/audio.ts` unter `SCORE_TRACKS` und `SCORE_SCENES`.

- Alle drei Titel werden nach der ersten erlaubten Audiointeraktion als komprimierte lokale Streams vorbereitet.
- Die Audioelemente loopen die vollständigen Master, ohne die langen Titel vollständig als PCM im Arbeitsspeicher zu halten.
- Szenenwechsel verwenden einen Crossfade von 2,2 Sekunden.
- Beim Level-up wird der aktuelle Titel abgesenkt, während die Fanfare spielt.
- Bei einem Lade- oder Dekodierfehler bleibt die prozedurale Web-Audio-Musik als Fallback aktiv.
- Beim Zurückkehren zu einem Titel wird seine letzte Wiedergabeposition wieder aufgenommen.

Die Streaming-Architektur verhindert, dass alle drei Master dauerhaft als unkomprimierte PCM-Daten im Arbeitsspeicher liegen.

Für eine spätere Veröffentlichung sind die ursprünglichen Suno-Projekt- und Lizenznachweise getrennt vom Spiel-Build aufzubewahren.
