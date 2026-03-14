export interface WorkflowGraph {
	nodes: WorkflowNode[]
	edges: WorkflowEdge[]
}

export type WorkflowNode = TableNode | QueryNode | ChartNode | ResultsNode

interface BaseNode {
	id: string
	position: { x: number; y: number }
}

export interface TableNode extends BaseNode {
	type: 'table'
	data: {
		tableName: string
		columns: string[]
	}
}

export interface QueryNode extends BaseNode {
	type: 'query'
	data: {
		question: string
		sql: string
		toolCallId: string
		timestamp: number
		totalRows: number
	}
}

export interface ChartNode extends BaseNode {
	type: 'chart'
	data: {
		columns: string[]
		rows: Record<string, unknown>[]
		totalRows: number
		visualization: {
			type: 'bar' | 'line' | 'area' | 'pie'
			xKey: string
			yKeys: string[]
			title: string
		} | null
		toolCallId: string
	}
}

export interface ResultsNode extends BaseNode {
	type: 'results'
	data: {
		columns: string[]
		rows: Record<string, unknown>[]
		totalRows: number
		toolCallId: string
	}
}

export interface WorkflowEdge {
	id: string
	from: string
	to: string
}
