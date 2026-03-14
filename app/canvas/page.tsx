'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWorkflow } from '@/lib/workflow-context'

const CanvasEditor = dynamic(
	() => import('@/components/canvas-editor').then((m) => m.CanvasEditor),
	{ ssr: false }
)

export default function CanvasPage() {
	const { graph, clearGraph } = useWorkflow()

	return (
		<div className="flex flex-col h-dvh bg-background">
			<header className="border-b border-border px-4 py-2 flex items-center justify-between shrink-0 z-10">
				<div className="flex items-center gap-3">
					<Link href="/">
						<Button variant="ghost" size="icon" className="h-8 w-8">
							<ArrowLeft className="h-4 w-4" />
						</Button>
					</Link>
					<h1 className="text-sm font-semibold text-foreground">Workflow Canvas</h1>
					<span className="text-xs text-muted-foreground">
						{graph.nodes.length} nodes
					</span>
				</div>
				{graph.nodes.length > 0 && (
					<Button
						variant="ghost"
						size="sm"
						className="h-7 text-xs text-muted-foreground"
						onClick={clearGraph}
					>
						<Trash2 className="h-3 w-3 mr-1" />
						Clear
					</Button>
				)}
			</header>
			<div className="flex-1">
				<CanvasEditor />
			</div>
		</div>
	)
}
