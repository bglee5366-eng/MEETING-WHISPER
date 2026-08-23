import Link from "next/link";
import ProjectWorkspace from "@/components/ProjectWorkspace";
export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <main className="project-page"><Link href="/">← 회의 화면</Link><ProjectWorkspace id={id} /></main>; }
