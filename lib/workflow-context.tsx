'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { extractTableReferences } from './sql-parser'
import { WorkflowEdge, WorkflowGraph, WorkflowNode } from './workflow-types'

interface AddQueryParams {
	question: string
	sql: string
	toolCallId: string
	result: {
		columns: string[]
		rows: Record<string, unknown>[]
		totalRows: number
		visualization: {
			type: 'bar' | 'line' | 'area' | 'pie'
			xKey: string
			yKeys: string[]
			title: string
		} | null
	}
}

interface WorkflowContextValue {
	graph: WorkflowGraph
	addQueryExecution: (params: AddQueryParams) => void
	clearGraph: () => void
}

const WorkflowContext = createContext<WorkflowContextValue | null>(null)

const STORAGE_KEY = 'biglunch-workflow'
const TABLE_X = 50
const QUERY_X = 400
const OUTPUT_X = 800
const ROW_GAP = 600
const OUTPUT_GAP = 480

function loadGraph(): WorkflowGraph {
	if (typeof window === 'undefined') return { nodes: [], edges: [] }
	try {
		const stored = localStorage.getItem(STORAGE_KEY)
		if (stored) {
			const parsed = JSON.parse(stored)
			// Filter out old 'result' nodes from previous schema
			parsed.nodes = (parsed.nodes || []).filter((n: any) => n.type !== 'result')
			parsed.edges = (parsed.edges || []).filter((e: any) =>
				!e.from.startsWith('result-') && !e.to.startsWith('result-')
			)
			return parsed
		}
	} catch {}
	return { nodes: [], edges: [] }
}

function saveGraph(graph: WorkflowGraph) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(graph))
	} catch {}
}

export function WorkflowProvider({ children }: { children: React.ReactNode }) {
	const [graph, setGraph] = useState<WorkflowGraph>(() => loadGraph())
	const graphRef = useRef(graph)
	graphRef.current = graph

	useEffect(() => {
		saveGraph(graph)
	}, [graph])

	const addQueryExecution = useCallback((params: AddQueryParams) => {
		setGraph((prev) => {
			if (prev.nodes.some((n) => n.type === 'query' && n.data.toolCallId === params.toolCallId)) {
				return prev
			}

			const tables = extractTableReferences(params.sql)
			const queryCount = prev.nodes.filter((n) => n.type === 'query').length
			const rowY = queryCount * ROW_GAP + 100

			const newNodes: WorkflowNode[] = []
			const newEdges: WorkflowEdge[] = []

			// Create or find table nodes
			const tableNodeIds: string[] = []
			for (const tableName of tables) {
				const existing = prev.nodes.find(
					(n) => n.type === 'table' && n.data.tableName === tableName
				)
				if (existing) {
					tableNodeIds.push(existing.id)
				} else {
					const tableId = `table-${tableName}`
					const tableCount = prev.nodes.filter((n) => n.type === 'table').length +
						newNodes.filter((n) => n.type === 'table').length
					newNodes.push({
						id: tableId,
						type: 'table',
						position: { x: TABLE_X, y: tableCount * 120 + 100 },
						data: { tableName, columns: params.result.columns },
					})
					tableNodeIds.push(tableId)
				}
			}

			// Create query node
			const queryId = `query-${params.toolCallId}`
			newNodes.push({
				id: queryId,
				type: 'query',
				position: { x: QUERY_X, y: rowY },
				data: {
					question: params.question,
					sql: params.sql,
					toolCallId: params.toolCallId,
					timestamp: Date.now(),
					totalRows: params.result.totalRows,
				},
			})

			// Create chart node (only if visualization exists)
			const hasViz = params.result.visualization && params.result.rows.length >= 2
			const chartId = `chart-${params.toolCallId}`
			if (hasViz) {
				newNodes.push({
					id: chartId,
					type: 'chart',
					position: { x: OUTPUT_X, y: rowY - OUTPUT_GAP / 2 },
					data: {
						columns: params.result.columns,
						rows: params.result.rows.slice(0, 50),
						totalRows: params.result.totalRows,
						visualization: params.result.visualization,
						toolCallId: params.toolCallId,
					},
				})
			}

			// Create results table node
			const resultsId = `results-${params.toolCallId}`
			newNodes.push({
				id: resultsId,
				type: 'results',
				position: { x: OUTPUT_X, y: hasViz ? rowY + OUTPUT_GAP / 2 : rowY },
				data: {
					columns: params.result.columns,
					rows: params.result.rows.slice(0, 50),
					totalRows: params.result.totalRows,
					toolCallId: params.toolCallId,
				},
			})

			// Edges: tables → query → chart/results
			for (const tableId of tableNodeIds) {
				newEdges.push({
					id: `edge-${tableId}-${queryId}`,
					from: tableId,
					to: queryId,
				})
			}
			if (hasViz) {
				newEdges.push({
					id: `edge-${queryId}-${chartId}`,
					from: queryId,
					to: chartId,
				})
			}
			newEdges.push({
				id: `edge-${queryId}-${resultsId}`,
				from: queryId,
				to: resultsId,
			})

			return {
				nodes: [...prev.nodes, ...newNodes],
				edges: [...prev.edges, ...newEdges],
			}
		})
	}, [])

	const clearGraph = useCallback(() => {
		setGraph({ nodes: [], edges: [] })
	}, [])

	return (
		<WorkflowContext.Provider value={{ graph, addQueryExecution, clearGraph }}>
			{children}
		</WorkflowContext.Provider>
	)
}

export function useWorkflow() {
	const ctx = useContext(WorkflowContext)
	if (!ctx) throw new Error('useWorkflow must be used inside WorkflowProvider')
	return ctx
}
