import { describe, expect, it, beforeEach, vi } from 'vitest';
import { Input } from '../src/core/input';

// The module reads localStorage for saved key bindings; give it a stub so the
// tests exercise the default layout in a plain Node environment.
beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => {},
  });
});

/**
 * These tests drive the real keyboard path (`keyDown`/`keyUp`), not the
 * scripted-input path. That distinction matters: an earlier version of
 * `beginTick` snapshotted the previous state from the *current* held set, which
 * left `pressed()` permanently false for keyboard and gamepad while the
 * scripted path kept working — so Start, Jump, Grenade and Pause were all dead
 * in the browser while the headless run passed.
 */
describe('edge detection on the real keyboard path', () => {
  it('reports a key as pressed on exactly one tick', () => {
    const input = new Input();

    input.keyDown('Enter');
    input.beginTick();
    expect(input.down('start')).toBe(true);
    expect(input.pressed('start')).toBe(true);

    // Still held, but no longer a new press.
    input.beginTick();
    expect(input.down('start')).toBe(true);
    expect(input.pressed('start')).toBe(false);

    input.keyUp('Enter');
    input.beginTick();
    expect(input.down('start')).toBe(false);
    expect(input.released('start')).toBe(true);
  });

  it('detects a press even when the key arrives between two ticks', () => {
    const input = new Input();
    input.beginTick();
    expect(input.pressed('jump')).toBe(false);

    input.keyDown('KeyC');
    input.beginTick();
    expect(input.pressed('jump')).toBe(true);
  });

  it('registers a fresh press after the key is released and hit again', () => {
    const input = new Input();
    for (let round = 0; round < 3; round++) {
      input.keyDown('KeyV');
      input.beginTick();
      expect(input.pressed('grenade')).toBe(true);
      input.keyUp('KeyV');
      input.beginTick();
      expect(input.pressed('grenade')).toBe(false);
    }
  });

  it('maps every default binding to its button', () => {
    const input = new Input();
    const cases: Array<[string, Parameters<Input['down']>[0]]> = [
      ['ArrowLeft', 'left'], ['KeyA', 'left'],
      ['ArrowRight', 'right'], ['KeyD', 'right'],
      ['ArrowUp', 'up'], ['KeyW', 'up'],
      ['ArrowDown', 'down'], ['KeyS', 'down'],
      ['KeyX', 'shoot'], ['KeyC', 'jump'], ['KeyV', 'grenade'],
      ['Enter', 'start'], ['Space', 'start'],
      ['KeyP', 'pause'], ['Escape', 'pause'],
    ];
    for (const [code, button] of cases) {
      input.keyDown(code);
      input.beginTick();
      expect(input.down(button), `${code} should map to ${button}`).toBe(true);
      input.keyUp(code);
      input.beginTick();
    }
  });

  it('ignores keys that are not bound', () => {
    const input = new Input();
    expect(input.keyDown('KeyQ')).toBe(false);
    input.beginTick();
    expect(input.anyPressed()).toBe(false);
  });

  it('reports the stick axes from the held direction keys', () => {
    const input = new Input();
    input.keyDown('ArrowRight');
    input.keyDown('ArrowUp');
    input.beginTick();
    expect(input.ax).toBe(1);
    expect(input.ay).toBe(-1);

    // Opposing keys cancel rather than sticking to one side.
    input.keyDown('ArrowLeft');
    input.beginTick();
    expect(input.ax).toBe(0);
  });

  it('drops all held buttons when the window loses focus', () => {
    const input = new Input();
    input.keyDown('ArrowRight');
    input.beginTick();
    expect(input.down('right')).toBe(true);
    input.clear();
    input.beginTick();
    expect(input.down('right')).toBe(false);
  });

  it('still detects edges when driven by the scripted runner', () => {
    const input = new Input();
    input.setScripted(new Set(['shoot']));
    input.beginTick();
    expect(input.pressed('shoot')).toBe(true);
    input.beginTick();
    expect(input.pressed('shoot')).toBe(false);

    input.setScripted(new Set([]));
    input.beginTick();
    expect(input.down('shoot')).toBe(false);
  });
});
