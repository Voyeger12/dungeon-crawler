# Rune Deep – Entwicklungs-Backlog

Diese Liste sammelt die geplanten Erweiterungen nach Priorität und Abhängigkeit. Sie ist bewusst noch kein fester Veröffentlichungsplan: Umfang, Balance und Inhalte werden zuerst in kleinen, spielbaren Ausbaustufen validiert.

## Legende

- **P0** – technische Grundlage; blockiert andere Arbeiten
- **P1** – zentral für die nächste große Spielversion
- **P2** – Ausbau, Vielfalt und Feinschliff
- **Abnahme** – Bedingungen, unter denen ein Punkt als erledigt gilt

## Bereits vorhandene Grundlage

- [x] Prozedural erzeugte Dungeons und Räume
- [x] Grundlegendes Kampf-, Gegner- und Boss-System
- [x] Power-ups und Level-up-Auswahl
- [x] Gold als sammelbare Ressource
- [x] Responsive UI-Grundlage, große Karte über `M` und Charakterbogen über `C`
- [x] Adaptive Musik-Grundlage für Erkundung, Kampf und Bossbegegnungen

## 1. Technische Grundlage für Items und Fortschritt – P0

- [ ] Datengetriebene Item-Definitionen für Waffen, Rüstungen, Verbrauchsgegenstände und besondere Relikte anlegen
- [ ] Seltenheiten, Preise, Werte, Effekte, Voraussetzungen und Beschreibungen vereinheitlichen
- [ ] Inventar sowie Ausrüstungsplätze und zentrale Berechnung aller Charakterwerte implementieren
- [ ] Item-Vergleich für aktuell ausgerüstete und angebotene Gegenstände vorbereiten
- [ ] Spielstände um Inventar, Ausrüstung und Shop-Zustand erweitern
- [ ] Sichere Migration älterer Spielstände einbauen
- [ ] Zentrale Inhaltsregister für Items, Gegner, Räume, Effekte, Sprites und Musik schaffen
- [ ] Testwerkzeuge für Gold, Preise, Schaden und Charakterwerte ergänzen

**Abnahme:** Kaufen, Ausrüsten, Speichern und Laden verändern die Werte korrekt; alte Spielstände bleiben nutzbar; Gold und Gegenstände können nicht dupliziert werden.

## 2. Lydia und der Shop – P1

- [ ] Festlegen, wo Lydia erscheint: Hub, sicherer Raum, zwischen Ebenen oder eine Kombination daraus
- [ ] Lydia als sichtbaren NPC mit eigener Figur, Animation und Interaktionshinweis gestalten
- [ ] Dialog- und Shop-Oberfläche im rauen mittelalterlichen Stil erstellen
- [ ] Kategorien für Waffen, Rüstungen, Tränke und besondere Gegenstände einbauen
- [ ] Shop-Bestand mit kontrollierter Zufälligkeit, Seltenheiten und ebenenabhängigen Angeboten erzeugen
- [ ] Deutliche Vorschau für Preis, Wertänderungen und besondere Effekte anzeigen
- [ ] Kaufen, optional Verkaufen und optionales Neuwürfeln des Angebots umsetzen
- [ ] Preise und Goldbelohnungen so balancieren, dass Gold dauerhaft wertvoll bleibt
- [ ] Eigene Dialoge, Musik und Story-Verknüpfungen für Lydia hinzufügen

**Abnahme:** Lydia ist ohne Verwechslung auffindbar; alle Transaktionen sind verständlich und speicherfest; der Shop kann nicht während eines aktiven Kampfes missbraucht werden.

## 3. Figuren, Monster und Animationen – P1

- [ ] Einheitlichen Sprite- und Animationsstil für alle Figuren festlegen
- [ ] Spielfigur vollständig ersetzen: Idle, Laufen, Angriffsvorbereitung, Trefferphase, Erholung, Dash, Trefferreaktion und Tod
- [ ] Bewegungsrichtungen, Blickrichtung, Waffenanker und Schatten sauber ausrichten
- [ ] Neue passende Sprites für vorhandene Monster und Bosse produzieren
- [ ] Zusätzliche Monsterrollen gestalten: Nahkämpfer, Fernkämpfer, Sturmangreifer, Beschwörer und Verteidiger
- [ ] Eigene Angriffs- und Trefferanimationen pro Waffen- und Gegnertyp ergänzen
- [ ] Primitive Ersatzgrafiken als technische Rückfallebene behalten
- [ ] Trefferboxen und aktive Angriffsfenster mit den sichtbaren Animationen synchronisieren

**Abnahme:** Bei geladenen Assets sind keine Platzhalterformen sichtbar; Figuren springen nicht zwischen Animationsbildern; sichtbarer Treffer und tatsächliche Trefferbox stimmen überein.

## 4. Wände, Tore und Dungeon-Texturen – P1

- [ ] Vollständiges Wand-Set mit geraden Stücken, Innen- und Außenecken sowie beschädigten Varianten erstellen
- [ ] Richtige Tore und Türen für geschlossen, geöffnet, verriegelt und Bosszugang erstellen
- [ ] Boden-Texturen mit kontrollierter Variation, Rissen, Schmutz und Übergängen produzieren
- [ ] Türrahmen, Säulen, Sockel, Gitter und Wandverzierungen ergänzen
- [ ] CSS-Platzhalter im Dungeon vollständig durch Spielgrafiken ersetzen
- [ ] Kachelränder, Skalierung und Kollisionen für alle Auflösungen prüfen
- [ ] Spätere Biome bereits im Tileset- und Ladeformat berücksichtigen

**Abnahme:** Wände und Türen sind in jeder Ausrichtung korrekt; es entstehen keine sichtbaren Nähte oder falschen Kollisionen; die Darstellung bleibt bei allen unterstützten Auflösungen stabil.

## 5. Charakter- und Startwaffenauswahl – P1

- [ ] Charakterauswahl vor Beginn eines Runs entwerfen
- [ ] Mehrere spielerisch klar unterschiedliche Charaktere definieren
- [ ] Werte, passive Fähigkeiten, Startressourcen und Schwächen jedes Charakters festlegen
- [ ] Startwaffenauswahl nach der Charakterwahl ergänzen
- [ ] Weitere Waffentypen entwickeln, zum Beispiel Schwert, Axt, Speer, Bogen, Stab oder Dolche
- [ ] Für jede Waffe eigenes Timing, Reichweite, Animation, Klang und Treffereffekt erstellen
- [ ] Freigaben und Fortschritt zwischen Runs festlegen
- [ ] Vorschau und verständliche Beschreibungen für neue Spieler anbieten

**Abnahme:** Jede Kombination startet zuverlässig; Waffen fühlen sich erkennbar unterschiedlich an; keine Wahl ist offensichtlich unspielbar oder zwingend überlegen.

## 6. Mehr Skills und Level-up-Varianten – P1

- [ ] Größeren allgemeinen Skill-Pool anlegen
- [ ] Charakterbezogene und waffenbezogene Skills ergänzen
- [ ] Synergien, Tags und mögliche Upgrade-Ketten definieren
- [ ] Seltenheiten und stärkere spätere Entwicklungsstufen einführen
- [ ] Regeln gegen nutzlose, doppelte oder widersprüchliche Angebote einbauen
- [ ] Optionales Neuwürfeln oder Sperren einzelner Angebote prüfen
- [ ] Texte, Symbole und Effekte für alle Skills vereinheitlichen
- [ ] Balance über verschiedene Builds und Run-Längen testen

**Abnahme:** Jede Auswahl erklärt ihre tatsächliche Wirkung; Angebote passen zum aktuellen Charakter; mehrere konkurrenzfähige Builds sind möglich.

## 7. Mehr Ebenen und größere Dungeon-Vielfalt – P1

- [ ] Zielzahl der Ebenen und gewünschte Dauer eines vollständigen Runs festlegen
- [ ] Mehrere optisch und spielerisch unterschiedliche Dungeon-Gebiete planen
- [ ] Weitere Raumtypen einbauen: Arena, Schatzkammer, Schrein, Falle, Rätsel, Ruheplatz, Shop und Story-Raum
- [ ] Pro Gebiet eigene Böden, Wände, Tore, Requisiten, Beleuchtung und Gefahren erstellen
- [ ] Prozedurale Regeln für Dramaturgie, Schwierigkeit und Abwechslung erweitern
- [ ] Unfaire Sackgassen, unerreichbare Räume und blockierte Ausgänge automatisch verhindern
- [ ] Ebenenübergänge, sichere Zwischenbereiche und Fortschrittsanzeige ergänzen
- [ ] Reproduzierbare Seeds für QA und Fehlerberichte beibehalten

**Abnahme:** Jeder erzeugte Dungeon ist abschließbar; verschiedene Gebiete unterscheiden sich sichtbar und spielerisch; wiederholte Runs erzeugen keine dominierende Raumfolge.

## 8. Neue Monster, Elitegegner und Bosse – P1

- [ ] Gegnerkatalog mit klaren Rollen, Angriffen, Schwächen und Gebieten erstellen
- [ ] Neue normale Monster passend zu jedem Dungeon-Gebiet entwickeln
- [ ] Elite-Modifikatoren mit sichtbaren Merkmalen und besonderen Belohnungen einführen
- [ ] Elite-Bosse als seltene, anspruchsvolle Begegnungen gestalten
- [ ] Mehrere reguläre Bosse mit eigenen Arenen, Phasen und Mechaniken entwickeln
- [ ] Boss-Telegraphen, Trefferfenster und Übergänge besonders lesbar machen
- [ ] Begegnungsgruppen und Schwierigkeitskurve über alle Ebenen balancieren
- [ ] Eigene Belohnungen, Musik und Story-Hinweise pro Boss ergänzen

**Abnahme:** Gefährliche Angriffe sind fair angekündigt; Elite- und Bossmechaniken unterscheiden sich; Begegnungen bleiben auch bei vielen Effekten lesbar und performant.

## 9. Effekt-System – P1

- [ ] Datengetriebenes, wiederverwendbares Partikel- und Effekt-System erstellen
- [ ] Objekt-Pooling und feste Leistungsbudgets für Effekte einbauen
- [ ] Feuer, Funken, Rauch, Glut, Staub und Einschläge erstellen
- [ ] Waffenspuren, Trefferblitze, Projektilspuren und Status-Effekte ergänzen
- [ ] Umgebungseffekte für Fackeln, Tore, Fallen und besondere Räume hinzufügen
- [ ] Lichteffekte, leichte Kamerabewegung und Bildschirmfeedback kontrolliert einsetzen
- [ ] Option für reduzierte Effekte und Kamerabewegung anbieten
- [ ] Wichtige gegnerische Warnsignale auch bei reduzierten Effekten erhalten

**Abnahme:** Effekte verstärken Treffer und Atmosphäre, verdecken aber keine Gefahren; längere Kämpfe erzeugen keine merklichen Speicher- oder Bildratenprobleme.

## 10. Musik und Audio-Ausbau – P2

- [ ] Zusätzliche musikalische Phrasen, Instrumentfarben und Variationen erstellen
- [ ] Eigene Themen für Dungeon-Gebiete, Lydia, Charakterauswahl und Story-Szenen hinzufügen
- [ ] Individuelle Musik für wichtige Bosse und den finalen Endboss komponieren
- [ ] Übergänge zwischen Erkundung, Kampf, Boss und Ruhe weiter verfeinern
- [ ] Kampfmusik dynamischer auf Gegnerzahl, Gefahr und Bossphasen reagieren lassen
- [ ] Weitere Geräusche für Waffen, Rüstungen, Monster, Feuer und Umgebung erstellen
- [ ] Wiederholungen, tiefes Brummen, Lautheitssprünge und hörbare Loop-Kanten in Langzeittests prüfen
- [ ] Optional später gerenderte oder lizenzierte Musikstücke evaluieren

**Abnahme:** Musik bleibt über einen vollständigen Run abwechslungsreich; Zustandswechsel sind sauber; Sprache, UI, Effekte und Musik bleiben getrennt regelbar.

## 11. Story und Finale – P1

- [ ] Zentrale Frage beantworten: Warum betritt die Spielfigur die Dungeons?
- [ ] Vorgeschichte, Ziel, persönliche Motivation und Einsatz der Reise definieren
- [ ] Rolle und Motivation von Lydia mit der Haupthandlung verbinden
- [ ] Kurze, überspringbare Einführung vor dem ersten Run erstellen
- [ ] Geschichte über Räume, Umgebungsdetails, Begegnungen und Fundstücke weitererzählen
- [ ] Pro Ebene einen klaren narrativen Fortschritt oder eine neue Enthüllung einbauen
- [ ] Bosse mit der Welt und dem finalen Konflikt verknüpfen
- [ ] Finalen Endboss, Konfrontation und verständliches Ende schreiben und inszenieren
- [ ] Texte von Beginn an lokalisierbar und unabhängig von der Spiellogik speichern

**Abnahme:** Die Motivation ist früh verständlich; Lydia und die Bosse haben eine erkennbare Funktion in der Handlung; das Ende löst die zentrale Ausgangsfrage auf.

## 12. UI, Barrierefreiheit und Komfort – P2

- [ ] Shop-, Inventar-, Ausrüstungs- und Charakterauswahl im bestehenden mittelalterlichen Stil gestalten
- [ ] Einheitliche Zahlen, Schriften, Symbole, Tooltips und Eingabehinweise verwenden
- [ ] Maus, Tastatur und später Controller vollständig unterstützen
- [ ] Textgröße, Kontrast, Lautstärke, reduzierte Effekte und reduzierte Kamerabewegung anbieten
- [ ] Gegenstands- und Skill-Vergleiche ohne verborgenes Vorwissen verständlich machen
- [ ] Bestiarium, Item-Sammlung oder Lore-Archiv als späteres Komfortziel prüfen
- [ ] Alle Oberflächen über die unterstützten Seitenverhältnisse und Auflösungen testen

**Abnahme:** Alle wichtigen Aktionen sind ohne Raten verständlich; Fokus und Navigation funktionieren mit jeder unterstützten Eingabemethode; keine Oberfläche verdeckt entscheidende Spielinformationen.

## 13. QA und Veröffentlichung – fortlaufend

- [ ] Automatisierte Tests für Käufe, Inventar, Ausrüstung, Werteberechnung und Spielstandmigration ergänzen
- [ ] Tests für Dungeon-Erzeugung, Begegnungen, Skills und Bosszustände erweitern
- [ ] Feste Screenshot-Matrix für Auflösungen, Skalierungsstufen und Seitenverhältnisse pflegen
- [ ] Langzeittests für Abstürze, Stillstände, Musik und Speicherverbrauch durchführen
- [ ] Leistungsbudgets für Gegner, Partikel, Lichter und Audio festlegen
- [ ] Inhaltsprüfung für fehlende Sprites, Animationen, Texte und Sounds automatisieren
- [ ] Credits und Lizenzen aller verwendeten oder erzeugten Assets dokumentieren
- [ ] Nach jedem abgeschlossenen Meilenstein einen spielbaren Build, Commit und GitHub-Push erstellen

## Empfohlene Umsetzungsreihenfolge

1. **Fundament:** Item-Daten, Inventar, Ausrüstung, Werte und Spielstandmigration.
2. **Erster vertikaler Ausbau:** Lydia mit einem kleinen funktionierenden Shop, einer neuen Waffe und einer Rüstung.
3. **Grafischer Referenzstandard:** Eine Spielfigur, ein Monster, eine Wandgruppe und ein Tor vollständig produzieren und technisch validieren.
4. **Progression:** Charakterwahl, Startwaffen und zusätzliche Level-up-Skills ausbauen.
5. **Content:** Weitere Gebiete, Räume, Monster, Elitegegner, Bosse und Effekte in Paketen ergänzen.
6. **Erzählung und Audio:** Einführung, Lydia-Handlung, Boss-Erzählung, Finale und gebietsspezifische Musik integrieren.
7. **Abschluss:** Balance, Barrierefreiheit, Langzeittests, Performance und Release-Politur.

## Offene Entscheidungen

- [ ] Wo und wie oft soll Lydia erscheinen?
- [ ] Bleiben Items und Gold dauerhaft erhalten oder gelten sie nur für einen Run?
- [ ] Wie viele Charaktere, Startwaffen, Gebiete und Ebenen sind für Version 1.0 vorgesehen?
- [ ] Wie lang soll ein vollständiger erfolgreicher Run ungefähr dauern?
- [ ] Sollen ausgerüstete Waffen und Rüstungen sichtbar am Charakter wechseln?
- [ ] Soll der endgültige Grafikstil eher gemalt, hochauflösendes Pixel-Art oder eine Mischung sein?
- [ ] Soll die Story linear sein oder durch mehrere Runs und freischaltbare Informationen erzählt werden?
- [ ] Gibt es ein festes Ende oder mehrere Enden abhängig von Entscheidungen und Fortschritt?

