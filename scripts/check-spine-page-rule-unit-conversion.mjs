import assert from 'node:assert/strict';
import {
  convertImageMapSizeSchemeUnit,
  resolveImageMapSpineBleed,
  resolveImageMapSpinePageRule,
  resolveImageMapSpineWidth,
} from '../src/image-map-editor/editors/imagemap/ImageMapSizeScheme.ts';

const rules = {
  unit: 'cm',
  matchStrategy: 'exact',
  items: [
    { pageCount: 10, spineWidth: 1.4, spineBleed: 0.3 },
    { pageCount: 20, spineWidth: 2.2, spineBleed: 0.5 },
  ],
};

assert.deepEqual(
  resolveImageMapSpinePageRule(rules, 10, 'cm'),
  { pageCount: 10, spineWidth: 1.4, spineBleed: 0.3 },
  'cm 规则在 cm 规格中应保持原值',
);
assert.deepEqual(
  resolveImageMapSpinePageRule(rules, 10, 'mm'),
  { pageCount: 10, spineWidth: 14, spineBleed: 3 },
  'cm 规则切换到 mm 规格时应乘以 10',
);
assert.deepEqual(
  resolveImageMapSpinePageRule(rules, 10, 'in'),
  { pageCount: 10, spineWidth: 0.5512, spineBleed: 0.1181 },
  'cm 规则切换到 in 规格时应转换为英寸',
);

const millimetreScheme = {
  unit: 'mm',
  pageCount: 10,
  pageCountOptions: [10, 20],
  spineWidthMode: 'by_page_count',
  spineWidthBasis: 'page_count_table',
  spineWidthPageRules: rules,
  // These simulate stale values previously persisted on the size template.
  spineWidth: 25,
  spineBleed: 8,
};
assert.equal(resolveImageMapSpineWidth(millimetreScheme), 14, '画布首次加载必须使用分段规则，而不是旧模板背脊宽');
assert.equal(resolveImageMapSpineBleed(millimetreScheme), 3, '画布首次加载必须使用分段规则，而不是旧模板背脊出血');

assert.equal(
  resolveImageMapSpineWidth({ ...millimetreScheme, spineWidthFormula: { unit: 'cm', pageCountCoefficient: 0.2, pageCountThickness: 0.3, baseWidth: 1, additionalWidth: 0.9, spineBleed: 0 } }),
  14,
  '分段规则存在时不能被同产品的公式字段覆盖',
);

const centimetreScheme = convertImageMapSizeSchemeUnit(millimetreScheme, 'mm', 'cm');
assert.equal(resolveImageMapSpineWidth(centimetreScheme), 1.4, '规格切换到 cm 后，画布背脊宽必须按规则单位重新解析');
assert.equal(resolveImageMapSpineBleed(centimetreScheme), 0.3, '规格切换到 cm 后，画布背脊出血必须按规则单位重新解析');

console.log('spine page-rule unit conversion: ok');
