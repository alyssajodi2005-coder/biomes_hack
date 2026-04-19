"""
Flex sensor calibration over serial: collect ADC readings at known angles,
fit a polynomial (ADC -> angle), save calibration JSON.

Arduino should print lines like: Flex raw value: 512
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path
from typing import List, Sequence

import numpy as np
import serial

FLEX_LINE_RE = re.compile(
    r"Flex raw value:\s*([0-9]+(?:\.[0-9]+)?)", re.IGNORECASE
)


def open_serial(port: str, baud: int, timeout: float = 2.0) -> serial.Serial:
    return serial.Serial(port=port, baudrate=baud, timeout=timeout)


def read_one_adc(ser: serial.Serial, stale_ms: float = 500.0) -> float:
    """Return the next parsed ADC value from the stream (discard stale buffered lines)."""
    deadline = time.monotonic() + stale_ms / 1000.0
    while time.monotonic() < deadline:
        line = ser.readline().decode("utf-8", errors="replace").strip()
        if not line:
            continue
        m = FLEX_LINE_RE.search(line)
        if m:
            return float(m.group(1))
    raise TimeoutError("No valid 'Flex raw value:' line received in time.")


def sample_adc(
    ser: serial.Serial,
    n: int,
    settle_s: float,
    discard: int,
) -> float:
    """Average n readings after optional settle time and discarding first lines."""
    time.sleep(settle_s)
    for _ in range(discard):
        try:
            read_one_adc(ser, stale_ms=2000.0)
        except TimeoutError:
            break
    values: List[float] = []
    for _ in range(n):
        values.append(read_one_adc(ser, stale_ms=3000.0))
    return float(np.median(values))


def fit_poly(
    adcs: Sequence[float], angles_deg: Sequence[float], degree: int
) -> np.ndarray:
    """Return polynomial coefficients highest power first: angle = polyval(adc, coef)."""
    x = np.asarray(adcs, dtype=float)
    y = np.asarray(angles_deg, dtype=float)
    if len(x) != len(y) or len(x) < degree + 1:
        raise ValueError(
            f"Need at least {degree + 1} points for degree-{degree} fit; got {len(x)}."
        )
    return np.polyfit(x, y, deg=degree)


def load_calibration(path: Path) -> dict:
    payload = json.loads(path.read_text(encoding="utf-8"))
    coefficients = payload.get("coefficients")
    if not coefficients:
        raise ValueError(f"No coefficients found in calibration file: {path}")
    payload["coefficients"] = np.asarray(coefficients, dtype=float)
    return payload


def adc_to_angle(
    adc: float,
    coef: Sequence[float],
    *,
    min_angle: float | None = None,
    max_angle: float | None = None,
) -> float:
    """Convert one ADC reading into an angle using saved calibration coefficients."""
    angle = float(np.polyval(np.asarray(coef, dtype=float), float(adc)))
    if min_angle is not None:
        angle = max(min_angle, angle)
    if max_angle is not None:
        angle = min(max_angle, angle)
    return angle


def is_monotonic(values: Sequence[float]) -> bool:
    diffs = np.diff(np.asarray(values, dtype=float))
    return bool(np.all(diffs >= 0) or np.all(diffs <= 0))


def format_poly_equation(coef: np.ndarray, var: str = "ADC") -> str:
    """One-line polynomial matching numpy.polyval (coefficients high degree first)."""
    c = np.asarray(coef, dtype=float).ravel()
    degree = len(c) - 1

    def term_magnitude(power: int, mag: float) -> str:
        m = f"{mag:.6g}"
        if power == 0:
            return m
        if power == 1:
            return f"{m}·{var}"
        sup = "²" if power == 2 else "³" if power == 3 else f"^{power}"
        return f"{m}·{var}{sup}"

    parts: List[str] = []
    for i, coeff in enumerate(c):
        power = degree - i
        body = term_magnitude(power, abs(float(coeff)))
        if i == 0:
            parts.append(f"-{body}" if coeff < 0 else body)
        elif coeff < 0:
            parts.append(f"- {body}")
        else:
            parts.append(f"+ {body}")
    return " ".join(parts)


def plot_calibration(
    adcs: Sequence[float],
    angles_deg: Sequence[float],
    coef: np.ndarray,
    plot_path: Path,
    *,
    show: bool = False,
) -> None:
    try:
        import matplotlib.pyplot as plt
    except ModuleNotFoundError as exc:
        raise ModuleNotFoundError(
            "matplotlib is required only for saving/showing the calibration plot. "
            "Install it with: python3 -m pip install matplotlib"
        ) from exc

    adcs_arr = np.asarray(adcs, dtype=float)
    ang_arr = np.asarray(angles_deg, dtype=float)
    a_min, a_max = float(adcs_arr.min()), float(adcs_arr.max())
    span = max(a_max - a_min, 1e-6)
    pad = max(0.05 * span, 5.0)
    lo = max(0.0, a_min - pad)
    hi = min(1023.0, a_max + pad)
    xs = np.linspace(lo, hi, 200)
    ys = np.polyval(coef, xs)

    fig, ax = plt.subplots(figsize=(8, 5), dpi=120)
    ax.scatter(adcs_arr, ang_arr, s=70, zorder=3, label="Calibration points")
    ax.plot(xs, ys, color="C0", lw=2, label=f"Best fit (deg {len(coef) - 1})")
    ax.set_xlabel("ADC reading")
    ax.set_ylabel("Angle (degrees)")
    ax.set_title("Flex sensor: ADC → angle")
    eq = format_poly_equation(coef, var="ADC")
    fig.text(0.5, 0.02, f"angle ≈ {eq}", ha="center", fontsize=9)
    ax.grid(True, alpha=0.3)
    ax.legend(loc="best")
    fig.tight_layout()
    fig.subplots_adjust(bottom=0.18)
    plot_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(plot_path, bbox_inches="tight")
    print(f"Saved plot to {plot_path}")
    if show:
        plt.show()
    plt.close(fig)


def save_calibration(path: Path, coef: np.ndarray, meta: dict) -> None:
    payload = {
        "coefficients": coef.tolist(),
        "degree": int(len(coef) - 1),
        "meta": meta,
    }
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Saved calibration to {path}")


def parse_angles_list(raw_angles: str) -> List[float]:
    return [float(a.strip()) for a in raw_angles.split(",") if a.strip()]


def ensure_angles_for_degree(angles: Sequence[float], degree: int) -> None:
    if len(angles) < degree + 1:
        raise ValueError(
            f"Need at least {degree + 1} angles for degree-{degree} fit; got {len(angles)}."
        )


def run_calibrate(args: argparse.Namespace) -> None:
    angles = parse_angles_list(args.angles)
    if len(angles) < 2:
        print("Provide at least two comma-separated angles, e.g. --angles 0,45,90")
        sys.exit(1)
    ensure_angles_for_degree(angles, args.degree)

    ser = open_serial(args.port, args.baud)
    try:
        time.sleep(args.open_delay)
        ser.reset_input_buffer()

        adcs: List[float] = []
        raw_runs: List[List[float]] = []
        print("\nCalibration: hold the sensor steady at each angle when prompted.\n")
        for deg in angles:
            per_angle_runs: List[float] = []
            for run_idx in range(args.repeats):
                prompt = (
                    f"Bend to **{deg}°** (physical reference), run {run_idx + 1}/{args.repeats}, "
                    "then press Enter… "
                )
                input(prompt)
                adc = sample_adc(
                    ser,
                    n=args.samples,
                    settle_s=args.settle,
                    discard=args.discard,
                )
                per_angle_runs.append(adc)
                print(f"  Run {run_idx + 1}: ADC ≈ {adc:.2f}")

            combined_adc = float(np.mean(per_angle_runs))
            raw_runs.append(per_angle_runs)
            adcs.append(combined_adc)
            print(
                f"  Averaged ADC ≈ {combined_adc:.2f} at {deg}° "
                f"from {args.repeats} run(s)\n"
            )

        coef = fit_poly(adcs, angles, degree=args.degree)
        print("Fit: angle ≈ polynomial(ADC), coefficients (high→low power):")
        print(f"  {coef}\n")

        adc_span = max(adcs) - min(adcs)
        if adc_span < 25:
            print(
                "Warning: calibration ADC span is very small. "
                "A narrow reading range can make angle estimates unstable."
            )
        if not is_monotonic(adcs):
            print(
                "Warning: ADC readings are not monotonic across your angle steps. "
                "That usually means the sensor positions were inconsistent or the "
                "chosen angle references do not match the sensor's real bend range."
            )

        xs = np.linspace(min(adcs), max(adcs), 50)
        pred = np.polyval(coef, xs)
        print(
            f"Sanity check: over ADC [{min(adcs):.1f}, {max(adcs):.1f}], "
            f"model angle range ≈ [{pred.min():.1f}°, {pred.max():.1f}°]\n"
        )

        meta = {
            "angles_deg": angles,
            "adcs": adcs,
            "raw_runs": raw_runs,
            "repeats": args.repeats,
            "port": args.port,
            "baud": args.baud,
        }
        out_cal = Path(args.out)
        save_calibration(out_cal, coef, meta)
        plot_path = Path(args.plot) if args.plot else out_cal.with_suffix(".png")
        plot_calibration(adcs, angles, coef, plot_path, show=args.show)
    finally:
        ser.close()


def run_merge(args: argparse.Namespace) -> None:
    paths = [Path(p) for p in args.inputs]
    if len(paths) < 2:
        print("Provide at least two calibration JSON files to merge.")
        sys.exit(1)

    payloads = [json.loads(path.read_text(encoding="utf-8")) for path in paths]
    metas = [payload.get("meta", {}) for payload in payloads]
    angle_sets = [list(meta.get("angles_deg") or []) for meta in metas]
    first_angles = angle_sets[0]
    if not first_angles:
        print(f"Missing angles_deg in calibration file: {paths[0]}")
        sys.exit(1)

    for path, angles in zip(paths[1:], angle_sets[1:]):
        if angles != first_angles:
            print(
                f"Angle steps do not match. {paths[0].name} has {first_angles}, "
                f"but {path.name} has {angles}."
            )
            sys.exit(1)

    ensure_angles_for_degree(first_angles, args.degree)

    adcs_per_run: List[np.ndarray] = []
    collected_raw_runs: List[List[List[float]]] = []
    for path, meta in zip(paths, metas):
        adcs = meta.get("adcs")
        if not adcs or len(adcs) != len(first_angles):
            print(f"Missing or invalid ADC list in {path}")
            sys.exit(1)
        adcs_per_run.append(np.asarray(adcs, dtype=float))
        raw_runs = meta.get("raw_runs")
        if raw_runs:
            collected_raw_runs.append(raw_runs)

    merged_adcs = np.mean(np.vstack(adcs_per_run), axis=0)
    coef = fit_poly(merged_adcs, first_angles, degree=args.degree)

    print("\nMerged calibration summary:")
    print(f"  Source files: {len(paths)}")
    print(f"  Angles: {first_angles}")
    print(f"  Averaged ADCs: {[round(v, 2) for v in merged_adcs.tolist()]}")
    print("  Coefficients (high→low power):")
    print(f"    {coef}\n")

    meta = {
        "angles_deg": first_angles,
        "adcs": merged_adcs.tolist(),
        "merged_from": [str(path) for path in paths],
        "merge_count": len(paths),
    }
    if collected_raw_runs:
        meta["raw_runs_by_file"] = {
            path.name: runs for path, runs in zip(paths, collected_raw_runs)
        }

    out_cal = Path(args.out)
    save_calibration(out_cal, coef, meta)
    plot_path = Path(args.plot) if args.plot else out_cal.with_suffix(".png")
    plot_calibration(merged_adcs, first_angles, coef, plot_path, show=args.show)


def run_monitor(args: argparse.Namespace) -> None:
    calibration_path = Path(args.calibration)
    calibration = load_calibration(calibration_path)
    coef = calibration["coefficients"]
    meta = calibration.get("meta", {})
    angles = meta.get("angles_deg") or []
    min_angle = float(min(angles)) if angles else None
    max_angle = float(max(angles)) if angles else None

    ser = open_serial(args.port, args.baud)
    try:
        time.sleep(args.open_delay)
        ser.reset_input_buffer()
        print(
            f"Streaming flex sensor angles from {args.port} using {calibration_path}.\n"
            "Press Ctrl+C to stop.\n"
        )

        while True:
            adc = read_one_adc(ser, stale_ms=args.timeout_ms)
            angle = adc_to_angle(
                adc, coef, min_angle=min_angle, max_angle=max_angle
            )
            print(f"ADC: {adc:7.2f}  ->  angle: {angle:7.2f} deg")
            if args.interval > 0:
                time.sleep(args.interval)
    except KeyboardInterrupt:
        print("\nStopped monitor.")
    finally:
        ser.close()


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Flex sensor serial tools for calibration and live angle interpretation.",
    )
    subparsers = p.add_subparsers(dest="command", required=True)

    calibrate = subparsers.add_parser(
        "calibrate",
        help="Collect known-angle samples and fit ADC -> angle coefficients",
    )
    calibrate.add_argument(
        "--port",
        default="/dev/cu.usbmodem1101",
        help="Serial port (default: %(default)s)",
    )
    calibrate.add_argument("--baud", type=int, default=9600)
    calibrate.add_argument(
        "--angles",
        default="0,20,40,60,80,100,120",
        help="Comma-separated target angles in degrees (default: %(default)s)",
    )
    calibrate.add_argument(
        "--degree", type=int, default=2, help="Polynomial degree (1=linear)"
    )
    calibrate.add_argument(
        "--samples", type=int, default=25, help="Median of N reads per angle"
    )
    calibrate.add_argument(
        "--repeats",
        type=int,
        default=1,
        help="How many separate runs to record and average per angle",
    )
    calibrate.add_argument(
        "--settle", type=float, default=0.4, help="Seconds to wait before sampling"
    )
    calibrate.add_argument(
        "--discard", type=int, default=3, help="Lines to discard before averaging"
    )
    calibrate.add_argument(
        "--open-delay", type=float, default=2.0, help="Seconds after opening port"
    )
    calibrate.add_argument(
        "--out",
        default="flex_calibration.json",
        help="Output JSON path",
    )
    calibrate.add_argument(
        "--plot",
        default=None,
        metavar="PATH",
        help="PNG path for calibration plot (default: same base name as --out)",
    )
    calibrate.add_argument(
        "--show",
        action="store_true",
        help="Open an interactive plot window after saving",
    )

    merge = subparsers.add_parser(
        "merge",
        help="Average several saved calibration runs into one final calibration",
    )
    merge.add_argument(
        "inputs",
        nargs="+",
        help="Calibration JSON files to combine",
    )
    merge.add_argument(
        "--degree", type=int, default=2, help="Polynomial degree for merged fit"
    )
    merge.add_argument(
        "--out",
        default="flex_calibration_merged.json",
        help="Output JSON path",
    )
    merge.add_argument(
        "--plot",
        default=None,
        metavar="PATH",
        help="PNG path for merged calibration plot (default: same base name as --out)",
    )
    merge.add_argument(
        "--show",
        action="store_true",
        help="Open an interactive plot window after saving",
    )

    monitor = subparsers.add_parser(
        "monitor",
        help="Read serial ADC values continuously and print interpreted angles",
    )
    monitor.add_argument(
        "--port",
        default="/dev/cu.usbmodem1101",
        help="Serial port (default: %(default)s)",
    )
    monitor.add_argument("--baud", type=int, default=9600)
    monitor.add_argument(
        "--calibration",
        default="flex_calibration.json",
        help="Calibration JSON created by the calibrate command",
    )
    monitor.add_argument(
        "--open-delay", type=float, default=2.0, help="Seconds after opening port"
    )
    monitor.add_argument(
        "--timeout-ms",
        type=float,
        default=3000.0,
        help="Serial read timeout in milliseconds",
    )
    monitor.add_argument(
        "--interval",
        type=float,
        default=0.0,
        help="Optional delay between displayed readings",
    )
    return p


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    if args.command == "calibrate":
        run_calibrate(args)
    elif args.command == "merge":
        run_merge(args)
    elif args.command == "monitor":
        run_monitor(args)
    else:
        parser.error(f"Unknown command: {args.command}")


if __name__ == "__main__":
    main()
