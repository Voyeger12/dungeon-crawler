# Credits

Rune Deep verwendet eigens für dieses Projekt erstellten Code und eigens dafür erzeugte Inhalte.

## Musik und Sound

- Die Musikstücke **„Runedeep Vault“**, **„Runedeep Clash“** und **„Runedeep Crown“** wurden vom Projektinhaber mit Suno AI erzeugt und als lokale MP3-Master bereitgestellt.
- `Runedeep Vault` begleitet Erkundung, Hauptmenü und ruhige Spielsituationen.
- `Runedeep Clash` begleitet normale Kämpfe.
- `Runedeep Crown` begleitet Bossbegegnungen.
- Die Audio-Engine streamt die lokalen MP3-Dateien komprimiert durch den gemeinsamen Web-Audio-Mixer, blendet dynamisch zwischen den Spielsituationen und senkt die Musik während der Level-up-Fanfare ab.
- Die bisherigen, vollständig mit der Web Audio API erzeugten Musikschichten bleiben als Offline- und Ladefehler-Fallback erhalten.
- Soundeffekte und Level-up-Fanfare werden weiterhin zur Laufzeit mit der Web Audio API synthetisiert.

Für eine spätere kommerzielle Veröffentlichung müssen die zum Erstellungszeitpunkt geltenden Nutzungsrechte sowie die zugehörigen Projekt-, Konto- und Exportnachweise vom Projektinhaber separat archiviert werden.

## Grafik und Benutzeroberfläche

- Figuren, Kampfanimationen, Symbole, Partikel und Beleuchtung werden mit der Canvas-2D-API gezeichnet oder aus eigens für Rune Deep erzeugten lokalen Sprite-Assets zusammengesetzt.
- Menüs und HUD verwenden lokale Systemschriften, eigenes CSS sowie speziell für Rune Deep erzeugte Material- und Ornamentgrafiken.
- Die lokalen UI-Grafiken unter `public/assets/ui/`, die Umgebungs- und Requisitengrafiken unter `public/assets/dungeon/` sowie die Figuren unter `public/assets/characters/` wurden eigens für dieses Projekt erzeugt, anschließend lokal freigestellt, zugeschnitten und für das Spiel optimiert.
- Der Gameplay-Grafikpass unter `public/assets/gameplay/generated/` ergänzt getrennte Wandhalter und Flammen für Fackeln, sieben eindeutige Collectable-Silhouetten, zwölf Runensegen-Sigille sowie eine zusammenhängende Effektbibliothek für Treffer, Zustände, Heilung, Projektile und Boss-Telegraphen.
- Die Gameplay-Atlanten wurden auf einfarbigem Chroma-Key-Hintergrund erzeugt, lokal mit weichen Alpha-Kanten freigestellt und anschließend in feste, pivotstabile Einzelzellen extrahiert.
- Die exakten Produktionsprompts der ursprünglichen UI- und Dungeonproduktion sind in `ASSET_PROMPTS.md` dokumentiert.

Es werden keine Medien per Hotlink oder von externen Laufzeitdiensten geladen. Sämtliche ausgelieferten Spielmedien liegen lokal im Projekt.
