const join = (...parts: string[]) => parts
	.filter(Boolean)
	.join('/')
	.replace(/\/+/g, '/');

export { join };
export default { join };
