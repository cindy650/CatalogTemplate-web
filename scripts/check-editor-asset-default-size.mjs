import { readFile } from "node:fs/promises";

const descriptorsUrl = new URL(
  "../src/image-map-editor/editors/imagemap/Descriptors.json",
  import.meta.url,
);
const descriptors = JSON.parse(await readFile(descriptorsUrl, "utf8"));
const sizedAssetTypes = new Set(["image", "gif", "svg"]);
const assets = Object.values(descriptors)
  .flat()
  .filter((descriptor) => sizedAssetTypes.has(descriptor.option?.type));
const invalidAssets = assets.filter(({ option }) =>
  [option.width, option.height].some(
    (value) => !Number.isFinite(value) || value <= 0,
  ),
);

if (invalidAssets.length > 0) {
  const details = invalidAssets
    .map(
      ({ name, option }) =>
        `${name} (${option.type}): ${String(option.width)} x ${String(option.height)}`,
    )
    .join("\n");

  throw new Error(`素材缺少有效的默认宽高：\n${details}`);
}

console.log(`已检查 ${assets.length} 个图片、GIF 和 SVG 素材的默认宽高。`);
