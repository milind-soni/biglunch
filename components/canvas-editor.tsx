'use client'

import { useCallback, useMemo } from 'react'
import {
	ReactFlow,
	Background,
	Controls,
	MiniMap,
	Handle,
	Position,
	type Node,
	type Edge,
	type NodeTypes,
	useReactFlow,
	ReactFlowProvider,
	BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useWorkflow } from '@/lib/workflow-context'
import { WorkflowGraph } from '@/lib/workflow-types'
import { AgGridReact } from 'ag-grid-react'
import { AllCommunityModule, ModuleRegistry, themeQuartz, themeAlpine } from 'ag-grid-community'
import { DynamicChart } from './dynamic-chart'
import { Config, Result } from '@/lib/types'

ModuleRegistry.registerModules([AllCommunityModule])

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Table Node — data source pill
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function TableNode({ data }: { data: { tableName: string; columns: string[] } }) {
	return (
		<div style={{
			width: 200, height: 56,
			background: 'var(--color-background, #fff)',
			border: '1.5px solid var(--color-muted, #e5e7eb)',
			borderRadius: 10,
			fontFamily: 'system-ui, -apple-system, sans-serif',
			display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px',
			color: 'var(--color-text, #111)',
		}}>
			<div style={{
				width: 32, height: 32, borderRadius: 8,
				background: 'linear-gradient(135deg, #818cf8, #6366f1)',
				display: 'flex', alignItems: 'center', justifyContent: 'center',
				color: 'white', flexShrink: 0,
			}}>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
					<rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 3v18" />
				</svg>
			</div>
			<div style={{ minWidth: 0 }}>
				<div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
					{data.tableName}
				</div>
				{data.columns.length > 0 && (
					<div style={{ fontSize: 9, opacity: 0.45, marginTop: 1 }}>
						{data.columns.length} column{data.columns.length !== 1 ? 's' : ''}
					</div>
				)}
			</div>
			<Handle type="source" position={Position.Right} style={{ background: '#6366f1', width: 8, height: 8 }} />
		</div>
	)
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Query Node — question + SQL
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function QueryNode({ data }: { data: { question: string; sql: string; totalRows: number } }) {
	return (
		<div style={{
			width: 340, height: 200,
			background: 'var(--color-background, #fff)',
			border: '1.5px solid var(--color-muted, #e5e7eb)',
			borderRadius: 12,
			fontFamily: 'system-ui, -apple-system, sans-serif',
			display: 'flex', flexDirection: 'column',
			overflow: 'hidden',
			color: 'var(--color-text, #111)',
		}}>
			<Handle type="target" position={Position.Left} style={{ background: '#0ea5e9', width: 8, height: 8 }} />
			<div style={{
				padding: '10px 14px',
				display: 'flex', alignItems: 'center', gap: 10,
				borderBottom: '1px solid var(--color-muted, #e5e7eb)',
				flexShrink: 0,
			}}>
				<div style={{
					width: 32, height: 32, borderRadius: 8,
					background: 'linear-gradient(135deg, #38bdf8, #0ea5e9)',
					display: 'flex', alignItems: 'center', justifyContent: 'center',
					color: 'white', flexShrink: 0,
				}}>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
						<circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
					</svg>
				</div>
				<div style={{ flex: 1, minWidth: 0 }}>
					<div style={{ fontWeight: 600, fontSize: 12, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
						{data.question || 'Query'}
					</div>
					<div style={{ fontSize: 10, opacity: 0.45, marginTop: 1 }}>
						{data.totalRows} row{data.totalRows !== 1 ? 's' : ''} returned
					</div>
				</div>
			</div>
			<pre style={{
				flex: 1, margin: 0, padding: '8px 14px',
				fontSize: 10, fontFamily: 'ui-monospace, "SF Mono", monospace',
				opacity: 0.5, lineHeight: 1.5,
				whiteSpace: 'pre-wrap', overflow: 'auto',
			}}>
				{data.sql}
			</pre>
			<Handle type="source" position={Position.Right} style={{ background: '#0ea5e9', width: 8, height: 8 }} />
		</div>
	)
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Chart Node — visualization only
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function ChartNode({ data }: { data: { rows: Record<string, unknown>[]; visualization: any } }) {
	const viz = data.visualization
	const chartConfig: Config | null = viz ? {
		type: viz.type, xKey: viz.xKey, yKeys: viz.yKeys,
		title: '', description: '', takeaway: '', legend: true,
	} : null
	const chartData: Result[] = (data.rows || []).map((row: any) => {
		const r: Result = {}
		for (const [k, v] of Object.entries(row)) { r[k] = typeof v === 'number' ? v : String(v ?? '') }
		return r
	})

	return (
		<div style={{
			width: 520, height: 420,
			background: 'var(--color-background, #fff)',
			border: '1.5px solid var(--color-muted, #e5e7eb)',
			borderRadius: 12,
			fontFamily: 'system-ui, -apple-system, sans-serif',
			display: 'flex', flexDirection: 'column',
			overflow: 'hidden',
			color: 'var(--color-text, #111)',
		}}>
			<Handle type="target" position={Position.Left} style={{ background: '#10b981', width: 8, height: 8 }} />
			<div style={{
				padding: '8px 14px',
				display: 'flex', alignItems: 'center', gap: 10,
				borderBottom: '1px solid var(--color-muted, #e5e7eb)',
				flexShrink: 0,
			}}>
				<div style={{
					width: 32, height: 32, borderRadius: 8,
					background: 'linear-gradient(135deg, #34d399, #10b981)',
					display: 'flex', alignItems: 'center', justifyContent: 'center',
					color: 'white', flexShrink: 0,
				}}>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
						<path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" />
					</svg>
				</div>
				<div style={{ fontSize: 12, fontWeight: 600 }}>
					{viz?.title || 'Chart'}
				</div>
			</div>
			<div style={{ flex: 1, minHeight: 0, padding: '8px 8px 4px' }}>
				{chartConfig && chartData.length >= 2 ? (
					<DynamicChart chartData={chartData} chartConfig={chartConfig} />
				) : (
					<div style={{ padding: 24, fontSize: 11, opacity: 0.4, textAlign: 'center' }}>No data</div>
				)}
			</div>
		</div>
	)
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Results Node — AG Grid data table
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function ResultsNode({ data }: { data: { columns: string[]; rows: Record<string, unknown>[]; totalRows: number } }) {
	const columns = data.columns || []
	const rows = data.rows || []
	const visibleCols = columns.filter((c) => !c.startsWith('_dlt_'))
	const colDefs = visibleCols.map((c) => ({
		field: c,
		headerName: c.replace(/^properties__/, '').replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()),
		flex: 1, minWidth: 90,
	}))

	return (
		<div style={{
			width: 520, height: 320,
			background: 'var(--color-background, #fff)',
			border: '1.5px solid var(--color-muted, #e5e7eb)',
			borderRadius: 12,
			fontFamily: 'system-ui, -apple-system, sans-serif',
			display: 'flex', flexDirection: 'column',
			overflow: 'hidden',
			color: 'var(--color-text, #111)',
		}}>
			<Handle type="target" position={Position.Left} style={{ background: '#d97706', width: 8, height: 8 }} />
			<div style={{
				padding: '8px 14px',
				display: 'flex', alignItems: 'center', gap: 10,
				borderBottom: '1px solid var(--color-muted, #e5e7eb)',
				flexShrink: 0,
			}}>
				<div style={{
					width: 32, height: 32, borderRadius: 8,
					background: 'linear-gradient(135deg, #f59e0b, #d97706)',
					display: 'flex', alignItems: 'center', justifyContent: 'center',
					color: 'white', flexShrink: 0,
				}}>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
						<rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
					</svg>
				</div>
				<div style={{ fontSize: 12, fontWeight: 600 }}>
					{data.totalRows} row{data.totalRows !== 1 ? 's' : ''}
					<span style={{ opacity: 0.45, fontWeight: 400, marginLeft: 6 }}>Results</span>
				</div>
			</div>
			<div className="nopan nowheel" style={{ flex: 1, minHeight: 0 }}>
				{rows.length > 0 ? (
					<AgGridReact rowData={rows} columnDefs={colDefs} theme={themeQuartz}
						headerHeight={28} rowHeight={26} suppressCellFocus domLayout="normal" />
				) : (
					<div style={{ padding: 24, fontSize: 11, opacity: 0.4, textAlign: 'center' }}>No rows</div>
				)}
			</div>
		</div>
	)
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Graph conversion + Editor
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const nodeTypes: NodeTypes = {
	table: TableNode,
	query: QueryNode,
	chart: ChartNode,
	results: ResultsNode,
}

function graphToFlow(graph: WorkflowGraph): { nodes: Node[]; edges: Edge[] } {
	const nodes: Node[] = graph.nodes.map((node) => ({
		id: node.id,
		type: node.type,
		position: node.position,
		data: node.data,
		draggable: true,
		selectable: true,
	}))

	const edges: Edge[] = graph.edges.map((edge) => ({
		id: edge.id,
		source: edge.from,
		target: edge.to,
		type: 'smoothstep',
		animated: true,
		style: { stroke: 'var(--color-text-3, #aaa)', strokeWidth: 2 },
	}))

	return { nodes, edges }
}

function CanvasEditorInner() {
	const { graph } = useWorkflow()
	const { fitView } = useReactFlow()

	const { nodes, edges } = useMemo(() => graphToFlow(graph), [graph])

	const onNodesChange = useCallback(() => {}, [])

	return (
		<ReactFlow
			nodes={nodes}
			edges={edges}
			nodeTypes={nodeTypes}
			onNodesChange={onNodesChange}
			fitView
			fitViewOptions={{ padding: 0.2 }}
			colorMode="system"
			proOptions={{ hideAttribution: true }}
			minZoom={0.1}
			maxZoom={2}
			defaultEdgeOptions={{
				type: 'smoothstep',
				animated: true,
				style: { stroke: 'var(--color-text-3, #aaa)', strokeWidth: 2 },
			}}
		>
			<Background variant={BackgroundVariant.Dots} gap={20} size={1} />
			<Controls showInteractive={false} />
			<MiniMap
				nodeStrokeWidth={3}
				pannable
				zoomable
				style={{ background: 'var(--color-background, #f8f9fa)' }}
			/>
		</ReactFlow>
	)
}

export function CanvasEditor() {
	return (
		<div style={{ width: '100%', height: '100%' }}>
			<ReactFlowProvider>
				<CanvasEditorInner />
			</ReactFlowProvider>
		</div>
	)
}
