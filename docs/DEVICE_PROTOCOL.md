# Device Protocol Boundary

## V1 status

No device network protocol is implemented in V1.

The real V1 deployment mechanism is:

`PC -> SD Card -> physical target device`

## Future V2 boundary

The architecture reserves a future path:

```text
PC Application
   |
   | network transport
   v
ESP32-C6
   |
   | device-side transport/protocol
   v
Target Device
```

The ESP32-C6 is a network/device transport component, not a web UI host.

## Separation of concepts

`DeploymentTarget` and `DeviceTransport` are different concepts.

- `DeploymentTarget` answers how a deployment package reaches its destination.
- `DeviceTransport` represents a future communication channel with a device.

A future Wi-Fi target may compose a network/device transport, but the template/project layer must not know those details.

## Reserved model

The project specification permits a future device model containing concepts such as:

- id
- name
- type
- IP address
- firmware version
- hardware version
- capabilities
- connection status

These fields should not force V1 to implement device management.

## Explicitly out of scope for V1

- ESP32-C6 firmware
- Wi-Fi communication
- device discovery
- network authentication
- HTTP server on ESP32-C6
- ESP32 web page
- browser-to-device deployment
- cloud backend

The real network protocol must be designed as a separate V2 feature once device-side requirements are available.
