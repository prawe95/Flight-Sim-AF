import * as THREE from 'three';

/**
 * Tactical Radar Minimap
 * Renders top-down situational awareness radar:
 * - Player position & heading
 * - Runway alignment
 * - City skyline boundaries
 * - Radar sweep beam
 */
export class Minimap {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.size = 190;
    this.canvas.width = this.size;
    this.canvas.height = this.size;

    // Scale: radar radius shows 6000 meters
    this.radarRange = 6000;
    this.sweepAngle = 0;
  }

  render(airplane, runway, city) {
    const ctx = this.ctx;
    const s = this.size;
    const cx = s / 2;
    const cy = s / 2;
    const radius = (s / 2) - 10;

    ctx.clearRect(0, 0, s, s);

    // Save clip to circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    // Dark radar background
    ctx.fillStyle = 'rgba(6, 18, 14, 0.85)';
    ctx.fillRect(0, 0, s, s);

    // Coordinate conversion: World (X, Z) to Radar (px, py)
    const planePos = airplane.physics.position;
    const toRadarX = (wx) => cx + ((wx - planePos.x) / this.radarRange) * radius;
    const toRadarY = (wz) => cy + ((wz - planePos.z) / this.radarRange) * radius;

    // 1. City Zone Rectangle
    if (city) {
      const cityX1 = toRadarX(city.originX - city.cityWidth / 2);
      const cityY1 = toRadarY(city.originZ - city.cityLength / 2);
      const cityX2 = toRadarX(city.originX + city.cityWidth / 2);
      const cityY2 = toRadarY(city.originZ + city.cityLength / 2);

      ctx.fillStyle = 'rgba(0, 200, 255, 0.12)';
      ctx.fillRect(Math.min(cityX1, cityX2), Math.min(cityY1, cityY2), Math.abs(cityX2 - cityX1), Math.abs(cityY2 - cityY1));
      ctx.strokeStyle = 'rgba(0, 200, 255, 0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.min(cityX1, cityX2), Math.min(cityY1, cityY2), Math.abs(cityX2 - cityX1), Math.abs(cityY2 - cityY1));

      ctx.font = '9px monospace';
      ctx.fillStyle = 'rgba(0, 220, 255, 0.6)';
      ctx.fillText('METROPOLIS', Math.min(cityX1, cityX2) + 4, Math.min(cityY1, cityY2) + 12);
    }

    // 2. Runway
    if (runway) {
      const rX = toRadarX(0);
      const rY1 = toRadarY(-runway.length / 2);
      const rY2 = toRadarY(runway.length / 2);

      ctx.strokeStyle = '#00ffaa';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(rX, rY1);
      ctx.lineTo(rX, rY2);
      ctx.stroke();

      ctx.font = '9px monospace';
      ctx.fillStyle = '#00ffaa';
      ctx.fillText('RWY 09L', rX + 4, rY1 + 10);
    }

    // 3. Rotating Radar Sweep Beam
    this.sweepAngle += 0.035;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.sweepAngle);
    const sweepGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    sweepGrad.addColorStop(0, 'rgba(0, 255, 170, 0.35)');
    sweepGrad.addColorStop(1, 'rgba(0, 255, 170, 0.0)');
    ctx.fillStyle = sweepGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, 0, 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 4. Radar Range Rings
    ctx.strokeStyle = 'rgba(0, 255, 170, 0.25)';
    ctx.lineWidth = 1;
    [0.35, 0.7, 1.0].forEach((ratio) => {
      ctx.beginPath();
      ctx.arc(cx, cy, radius * ratio, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Crosshairs
    ctx.beginPath();
    ctx.moveTo(cx, cy - radius);
    ctx.lineTo(cx, cy + radius);
    ctx.moveTo(cx - radius, cy);
    ctx.lineTo(cx + radius, cy);
    ctx.stroke();

    // 5. Player Icon at Center (Rotated to plane heading)
    ctx.save();
    ctx.translate(cx, cy);
    const headingRad = THREE.MathUtils.degToRad(airplane.physics.heading);
    ctx.rotate(headingRad);

    ctx.fillStyle = '#ffff00';
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(-6, 7);
    ctx.lineTo(0, 4);
    ctx.lineTo(6, 7);
    ctx.closePath();
    ctx.fill();

    // Heading line
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(0, -22);
    ctx.stroke();

    ctx.restore();

    ctx.restore(); // Restore unclipped

    // Outer border & label
    ctx.strokeStyle = '#00ffaa';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.font = '10px monospace';
    ctx.fillStyle = '#00ffaa';
    ctx.textAlign = 'center';
    ctx.fillText('RADAR 6KM', cx, s - 2);
  }
}
