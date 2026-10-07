# Power Topology Card

Eine frei konfigurierbare Home-Assistant-Lovelace-Custom-Card für Energieflüsse. Version 0.1 verwendet ausschließlich YAML: beliebig viele Knoten, freie Positionen und frei definierte Verbindungen. Keine fest codierte Anlagentopologie, keine automatische Energiebilanz, kein visueller Editor. Der Quellcode ist eigenständig entwickelt und steht unter der MIT-Lizenz.

## Installation

1. `npm ci` und `npm run build` ausführen (Node.js 20 oder neuer).
2. `dist/power-topology-card.js` nach `/config/www/power-topology-card.js` in Home Assistant kopieren.
3. Unter **Einstellungen → Dashboards → Ressourcen** `/local/power-topology-card.js` als **JavaScript-Modul** hinzufügen. Ressourcen lassen sich im erweiterten Benutzermodus verwalten. Bei YAML-Ressourcen:

```yaml
resources:
  - url: /local/power-topology-card.js
    type: module
```

4. Eine manuelle Karte mit folgendem YAML anlegen. Nach Updates Browser-Cache aktualisieren.

### HACS-Vorbereitung

`hacs.json` und das Browser-Bundle sind für eine spätere HACS-Veröffentlichung vorbereitet. Für Releases die gebaute Datei `dist/power-topology-card.js` als Release-Asset `power-topology-card.js` anhängen. Dieses Projekt ist noch nicht im HACS-Standardkatalog veröffentlicht. Nach Veröffentlichung kann das Repository als benutzerdefiniertes Dashboard-Repository hinzugefügt werden.

## Beispiel

Alle `sensor.placeholder_*` sind ausdrücklich Platzhalter und müssen durch eigene Entities ersetzt werden.

```yaml
type: custom:power-topology-card
title: Energiefluss
nodes:
  - id: solar
    type: solar
    name: PV
    x: 10
    y: 30
    power: sensor.placeholder_solar_power
  - id: battery
    type: battery
    name: Speicher
    x: 50
    y: 50
    power: sensor.placeholder_battery_power
    soc: sensor.placeholder_battery_soc
    entity: sensor.placeholder_battery_soc
  - id: home
    type: home
    name: Haus
    x: 90
    y: 30
connections:
  - from: solar
    to: battery
    entity: sensor.placeholder_solar_to_battery_power
  - from: battery
    to: home
    entity: sensor.placeholder_battery_to_home_power
```

Die [vollständige Beispielkonfiguration](examples/first-installation.yaml) zeigt vier PV-Knoten, zwei Speicherketten, einen gemeinsamen Wechselrichter sowie Haus und Netz. Die Topologie existiert ausschließlich in dieser YAML-Datei.

## Kartenoptionen

| Option | Bedeutung |
| --- | --- |
| `type` | Erforderlich: `custom:power-topology-card` |
| `title` | Optionaler Titel |
| `nodes` | Erforderliche, nicht leere Liste von Knoten |
| `connections` | Optionale Liste von Verbindungen |

## Node-Optionen

| Option | Bedeutung |
| --- | --- |
| `id` | Erforderlicher eindeutiger String; Referenz für Verbindungen |
| `type` | Erforderlich: `solar`, `battery`, `inverter`, `home`, `grid`, `generic` |
| `name` | Anzeigename; Standard ist `id` |
| `x`, `y` | Erforderliche Zahlen von 0 bis 100; links → rechts, oben → unten. Ein Innenrand schützt die Knoten am Kartenrand. |
| `power` | Optionale Entity für den angezeigten Leistungswert |
| `soc` | Optionale Entity für den SoC in Prozent, nur bei `battery` |
| `entity` | Optionale Entity, deren Home-Assistant-More-info-Dialog beim Klick geöffnet wird |
| `icon` | Optionales MDI-Icon; überschreibt das zum Typ passende Standardicon |

## Connection-Optionen

| Option | Bedeutung |
| --- | --- |
| `from` | Erforderliche vorhandene Node-ID |
| `to` | Erforderliche vorhandene, andere Node-ID |
| `entity` | Optionale Entity für genau diese Verbindung |

Positive Leistung bewegt Flusspunkte von `from` nach `to`; negative Leistung kehrt die Richtung um. Der angezeigte Wert behält sein Vorzeichen. Bei 0 W gibt es keine Flusspunkte. Ohne Entity erscheint nur die statische Verbindung. Fehlende Entities, `unknown`, `unavailable`, nicht numerische Werte und ungeeignete Einheiten ergeben „—“ und keine Animation. W, kW und MW werden als Watt angezeigt; Werte ohne Einheit werden als Watt interpretiert. SoC-Sensoren müssen Prozent liefern.

**Jede Verbindung verwendet ausschließlich ihren eigenen Sensor.** Node-Leistung und SoC dienen nur der Anzeige. Die Karte leitet keine Leistung aus benachbarten Knoten ab und berechnet keine Bilanz. Für Import/Export einen vorzeichenbehafteten Sensor passend zur gewählten Orientierung verwenden.

## Darstellung und Grenzen der v0.1

Kreisförmige Knoten liegen über einer SVG-Verbindungsebene. Home-Assistant-Theme-Variablen steuern Hintergrund, Text, Icons und Flusspunkte; dunkle Fallback-Farben sind vorhanden. Die Karte skaliert mit dem verfügbaren Platz. Unter 560 px Breite lässt sich die Topologie horizontal scrollen, damit Werte lesbar bleiben. Die Einstellung „reduzierte Bewegung“ des Betriebssystems unterdrückt Flusspunkte.

Verbindungen sind gerade Linien ohne automatisches Routing oder Kollisionsvermeidung. Knoten, Namen und Werte sollten mit genügend Abstand platziert werden. Bei überlappenden oder sehr nahen Knoten (Abstand ≤ einem Knotendurchmesser) wird die verdeckte Verbindung nicht gezeichnet. Parallele Verbindungen können sich überlagern. Es gibt keine automatische Layoutoptimierung oder praktische Obergrenze für die YAML-Listen; sehr große Graphen benötigen entsprechend Platz und Browserleistung.

## Entwicklung

```sh
npm ci
npm test
npm run build
```

`src/model.js` enthält Konfigurationsvalidierung, Sensor-Auswertung und Geometrie. `src/power-topology-card.js` registriert das Custom Element und rendert die Karte. `dist/power-topology-card.js` ist ein eigenständiges ES-Modul ohne externe Browser-Abhängigkeiten. Tests prüfen auch DOM-Rendering, Animationen und More-info-Ereignisse; ein abschließender visueller Test in einer echten Home-Assistant-Installation wird empfohlen.
