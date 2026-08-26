import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import { translation, translationKo, translationZhCN } from '../locales';

const i18nClient = i18n.use(LanguageDetector);

i18nClient.init({
	load: 'all',
	lng: 'zh-CN',
	whitelist: ['zh', 'zh-CN', 'en', 'en-US', 'ko', 'ko-KR'],
	nonExplicitWhitelist: false,
	lngs: ['zh-CN', 'en-US', 'ko-KR'],
	fallbackLng: 'zh-CN',
	interpolation: {
		escapeValue: false,
	},
	react: {
		wait: true,
		nsMode: 'default',
	},
	defaultNS: 'locale.constant',
	resources: {
		zh: {
			'locale.constant': translationZhCN,
		},
		'zh-CN': {
			'locale.constant': translationZhCN,
		},
		en: {
			'locale.constant': translation,
		},
		'en-US': {
			'locale.constant': translation,
		},
		ko: {
			'locale.constant': translationKo,
		},
		'ko-KR': {
			'locale.constant': translationKo,
		},
	},
} as any);

export default () => i18nClient;
