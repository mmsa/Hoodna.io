"use client"

import Link from "next/link"
import { useState } from "react"
import { Loader2, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import api from "@/lib/api"

type Answer = {
  answer: string
  citations: Array<{ type: string; id: number; title: string; url_path: string; snippet?: string }>
}

export function AskNeighbours() {
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function ask() {
    if (!question.trim() || loading) return
    setLoading(true)
    setError("")
    try {
      setAnswer((await api.post("/api/ask", { question: question.trim() })).data)
    } catch {
      setError("Could not search neighbourhood knowledge. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="mb-5 rounded-[22px] border border-border/70 bg-card p-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && void ask()}
            className="pl-9"
            placeholder="Ask about recommendations, notices, or local updates"
            aria-label="Ask neighbours"
          />
        </div>
        <Button onClick={ask} disabled={!question.trim() || loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ask"}
        </Button>
      </div>
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      {answer ? (
        <div className="mt-4 rounded-lg bg-muted/40 p-3">
          <p className="text-sm leading-6 text-foreground">{answer.answer}</p>
          {answer.citations.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {answer.citations.map((citation) => (
                <Link key={`${citation.type}-${citation.id}`} href={citation.url_path} className="text-xs font-medium text-primary hover:underline">
                  {citation.title}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
