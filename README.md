# Aero-X Web Flight Simulator

A modern, high-fidelity 3D web-based flight simulator built with **Three.js** and vanilla JavaScript. Features realistic 6-DOF aerodynamics, multiple dynamic camera systems, a detailed metropolis skyline with skyscrapers, airport runway with PAPI lighting, procedural terrain with mountains and ocean, and military-grade glass cockpit Heads-Up Display (HUD).

---

## ✈️ Controls Reference

| Action | Primary Key | Alternate / Mouse | Description |
|---|---|---|---|
| **Pitch Down** | <kbd>W</kbd> | <kbd>↓ Arrow</kbd> / On-Screen `W` | Push stick forward (nose down) |
| **Pitch Up** | <kbd>S</kbd> | <kbd>↑ Arrow</kbd> / On-Screen `S` | Pull stick back (nose up) |
| **Roll Left** | <kbd>A</kbd> | <kbd>← Arrow</kbd> / On-Screen `A` | Bank aircraft left |
| **Roll Right** | <kbd>D</kbd> | <kbd>→ Arrow</kbd> / On-Screen `D` | Bank aircraft right |
| **Yaw Left** | <kbd>Q</kbd> | On-Screen `Q` | Rudder left / Nosewheel steering |
| **Yaw Right** | <kbd>E</kbd> | On-Screen `E` | Rudder right / Nosewheel steering |
| **Throttle Up / Boost** | <kbd>Shift</kbd> | <kbd>Space</kbd> / On-Screen `THR ▲` | Increase turbine thrust & afterburner |
| **Throttle Down** | <kbd>Ctrl</kbd> | <kbd>Z</kbd> / On-Screen `THR ▼` | Decrease thrust to idle |
| **Camera View Switch** | <kbd>C</kbd> | Top Bar Pills | Cycle Chase, Cockpit, Orbit, Flyby, Wing |
| **Free Camera Look** | <kbd>Right Click + Drag</kbd> | Mouse Drag | Pan view in Cockpit or 360° Orbit |
| **Landing Gear** | <kbd>G</kbd> | On-Screen `GEAR` | Extend / Retract landing gear |
| **Airbrake & Brakes** | <kbd>B</kbd> | On-Screen `BRAKE` | Deploy dorsal speedbrake & wheel brakes |
| **Flaps Cycle** | <kbd>F</kbd> | — | Cycle Clean (0°) &rarr; Takeoff (15°) &rarr; Landing (30°) |
| **Quick Respawn** | <kbd>R</kbd> | Top/Bottom Button | Reset to runway immediately |

---

## 🌟 Key Features

1. **Rich Background & Environment**:
   - **Dynamic Atmospheric Sky**: Rayleigh and Mie atmospheric scattering with sun elevation/azimuth calculations.
   - **Time of Day Modes**: Real-time switching between Noon, Golden Hour Sunset, and Night with glowing city & runway lights.
   - **Layered 3D Clouds**: Procedural puffy cumulus clouds drifting at flight altitudes.
   - **Metropolis City**: 100+ modern skyscrapers with glowing window textures, rooftop antenna masts with flashing collision beacons, street grid, and animated expressway traffic.
   - **Airfield Complex**: 3.2km asphalt runway 09L/27R with tire skid marks, threshold piano keys, edge & centerline lighting, ALS approach strobes, functional 4-unit PAPI glideslope indicator, taxiways, hangars, and control tower with rotating beacon.
   - **Expansive Terrain**: 24km x 24km procedural terrain with grass/field patchwork texturing, rolling hills, snowcapped mountain ranges, and coastal water bay.

2. **Camera Controls as a Real Game**:
   - **Chase View (Third Person)**: Smooth spring follow behind the jet with speed-dependent dynamic FOV expansion and bank alignment.
   - **Cockpit View (First Person)**: Immersive pilot view inside the canopy with HUD glass, dashboard, and high-G head bobbing.
   - **Free Orbit 360°**: Smooth turntable camera allowing 360-degree inspection with mouse dragging and wheel zoom.
   - **Flyby / Tower View**: Cinematic ground tracking camera watching the jet roar past with dynamic zoom.
   - **Wing Cam**: Action camera fixed on the wingtip looking along the fuselage.

3. **6-DOF Aerodynamics Flight Model**:
   - Realistic lift curve $C_L(\alpha)$ with thin-airfoil stall dynamics and warning.
   - Induced drag, parasite drag, flaps drag, gear drag, and airbrake drag.
   - Air density lapse rate with altitude.
   - Fly-By-Wire (FBW) auto-stabilization assistance (can be toggled on/off).
   - Tricycle landing gear suspension physics, wheel roll, braking, and crash detection.

4. **Modern Fighter / Airliner Glass Cockpit HUD**:
   - Artificial horizon with dynamic pitch ladder.
   - Flight Path Marker (Velocity Vector).
   - Rolling Airspeed Tape (knots) and Mach readout.
   - Rolling Altitude Tape (feet) and Vertical Speed Indicator (ft/min).
   - 360° Heading Compass Tape.
   - G-Meter with high-G blackout and redout screen vignettes.
   - ILS Localizer and Glideslope needles for precision landings.
   - Flashing Stall Warning and Low Altitude alerts.
   - Tactical Radar Minimap with 360° rotating radar sweep beam.

5. **Built-in Procedural Audio Synthesizer**:
   - Real-time Web Audio API jet engine turbine whine and sub-bass rumble modulated by throttle RPM.
   - Airspeed wind rush.
   - Runway tire touchdown screech sound.
   - Stall warning audible alarm and crash audio.

---

## 🚀 Running the Simulator

To start the simulator locally:
```bash
# Start development server
npm run dev

# Or build for production
npm run build
npm run preview
```
Open `http://localhost:3000` (or the preview port `http://localhost:4173`) in any modern web browser (Chrome, Edge, Firefox, Safari).
