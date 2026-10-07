export const TYPES = {
  solar: 'mdi:solar-power', battery: 'mdi:battery', inverter: 'mdi:current-dc',
  home: 'mdi:home', grid: 'mdi:transmission-tower', generic: 'mdi:circle-outline',
};

export function validateConfig(config) {
  if (!config || !Array.isArray(config.nodes) || !config.nodes.length) {
    throw new Error('Power Topology Card: nodes must be a non-empty array.');
  }
  const ids = new Set();
  for (const node of config.nodes) {
    if (!node || typeof node.id !== 'string' || !node.id.trim() || ids.has(node.id)) {
      throw new Error('Power Topology Card: each node needs a unique, non-empty id.');
    }
    ids.add(node.id);
    if (!Object.hasOwn(TYPES, node.type)) throw new Error(`Unknown node type: ${node.type}`);
    for (const key of ['x', 'y']) {
      if (!Number.isFinite(node[key]) || node[key] < 0 || node[key] > 100) {
        throw new Error(`Node ${node.id}: ${key} must be a number from 0 to 100.`);
      }
    }
    for (const key of ['name', 'power', 'soc', 'entity', 'icon']) {
      if (node[key] !== undefined && typeof node[key] !== 'string') throw new Error(`Node ${node.id}: ${key} must be a string.`);
    }
  }
  if (config.connections !== undefined && !Array.isArray(config.connections)) throw new Error('connections must be an array.');
  for (const connection of config.connections || []) {
    if (!connection || !ids.has(connection.from) || !ids.has(connection.to)) throw new Error('Connection endpoints must reference existing nodes.');
    if (connection.from === connection.to) throw new Error('A connection must join two different nodes.');
    if (connection.entity !== undefined && typeof connection.entity !== 'string') throw new Error('Connection entity must be a string.');
  }
  if (config.title !== undefined && typeof config.title !== 'string') throw new Error('title must be a string.');
  return { ...config, nodes: config.nodes.map(n => ({ ...n })), connections: (config.connections || []).map(c => ({ ...c })) };
}

export function numericState(hass, entity) {
  const state = hass?.states?.[entity];
  if (!state || typeof state.state !== 'string' || !state.state.trim()) return null;
  const value = Number(state.state);
  return Number.isFinite(value) ? value : null;
}

export function powerWatts(hass, entity) {
  const value = numericState(hass, entity);
  if (value === null) return null;
  const unit = hass.states[entity].attributes?.unit_of_measurement;
  if (unit === 'kW') return value * 1000;
  if (unit === 'MW') return value * 1000000;
  if (unit && unit !== 'W') return null;
  return value;
}

export function connectionGeometry(from, to) {
  const x1 = 60 + from.x * 8.8, y1 = 60 + from.y * 4.8;
  const x2 = 60 + to.x * 8.8, y2 = 60 + to.y * 4.8;
  const length = Math.hypot(x2 - x1, y2 - y1);
  if (length <= 84) return null;
  const dx = (x2 - x1) / length, dy = (y2 - y1) / length;
  return { x1: x1 + dx * 42, y1: y1 + dy * 42, x2: x2 - dx * 42, y2: y2 - dy * 42, mx: (x1 + x2) / 2, my: (y1 + y2) / 2 };
}
