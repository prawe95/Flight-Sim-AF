import * as THREE from 'three';

/**
 * Modern Glass Cockpit Heads-Up Display (HUD)
 * Renders high-fidelity military/aerospace flight symbology directly to a 2D canvas:
 * - Pitch ladder & Horizon line
 * - Velocity vector / Flight path marker
 * - Airspeed tape & Mach readout
 * - Altitude tape & Radar altimeter (AGL)
 * - Heading compass tape
 * - G-force meter & G-blackout/redout effects
 * - Stall & Terrain warnings
 * - ILS glideslope crosshairs
 */
export class HUD {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');

    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.resize();

    // Primary HUD neon cyan/green color
    this.hudColor = '#00ffaa';
    this.hudWarningColor = '#ff3333';
    this.hudCautionColor = '#ffaa00';
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  render(airplane, runway, camera) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const cx = w / 2;
    const cy = h / 2;

    ctx.clearRect(0, 0, w, h);

    const phys = airplane.physics;
    const isStalling = phys.isStalling;

    // 1. High-G Blackout / Redout Vignette
    this._drawGForceVignette(ctx, w, h, phys.gForce);

    // Save state for HUD elements
    ctx.save();
    ctx.strokeStyle = this.hudColor;
    ctx.fillStyle = this.hudColor;
    ctx.lineWidth = 1.8;
    ctx.shadowColor = 'rgba(0, 255, 170, 0.45)';
    ctx.shadowBlur = 6;
    ctx.font = '600 13px "Courier New", monospace';

    // 2. Pitch Ladder & Horizon Line (Rotates with plane roll, slides with pitch)
    this._drawPitchLadder(ctx, cx, cy, phys.pitchDeg, phys.rollDeg);

    // 3. Flight Path Marker (Velocity Vector)
    this._drawVelocityVector(ctx, cx, cy, airplane, camera);

    // 4. Center Boresight Crosshair
    this._drawBoresight(ctx, cx, cy);

    // 5. Airspeed Tape (Left Side)
    this._drawAirspeedTape(ctx, cx - 220, cy, phys.airspeedKnots, phys.mach);

    // 6. Altitude Tape & Vertical Speed (Right Side)
    this._drawAltitudeTape(ctx, cx + 220, cy, phys.altitudeFeet, phys.verticalSpeedFPM);

    // 7. Heading Compass Tape (Top)
    this._drawHeadingTape(ctx, cx, 55, phys.heading);

    // 8. G-Force & AoA (Top Left)
    this._drawGAndAoA(ctx, 40, 110, phys.gForce, phys.maxG, phys.aoaDeg);

    // 9. Systems Telemetry (Bottom Left)
    this._drawSystemsStatus(ctx, 40, h - 70, phys);

    // 10. ILS Glideslope / Localizer Crosshairs (when approaching runway)
    this._drawILS(ctx, cx, cy, phys.position);

    // 11. Stall / Warnings Banner
    if (isStalling) {
      this._drawWarningBanner(ctx, cx, cy - 140, 'STALL WARNING - PULL DOWN');
    } else if (phys.altitudeFeet < 300 && !phys.isGrounded && phys.verticalSpeed < -6) {
      this._drawWarningBanner(ctx, cx, cy - 140, 'PULL UP - LOW ALTITUDE');
    }

    ctx.restore();
  }

  _drawGForceVignette(ctx, w, h, gForce) {
    if (gForce > 3.5) {
      // Blackout peripheral vignette
      const intensity = Math.min(0.85, (gForce - 3.5) / 4.5);
      const grad = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.7);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, `rgba(0,0,0,${intensity})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    } else if (gForce < -1.0) {
      // Redout
      const intensity = Math.min(0.7, (-gForce - 1.0) / 2.0);
      const grad = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.7);
      grad.addColorStop(0, 'rgba(255,0,0,0)');
      grad.addColorStop(1, `rgba(180,0,0,${intensity})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }
  }

  _drawBoresight(ctx, cx, cy) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();

    // Miniature aircraft symbol
    ctx.beginPath();
    ctx.moveTo(cx - 20, cy);
    ctx.lineTo(cx - 8, cy);
    ctx.lineTo(cx - 5, cy + 6);
    ctx.moveTo(cx + 8, cy);
    ctx.lineTo(cx + 20, cy);
    ctx.lineTo(cx + 5, cy + 6);
    ctx.stroke();
    ctx.restore();
  }

  _drawVelocityVector(ctx, cx, cy, airplane, camera) {
    // Project airplane velocity vector to screen space
    const phys = airplane.physics;
    if (phys.airspeed < 5) return;

    const velNorm = phys.velocity.clone().normalize();
    const velWorld = phys.position.clone().addScaledVector(velNorm, 60.0);
    const screenPos = velWorld.project(camera);

    if (screenPos.z < 1) {
      const vx = (screenPos.x * 0.5 + 0.5) * this.width;
      const vy = (-screenPos.y * 0.5 + 0.5) * this.height;

      // Draw Flight Path Marker circle with wings
      ctx.save();
      ctx.beginPath();
      ctx.arc(vx, vy, 6, 0, Math.PI * 2);
      ctx.moveTo(vx - 14, vy);
      ctx.lineTo(vx - 6, vy);
      ctx.moveTo(vx + 6, vy);
      ctx.lineTo(vx + 14, vy);
      ctx.moveTo(vx, vy - 6);
      ctx.lineTo(vx, vy - 12);
      ctx.stroke();
      ctx.restore();
    }
  }

  _drawPitchLadder(ctx, cx, cy, pitchDeg, rollDeg) {
    ctx.save();
    ctx.translate(cx, cy);
    // Rotate with roll
    ctx.rotate(THREE.MathUtils.degToRad(-rollDeg));

    // Pixels per pitch degree
    const ppd = 7.5;
    const pitchOffset = pitchDeg * ppd;

    // Clip to HUD central region
    ctx.beginPath();
    ctx.rect(-180, -180, 360, 360);
    ctx.clip();

    // Horizon line (0° pitch)
    const horizY = pitchOffset;
    ctx.beginPath();
    ctx.moveTo(-160, horizY);
    ctx.lineTo(-45, horizY);
    ctx.moveTo(45, horizY);
    ctx.lineTo(160, horizY);
    ctx.stroke();

    // Pitch bars every 5° from -60° to +60°
    for (let p = -60; p <= 60; p += 5) {
      if (p === 0) continue;
      const y = horizY - (p * ppd);
      if (y < -200 || y > 200) continue;

      const isPositive = p > 0;
      const barLen = Math.abs(p) % 10 === 0 ? 55 : 35;
      const gap = 35;

      ctx.beginPath();
      if (isPositive) {
        // Solid rungs for nose-up
        ctx.setLineDash([]);
        ctx.moveTo(-gap - barLen, y);
        ctx.lineTo(-gap, y);
        ctx.lineTo(-gap, y + 8); // Tick pointing toward horizon

        ctx.moveTo(gap, y + 8);
        ctx.lineTo(gap, y);
        ctx.lineTo(gap + barLen, y);
      } else {
        // Dashed rungs for nose-down
        ctx.setLineDash([6, 4]);
        ctx.moveTo(-gap - barLen, y);
        ctx.lineTo(-gap, y);
        ctx.lineTo(-gap, y - 8);

        ctx.moveTo(gap, y - 8);
        ctx.lineTo(gap, y);
        ctx.lineTo(gap + barLen, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Pitch angle number text
      if (Math.abs(p) % 10 === 0) {
        ctx.fillText(`${Math.abs(p)}`, -gap - barLen - 24, y + 4);
        ctx.fillText(`${Math.abs(p)}`, gap + barLen + 8, y + 4);
      }
    }

    ctx.restore();
  }

  _drawAirspeedTape(ctx, x, cy, kts, mach) {
    ctx.save();
    const tapeHeight = 260;
    const ppk = 2.0; // Pixels per knot

    // Outer tape bracket
    ctx.strokeRect(x - 65, cy - tapeHeight / 2, 65, tapeHeight);

    // Clip contents to tape
    ctx.beginPath();
    ctx.rect(x - 65, cy - tapeHeight / 2, 65, tapeHeight);
    ctx.clip();

    // Ticks every 10 knots
    const startSpd = Math.floor((kts - 70) / 10) * 10;
    const endSpd = Math.ceil((kts + 70) / 10) * 10;

    for (let s = startSpd; s <= endSpd; s += 10) {
      if (s < 0) continue;
      const y = cy + (kts - s) * ppk;
      const isMajor = s % 50 === 0;

      ctx.beginPath();
      ctx.moveTo(x - 5, y);
      ctx.lineTo(x - (isMajor ? 20 : 10), y);
      ctx.stroke();

      if (isMajor) {
        ctx.textAlign = 'right';
        ctx.fillText(`${s}`, x - 24, y + 4);
      }
    }
    ctx.restore();

    // Digital readout box
    ctx.fillStyle = '#06130e';
    ctx.fillRect(x - 72, cy - 14, 76, 28);
    ctx.strokeStyle = this.hudColor;
    ctx.strokeRect(x - 72, cy - 14, 76, 28);

    ctx.fillStyle = this.hudColor;
    ctx.textAlign = 'right';
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.fillText(`${kts.toFixed(0)}`, x - 18, cy + 5);

    ctx.font = '11px sans-serif';
    ctx.fillText('KTS', x - 2, cy + 5);

    // Mach number below tape
    ctx.textAlign = 'center';
    ctx.fillText(`M ${mach.toFixed(2)}`, x - 32, cy + tapeHeight / 2 + 20);
  }

  _drawAltitudeTape(ctx, x, cy, altFt, vsiFpm) {
    ctx.save();
    const tapeHeight = 260;
    const ppf = 0.22; // Pixels per foot

    // Outer tape bracket
    ctx.strokeRect(x, cy - tapeHeight / 2, 70, tapeHeight);

    // Clip tape
    ctx.beginPath();
    ctx.rect(x, cy - tapeHeight / 2, 70, tapeHeight);
    ctx.clip();

    // Ticks every 100 feet
    const startAlt = Math.floor((altFt - 600) / 100) * 100;
    const endAlt = Math.ceil((altFt + 600) / 100) * 100;

    for (let a = startAlt; a <= endAlt; a += 100) {
      if (a < 0) continue;
      const y = cy + (altFt - a) * ppf;
      const isMajor = a % 500 === 0;

      ctx.beginPath();
      ctx.moveTo(x + 5, y);
      ctx.lineTo(x + (isMajor ? 20 : 10), y);
      ctx.stroke();

      if (isMajor) {
        ctx.textAlign = 'left';
        ctx.fillText(`${a}`, x + 24, y + 4);
      }
    }
    ctx.restore();

    // Digital readout box
    ctx.fillStyle = '#06130e';
    ctx.fillRect(x - 4, cy - 14, 82, 28);
    ctx.strokeStyle = this.hudColor;
    ctx.strokeRect(x - 4, cy - 14, 82, 28);

    ctx.fillStyle = this.hudColor;
    ctx.textAlign = 'left';
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.fillText(`${altFt.toFixed(0)}`, x + 6, cy + 5);

    ctx.font = '11px sans-serif';
    ctx.fillText('FT', x + 60, cy + 5);

    // Vertical speed readout below tape
    ctx.textAlign = 'center';
    const sign = vsiFpm >= 0 ? '+' : '';
    ctx.fillText(`VSI ${sign}${vsiFpm.toFixed(0)}`, x + 35, cy + tapeHeight / 2 + 20);
  }

  _drawHeadingTape(ctx, cx, y, heading) {
    ctx.save();
    const tapeWidth = 320;
    const ppd = 4.0; // Pixels per degree

    // Tape box
    ctx.strokeRect(cx - tapeWidth / 2, y - 24, tapeWidth, 36);

    ctx.beginPath();
    ctx.rect(cx - tapeWidth / 2, y - 24, tapeWidth, 36);
    ctx.clip();

    // Ticks every 5 degrees
    const startH = Math.floor((heading - 40) / 5) * 5;
    const endH = Math.ceil((heading + 40) / 5) * 5;

    for (let h = startH; h <= endH; h += 5) {
      const normH = (h % 360 + 360) % 360;
      const x = cx + (h - heading) * ppd;
      const isMajor = normH % 10 === 0;

      ctx.beginPath();
      ctx.moveTo(x, y + 12);
      ctx.lineTo(x, y + (isMajor ? -2 : 5));
      ctx.stroke();

      if (isMajor) {
        let label = `${Math.floor(normH / 10)}`;
        if (normH === 0) label = 'N';
        else if (normH === 90) label = 'E';
        else if (normH === 180) label = 'S';
        else if (normH === 270) label = 'W';

        ctx.textAlign = 'center';
        ctx.font = 'bold 12px "Courier New", monospace';
        ctx.fillText(label, x, y - 6);
      }
    }
    ctx.restore();

    // Central pointer arrow & digital readout
    ctx.beginPath();
    ctx.moveTo(cx, y + 16);
    ctx.lineTo(cx - 6, y + 26);
    ctx.lineTo(cx + 6, y + 26);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#06130e';
    ctx.fillRect(cx - 24, y + 28, 48, 20);
    ctx.strokeStyle = this.hudColor;
    ctx.strokeRect(cx - 24, y + 28, 48, 20);

    ctx.fillStyle = this.hudColor;
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.fillText(`${heading.toFixed(0).padStart(3, '0')}°`, cx, y + 43);
  }

  _drawGAndAoA(ctx, x, y, g, maxG, aoaDeg) {
    ctx.textAlign = 'left';
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.fillText(`G:   ${g.toFixed(1)} (MAX: ${maxG.toFixed(1)})`, x, y);
    ctx.fillText(`AoA: ${aoaDeg.toFixed(1)}°`, x, y + 18);
  }

  _drawSystemsStatus(ctx, x, y, phys) {
    ctx.textAlign = 'left';
    ctx.font = '12px "Courier New", monospace';

    // Throttle bar
    const throttlePercent = Math.min(100, Math.floor(phys.throttle * 100));
    const isBoost = phys.throttle > 1.0;
    ctx.fillText(`THR: ${throttlePercent}% ${isBoost ? '[BOOST]' : ''}`, x, y);

    ctx.strokeRect(x, y + 6, 120, 8);
    ctx.fillStyle = isBoost ? '#ff7700' : this.hudColor;
    ctx.fillRect(x + 1, y + 7, Math.min(118, (phys.throttle / 1.15) * 118), 6);

    ctx.fillStyle = this.hudColor;
    const flapState = phys.flaps === 0 ? 'CLEAN (0°)' : (phys.flaps === 1 ? '15°' : '30° FULL');
    ctx.fillText(`FLAPS: ${flapState}`, x, y + 32);

    const gearState = phys.gear > 0.8 ? 'DOWN' : (phys.gear < 0.2 ? 'UP' : 'TRANSIT');
    ctx.fillText(`GEAR:  ${gearState}`, x, y + 48);

    if (phys.airbrake > 0.1) {
      ctx.fillStyle = this.hudCautionColor;
      ctx.fillText(`AIRBRAKE ACTIVE`, x + 150, y + 32);
    }
  }

  _drawILS(ctx, cx, cy, planePos) {
    // ILS active when within 6000m north of runway (Z from -6000 to -1200)
    const dz = planePos.z - (-1200);
    if (dz < -50 && dz > -6500) {
      // Localizer: lateral deviation from runway centerline (X = 0)
      const locError = planePos.x;
      const locBarX = THREE.MathUtils.clamp(cx - (locError * 1.2), cx - 120, cx + 120);

      // Glideslope: 3 degree angle from touchdown point
      const dist = Math.abs(dz);
      const idealHeight = dist * Math.tan(THREE.MathUtils.degToRad(3.0));
      const gsError = planePos.y - idealHeight;
      const gsBarY = THREE.MathUtils.clamp(cy + (gsError * 1.5), cy - 120, cy + 120);

      ctx.save();
      ctx.strokeStyle = 'rgba(255, 200, 0, 0.7)';
      ctx.setLineDash([4, 4]);

      // Localizer needle (vertical dashed line)
      ctx.beginPath();
      ctx.moveTo(locBarX, cy - 80);
      ctx.lineTo(locBarX, cy + 80);
      ctx.stroke();

      // Glideslope needle (horizontal dashed line)
      ctx.beginPath();
      ctx.moveTo(cx - 80, gsBarY);
      ctx.lineTo(cx + 80, gsBarY);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.font = '11px sans-serif';
      ctx.fillStyle = '#ffaa00';
      ctx.fillText('ILS 09L', cx - 22, cy + 98);
      ctx.restore();
    }
  }

  _drawWarningBanner(ctx, cx, cy, text) {
    ctx.save();
    const flash = (Math.floor(Date.now() / 250) % 2) === 0;
    if (flash) {
      ctx.fillStyle = 'rgba(230, 20, 20, 0.85)';
      ctx.fillRect(cx - 160, cy - 18, 320, 36);

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - 160, cy - 18, 320, 36);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(text, cx, cy + 5);
    }
    ctx.restore();
  }
}
