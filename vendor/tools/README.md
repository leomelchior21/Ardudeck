# Vendored Windows tools

Place `arduino-cli.exe` in this folder before running `npm run desktop:package`
if you want the installed Ardu OS to carry its own Arduino CLI. The desktop
shell then points `ARDUDECK_ARDUINO_CLI` at it, so students never install the
Arduino IDE.

The AVR core (`arduino:avr` + `arduino-cli core install arduino:avr`) still has
to be present next to the CLI. Run it once on a prepared machine and copy the
resulting `arduino15` folder next to the executable, or provision it with
`scripts/setup-arduino-cli.sh` on the target.
