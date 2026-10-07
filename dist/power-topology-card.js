// src/model.js
var TYPES = {
  solar: "mdi:solar-power",
  battery: "mdi:battery",
  inverter: "mdi:current-dc",
  home: "mdi:home",
  grid: "mdi:transmission-tower",
  generic: "mdi:circle-outline"
};
function validateConfig(config) {
  if (!config || !Array.isArray(config.nodes) || !config.nodes.length) {
    throw new Error("Power Topology Card: nodes must be a non-empty array.");
  }
  const ids = /* @__PURE__ */ new Set();
  for (const node of config.nodes) {
    if (!node || typeof node.id !== "string" || !node.id.trim() || ids.has(node.id)) {
      throw new Error("Power Topology Card: each node needs a unique, non-empty id.");
    }
    ids.add(node.id);
    if (!Object.hasOwn(TYPES, node.type)) throw new Error(`Unknown node type: ${node.type}`);
    for (const key of ["x", "y"]) {
      if (!Number.isFinite(node[key]) || node[key] < 0 || node[key] > 100) {
        throw new Error(`Node ${node.id}: ${key} must be a number from 0 to 100.`);
      }
    }
    for (const key of ["name", "power", "soc", "entity", "icon"]) {
      if (node[key] !== void 0 && typeof node[key] !== "string") throw new Error(`Node ${node.id}: ${key} must be a string.`);
    }
  }
  if (config.connections !== void 0 && !Array.isArray(config.connections)) throw new Error("connections must be an array.");
  for (const connection of config.connections || []) {
    if (!connection || !ids.has(connection.from) || !ids.has(connection.to)) throw new Error("Connection endpoints must reference existing nodes.");
    if (connection.from === connection.to) throw new Error("A connection must join two different nodes.");
    if (connection.entity !== void 0 && typeof connection.entity !== "string") throw new Error("Connection entity must be a string.");
  }
  if (config.title !== void 0 && typeof config.title !== "string") throw new Error("title must be a string.");
  return { ...config, nodes: config.nodes.map((n) => ({ ...n })), connections: (config.connections || []).map((c) => ({ ...c })) };
}
function numericState(hass, entity) {
  const state = hass?.states?.[entity];
  if (!state || typeof state.state !== "string" || !state.state.trim()) return null;
  const value = Number(state.state);
  return Number.isFinite(value) ? value : null;
}
function powerWatts(hass, entity) {
  const value = numericState(hass, entity);
  if (value === null) return null;
  const unit = hass.states[entity].attributes?.unit_of_measurement;
  if (unit === "kW") return value * 1e3;
  if (unit === "MW") return value * 1e6;
  if (unit && unit !== "W") return null;
  return value;
}
function connectionGeometry(from, to) {
  const x1 = 60 + from.x * 8.8, y1 = 60 + from.y * 4.8;
  const x2 = 60 + to.x * 8.8, y2 = 60 + to.y * 4.8;
  const length = Math.hypot(x2 - x1, y2 - y1);
  if (length <= 84) return null;
  const dx = (x2 - x1) / length, dy = (y2 - y1) / length;
  return { x1: x1 + dx * 42, y1: y1 + dy * 42, x2: x2 - dx * 42, y2: y2 - dy * 42, mx: (x1 + x2) / 2, my: (y1 + y2) / 2 };
}

// src/power-topology-card.js
var SVG = "http://www.w3.org/2000/svg";
var format = (value) => value === null ? "\u2014" : new Intl.NumberFormat(void 0, { maximumFractionDigits: 1 }).format(value);
function svgElement(tag, attributes = {}) {
  const el = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attributes)) el.setAttribute(key, String(value));
  return el;
}
var PowerTopologyCard = class extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }
  setConfig(config) {
    this._config = validateConfig(config);
    this.render();
  }
  set hass(hass) {
    this._hass = hass;
    this.updateValues();
  }
  getCardSize() {
    return 6;
  }
  getGridOptions() {
    return { columns: 12, rows: 6, min_columns: 6, min_rows: 4 };
  }
  render() {
    if (!this._config) return;
    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; }
        ha-card { overflow:hidden; background:var(--ha-card-background,var(--card-background-color,#151b24)); color:var(--primary-text-color,#e9eef5); }
        .title { margin:0; padding:20px 20px 0; font-size:20px; font-weight:500; }
        .viewport { width:100%; overflow-x:auto; }
        .topology { position:relative; min-width:560px; width:100%; aspect-ratio:5/3; }
        svg { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; }
        .wire { stroke:var(--divider-color,#374151); stroke-width:2; }
        .dot { fill:var(--energy-grid-consumption-color,var(--primary-color,#4da6ff)); }
        .label-bg { fill:var(--ha-card-background,var(--card-background-color,#151b24)); }
        .flow-label { fill:var(--secondary-text-color,#aeb9c8); font:14px sans-serif; text-anchor:middle; }
        .node { position:absolute; transform:translate(-50%,-50%); width:8.4%; aspect-ratio:1; border:2px solid var(--divider-color,#374151); border-radius:50%; box-sizing:border-box; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; background:var(--ha-card-background,var(--card-background-color,#151b24)); box-shadow:0 2px 12px #0003; color:var(--primary-text-color,#e9eef5); padding:3px; font:inherit; }
        button.node { cursor:pointer; }
        button.node:focus-visible { outline:3px solid var(--primary-color,#4da6ff); outline-offset:3px; }
        .node ha-icon { --mdc-icon-size:22px; color:var(--primary-color,#4da6ff); }
        .solar ha-icon { color:var(--energy-solar-color,#ffca55); }
        .battery ha-icon { color:var(--energy-battery-out-color,#4ec9a0); }
        .home ha-icon { color:var(--energy-grid-consumption-color,#4da6ff); }
        .name { position:absolute; top:calc(100% + 6px); width:160%; text-align:center; overflow-wrap:anywhere; font-size:12px; line-height:1.2; }
        .power, .soc { font-size:11px; line-height:1.2; white-space:nowrap; }
        .soc { color:var(--secondary-text-color,#aeb9c8); }
        @media (prefers-reduced-motion:reduce) { .dot { display:none; } }
      </style>
      <ha-card><div class="viewport"><div class="topology"></div></div></ha-card>`;
    const card = this.shadowRoot.querySelector("ha-card");
    if (this._config.title) {
      const title = document.createElement("h2");
      title.className = "title";
      title.textContent = this._config.title;
      card.prepend(title);
    }
    const canvas = this.shadowRoot.querySelector(".topology");
    const svg = svgElement("svg", { viewBox: "0 0 1000 600", "aria-hidden": "true" });
    canvas.append(svg);
    const nodes = new Map(this._config.nodes.map((n) => [n.id, n]));
    this._flows = this._config.connections.map((connection) => {
      const geometry = connectionGeometry(nodes.get(connection.from), nodes.get(connection.to));
      if (!geometry) return { connection };
      const { x1, y1, x2, y2, mx, my } = geometry;
      const group = svgElement("g");
      group.append(svgElement("line", { x1, y1, x2, y2, class: "wire" }));
      const label = svgElement("text", { x: mx, y: my - 9, class: "flow-label" });
      if (connection.entity) {
        group.append(svgElement("rect", { x: mx - 55, y: my - 25, width: 110, height: 22, rx: 6, class: "label-bg" }), label);
      }
      svg.append(group);
      return { connection, geometry, group, label, direction: null };
    });
    this._nodes = this._config.nodes.map((node) => {
      const el = document.createElement(node.entity ? "button" : "div");
      el.className = `node ${node.type}`;
      el.style.left = `${6 + node.x * 0.88}%`;
      el.style.top = `${10 + node.y * 0.8}%`;
      const name = node.name || node.id;
      const icon = document.createElement("ha-icon");
      icon.setAttribute("icon", node.icon || TYPES[node.type]);
      const caption = document.createElement("span");
      caption.className = "name";
      caption.textContent = name;
      el.append(icon, caption);
      let power, soc;
      if (node.power) {
        power = document.createElement("span");
        power.className = "power";
        el.append(power);
      }
      if (node.type === "battery" && node.soc) {
        soc = document.createElement("span");
        soc.className = "soc";
        el.append(soc);
      }
      if (node.entity) {
        el.type = "button";
        el.setAttribute("aria-label", `${name}: More info`);
        el.addEventListener("click", () => this.dispatchEvent(new CustomEvent("hass-more-info", {
          detail: { entityId: node.entity },
          bubbles: true,
          composed: true
        })));
      }
      canvas.append(el);
      return { node, el, power, soc };
    });
    this.updateValues();
  }
  updateValues() {
    if (!this._config || !this._nodes) return;
    for (const { node, el, power, soc } of this._nodes) {
      if (power) power.textContent = `${format(powerWatts(this._hass, node.power))} W`;
      if (soc) soc.textContent = `${format(numericState(this._hass, node.soc))} %`;
      el.title = [node.name || node.id, power?.textContent, soc?.textContent].filter(Boolean).join(" \xB7 ");
    }
    for (const flow of this._flows) {
      if (!flow.geometry) continue;
      const watts = powerWatts(this._hass, flow.connection.entity);
      flow.label.textContent = `${format(watts)} W`;
      const direction = watts === null || watts === 0 ? 0 : Math.sign(watts);
      if (flow.direction === direction) continue;
      flow.direction = direction;
      flow.group.querySelectorAll(".dot").forEach((dot) => dot.remove());
      if (!direction) continue;
      const { x1, y1, x2, y2 } = flow.geometry;
      const path = direction > 0 ? `M ${x1} ${y1} L ${x2} ${y2}` : `M ${x2} ${y2} L ${x1} ${y1}`;
      for (let i = 0; i < 3; i++) {
        const dot = svgElement("circle", { r: 3.5, class: "dot" });
        dot.append(svgElement("animateMotion", { path, dur: "2.4s", begin: `${-i * 0.8}s`, repeatCount: "indefinite" }));
        flow.group.append(dot);
      }
    }
  }
};
if (!customElements.get("power-topology-card")) customElements.define("power-topology-card", PowerTopologyCard);
window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === "power-topology-card")) {
  window.customCards.push({ type: "power-topology-card", name: "Power Topology Card", description: "Freely configurable energy nodes and connections." });
}
