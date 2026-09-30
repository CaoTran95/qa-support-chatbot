// Bots selectable in the web UI. No Node imports: safe to use from client components.
// The profile name is also the allowlist for the server and the bridge, so a browser can never ask for another profile.
export type Bot = {
  profile: string;
  label: string;
  emptyText: string;
  placeholder: string;
  typing: string;
  suggestions: string[];
};

export const BOTS: Bot[] = [
  {
    profile: "qa-support",
    label: "QA Support",
    emptyText: "Hỏi QA Support bất cứ điều gì về kiểm thử.",
    placeholder: "Nhập câu hỏi cho QA Support…",
    typing: "QA Support đang trả lời…",
    suggestions: ["Tôi đang test flow refund, hãy hướng dẫn tôi cần kiểm tra những gì.", "Xin chào, bạn là ai?"],
  },
  {
    profile: "vtp-reship",
    label: "VTP Reship",
    emptyText: "Đưa số đơn bị Viettel Post huỷ. Bot điều tra, giải thích và chỉ làm khi bạn duyệt.",
    placeholder: "Nhập số đơn hoặc câu hỏi cho VTP Reship…",
    typing: "VTP Reship đang trả lời…",
    suggestions: ["Bạn giúp được gì cho đơn bị Viettel Post huỷ?", "Quy trình đẩy lại đơn VTP bị huỷ gồm những bước nào?"],
  },
];

export const DEFAULT_BOT = BOTS[0];

export function findBot(input: unknown): Bot | undefined {
  return typeof input === "string" ? BOTS.find((b) => b.profile === input) : undefined;
}
