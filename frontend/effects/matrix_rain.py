#!/usr/bin/env python3
"""
Matrix rain effect generator using local fonts and Hebrew letters.

- Loads a TTF font from ../static/fonts (default: first .ttf in that folder).
- Draws falling columns of Hebrew letters with rainbow colors.
- Generates an animated GIF by default.

Usage:
  python frontend/effects/matrix_rain.py \
    --width 900 --height 520 \
    --font-size 28 \
    --frames 180 \
    --fps 20 \
    --output ../static/effects/matrix_rain.gif

Notes:
- If your chosen font lacks Hebrew glyphs, rendering may fallback or show tofu.
- Place a Hebrew-capable TTF in frontend/static/fonts and pass --font to use it.
"""
from __future__ import annotations
import os
import random
import math
import argparse
import colorsys
from typing import List, Tuple

from PIL import Image, ImageDraw, ImageFont

# Hebrew letters (final forms included)
HEBREW_LETTERS = list("אבגדהוזחטיךכלםמןנסעפףצץקרשת")


def find_default_font(font_dir: str) -> str | None:
    if not os.path.isdir(font_dir):
        return None
    for name in os.listdir(font_dir):
        if name.lower().endswith(".ttf"):
            return os.path.join(font_dir, name)
    return None


def load_font(font_path: str | None, font_size: int) -> ImageFont.FreeTypeFont:
    if not font_path or not os.path.exists(font_path):
        # Try default in ../static/fonts relative to this script
        here = os.path.dirname(os.path.abspath(__file__))
        fallback_dir = os.path.abspath(os.path.join(here, "../static/fonts"))
        font_path = find_default_font(fallback_dir)
        if not font_path:
            raise FileNotFoundError(
                "No .ttf font found. Place a TTF in frontend/static/fonts or pass --font"
            )
    return ImageFont.truetype(font_path, font_size)


def measure_char(font: ImageFont.FreeTypeFont, sample: str = "א") -> Tuple[int, int]:
    # getbbox is more accurate than getsize for FreeTypeFont
    try:
        bbox = font.getbbox(sample)
        w = bbox[2] - bbox[0]
        h = bbox[3] - bbox[1]
        return max(1, w), max(1, h)
    except Exception:
        w, h = font.getsize(sample)
        return max(1, w), max(1, h)


def hsv_to_rgb255(h: float, s: float, v: float) -> Tuple[int, int, int]:
    r, g, b = colorsys.hsv_to_rgb(h, s, v)
    return int(r * 255), int(g * 255), int(b * 255)


def generate_matrix_rain(
    width: int,
    height: int,
    font: ImageFont.FreeTypeFont,
    frames: int,
    fps: int,
    output_path: str,
    fade_alpha: float = 0.08,
    min_speed: float = 0.6,
    max_speed: float = 1.2,
    seed: int | None = None,
):
    """Generate the matrix rain animated GIF.

    fade_alpha: amount of black overlay per frame (0..1) to create trails
    speeds are in units of character-height per frame
    """
    if seed is not None:
        random.seed(seed)

    cw, ch = measure_char(font)
    # Add a small spacing between columns
    spacing = max(1, cw // 6)
    col_width = cw + spacing
    cols = max(1, width // col_width)

    # Initialize drop positions and speeds per column
    positions = [random.uniform(-10.0, 0.0) for _ in range(cols)]  # in rows (char heights)
    speeds = [random.uniform(min_speed, max_speed) for _ in range(cols)]

    # Precompute X positions per column
    col_x = [i * col_width for i in range(cols)]

    # Create initial black RGBA frame
    frame_rgba = Image.new("RGBA", (width, height), (0, 0, 0, 255))
    draw = ImageDraw.Draw(frame_rgba)

    frames_rgb: List[Image.Image] = []

    # Conversion helper for trails: overlay semi-transparent black
    def apply_fade(img: Image.Image, alpha_amount: float) -> Image.Image:
        alpha = int(max(0, min(1, alpha_amount)) * 255)
        fade = Image.new("RGBA", img.size, (0, 0, 0, alpha))
        return Image.alpha_composite(img, fade)

    # Draw loop
    for i in range(frames):
        # Trail fade
        frame_rgba = apply_fade(frame_rgba, fade_alpha)
        draw = ImageDraw.Draw(frame_rgba)

        # Optionally vary hue base per frame for a global flow
        base_h = (i / max(1, frames)) % 1.0

        for c in range(cols):
            # Occasionally refresh speed to vary
            if random.random() < 0.01:
                speeds[c] = random.uniform(min_speed, max_speed)

            # Advance drop
            positions[c] += speeds[c]

            # Reset drop when it goes beyond the bottom with small random delay
            max_rows = height / ch
            if positions[c] * ch > height + random.uniform(0, 4) * ch:
                positions[c] = random.uniform(-12.0, -1.0)

            # Draw the head character at integer row position
            row = int(positions[c])
            y = row * ch
            if 0 <= y < height:
                ch_ = random.choice(HEBREW_LETTERS)
                # Rainbow color per column and frame
                h = (base_h + c / max(1, cols) + random.uniform(-0.03, 0.03)) % 1.0
                s = random.uniform(0.85, 1.0)
                v = random.uniform(0.85, 1.0)
                color = hsv_to_rgb255(h, s, v)
                # Occasionally highlight the leading char brighter (simulate head)
                if random.random() < 0.12:
                    v2 = min(1.0, v * 1.2)
                    color = hsv_to_rgb255(h, s, v2)
                draw.text((col_x[c], y), ch_, font=font, fill=color)

            # Optionally sprinkle a mid-tail replacement to create more density
            if random.random() < 0.15:
                tail_row = row - random.randint(2, 8)
                ty = tail_row * ch
                if 0 <= ty < height:
                    ch_2 = random.choice(HEBREW_LETTERS)
                    h2 = (base_h + random.random()) % 1.0
                    s2 = random.uniform(0.7, 1.0)
                    v2 = random.uniform(0.6, 0.9)
                    color2 = hsv_to_rgb255(h2, s2, v2)
                    draw.text((col_x[c], ty), ch_2, font=font, fill=color2)

        # Store RGB frame (GIF-friendly)
        frames_rgb.append(frame_rgba.convert("RGB"))

    # Ensure output directory exists
    out_dir = os.path.dirname(os.path.abspath(output_path))
    if out_dir and not os.path.exists(out_dir):
        os.makedirs(out_dir, exist_ok=True)

    # Save as animated GIF
    duration_ms = int(1000 / max(1, fps))
    frames_rgb[0].save(
        output_path,
        save_all=True,
        append_images=frames_rgb[1:],
        duration=duration_ms,
        loop=0,
        optimize=False,
        disposal=2,  # restore to background for better trails between frames
    )
    print(f"Saved matrix rain animation -> {output_path}")


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    default_output = os.path.abspath(os.path.join(here, "../static/effects/matrix_rain.gif"))
    default_font_dir = os.path.abspath(os.path.join(here, "../static/fonts"))

    parser = argparse.ArgumentParser(description="Generate a matrix rain animation using local fonts and Hebrew letters.")
    parser.add_argument("--width", type=int, default=900, help="Output width in pixels")
    parser.add_argument("--height", type=int, default=520, help="Output height in pixels")
    parser.add_argument("--font", type=str, default=None, help="Path to TTF font. Defaults to first .ttf in static/fonts")
    parser.add_argument("--font-size", type=int, default=28, help="Font size in pixels")
    parser.add_argument("--frames", type=int, default=180, help="Number of frames to generate")
    parser.add_argument("--fps", type=int, default=20, help="Frames per second (GIF frame delay)")
    parser.add_argument("--output", type=str, default=default_output, help="Output GIF path")
    parser.add_argument("--fade", type=float, default=0.08, help="Trail fade alpha per frame (0..1)")
    parser.add_argument("--seed", type=int, default=None, help="Random seed for reproducibility")
    args = parser.parse_args()

    font = load_font(args.font, args.font_size)
    print(f"Using font: {getattr(font, 'path', args.font) or 'loaded'} size {args.font_size}")
    print(f"Fonts dir (for defaults): {default_font_dir}")

    generate_matrix_rain(
        width=args.width,
        height=args.height,
        font=font,
        frames=args.frames,
        fps=args.fps,
        output_path=args.output,
        fade_alpha=args.fade,
        seed=args.seed,
    )


if __name__ == "__main__":
    main()
