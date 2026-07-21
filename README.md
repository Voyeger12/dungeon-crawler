# Rune Deep

**Rune Deep** ist ein direkt spielbarer 2D-Top-down-Dungeon-Brawler für den Browser. Jeder Durchlauf erzeugt eine neue Raumfolge aus Kampf-, Elite-, Schatz-, Rast- und Bossräumen. Der Runenträger kämpft mit einer kurzen Schwertkombo, weicht per Dash aus, sammelt Relikte und stellt sich am Ende dem zweiphasigen Runenwächter.

## Technologie

- **TypeScript 5** für typsichere Spiellogik
- **HTML5 Canvas 2D** für den deterministischen, zeitbasierten Game-Loop
- **HTML/CSS** für zugängliche Menüs, HUD und Overlays
- **Vite 6** als Entwicklungsserver und Produktions-Bundler
- **Web Audio API** für adaptive, mehrschichtige Musik und Soundeffekte
- **Local Storage** für Einstellungen und Bestwerte

Die eigene Canvas-Engine hält die Produktion klein, offline-freundlich und unabhängig von externen Laufzeitbibliotheken. Figuren, Trefferfeedback und Beleuchtung werden dynamisch gezeichnet; lokale WebP-Assets liefern die rauen Holz-, Eisen-, Leder-, Stein- und Requisitenoberflächen. Es gibt keine Hotlinks oder zur Laufzeit nachgeladenen Fremdmedien.

## Voraussetzungen und Installation

- Node.js 20 oder neuer
- npm 10 oder neuer

```bash
npm install
npm run dev
```

Vite zeigt anschließend die lokale Adresse an, normalerweise `http://localhost:5173`.

### Windows-Schnellstart

Nach der Installation von Node.js kann das Spiel auch direkt per Doppelklick auf
`SPIEL_STARTEN.cmd` geöffnet werden. Der Starter installiert bei Bedarf die
Abhängigkeiten, startet den lokalen Server und öffnet das Spiel automatisch im
Standardbrowser. Das separate Serverfenster kann zum Beenden geschlossen werden.

## Produktions-Build

```bash
npm run build
npm run preview
```

Der Build wird in `dist/` erzeugt. `npm run build` führt zuerst die strikte TypeScript-Prüfung und danach den Vite-Build aus.

## Steuerung

| Eingabe | Aktion |
|---|---|
| `WASD` / Pfeiltasten | Bewegen |
| Maus | Zielen |
| Linksklick / `Leertaste` | Schwertangriff |
| `Shift` | Dash mit kurzen Unverwundbarkeitsframes |
| `E` | Truhe öffnen / an Runenkreis rasten |
| `Q` | Heiltrank verwenden |
| `C` / `I` | Charakterkodex mit Werten, Runensegen und Relikten |
| `M` | Große Dungeonkarte |
| `Esc` | Pause |

Die Seite verhindert Scrollen durch Spieltasten. Diagonalbewegung wird normalisiert, Mauskoordinaten werden auf die logische Canvas-Auflösung skaliert und ein Fokusverlust pausiert das Spiel automatisch.

## Spielfunktionen

- Variierender Dungeon-Graph mit persistenten Raumzuständen und großer, normalisierter Dungeonkarte auf `M`
- Vier normale Gegnertypen: Skelettkrieger, Schleim, Bogenschütze und Schattenbestie
- Elitevarianten mit Aura, verstärkten Werten und zusätzlicher Belohnung
- Zweiphasiger Runenwächter mit Nahschlag, Schockwelle, Projektilring, Runenfeldern, Sturmangriff und Beschwörung
- Reaktionsschneller Nahkampf mit animierter Dreierkombo, klarer Schwert-Schwungbahn, Rückstoß, kritischen Treffern, Schadenszahlen und Hit-Stop-artigem Feedback
- Dash-Abklingzeit, Unverwundbarkeit, Treffer-I-Frames, Rüstung und Heiltränke
- Transaktionale Level-up-Zeremonie mit Fanfare, sicherer Eingabesperre und drei klaren Runentafeln pro Stufe
- Gold, Heilung, Tränke, Schlüssel, temporäre Buffs, zerstörbare Kisten und acht seltene Relikte
- Schatz- und Rastraum, Fallen mit visueller Aktivierung, atmosphärische Fackelbeleuchtung sowie lokale Boden-, Mauer-, Truhen-, Schrein- und Hindernisgrafiken
- Adaptiver Reliquienschrein-Rahmen mit echten lokalen Holz-, Eisen-, Leder- und Pergamentmaterialien, freigestellten Schmiedebeschlägen und lesbarem `M`-Kartenhinweis
- Klar getrennte Informationsebenen: dauerhafte Werte und Werkzeuge liegen außerhalb der Arena; Bossleben, Interaktionen, Warnungen und Trefferfeedback bleiben in der Spielwelt
- Start-, Pause-, Charakterkodex-, Karten-, Level-up-, Sieg- und Niederlagenbildschirm mit Tastatur-Fokusführung
- Feste logische 960×540-Spielwelt mit DPR-scharfem Backbuffer, automatischer Anpassung, 720p/900p/1080p/1440p-Presets, Vollbild und vier UI-Größen
- Optionale kontextabhängige Spielhinweise mit gespeichertem Fortschritt und Reset in den Einstellungen
- Adaptive Dungeon-Musik mit Bass, Melodie, Flächen und Percussion, separate Lautstärken, Stummschaltung, deaktivierbare Erschütterung und reduzierte Effekte
- Robuste lokale Speicherung mit validierten Standardwerten und versioniertem Speicherschlüssel

## Projektstruktur

```text
src/
  audio.ts       Prozedurales Web-Audio
  config.ts      Zentrales Balancing, Relikte und Segnungen
  dungeon.ts     Dungeon-Graph und Raumvorlagen
  display.ts     16:9-Präsentation, DPR, Vollbild und Renderpresets
  game.ts        Game-Loop und Spielsysteme
  input.ts       Tastatur-, Maus- und Fokusbehandlung
  math.ts        Vektor- und Zufallsfunktionen
  map-view.ts    Normalisierte, semantische M-Karte
  hud.ts         Gecachter, barrierearmer HUD-Zustand und DOM-Updates
  model.ts       Gemeinsame Typen und Zustandsmodelle
  renderer.ts    Canvas-Rendering und prozedurale Pixelgrafik
  storage.ts     Validierte Local-Storage-Daten
  style.css      Menüs, HUD und responsive Darstellung
  tutorial.ts    Kontextabhängige Einsteigerhinweise
  ui.ts          DOM-Overlays und UI-Ereignisse
  main.ts        Einstiegspunkt
public/assets/   Lokale UI- und Dungeonmaterialien als optimierte WebP-Dateien
```

## Speicherung

Gespeichert werden Bestpunktzahl, schnellster Sieg, höchstes Level, meiste besiegte Gegner, Anzahl der Durchläufe und Siege, alle Audio-/Grafikeinstellungen sowie der Fortschritt der optionalen Spielhinweise. Speicherstände der Versionen 2 und 3 werden automatisch in Version 4 übernommen. Fehlende, alte oder beschädigte Daten werden abgefangen und durch sichere Standardwerte ergänzt. Ein laufender Dungeon wird bewusst nicht gespeichert.

## Hinweise

- Desktop und Laptop sind die primären Zielplattformen; eine Touch-Steuerung ist nicht enthalten.
- Das Spiel verwendet keine Backenddienste, API-Schlüssel oder Hotlinks und ist nach der Installation offline spielbar.
