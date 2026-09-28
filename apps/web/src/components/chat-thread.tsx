"use client";

import { useActionState, useEffect, useRef } from "react";

import { providerSendMessage, type ActionState } from "@/app/actions/provider";
import { sendMessage, type ActionState as CustomerActionState } from "@/app/actions/customer";
import { FormFeedback } from "@/components/submit-button";

export interface ChatMessage {
  id: string;
  body: string;
  mine: boolean;
  createdAt: string;
}

/**
 * Conversation view.
 *
 * Scrolls to the newest message only when the reader is already at the bottom,
 * because yanking someone back down while they are reading earlier messages is
 * the single most irritating thing a chat window can do.
 */
export function ChatThread({
  conversationId,
  messages,
  peerName,
  asProvider = false,
}: {
  conversationId: string;
  messages: ChatMessage[];
  peerName: string;
  asProvider?: boolean;
}) {
  // Both actions are wired; the one used is chosen by role, so the server action
  // that runs is always the one that verifies ownership of the conversation.
  const [providerState, providerAction, providerPending] = useActionState<
    ActionState | null,
    FormData
  >(providerSendMessage, null);
  const [customerState, customerAction, customerPending] = useActionState<
    CustomerActionState | null,
    FormData
  >(sendMessage, null);

  const state = asProvider ? providerState : customerState;
  const formAction = asProvider ? providerAction : customerAction;
  const pending = asProvider ? providerPending : customerPending;
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const atBottomRef = useRef(true);

  useEffect(() => {
    if (atBottomRef.current) {
      bottomRef.current?.scrollIntoView({ block: "end" });
    }
  }, [messages.length]);

  return (
    <div className="flex min-h-[24rem] flex-col">
      <div
        className="flex-1 space-y-2 overflow-y-auto rounded-lg border border-ink-200 bg-ink-50 p-3"
        onScroll={(event) => {
          const el = event.currentTarget;
          // 40px of slack so a partly-visible last message still counts as
          // "at the bottom".
          atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.mine ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                message.mine
                  ? "bg-brand-700 text-ink-50"
                  : "border border-ink-300 bg-ink-100 text-ink-900"
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{message.body}</p>
              <p
                className={`mt-1 text-[10px] ${
                  message.mine ? "text-brand-100" : "text-ink-400"
                }`}
              >
                {message.createdAt}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form action={formAction} className="mt-3 space-y-2">
        <input type="hidden" name="conversationId" value={conversationId} />
        <label className="sr-only" htmlFor={`msg-${conversationId}`}>
          Message {peerName}
        </label>
        <textarea
          className="input min-h-20 resize-y"
          id={`msg-${conversationId}`}
          name="body"
          required
          maxLength={2000}
          placeholder={`Message ${peerName}…`}
          disabled={pending}
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-ink-500">Booking details and charges are on the job page.</p>
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? "Sending…" : "Send"}
          </button>
        </div>
        <FormFeedback state={state} />
      </form>
    </div>
  );
}
