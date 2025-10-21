"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/prompts";
import { completionSchema } from "@/lib/types";
import { formatSeconds, getProxyPath } from "@/lib/utils";
import { useEffect, useState } from "react";
import { z } from "zod";
import ChunkSummary from "./chunk-summary";
import Result from "./result";

export default function SearchPage() {
  const [completion, setCompletion] = useState<null | z.infer<typeof completionSchema>>(null);
  const [systemPrompt, setSystemPrompt] = useState<string>(DEFAULT_SYSTEM_PROMPT);
  const [pendingSystemPrompt, setPendingSystemPrompt] = useState<string>(systemPrompt);
  const [partition, setPartition] = useState<string>("default");
  const [topK, setTopK] = useState<number>(6);
  const [rerank, setRerank] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [open, setOpen] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setIsLoading(true);

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message, partition, topK, rerank }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const json = await response.json();
      const completion = completionSchema.parse(json)
      setCompletion(completion)
    } catch (error) {
      console.error("Error searching:", error);
      alert(error instanceof Error ? error.message : "Failed to search");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSystemPromptSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setSystemPrompt(pendingSystemPrompt);
    localStorage.setItem("systemPrompt", pendingSystemPrompt);
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
    const parsed = parseInt(value);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 100) {
      setTopK(parsed);
      localStorage.setItem("topK", value);
    }
  };

  const handleRerankChange = (value: boolean) => {
    setRerank(value);
    localStorage.setItem("rerank", value.toString());
  };

  const handleResetSystemPrompt = () => {
    setPendingSystemPrompt(DEFAULT_SYSTEM_PROMPT);
  };

  useEffect(() => {
    const savedSystemPrompt = localStorage.getItem("systemPrompt");
    if (savedSystemPrompt) {
      setSystemPrompt(savedSystemPrompt);
    }
    const savedMessage = localStorage.getItem("message");
    if (savedMessage) {
      setMessage(savedMessage);
    }
    const savedPartition = localStorage.getItem("partition");
    if (savedPartition) {
      setPartition(savedPartition);
    }
    const savedTopK = localStorage.getItem("topK");
    if (savedTopK) {
      const parsed = parseInt(savedTopK);
      if (!isNaN(parsed) && parsed > 0) {
        setTopK(parsed);
      }
    }
    const savedRerank = localStorage.getItem("rerank");
    if (savedRerank) {
      setRerank(savedRerank === "true");
    }
  }, []);

  return (
    <>
      <form onSubmit={handleSubmit} className="w-full flex gap-2 pb-4">
        <div className="flex-1 flex flex-col">
          <input
            type="text"
            placeholder="Enter message"
            className="border-1 border-gray-300 rounded-md p-2 w-full"
            name="message"
            value={message}
            onChange={(e) => handleMessageChange(e.target.value)}
          />
          <div className="flex gap-10 pt-2 justify-between">
            <div className="text-sm flex items-center gap-2">
              <label htmlFor="partition">Partition:</label>
              <input
                type="text"
                name="partition"
                className="border-1 border-gray-300 rounded-md p-2"
                value={partition}
                onChange={(e) => handlePartitionChange(e.target.value)}
              />
            </div>
            <div className="text-sm flex items-center gap-2">
              <label htmlFor="topK">Top K:</label>
              <input
                type="number"
                name="topK"
                className="border-1 border-gray-300 rounded-md p-2"
                value={topK}
                onChange={(e) => handleTopKChange(e.target.value)}
              />
            </div>
            <div className="text-sm flex items-center gap-2">
              <label htmlFor="rerank">Rerank:</label>
              <input
                type="checkbox"
                name="rerank"
                className="border-1 border-gray-300 rounded-md p-2"
                checked={rerank}
                onChange={(e) => handleRerankChange(e.target.checked)}
              />
            </div>
          </div>
        </div>
        <button
          type="submit"
          className="bg-blue-500 text-white rounded-md p-2 px-6 self-start">
            Search
        </button>
      </form>
      {!completion && !isLoading && (
        <div className="flex flex-col h-full mt-8">
          <p>No results yet. Search to get started.</p>
        </div>
      )}
      {isLoading && (
        <div className="flex flex-col h-full mt-8 items-center justify-center">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
          </div>
        </div>
      )}
      {completion && !isLoading && (
        <Tabs defaultValue="message" className="flex flex-col h-full mt-8">
          <TabsList className="w-full justify-start bg-transparent gap-2">
            <TabsTrigger
              value="message"
            >
              Results
            </TabsTrigger>
            <TabsTrigger
              value="chunks"
            >
              Chunks
            </TabsTrigger>
          </TabsList>
          <TabsContent value="message" className="flex-1">
            <ul>
              {completion.retrievalResponse.scoredChunks.map((chunk: any, i: number) => (
                <li key={i} className="pb-20">
                  <Result partition={partition} chunk={chunk} />
                </li>
              ))}
            </ul>
          </TabsContent>
          <TabsContent value="chunks" className="flex-1 whitespace-pre-wrap">
            <pre className="flex flex-col gap-2 whitespace-pre-wrap text-xs">
              {JSON.stringify(completion.retrievalResponse, null, 2)}
            </pre>
          </TabsContent>
        </Tabs>
      )}
    </>
  );
}