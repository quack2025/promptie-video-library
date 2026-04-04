"use client";

import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useEffect, useState, useRef, useCallback } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDownIcon } from "@radix-ui/react-icons";

import { z } from "zod";
import GeneratedText from "./generated-text";
import {
  DEFAULT_OPENROUTER_MODEL,
  DEFAULT_SYSTEM_PROMPT,
} from "../lib/prompts";
import { completionSchema } from "../lib/types";

export default function Home() {
  const [completion, setCompletion] = useState<null | z.infer<typeof completionSchema>>(null);
  const [systemPrompt, setSystemPrompt] = useState<string>(DEFAULT_SYSTEM_PROMPT);
  const [pendingSystemPrompt, setPendingSystemPrompt] = useState<string>(systemPrompt);
  const [openrouterModel, setOpenrouterModel] = useState<string>(
    DEFAULT_OPENROUTER_MODEL
  );
  const [pendingOpenrouterModel, setPendingOpenrouterModel] =
    useState<string>(openrouterModel);
  const [provider, setProvider] = useState<string>("anthropic");
  const [pendingProvider, setPendingProvider] = useState<string>(provider);
  const [partition, setPartition] = useState<string>("");
  const [partitions, setPartitions] = useState<string[]>([]);
  const [ciudad, setCiudad] = useState<string>("");
  const [tipoConsumidor, setTipoConsumidor] = useState<string>("");
  const [topK, setTopK] = useState<number>(30);
  const [maxChunksPerDocument, setMaxChunksPerDocument] = useState<number>(5);
  const [rerank, setRerank] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [streamingText, setStreamingText] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [chunkCount, setChunkCount] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const abortRef = useRef<AbortController | null>(null);

  // Fetch partitions from Ragie API
  useEffect(() => {
    fetch("/api/partitions")
      .then((res) => res.ok ? res.json() : Promise.reject())
      .then((data: string[]) => {
        setPartitions(data);
        // Set initial partition from localStorage or first available
        const saved = localStorage.getItem("partition");
        if (saved && data.includes(saved)) {
          setPartition(saved);
        } else if (data.length > 0) {
          setPartition(data[0]);
        }
      })
      .catch(() => {
        // Fallback: allow manual entry
        const saved = localStorage.getItem("partition");
        if (saved) setPartition(saved);
      });
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!message.trim() || !partition) return;

    // Abort any previous request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setIsStreaming(false);
    setStreamingText("");
    setError(null);
    setCompletion(null);
    setChunkCount(null);

    try {
      const response = await fetch("/api/completions", {
        method: "POST",
        body: JSON.stringify({ systemPrompt, message, partition, topK, rerank, provider, openrouterModel, ciudad, tipoConsumidor, maxChunksPerDocument: maxChunksPerDocument || undefined }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const json = await response.json();
        setError(json.error || `Error ${response.status}`);
        setIsLoading(false);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let buffer = "";
      let accText = "";
      let retrievalData: any = null;

      setIsLoading(false);
      setIsStreaming(true);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === "retrieval") {
              retrievalData = event.data;
              setChunkCount(event.data?.scoredChunks?.length ?? 0);
            } else if (event.type === "delta") {
              accText += event.text;
              setStreamingText(accText);
            } else if (event.type === "complete") {
              setCompletion({
                modelResponse: event.modelResponse,
                retrievalResponse: retrievalData,
              });
              setIsStreaming(false);
            } else if (event.type === "error") {
              setError(event.message);
              setIsStreaming(false);
            }
          } catch {
            // skip invalid JSON
          }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setError("Connection error");
      }
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  }, [message, partition, systemPrompt, topK, rerank, provider, openrouterModel, ciudad, tipoConsumidor, maxChunksPerDocument]);

  const handleSystemPromptSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setSystemPrompt(pendingSystemPrompt);
    localStorage.setItem("systemPrompt", pendingSystemPrompt);
    setProvider(pendingProvider);
    localStorage.setItem("provider", pendingProvider);
    setOpenrouterModel(pendingOpenrouterModel);
    localStorage.setItem("openrouterModel", pendingOpenrouterModel);
    setOpen(false);
  };

  const handleOpenChange = (open: boolean) => {
    setOpen(open);
    if (open) {
      setPendingSystemPrompt(systemPrompt);
    }
  };

  const handleMessageChange = (value: string) => {
    setMessage(value);
    localStorage.setItem("message", value);
  };

  const handlePartitionChange = (value: string) => {
    setPartition(value);
    localStorage.setItem("partition", value);
  };

  const handleTopKChange = (value: string) => {
    setTopK(parseInt(value));
    localStorage.setItem("topK", value);
  };

  const handleMaxChunksPerDocumentChange = (value: string) => {
    setMaxChunksPerDocument(parseInt(value));
    localStorage.setItem("maxChunksPerDocument", value);
  };

  const handleResetSystemPrompt = () => {
    setPendingSystemPrompt(DEFAULT_SYSTEM_PROMPT);
  };

  useEffect(() => {
    const savedProvider = localStorage.getItem("provider");
    if (savedProvider) setProvider(savedProvider);
    const savedOpenrouterModel = localStorage.getItem("openrouterModel");
    if (savedOpenrouterModel) setOpenrouterModel(savedOpenrouterModel);
    const savedSystemPrompt = localStorage.getItem("systemPrompt");
    if (savedSystemPrompt) setSystemPrompt(savedSystemPrompt);
    const savedMessage = localStorage.getItem("message");
    if (savedMessage) setMessage(savedMessage);
    const savedCiudad = localStorage.getItem("ciudad");
    if (savedCiudad) setCiudad(savedCiudad);
    const savedTipoConsumidor = localStorage.getItem("tipoConsumidor");
    if (savedTipoConsumidor) setTipoConsumidor(savedTipoConsumidor);
    const savedMaxChunksPerDocument = localStorage.getItem("maxChunksPerDocument");
    if (savedMaxChunksPerDocument) setMaxChunksPerDocument(parseInt(savedMaxChunksPerDocument));
    const savedTopK = localStorage.getItem("topK");
    if (savedTopK) setTopK(parseInt(savedTopK));
    const savedRerank = localStorage.getItem("rerank");
    if (savedRerank) setRerank(savedRerank === "true");
  }, []);

  const isWorking = isLoading || isStreaming;

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Query Form */}
      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Ask a question about your video sessions..."
            className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2.5 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-shadow"
            name="message"
            value={message}
            onChange={(e) => handleMessageChange(e.target.value)}
          />
          <button
            type="submit"
            disabled={isWorking || !partition}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg px-6 py-2.5 text-sm font-medium transition-colors"
          >
            {isWorking ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                {isStreaming ? "Analyzing..." : "Retrieving..."}
              </span>
            ) : (
              "Send"
            )}
          </button>
        </div>

        {/* Partition selector + toggle for more settings */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Partition</label>
            {partitions.length > 0 ? (
              <select
                className="text-sm border border-gray-200 dark:border-gray-700 rounded-md px-2.5 py-1.5 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                value={partition}
                onChange={(e) => handlePartitionChange(e.target.value)}
              >
                {partitions.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                className="text-sm border border-gray-200 dark:border-gray-700 rounded-md px-2.5 py-1.5 w-32 bg-white dark:bg-gray-900"
                value={partition}
                onChange={(e) => handlePartitionChange(e.target.value)}
                placeholder="partition name"
              />
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1 transition-colors"
          >
            <svg className={`w-3.5 h-3.5 transition-transform ${showSettings ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            {showSettings ? "Hide filters" : "Filters & settings"}
          </button>

          <div className="ml-auto">
            <Dialog open={open} onOpenChange={handleOpenChange}>
              <DialogTrigger asChild>
                <button type="button" className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                  Edit prompt
                </button>
              </DialogTrigger>
              <DialogContent>
                <DialogTitle>Edit system prompt</DialogTitle>
                <DialogDescription className="flex items-center justify-between">
                  Customize the system prompt for analysis.
                  <button className="text-blue-500 text-sm" onClick={handleResetSystemPrompt}>Reset</button>
                </DialogDescription>
                <form onSubmit={handleSystemPromptSubmit}>
                  <textarea
                    name="systemPrompt"
                    className="w-full h-[600px] p-2 border border-gray-300 rounded-md mb-4 text-sm font-mono"
                    value={pendingSystemPrompt}
                    onChange={(e) => setPendingSystemPrompt(e.target.value)}
                  />
                  {process.env.NEXT_PUBLIC_OPENROUTER_API_KEY && (
                  <AccordionPrimitive.Root type="single" collapsible>
                    <AccordionPrimitive.Item value="advanced" className="border border-gray-300 rounded-md p-2">
                      <AccordionPrimitive.Trigger className="group flex items-center justify-between gap-2 w-full">
                        <span className="text-sm">Advanced</span>
                        <ChevronDownIcon className="group-data-[state=open]:rotate-180 transition-transform" aria-hidden />
                      </AccordionPrimitive.Trigger>
                      <AccordionPrimitive.Content className="pt-2 flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <label className="text-sm">Provider:</label>
                          <select
                            className="border border-gray-300 rounded-md p-1 text-sm"
                            value={pendingProvider}
                            onChange={(e) => setPendingProvider(e.target.value)}
                          >
                            <option value="anthropic">Anthropic</option>
                            <option value="openrouter">OpenRouter</option>
                          </select>
                        </div>
                        {pendingProvider === "openrouter" && (
                          <div className="flex items-center gap-2">
                            <label className="text-sm">Model:</label>
                            <input
                              type="text"
                              className="border border-gray-300 rounded-md p-1 text-sm flex-1"
                              value={pendingOpenrouterModel}
                              onChange={(e) => setPendingOpenrouterModel(e.target.value)}
                            />
                          </div>
                        )}
                      </AccordionPrimitive.Content>
                    </AccordionPrimitive.Item>
                  </AccordionPrimitive.Root>
                  )}
                  <DialogFooter>
                    <DialogClose asChild>
                      <button type="button" className="text-gray-500 rounded-md p-2 text-sm">Cancel</button>
                    </DialogClose>
                    <button className="bg-blue-600 text-white rounded-md p-2 px-6 text-sm" type="submit">Save</button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Collapsible filters */}
        {showSettings && (
          <div className="flex gap-3 flex-wrap items-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700/50">
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-medium text-gray-500">City</label>
              <select
                className="text-sm border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1 bg-white dark:bg-gray-900"
                value={ciudad}
                onChange={(e) => { setCiudad(e.target.value); localStorage.setItem("ciudad", e.target.value); }}
              >
                <option value="">All</option>
                <option value="Bogotá">Bogotá</option>
                <option value="Medellín">Medellín</option>
                <option value="Cali-Barranquilla">Cali-Barranquilla</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-medium text-gray-500">Type</label>
              <select
                className="text-sm border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1 bg-white dark:bg-gray-900"
                value={tipoConsumidor}
                onChange={(e) => { setTipoConsumidor(e.target.value); localStorage.setItem("tipoConsumidor", e.target.value); }}
              >
                <option value="">All</option>
                <option value="usuario">User</option>
                <option value="no usuario">Non-user</option>
              </select>
            </div>
            <div className="w-px h-6 bg-gray-200 dark:bg-gray-700" />
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-medium text-gray-500">Chunks</label>
              <select
                className="text-sm border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1 bg-white dark:bg-gray-900"
                value={topK}
                onChange={(e) => handleTopKChange(e.target.value)}
              >
                <option value="8">8</option>
                <option value="20">20</option>
                <option value="30">30</option>
                <option value="40">40</option>
                <option value="60">60</option>
                <option value="80">80</option>
                <option value="100">100</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-medium text-gray-500">Max/video</label>
              <select
                className="text-sm border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1 bg-white dark:bg-gray-900"
                value={maxChunksPerDocument}
                onChange={(e) => handleMaxChunksPerDocumentChange(e.target.value)}
              >
                <option value="0">No limit</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="5">5</option>
              </select>
            </div>
          </div>
        )}
      </form>

      {/* Status bar during retrieval */}
      {isLoading && (
        <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800/30">
          <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
          <span className="text-sm text-blue-700 dark:text-blue-300">Retrieving relevant video segments...</span>
        </div>
      )}

      {/* Streaming indicator with live text */}
      {isStreaming && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 px-3 py-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-800/30">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            <span className="text-sm text-green-700 dark:text-green-300">
              Analyzing {chunkCount ? `${chunkCount} segments` : "..."}
            </span>
          </div>
          {streamingText && (
            <div className="markdown prose prose-sm max-w-none p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800">
              <StreamingMarkdown text={streamingText} />
            </div>
          )}
        </div>
      )}

      {/* Error display */}
      {error && !isWorking && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800/30">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!completion && !error && !isWorking && !isStreaming && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          </div>
          <p className="text-gray-500 text-sm">Ask a question to analyze your qualitative video sessions.</p>
          <p className="text-gray-400 text-xs mt-1">Citations will link directly to the relevant video moments.</p>
        </div>
      )}

      {/* Results */}
      {completion && !isWorking && !isStreaming && (
        <Tabs defaultValue="message" className="flex flex-col h-full">
          <TabsList className="w-full justify-start bg-transparent gap-1 border-b border-gray-200 dark:border-gray-700 rounded-none pb-0">
            <TabsTrigger value="message" className="text-sm data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none pb-2">
              Analysis
            </TabsTrigger>
            <TabsTrigger value="chunks" className="text-sm data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none pb-2">
              Chunks ({completion.retrievalResponse?.scoredChunks?.length ?? 0})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="message" className="flex-1 pt-4">
            <GeneratedText completion={completion} partition={partition} />
          </TabsContent>
          <TabsContent value="chunks" className="flex-1 pt-4">
            <pre className="whitespace-pre-wrap text-xs bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-100 dark:border-gray-800 max-h-[600px] overflow-auto">
              {JSON.stringify(completion.retrievalResponse, null, 2)}
            </pre>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

/** Minimal streaming markdown preview — just renders paragraphs while streaming */
function StreamingMarkdown({ text }: { text: string }) {
  // Split by double newlines for paragraphs, render with basic formatting
  const paragraphs = text.split(/\n\n+/);
  return (
    <div className="space-y-2 text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
      {paragraphs.map((p, i) => {
        if (p.startsWith("## ")) return <h2 key={i} className="text-lg font-semibold mt-3">{p.slice(3)}</h2>;
        if (p.startsWith("### ")) return <h3 key={i} className="text-base font-semibold mt-2">{p.slice(4)}</h3>;
        if (p.startsWith("# ")) return <h1 key={i} className="text-xl font-bold mt-3">{p.slice(2)}</h1>;
        if (p.startsWith("- ") || p.startsWith("* ")) {
          const items = p.split(/\n/).filter(Boolean);
          return <ul key={i} className="list-disc pl-5 space-y-1">{items.map((item, j) => <li key={j}>{item.replace(/^[-*]\s*/, "")}</li>)}</ul>;
        }
        return <p key={i}>{p}</p>;
      })}
      <span className="inline-block w-1.5 h-4 bg-blue-500 animate-pulse ml-0.5" />
    </div>
  );
}
