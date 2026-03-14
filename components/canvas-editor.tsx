'use client'

import { useEffect, useRef, useCallback } from 'react'
import {
	BindingUtil,
	CubicBezier2d,
	createShapeId,
	Editor,
	HTMLContainer,
	Mat,
	Rectangle2d,
	ShapeUtil,
	SVGContainer,
	T,
	TLBinding,
	TLShape,
	Tldraw,
	RecordProps,
	Vec,
	VecLike,
	vecModelValidator,
	useEditor,
	useValue,
	clamp,
	createComputedCache,
} from 'tldraw'
import 'tldraw/tldraw.css'
import { useWorkflow } from '@/lib/workflow-context'
import { WorkflowGraph } from '@/lib/workflow-types'
import { AgGridReact } from 'ag-grid-react'
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community'
import { DynamicChart } from './dynamic-chart'
import { Config, Result } from '@/lib/types'

ModuleRegistry.registerModules([AllCommunityModule])

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Connection Shape — bezier curve arrows (from komputer)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const CONNECTION_TYPE = 'connection' as const
declare module 'tldraw' {
	interface TLGlobalShapePropsMap {
		[CONNECTION_TYPE]: { start: { x: number; y: number }; end: { x: number; y: number } }
	}
	interface TLGlobalBindingPropsMap {
		[CONNECTION_TYPE]: { terminal: 'start' | 'end' }
	}
}

type ConnectionShape = TLShape<typeof CONNECTION_TYPE>
type ConnectionBinding = TLBinding<typeof CONNECTION_TYPE>

function getConnectionControlPoints(start: VecLike, end: VecLike): [Vec, Vec] {
	const distance = end.x - start.x
	const adjustedDistance = Math.max(30, distance > 0 ? distance / 3 : clamp(Math.abs(distance) + 30, 0, 100))
	return [new Vec(start.x + adjustedDistance, start.y), new Vec(end.x - adjustedDistance, end.y)]
}

function getConnectionPath(start: VecLike, end: VecLike) {
	const [cp1, cp2] = getConnectionControlPoints(start, end)
	return `M ${start.x} ${start.y} C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${end.x} ${end.y}`
}

// Cache for connection bindings
const connectionBindingsCache = createComputedCache(
	'connection bindings',
	(editor: Editor, connection: ConnectionShape) => {
		const bindings = editor.getBindingsFromShape(connection.id, CONNECTION_TYPE)
		let start: ConnectionBinding | undefined, end: ConnectionBinding | undefined
		for (const b of bindings) {
			if (b.props.terminal === 'start') start = b
			else if (b.props.terminal === 'end') end = b
		}
		return { start, end }
	},
	{ areRecordsEqual: (a, b) => a.id === b.id, areResultsEqual: (a, b) => a.start === b.start && a.end === b.end }
)

function getBindingPosition(editor: Editor, binding: ConnectionBinding) {
	const shape = editor.getShape(binding.toId)
	if (!shape) return null
	const geo = editor.getShapeGeometry(shape)
	// Connect to right edge for 'start', left edge for 'end'
	const localPoint = binding.props.terminal === 'start'
		? { x: geo.bounds.w, y: geo.bounds.h / 2 }
		: { x: 0, y: geo.bounds.h / 2 }
	return editor.getShapePageTransform(shape).applyToPoint(localPoint)
}

function getTerminals(editor: Editor, connection: ConnectionShape) {
	const bindings = connectionBindingsCache.get(editor, connection.id) ?? {} as { start?: ConnectionBinding; end?: ConnectionBinding }
	const shapeTransform = Mat.Inverse(editor.getShapePageTransform(connection))
	let start: VecLike = connection.props.start
	let end: VecLike = connection.props.end
	if (bindings.start) {
		const pos = getBindingPosition(editor, bindings.start)
		if (pos) start = Mat.applyToPoint(shapeTransform, pos)
	}
	if (bindings.end) {
		const pos = getBindingPosition(editor, bindings.end)
		if (pos) end = Mat.applyToPoint(shapeTransform, pos)
	}
	return { start, end }
}

function ConnectionComponent({ shape }: { shape: ConnectionShape }) {
	const editor = useEditor()
	const { start, end } = useValue('terminals', () => getTerminals(editor, shape), [editor, shape])
	return (
		<SVGContainer>
			<path
				d={getConnectionPath(start, end)}
				fill="none"
				stroke="var(--color-text-3, #aaa)"
				strokeWidth={2}
				strokeLinecap="round"
			/>
		</SVGContainer>
	)
}

class ConnectionShapeUtil extends ShapeUtil<ConnectionShape> {
	static override type = CONNECTION_TYPE
	static override props: RecordProps<ConnectionShape> = {
		start: vecModelValidator,
		end: vecModelValidator,
	}
	getDefaultProps() { return { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } } }
	getGeometry(shape: ConnectionShape) {
		const { start, end } = getTerminals(this.editor, shape)
		const [cp1, cp2] = getConnectionControlPoints(start, end)
		return new CubicBezier2d({
			start: Vec.From(start), cp1: Vec.From(cp1),
			cp2: Vec.From(cp2), end: Vec.From(end),
		})
	}
	override canResize() { return false }
	override canEdit() { return false }
	override canSnap() { return false }
	override hideResizeHandles() { return true }
	override hideRotateHandle() { return true }
	override hideSelectionBoundsBg() { return true }
	override hideSelectionBoundsFg() { return true }

	component(shape: ConnectionShape) { return <ConnectionComponent shape={shape} /> }
	indicator(shape: ConnectionShape) {
		const { start, end } = getTerminals(this.editor, shape)
		return <path d={getConnectionPath(start, end)} strokeWidth={2} strokeLinecap="round" />
	}
}

class ConnectionBindingUtil extends BindingUtil<ConnectionBinding> {
	static override type = CONNECTION_TYPE
	static override props = { terminal: T.literalEnum('start', 'end') }
	override getDefaultProps() { return { terminal: 'start' as const } }
	onBeforeDeleteToShape({ binding }: { binding: ConnectionBinding }) {
		this.editor.deleteShapes([binding.fromId])
	}
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Table Node — data source pill
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const TABLE_TYPE = 'wf-table' as const
declare module 'tldraw' {
	interface TLGlobalShapePropsMap {
		[TABLE_TYPE]: { tableName: string; columns: string }
	}
}
type TableShape = TLShape<typeof TABLE_TYPE>
const TBL_W = 200, TBL_H = 56

class TableShapeUtil extends ShapeUtil<TableShape> {
	static override type = TABLE_TYPE
	static override props: RecordProps<TableShape> = { tableName: T.string, columns: T.string }
	getDefaultProps() { return { tableName: '', columns: '' } }
	getGeometry() { return new Rectangle2d({ width: TBL_W, height: TBL_H, isFilled: true }) }
	override canResize() { return false }
	override hideResizeHandles() { return true }
	override hideRotateHandle() { return true }
	override hideSelectionBoundsBg() { return true }
	override hideSelectionBoundsFg() { return true }

	component(shape: TableShape) {
		const cols = shape.props.columns ? shape.props.columns.split(',') : []
		return (
			<HTMLContainer>
				<div style={{
					width: TBL_W, height: TBL_H,
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
							{shape.props.tableName}
						</div>
						{cols.length > 0 && (
							<div style={{ fontSize: 9, opacity: 0.45, marginTop: 1 }}>
								{cols.length} column{cols.length !== 1 ? 's' : ''}
							</div>
						)}
					</div>
				</div>
			</HTMLContainer>
		)
	}
	indicator() { return <rect width={TBL_W} height={TBL_H} rx={10} /> }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Query Node — question + SQL
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const QUERY_TYPE = 'wf-query' as const
declare module 'tldraw' {
	interface TLGlobalShapePropsMap {
		[QUERY_TYPE]: { question: string; sql: string; totalRows: string }
	}
}
type QueryShape = TLShape<typeof QUERY_TYPE>
const Q_W = 340, Q_H = 200

class QueryShapeUtil extends ShapeUtil<QueryShape> {
	static override type = QUERY_TYPE
	static override props: RecordProps<QueryShape> = { question: T.string, sql: T.string, totalRows: T.string }
	getDefaultProps() { return { question: '', sql: '', totalRows: '0' } }
	getGeometry() { return new Rectangle2d({ width: Q_W, height: Q_H, isFilled: true }) }
	override canResize() { return false }
	override hideResizeHandles() { return true }
	override hideRotateHandle() { return true }
	override hideSelectionBoundsBg() { return true }
	override hideSelectionBoundsFg() { return true }

	component(shape: QueryShape) {
		const rows = parseInt(shape.props.totalRows) || 0
		return (
			<HTMLContainer>
				<div style={{
					width: Q_W, height: Q_H,
					background: 'var(--color-background, #fff)',
					border: '1.5px solid var(--color-muted, #e5e7eb)',
					borderRadius: 12,
					fontFamily: 'system-ui, -apple-system, sans-serif',
					display: 'flex', flexDirection: 'column',
					overflow: 'hidden',
					color: 'var(--color-text, #111)',
				}}>
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
								{shape.props.question || 'Query'}
							</div>
							<div style={{ fontSize: 10, opacity: 0.45, marginTop: 1 }}>
								{rows} row{rows !== 1 ? 's' : ''} returned
							</div>
						</div>
					</div>
					<pre style={{
						flex: 1, margin: 0, padding: '8px 14px',
						fontSize: 10, fontFamily: 'ui-monospace, "SF Mono", monospace',
						opacity: 0.5, lineHeight: 1.5,
						whiteSpace: 'pre-wrap', overflow: 'auto',
					}}>
						{shape.props.sql}
					</pre>
				</div>
			</HTMLContainer>
		)
	}
	indicator() { return <rect width={Q_W} height={Q_H} rx={12} /> }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Chart Node — interactive chart + data table
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const CHART_TYPE = 'wf-chart' as const
declare module 'tldraw' {
	interface TLGlobalShapePropsMap {
		[CHART_TYPE]: { resultJson: string }
	}
}
type ChartShape = TLShape<typeof CHART_TYPE>
const CH_W = 520, CH_H = 420

function ChartShapeComponent({ shape }: { shape: ChartShape }) {
	let data: any = {}
	try { data = JSON.parse(shape.props.resultJson) } catch {}

	const rows: Record<string, any>[] = data.rows || []
	const viz = data.visualization

	const chartConfig: Config | null = viz ? {
		type: viz.type, xKey: viz.xKey, yKeys: viz.yKeys,
		title: '', description: '', takeaway: '', legend: true,
	} : null
	const chartData: Result[] = rows.map((row: any) => {
		const r: Result = {}
		for (const [k, v] of Object.entries(row)) { r[k] = typeof v === 'number' ? v : String(v ?? '') }
		return r
	})

	return (
		<HTMLContainer>
			<div style={{
				width: CH_W, height: CH_H,
				background: 'var(--color-background, #fff)',
				border: '1.5px solid var(--color-muted, #e5e7eb)',
				borderRadius: 12,
				fontFamily: 'system-ui, -apple-system, sans-serif',
				display: 'flex', flexDirection: 'column',
				overflow: 'hidden',
				color: 'var(--color-text, #111)',
			}}>
				{/* Header */}
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
				{/* Chart */}
				<div style={{ flex: 1, minHeight: 0, padding: '8px 8px 4px' }}>
					{chartConfig && rows.length >= 2 ? (
						<DynamicChart chartData={chartData} chartConfig={chartConfig} />
					) : (
						<div style={{ padding: 24, fontSize: 11, opacity: 0.4, textAlign: 'center' }}>No data</div>
					)}
				</div>
			</div>
		</HTMLContainer>
	)
}

class ChartShapeUtil extends ShapeUtil<ChartShape> {
	static override type = CHART_TYPE
	static override props: RecordProps<ChartShape> = { resultJson: T.string }
	getDefaultProps() { return { resultJson: '{}' } }
	getGeometry() { return new Rectangle2d({ width: CH_W, height: CH_H, isFilled: true }) }
	override canResize() { return false }
	override hideResizeHandles() { return true }
	override hideRotateHandle() { return true }
	override hideSelectionBoundsBg() { return true }
	override hideSelectionBoundsFg() { return true }
	component(shape: ChartShape) { return <ChartShapeComponent shape={shape} /> }
	indicator() { return <rect width={CH_W} height={CH_H} rx={12} /> }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Results Node — AG Grid data table
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const RESULTS_TYPE = 'wf-results' as const
declare module 'tldraw' {
	interface TLGlobalShapePropsMap {
		[RESULTS_TYPE]: { resultJson: string }
	}
}
type ResultsShape = TLShape<typeof RESULTS_TYPE>
const RES_W = 520, RES_H = 320

function ResultsShapeComponent({ shape }: { shape: ResultsShape }) {
	const editor = useEditor()

	let data: any = {}
	try { data = JSON.parse(shape.props.resultJson) } catch {}

	const columns: string[] = data.columns || []
	const rows: Record<string, any>[] = data.rows || []
	const totalRows: number = data.totalRows ?? 0

	const visibleCols = columns.filter((c: string) => !c.startsWith('_dlt_'))
	const colDefs = visibleCols.map((c: string) => ({
		field: c,
		headerName: c.replace(/^properties__/, '').replace(/_/g, ' ').replace(/\b\w/g, (ch: string) => ch.toUpperCase()),
		flex: 1, minWidth: 90,
	}))

	const handlePointerDown = useCallback((e: React.PointerEvent) => {
		e.stopPropagation()
		editor.select(shape.id)
	}, [editor, shape.id])

	return (
		<HTMLContainer>
			<div style={{
				width: RES_W, height: RES_H,
				background: 'var(--color-background, #fff)',
				border: '1.5px solid var(--color-muted, #e5e7eb)',
				borderRadius: 12,
				fontFamily: 'system-ui, -apple-system, sans-serif',
				display: 'flex', flexDirection: 'column',
				overflow: 'hidden',
				color: 'var(--color-text, #111)',
			}}>
				{/* Header */}
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
						{totalRows} row{totalRows !== 1 ? 's' : ''}
						<span style={{ opacity: 0.45, fontWeight: 400, marginLeft: 6 }}>Results</span>
					</div>
				</div>
				{/* Table */}
				<div onPointerDown={handlePointerDown} style={{ flex: 1, minHeight: 0, pointerEvents: 'auto' }}>
					{rows.length > 0 ? (
						<AgGridReact rowData={rows} columnDefs={colDefs} theme={themeQuartz}
							headerHeight={28} rowHeight={26} suppressCellFocus domLayout="normal" />
					) : (
						<div style={{ padding: 24, fontSize: 11, opacity: 0.4, textAlign: 'center' }}>No rows</div>
					)}
				</div>
			</div>
		</HTMLContainer>
	)
}

class ResultsShapeUtil extends ShapeUtil<ResultsShape> {
	static override type = RESULTS_TYPE
	static override props: RecordProps<ResultsShape> = { resultJson: T.string }
	getDefaultProps() { return { resultJson: '{}' } }
	getGeometry() { return new Rectangle2d({ width: RES_W, height: RES_H, isFilled: true }) }
	override canResize() { return false }
	override hideResizeHandles() { return true }
	override hideRotateHandle() { return true }
	override hideSelectionBoundsBg() { return true }
	override hideSelectionBoundsFg() { return true }
	component(shape: ResultsShape) { return <ResultsShapeComponent shape={shape} /> }
	indicator() { return <rect width={RES_W} height={RES_H} rx={12} /> }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Sync + Editor
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const shapeUtils = [ConnectionShapeUtil, TableShapeUtil, QueryShapeUtil, ChartShapeUtil, ResultsShapeUtil]
const bindingUtils = [ConnectionBindingUtil]

function syncGraphToEditor(editor: Editor, graph: WorkflowGraph) {
	for (const node of graph.nodes) {
		const id = createShapeId(node.id)
		if (editor.getShape(id)) continue

		if (node.type === 'table') {
			editor.createShape({
				id, type: TABLE_TYPE,
				x: node.position.x, y: node.position.y,
				props: { tableName: node.data.tableName, columns: node.data.columns.join(',') },
			})
		} else if (node.type === 'query') {
			editor.createShape({
				id, type: QUERY_TYPE,
				x: node.position.x, y: node.position.y,
				props: { question: node.data.question, sql: node.data.sql, totalRows: String(node.data.totalRows) },
			})
		} else if (node.type === 'chart') {
			editor.createShape({
				id, type: CHART_TYPE,
				x: node.position.x, y: node.position.y,
				props: {
					resultJson: JSON.stringify({
						columns: node.data.columns, rows: node.data.rows,
						totalRows: node.data.totalRows, visualization: node.data.visualization,
					}),
				},
			})
		} else if (node.type === 'results') {
			editor.createShape({
				id, type: RESULTS_TYPE,
				x: node.position.x, y: node.position.y,
				props: {
					resultJson: JSON.stringify({
						columns: node.data.columns, rows: node.data.rows,
						totalRows: node.data.totalRows,
					}),
				},
			})
		}
	}

	// Create connection shapes with bindings (komputer-style bezier curves)
	for (const edge of graph.edges) {
		const connId = createShapeId(edge.id)
		if (editor.getShape(connId)) continue

		const fromId = createShapeId(edge.from)
		const toId = createShapeId(edge.to)
		if (!editor.getShape(fromId) || !editor.getShape(toId)) continue

		// Create connection shape
		editor.createShape({
			id: connId, type: CONNECTION_TYPE,
			x: 0, y: 0,
			props: { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } },
		})

		// Bind start to source shape, end to target shape
		editor.createBinding({
			type: CONNECTION_TYPE,
			fromId: connId, toId: fromId,
			props: { terminal: 'start' },
		})
		editor.createBinding({
			type: CONNECTION_TYPE,
			fromId: connId, toId: toId,
			props: { terminal: 'end' },
		})
	}
}

export function CanvasEditor() {
	const { graph } = useWorkflow()
	const editorRef = useRef<Editor | null>(null)

	useEffect(() => {
		if (!editorRef.current) return
		syncGraphToEditor(editorRef.current, graph)
	}, [graph])

	return (
		<div style={{ width: '100%', height: '100%' }}>
			<Tldraw
				shapeUtils={shapeUtils}
				bindingUtils={bindingUtils}
				inferDarkMode
				components={{
					Toolbar: null, MainMenu: null, PageMenu: null,
					NavigationPanel: null, StylePanel: null, ActionsMenu: null,
					QuickActions: null, HelpMenu: null, DebugPanel: null, DebugMenu: null,
				}}
				onMount={(editor) => {
					editorRef.current = editor
					syncGraphToEditor(editor, graph)
					if (graph.nodes.length > 0) {
						setTimeout(() => editor.zoomToFit({ animation: { duration: 300 } }), 100)
					}
				}}
			/>
		</div>
	)
}
