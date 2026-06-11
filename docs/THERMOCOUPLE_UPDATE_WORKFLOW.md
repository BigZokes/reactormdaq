# Thermocouple Node Update Workflow

Saved: 2026-06-10

Scope: firmware and hardware verification for Temp1-Temp5 and Temp7-Temp8 only.
Do not use this checklist for dashboard or web-app redesign work.

## Current Baseline

- Gateway: working, `E4:B0:63:AE:B7:2C`, serial `E4B063AEB72C`.
- Gateway firmware now posts directly to Convex every 5 seconds, including heartbeat rows when all nodes are `MISSING`.
- Temp6: working, `20:6E:F1:33:A9:6C`, serial `206EF133A96C`.
- Temp1: flashed as `temp1`, serial `206EF133B55C`, gateway/Convex path verified after explicit ESP-NOW channel handling patch; physical thermocouple reports `OPEN` and should be inspected later.
- Temp2: flashed as `temp2`, serial `206EF133A8B8`, gateway/Convex path verified; physical thermocouple reports `OPEN` and should be inspected later.
- Temp3: flashed as `temp3`, serial `206EF1327EEC`, gateway/Convex path verified; physical thermocouple reading is stuck at `0.00 C` and should be inspected later.
- Temp4: flashed as `temp4`, serial `E4B063AF0B30`, gateway/Convex path verified; physical thermocouple reports `OPEN` and should be inspected later.
- Temp5: flashed as `temp5`, serial `E4B063AE6674`, gateway/Convex path verified after replacing the USB cable; physical thermocouple reports `OPEN` and should be inspected later.
- Temp7: flashed as `temp7`, serial `206EF133A4B8`, gateway/Convex path verified; physical thermocouple reports `OPEN` and should be inspected later.
- Temp8: flashed as `temp8`, serial `E4B063AE0784`, gateway/Convex path verified; physical thermocouple reports `OPEN` and should be inspected later.
- Remaining nodes to verify and flash: none.
- Firmware source: `src/tc_node.cpp`.
- PlatformIO environments: `temp1`, `temp2`, `temp3`, `temp4`, `temp5`, `temp7`, `temp8`.
- Device mapping source of truth: `docs/DEVICE_MAP.csv`.

Keep the gateway contract intact: inactive nodes must upload as `MISSING` and must not block rows from being logged when at least one thermocouple node is active.

## Build Status

The remaining node environments were built successfully on 2026-06-09:

```sh
pio run -e temp1 -e temp2 -e temp3 -e temp4 -e temp5 -e temp7 -e temp8
```

Result: `7 succeeded`.

## One-Board Loop

Run this loop for exactly one board at a time.

1. Plug in only the board being updated.
2. List ports.

```sh
node scripts/flash-device.mjs --ports
```

3. Read the visible `/dev/cu.usbmodem...` port and derive the 12-hex serial from the port name. Example: `/dev/cu.usbmodem206EF133B55C2` has serial `206EF133B55C`.
4. Match the serial/MAC to the intended channel before flashing. The Nano ESP32 serial usually corresponds to the MAC without colons, for example `206EF1327EEC` -> `20:6E:F1:32:7E:EC`.
5. If the serial is not already recorded, update the intended channel in `docs/DEVICE_MAP.csv`.

```sh
node scripts/flash-device.mjs --env temp1 --set-serial 206EF133B55C
node scripts/flash-device.mjs --env temp1 --set-serial 206EF133B55C --write
```

6. Build the target firmware before upload.

```sh
pio run -e temp1
```

7. Monitor before flashing when possible and record the board's printed `Node MAC`.

```sh
node scripts/monitor-device.mjs --env temp1 --port /dev/cu.usbmodem206EF133B55C2 --monitor
```

Expected node startup lines:

```text
ReactorDAQ Temp1 node starting
Node MAC: 20:6E:F1:33:B5:5C
Initializing MAX31855...ok.
Gateway peer added: E4:B0:63:AE:B7:2C
```

8. Flash the environment that matches the intended channel.

```sh
node scripts/flash-device.mjs --env temp1 --upload
```

If the serial is not recorded yet, pass the port explicitly:

```sh
node scripts/flash-device.mjs --env temp1 --port /dev/cu.usbmodem206EF133B55C2 --upload
```

9. Monitor after flashing and verify the node identity, MAC, temperature or thermocouple fault, and ESP-NOW send result.

```sh
node scripts/monitor-device.mjs --env temp1 --monitor
```

Useful node lines:

```text
ReactorDAQ Temp1 node starting
Node MAC: 20:6E:F1:33:B5:5C
Temp1 reading=24.25 C
ESP-NOW send to E4:B0:63:AE:B7:2C: success
```

10. With the gateway powered, confirm the backend receives the intended channel. The fastest check is Convex latest samples:

```sh
cd /Users/peterzokoro/Documents/New\ project/reactor-lab-platform
npx convex run samples:latest '{"limit":1}'
```

Look for the intended channel:

```text
"Temp1_Status": "OK"
"Temp1_Packets": 1
"source": "wifi"
```

11. If needed, monitor the gateway and confirm it receives the intended channel.

```sh
node scripts/monitor-device.mjs --env gateway --monitor
```

Useful gateway lines:

```text
RX 20:6E:F1:33:B5:5C Temp1 = 24.25 C packets=1
Uploading to Convex: {...,"Temp1_Status":"OK",...,"Temp2_Status":"MISSING",...}
Convex upload accepted. code=200
```

12. Update `docs/DEVICE_MAP.csv` with status, physical label, reactor position, wiring notes, and last verified date.

## Commands Used For Temp3

Temp3 was updated with this exact sequence:

```sh
node scripts/flash-device.mjs --ports
node scripts/flash-device.mjs --env temp3 --set-serial 206EF1327EEC --write
pio run -e temp3
node scripts/flash-device.mjs --env temp3 --upload
node scripts/monitor-device.mjs --env temp3 --monitor
cd /Users/peterzokoro/Documents/New\ project/reactor-lab-platform
npx convex run samples:latest '{"limit":1}'
```

Temp3 result:

- Board booted as `ReactorDAQ Temp3 node starting`.
- Node MAC printed as `20:6E:F1:32:7E:EC`.
- Firmware uploaded successfully.
- ESP-NOW sends were intermittent at first, then successful often enough for gateway ingestion.
- Convex showed `Temp3_Status: OK`, `Temp3_Packets: 10`, `source: wifi`.
- Reading was stuck at `0.00 C`; physical MAX31855/thermocouple wiring should be inspected later.

## Commands Used For Temp2

Temp2 was updated with this exact sequence:

```sh
node scripts/flash-device.mjs --ports
node scripts/flash-device.mjs --env temp2 --set-serial 206EF133A8B8 --write
pio run -e temp2
node scripts/flash-device.mjs --env temp2 --upload
node scripts/monitor-device.mjs --env temp2 --monitor
cd /Users/peterzokoro/Documents/New\ project/reactor-lab-platform
npx convex run samples:latest '{"limit":1}'
```

Temp2 result:

- Port was `/dev/cu.usbmodem206EF133A8B82`, serial `206EF133A8B8`.
- Serial maps to expected MAC `20:6E:F1:33:A8:B8`.
- Firmware uploaded successfully as `temp2`.
- Node monitor showed ESP-NOW sends to gateway `E4:B0:63:AE:B7:2C` with successes.
- Convex showed `Temp2_Status: FAULT`, `Temp2_Fault: OPEN`, `Temp2_Packets: 3`, `source: wifi`.
- This means the microcontroller-to-gateway-to-Convex path works; the remaining issue is physical thermocouple/probe/MAX31855 continuity.

## Commands Used For Temp1

Temp1 was updated with this exact sequence:

```sh
node scripts/flash-device.mjs --ports
node scripts/flash-device.mjs --env temp1 --set-serial 206EF133B55C --write
pio run -e temp1
node scripts/flash-device.mjs --env temp1 --upload
node scripts/monitor-device.mjs --env temp1 --monitor
cd /Users/peterzokoro/Documents/New\ project/reactor-lab-platform
npx convex run samples:latest '{"limit":1}'
```

Temp1 result:

- Port was `/dev/cu.usbmodem206EF133B55C2`, serial `206EF133B55C`.
- Serial maps to expected MAC `20:6E:F1:33:B5:5C`.
- Firmware uploaded successfully as `temp1`.
- Initial sends all failed, so `src/tc_node.cpp` was updated to keep the scanned WiFi channel and add the gateway peer with that explicit channel.
- After reflashing, node monitor showed ESP-NOW sends to gateway `E4:B0:63:AE:B7:2C` with successes.
- Convex showed `Temp1_Status: FAULT`, `Temp1_Fault: OPEN`, `Temp1_Packets: 5`, `source: wifi`.
- This means the microcontroller-to-gateway-to-Convex path works; the remaining issue is physical thermocouple/probe/MAX31855 continuity.

## Commands Used For Temp4

Temp4 was updated with this exact sequence:

```sh
node scripts/flash-device.mjs --ports
node scripts/flash-device.mjs --env temp4 --set-serial E4B063AF0B30 --write
pio run -e temp4
node scripts/flash-device.mjs --env temp4 --upload
node scripts/monitor-device.mjs --env temp4 --monitor
cd /Users/peterzokoro/Documents/New\ project/reactor-lab-platform
npx convex run samples:latest '{"limit":1}'
```

Temp4 result:

- Port was `/dev/cu.usbmodemE4B063AF0B302`, serial `E4B063AF0B30`.
- Serial maps to expected MAC `E4:B0:63:AF:0B:30`.
- Firmware uploaded successfully as `temp4`.
- Node monitor showed `ESP-NOW channel set to 6`, `Gateway peer channel: 6`, and ESP-NOW sends to gateway `E4:B0:63:AE:B7:2C` with successes.
- Convex showed `Temp4_Status: FAULT`, `Temp4_Fault: OPEN`, `Temp4_Packets: 3`, `source: wifi`.
- This means the microcontroller-to-gateway-to-Convex path works; the remaining issue is physical thermocouple/probe/MAX31855 continuity.

## Commands Used For Temp8

Temp8 was updated with this exact sequence:

```sh
node scripts/flash-device.mjs --ports
node scripts/flash-device.mjs --env temp8 --set-serial E4B063AE0784 --write
pio run -e temp8
node scripts/flash-device.mjs --env temp8 --upload
node scripts/monitor-device.mjs --env temp8 --monitor
cd /Users/peterzokoro/Documents/New\ project/reactor-lab-platform
npx convex run samples:latest '{"limit":1}'
```

Temp8 result:

- Port was `/dev/cu.usbmodemE4B063AE07842`, serial `E4B063AE0784`.
- Serial maps to expected MAC `E4:B0:63:AE:07:84`.
- Firmware uploaded successfully as `temp8`.
- Node monitor showed ESP-NOW sends to gateway `E4:B0:63:AE:B7:2C` with successes.
- Convex showed `Temp8_Status: FAULT`, `Temp8_Fault: OPEN`, `Temp8_Packets: 6`, `source: wifi`.
- This means the microcontroller-to-gateway-to-Convex path works; the remaining issue is physical thermocouple/probe/MAX31855 continuity.

## Commands Used For Temp7

Temp7 was updated with this exact sequence:

```sh
node scripts/flash-device.mjs --ports
node scripts/flash-device.mjs --env temp7 --set-serial 206EF133A4B8 --write
pio run -e temp7
node scripts/flash-device.mjs --env temp7 --upload
node scripts/monitor-device.mjs --env temp7 --monitor
cd /Users/peterzokoro/Documents/New\ project/reactor-lab-platform
npx convex run samples:latest '{"limit":1}'
```

Temp7 result:

- Port was `/dev/cu.usbmodem206EF133A4B82`, serial `206EF133A4B8`.
- Serial maps to expected MAC `20:6E:F1:33:A4:B8`.
- Firmware uploaded successfully.
- Node monitor showed `ESP-NOW send to E4:B0:63:AE:B7:2C: success`.
- Convex showed `Temp7_Status: FAULT`, `Temp7_Fault: OPEN`, `Temp7_Packets: 5`, `source: wifi`.
- This means the microcontroller-to-gateway-to-Convex path works; the remaining issue is physical thermocouple/probe/MAX31855 continuity.

## Commands Used For Temp5

Temp5 was updated with this exact sequence:

```sh
node scripts/flash-device.mjs --ports
pio device monitor -p /dev/cu.usbmodemE4B063AE66742 -b 115200
pio run -e temp5
node scripts/flash-device.mjs --env temp5 --upload
node scripts/monitor-device.mjs --env temp5 --monitor
cd /Users/peterzokoro/Documents/New\ project/reactor-lab-platform
npx convex run samples:latest '{"limit":1}'
```

Temp5 result:

- Port was `/dev/cu.usbmodemE4B063AE66742`, serial `E4B063AE6674`, corresponding to MAC `E4:B0:63:AE:66:74`.
- This did not match the older Temp5 map MAC `20:6E:F1:31:23:94`; the physical Temp5 label was treated as source of truth and the map was updated.
- Before flashing, the board ran an older standalone sensor sketch and reported `Thermocouple is open`.
- Firmware uploaded successfully as `temp5`.
- Shared node firmware was improved to scan the configured WiFi SSID and set the ESP-NOW channel even when WiFi login fails.
- The board briefly stopped appearing as a USB serial device and stopped producing fresh packets.
- Replacing the USB cable restored `/dev/cu.usbmodemE4B063AE66742`.
- Fresh monitor showed ESP-NOW sends to gateway `E4:B0:63:AE:B7:2C` with successes.
- Convex showed `Temp5_Status: FAULT`, `Temp5_Fault: OPEN`, `Temp5_Packets: 8`, `source: wifi`, proving the board reached the gateway/backend.
- The remaining Temp5 issue is physical thermocouple/probe/MAX31855 continuity.

## Node Queue

| Channel | Env | Expected MAC | Current Serial | Status |
| --- | --- | --- | --- | --- |
| Temp1 | temp1 | 20:6E:F1:33:B5:5C | 206EF133B55C | Wireless OK; thermocouple OPEN |
| Temp2 | temp2 | 20:6E:F1:33:A8:B8 | 206EF133A8B8 | Wireless OK; thermocouple OPEN |
| Temp3 | temp3 | 20:6E:F1:32:7E:EC | 206EF1327EEC | Wireless OK; sensor reads 0C |
| Temp4 | temp4 | E4:B0:63:AF:0B:30 | E4B063AF0B30 | Wireless OK; thermocouple OPEN |
| Temp5 | temp5 | E4:B0:63:AE:66:74 | E4B063AE6674 | Wireless OK; thermocouple OPEN |
| Temp7 | temp7 | 20:6E:F1:33:A4:B8 | 206EF133A4B8 | Wireless OK; thermocouple OPEN |
| Temp8 | temp8 | E4:B0:63:AE:07:84 | E4B063AE0784 | Wireless OK; thermocouple OPEN |

## Acceptance Criteria

For each node:

- The board serial is recorded in `docs/DEVICE_MAP.csv`.
- The board prints the expected `ReactorDAQ TempN node starting` line.
- The board prints a `Node MAC` that matches the channel assignment or the map is corrected before flashing.
- The board is flashed with the matching `tempN` environment.
- The node monitor shows temperature readings or clear thermocouple fault messages.
- The node monitor shows ESP-NOW send attempts to the gateway.
- The gateway monitor shows `RX ... TempN`.
- A sheet upload row shows active tested nodes as `OK`.
- Inactive nodes remain `MISSING` or later `STALE`; they do not block logging.
- `docs/DEVICE_MAP.csv` has final physical label, reactor position, wiring notes, and `Last Verified`.

## Current Next Step

Temp1, Temp2, Temp3, Temp4, Temp5, Temp7, and Temp8 have verified wireless/backend paths, but all need physical thermocouple-side inspection later. Temp6 was already the working baseline. No remaining thermocouple nodes need initial firmware flashing.
