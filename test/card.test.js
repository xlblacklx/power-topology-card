import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { validateConfig, powerWatts, connectionGeometry } from '../src/model.js';

const window = new Window();
for (const key of ['window', 'document', 'HTMLElement', 'customElements', 'CustomEvent']) globalThis[key] = window[key];
await import('../src/power-topology-card.js');
const config = {
  nodes: [
    { id: 'a', type: 'battery', x: 10, y: 50, name: '<img src=x>', power: 'sensor.node', soc: 'sensor.soc', entity: 'sensor.soc' },
    { id: 'b', type: 'home', x: 90, y: 50 },
  ],
  connections: [{ from: 'a', to: 'b', entity: 'sensor.flow' }],
};
const hass = value => ({ states: {
  'sensor.flow': { state: String(value), attributes: { unit_of_measurement: 'W' } },
  'sensor.node': { state: '2', attributes: { unit_of_measurement: 'kW' } },
  'sensor.soc': { state: '75', attributes: { unit_of_measurement: '%' } },
} });

test('validates graph without prescribing a topology', () => {
  assert.equal(validateConfig(config).connections.length, 1);
  assert.throws(() => validateConfig({ nodes: [] }));
  assert.throws(() => validateConfig({ ...config, nodes: [config.nodes[0], config.nodes[0]] }));
  assert.throws(() => validateConfig({ ...config, connections: [{ from: 'missing', to: 'b' }] }));
  assert.throws(() => validateConfig({ nodes: [{ id: 'x', type: 'generic', x: -1, y: 0 }] }));
  assert.throws(() => validateConfig({ nodes: [{ id: 'x', type: '__proto__', x: 0, y: 0 }] }));
  assert.equal(validateConfig({ nodes: [{ id: 'x', type: 'generic', x: 0, y: 100 }] }).connections.length, 0);
});

test('normalizes power and rejects unavailable states and non-power units', () => {
  assert.equal(powerWatts(hass(100), 'sensor.node'), 2000);
  for (const value of ['unknown', 'unavailable', '', 'Infinity', 'oops']) assert.equal(powerWatts(hass(value), 'sensor.flow'), null);
  assert.equal(powerWatts(hass(1), 'sensor.missing'), null);
  assert.equal(powerWatts(hass(1), 'sensor.soc'), null);
  assert.equal(connectionGeometry(config.nodes[0], config.nodes[0]), null);
});

test('renders safe labels, node sensors, directional dots and more-info', () => {
  const card = document.createElement('power-topology-card');
  card.hass = hass(120);
  card.setConfig(config);
  document.body.append(card);
  const root = card.shadowRoot;
  assert.equal(root.querySelectorAll('.node').length, 2);
  assert.equal(root.querySelector('.name').textContent, '<img src=x>');
  assert.equal(root.querySelector('img'), null);
  assert.equal(root.querySelector('.power').textContent, '2,000 W');
  assert.equal(root.querySelector('.soc').textContent, '75 %');
  assert.equal(root.querySelector('.flow-label').textContent, '120 W');
  assert.equal(root.querySelectorAll('.dot').length, 3);
  const forward = root.querySelector('animateMotion').getAttribute('path');
  const firstDot = root.querySelector('.dot');
  card.hass = hass(150);
  assert.equal(root.querySelector('.dot'), firstDot, 'same direction preserves animation');
  card.hass = hass(-120);
  assert.notEqual(root.querySelector('animateMotion').getAttribute('path'), forward);
  assert.equal(root.querySelector('.flow-label').textContent, '-120 W');
  for (const value of [0, 'unavailable']) {
    card.hass = hass(value);
    assert.equal(root.querySelectorAll('.dot').length, 0);
  }
  let event;
  card.addEventListener('hass-more-info', e => { event = e; });
  root.querySelector('button').click();
  assert.equal(event.detail.entityId, 'sensor.soc');
  assert.equal(event.composed, true);
  assert.equal(event.bubbles, true);
  card.setConfig({ ...config, connections: [{ from: 'a', to: 'b' }] });
  card.hass = hass(999);
  assert.equal(card.shadowRoot.querySelectorAll('.dot').length, 0);
  assert.equal(card.shadowRoot.querySelector('.flow-label'), null);
  card.remove();
});
