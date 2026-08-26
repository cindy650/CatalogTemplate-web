import fs from 'node:fs';
import postcss from 'postcss';

const stylesheet = 'src/image-map-editor/styles/app.css';
const root = postcss.parse(fs.readFileSync(stylesheet, 'utf8'), { from: stylesheet });
const keyframeSelector = /^(?:from|to|\d+%)$/;
const leaks = [];

root.walkRules(rule => {
	for (const selector of rule.selectors ?? []) {
		const value = selector.trim();
		if (
			!value.includes('.rde-') &&
			!value.includes('.fa') &&
			!keyframeSelector.test(value)
		) {
			leaks.push(`${rule.source?.start?.line ?? '?'}: ${value}`);
		}
	}
});

if (leaks.length) {
	console.error('Editor stylesheet contains selectors that can leak into the host application:');
	console.error(leaks.join('\n'));
	process.exit(1);
}

console.log('Editor stylesheet scope check passed.');
