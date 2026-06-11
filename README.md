# Distributed_Data_Acquisition_Network
[insert image] 

## Current Working Branch

The active PlatformIO/dashboard rebuild is in this repo alongside the original source files.

Important folders:

- `src/`: current gateway and shared thermocouple node firmware.
- `platformio.ini`: build targets for `gateway` and `temp1` through `temp8`.
- `apps_script/`: Google Apps Script backend for Google Sheets logging and dashboard reads.
- `dashboard/`: Vite React dashboard that can run from home in simulator mode and switch to live Apps Script data.
- `src_legacy/`: sanitized reference copy of the earlier Arduino sketches.
- `docs/DASHBOARD_DEPLOYMENT.md`: Vercel deployment and environment setup notes.
- `MEMORY.md` and `NEXT_STEPS.md`: project handoff notes for continuing the work.

Current priority is temperature-only data acquisition. The gateway accepts partial thermocouple availability, so missing/stale nodes do not block rows from being written.

The current data schema is `temperature-daq-v2`, which includes temperature, status, last packet age, packet count, and thermocouple fault fields for each channel.

## Quick Verification

Dashboard:

```sh
cd dashboard
npm ci
npm run build
```

Firmware:

```sh
cp include/secrets.example.h include/secrets.h
pio run -e gateway -e temp1 -e temp2 -e temp3 -e temp4 -e temp5 -e temp6 -e temp7 -e temp8
```

Safe flash helper:

```sh
node scripts/flash-device.mjs --list
node scripts/flash-device.mjs --ports
node scripts/flash-device.mjs --env temp6 --dry-run
node scripts/flash-device.mjs --env temp1 --set-serial 206EF133B55C
```

After editing `docs/DEVICE_MAP.csv`, refresh the dashboard copy:

```sh
node scripts/generate-dashboard-device-map.mjs
```

Repository checks:

```sh
node scripts/check-repo.mjs
```

Read-only preflight:

```sh
node scripts/preflight.mjs
APPS_SCRIPT_URL="https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec" node scripts/preflight.mjs
```

Apps Script backend after deployment:

```sh
cd dashboard
APPS_SCRIPT_URL="https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec" npm run test:backend
```

Do not commit `include/secrets.h`, `.env`, `.pio/`, `dashboard/node_modules/`, or `dashboard/dist/`.

## Overview
This project is a distributed data acquisition network that is designed for real-time monitoring of temperature, pressure, and airflow within a biomass gasifier. It is developed to support biomass gasification research through synchronized data collection and experimental analysis. It integrates embedded systems, wireless telemetry, distributed instrumentation, and custom PCB development into a scalable monitoring platform for research.



## System Architecture

The system consists of 10 independent ESP32s-based sensing nodes:
- 8 temperature nodes
- 1 pressure node
- 1 air velocity node
  
Thermal Monitoring Node contained:
- Arduino ESP32 Nano microcontroller
- Thermocouple
- MAX 31855 (Thermocouple Amplifier module)
- Switch
- 5V Battery

Differential Pressure Node contained:
- Arduino ESP32 Nano microcontroller
- Differential Pressure Transducer
- RS-485 module
- Switch
- 12V battery
- DC-DC Buck Converter*

Air Velocity Node
- Arduino ESP32 Nano microcontroller
- Wind Sensor Rev. P
- 12V battery
- DC-DC Buck Converter*
- switch

Each node transmits telemetry data wirelessly via WiFi to a centralized database for storage and analysis.

The distributed architecture enables scalable monitoring throughout the biomass gasifier while reducing wiring complexity and improving node deployment flexibility.
[insert diagram]

*DC-DC Buck Converters are implemented in the circuit to protect the MCU since it can safely input only 5V. Could have used a 5V voltage regulator, but the buck converter uses little power since it converts excess energy into currents and emits a little amount of heat. 5V regulators work fine but with power and heat management in mind, the buck converter is a better choice for me.
  
## Schematic & Wiring
I designed the schematics originally on KiCad and then transferred them to Altium to become comfortable with a design software that is used in the industry.
Below are the images of each node
