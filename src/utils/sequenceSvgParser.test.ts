import { describe, expect, test, vi } from 'vitest';
import { calculateSequenceSvgBounds } from './sequenceSvgParser';

describe('sequenceSvgParser', () => {
  test('calculates bounds when mirrorActors is true (default)', () => {
    // mock DOM with top and bottom actors
    const viewport = document.createElement('div');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    viewport.appendChild(svg);

    // Create top actor
    const topActor = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    topActor.classList.add('actor');
    vi.spyOn(topActor, 'getBoundingClientRect').mockReturnValue({
      left: 100, right: 200, top: 50, bottom: 90, width: 100, height: 40, x: 100, y: 50, toJSON: () => {}
    } as DOMRect);
    viewport.appendChild(topActor);

    // Create bottom actor
    const bottomActor = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    bottomActor.classList.add('actor');
    vi.spyOn(bottomActor, 'getBoundingClientRect').mockReturnValue({
      left: 100, right: 200, top: 400, bottom: 440, width: 100, height: 40, x: 100, y: 400, toJSON: () => {}
    } as DOMRect);
    viewport.appendChild(bottomActor);

    vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue({
      left: 0, right: 1000, top: 0, bottom: 1000, width: 1000, height: 1000, x: 0, y: 0, toJSON: () => {}
    } as DOMRect);

    const parsedParticipants = [{ id: 'Alice', alias: 'Alice', type: 'participant' }];
    const result = calculateSequenceSvgBounds(viewport, parsedParticipants, [], 1);
    expect(result.participants).toHaveLength(1);
    expect(result.participants[0].lifelineBottom).toBe(400); // botY
  });

  test('calculates bounds when mirrorActors is false (fallback line)', () => {
    // mock DOM with only top actor and vertical line
    const viewport = document.createElement('div');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    viewport.appendChild(svg);

    // Create top actor
    const topActor = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    topActor.classList.add('actor');
    vi.spyOn(topActor, 'getBoundingClientRect').mockReturnValue({
      left: 100, right: 200, top: 50, bottom: 90, width: 100, height: 40, x: 100, y: 50, toJSON: () => {}
    } as DOMRect);
    viewport.appendChild(topActor);

    // Create vertical line element representing lifeline
    const lifeline = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    lifeline.setAttribute('class', 'actor-line');
    vi.spyOn(lifeline, 'getBoundingClientRect').mockReturnValue({
      left: 149, right: 151, top: 90, bottom: 500, width: 2, height: 410, x: 149, y: 90, toJSON: () => {}
    } as DOMRect);
    viewport.appendChild(lifeline);

    vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue({
      left: 0, right: 1000, top: 0, bottom: 1000, width: 1000, height: 1000, x: 0, y: 0, toJSON: () => {}
    } as DOMRect);

    const parsedParticipants = [{ id: 'Alice', alias: 'Alice', type: 'participant' }];
    const result = calculateSequenceSvgBounds(viewport, parsedParticipants, [], 1);
    expect(result.participants).toHaveLength(1);
    expect(result.participants[0].lifelineBottom).toBe(500); // bottom of vertical line
  });

  test('ignores display:none actors and calculates correct coordinates at 2.5x zoom', () => {
    const viewport = document.createElement('div');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    viewport.appendChild(svg);

    // Create top actor
    const topActor = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    topActor.classList.add('actor');
    vi.spyOn(topActor, 'getBoundingClientRect').mockReturnValue({
      left: 250, right: 500, top: 125, bottom: 225, width: 250, height: 100, x: 250, y: 125, toJSON: () => {}
    } as DOMRect);
    viewport.appendChild(topActor);

    // Create a hidden bottom actor (width & height = 0)
    const hiddenActor = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    hiddenActor.classList.add('actor');
    vi.spyOn(hiddenActor, 'getBoundingClientRect').mockReturnValue({
      left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => {}
    } as DOMRect);
    viewport.appendChild(hiddenActor);

    // Create a lifeline element that matches
    const lifeline = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    lifeline.setAttribute('class', 'actor-line');
    vi.spyOn(lifeline, 'getBoundingClientRect').mockReturnValue({
      left: 372.5, right: 377.5, top: 225, bottom: 1250, width: 5, height: 1025, x: 372.5, y: 225, toJSON: () => {}
    } as DOMRect);
    viewport.appendChild(lifeline);

    vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue({
      left: 0, right: 2500, top: 0, bottom: 2500, width: 2500, height: 2500, x: 0, y: 0, toJSON: () => {}
    } as DOMRect);

    const parsedParticipants = [{ id: 'Alice', alias: 'Alice', type: 'participant' }];
    // Run at zoom = 2.5
    const result = calculateSequenceSvgBounds(viewport, parsedParticipants, [], 2.5);
    
    expect(result.participants).toHaveLength(1);
    // topActor unscaled x should be: left / zoom = 250 / 2.5 = 100
    expect(result.participants[0].x).toBe(100);
    // lifelineBottom should be: lineRect.bottom / zoom = 1250 / 2.5 = 500
    expect(result.participants[0].lifelineBottom).toBe(500);
  });
});
