# Wired calibration workflow

This demo now uses a simple wired calibration with just two reference angles:

- `0°`
- `90°`

## Run the demo calibration

```bash
cd /Users/alyssa/code/biomed_hack
python3 arduino/test.py calibrate \
  --port /dev/cu.usbmodem101 \
  --angles 0,90 \
  --degree 1 \
  --samples 12 \
  --discard 3 \
  --settle 0.4 \
  --repeats 3 \
  --out arduino/flex_calibration_demo.json \
  --plot arduino/flex_calibration_demo.png
```

## Watch the live interpreted angle

```bash
cd /Users/alyssa/code/biomed_hack
python3 arduino/test.py monitor \
  --port /dev/cu.usbmodem101 \
  --calibration arduino/flex_calibration_demo.json \
  --interval 0.2
```

## Notes

- Keep the brace placement exactly the same
- Hold the sensor still before pressing `Enter`
- This is a fast demo calibration for milestone tracking, not a clinical-grade angle system
