"use client";

import { useMessagePartText } from "@assistant-ui/react";
import { MarkdownText } from "@/components/assistant-ui/elements/markdown-text";
import { OpsAgentInlineCard } from "@/components/OpsAgentInlineCard";
import { extractPreviewToken } from "@/lib/ops-agent/preview-token";

/** Assistant text for ops-agent: markdown + inline confirm card when preview token is present. */
export function OpsAgentAssistantText() {
  const part = useMessagePartText();
  const token = extractPreviewToken(part.text);
  const done = part.status.type !== "running";

  return (
    <>
      <MarkdownText />
      {done && token ? <OpsAgentInlineCard key={token} token={token} /> : null}
    </>
  );
}
