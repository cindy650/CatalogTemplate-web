declare module '*.css';
declare module 'i18next-browser-languagedetector';

declare module 'monaco-editor/*?worker' {
	const WorkerConstructor: new () => Worker;
	export default WorkerConstructor;
}
