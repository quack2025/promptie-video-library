import { formatSeconds, getProxyPath, getStreamType } from "@/lib/utils";
import ChunkSummary from "./chunk-summary";

interface ResultProps {
  chunk: any;
  partition: string;
}

export default function Result({ chunk, partition }: ResultProps) {
  const streamType = getStreamType(chunk);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 justify-between">
        <p className="font-bold">{chunk.documentName}</p>
        <p className="text-sm text-gray-500">
          ({formatSeconds(chunk?.metadata?.start_time || 0)} -{" "}
          {formatSeconds(chunk?.metadata?.end_time || 0)})
        </p>
      </div>
      <ChunkSummary chunk={chunk} />
      {streamType === "video" && chunk?.links?.self_video_stream?.href && (
        <video src={getProxyPath(partition, chunk.links.self_video_stream.href)} controls />
      )}
      {streamType === "audio" && chunk?.links?.self_audio_stream?.href && (
        <audio src={getProxyPath(partition, chunk.links.self_audio_stream.href)} controls />
      )}
    </div>
  )
}