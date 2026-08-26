from __future__ import annotations

import argparse
import base64
import json
import mimetypes
from pathlib import Path
import sys
from urllib.request import urlopen

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
RUNNER = (ROOT / "browser" / "runner.html").as_uri()


def render_json(input_path: Path, jpg_path: Path | None, png_path: Path | None, dpi: float = 300):
    document = json.loads(input_path.read_text(encoding="utf-8"))
    embed_local_resources(document, input_path.parent)
    formats = [name for name, path_value in (("jpg", jpg_path), ("png", png_path)) if path_value]
    with sync_playwright() as playwright:
        browser = launch_browser(playwright)
        try:
            page = browser.new_page(viewport={"width": 1280, "height": 800}, device_scale_factor=1)
            page.goto(RUNNER)
            page.wait_for_function("Boolean(globalThis.ImageMapHeadlessRenderer)")
            result = page.evaluate(
                "payload => globalThis.ImageMapHeadlessRenderer.render(payload)",
                {"json": document, "dpi": dpi, "quality": 0.95, "formats": formats},
            )
        finally:
            browser.close()
    for format_name, output_path in (("jpg", jpg_path), ("png", png_path)):
        if output_path:
            write_data_url(output_path, result["images"][format_name])
    return {key: value for key, value in result.items() if key != "images"}


def launch_browser(playwright):
    candidates = [
        Path("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"),
        Path("C:/Program Files/Microsoft/Edge/Application/msedge.exe"),
        Path("C:/Program Files/Google/Chrome/Application/chrome.exe"),
        Path("C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"),
    ]
    for candidate in candidates:
        if candidate.is_file():
            return playwright.chromium.launch(headless=True, executable_path=str(candidate))
    return playwright.chromium.launch(headless=True)


def embed_local_resources(document, base_directory: Path):
    if isinstance(document, list):
        objects = document
    elif isinstance(document, dict):
        layers = document.get("layers") if isinstance(document.get("layers"), dict) else {}
        objects = document.get("objects") or layers.get("objects") or []
    else:
        objects = []
    for item in objects:
        if not isinstance(item, dict):
            continue
        for key in ("src", "fontUrl", "font_url"):
            value = item.get(key)
            if not isinstance(value, str) or not value or value.startswith(("data:", "blob:")):
                continue
            if value.startswith(("http:", "https:")):
                with urlopen(value) as response:
                    content = response.read()
                    mime = response.headers.get_content_type()
            else:
                resource = (base_directory / value.removeprefix("file://")).resolve()
                content = resource.read_bytes()
                mime = mimetypes.guess_type(resource.name)[0] or "application/octet-stream"
            item[key] = f"data:{mime};base64,{base64.b64encode(content).decode('ascii')}"
        if isinstance(item.get("objects"), list):
            embed_local_resources(item["objects"], base_directory)


def write_data_url(output_path: Path, data_url: str):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(base64.b64decode(data_url.split(",", 1)[1]))


def main():
    parser = argparse.ArgumentParser(description="Render CatalogTemplate image-map JSON to JPG/PNG")
    parser.add_argument("input", type=Path)
    parser.add_argument("--jpg", type=Path)
    parser.add_argument("--png", type=Path)
    parser.add_argument("--dpi", type=float, default=300)
    args = parser.parse_args()
    input_path = args.input.resolve()
    jpg_path = args.jpg.resolve() if args.jpg else input_path.with_suffix(".jpg")
    png_path = args.png.resolve() if args.png else input_path.with_suffix(".png")
    result = render_json(input_path, jpg_path, png_path, args.dpi)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"{type(exc).__name__}: {exc}", file=sys.stderr)
        raise
