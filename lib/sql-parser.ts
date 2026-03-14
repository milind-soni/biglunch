export function extractTableReferences(sql: string): string[] {
	const tables = new Set<string>()
	const pattern = /(?:FROM|JOIN)\s+"?(\w+)"?/gi
	let match
	while ((match = pattern.exec(sql)) !== null) {
		const name = match[1]
		if (name.toLowerCase() === 'information_schema' || name.toLowerCase() === 'main') continue
		tables.add(name)
	}
	return Array.from(tables)
}
