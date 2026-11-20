import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { CheckCircle2, Facebook, Instagram, MessageSquareText, Send, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { socialLabels } from "@/lib/social";
import { socialQuery } from "@/lib/menu-queries";
import { toast } from "sonner";
import { sendComment } from "@/lib/menu.functions";
import { commentSchema } from "@/lib/menu-schema";
import { Button } from "@/components/ui/button";

const field = "w-full rounded-2xl bg-input px-4 py-3 text-base outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring";

// Guests write to the café privately: comments are never shown on the menu.
export function CommentBox() {
  const send = useServerFn(sendComment);
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const social = useQuery({ ...socialQuery, enabled: open });
  const accounts = (social.data ?? []).filter((a) => a.url);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = new FormData(e.currentTarget);
    const parsed = commentSchema.safeParse({ author_name: "", message: values.get("message") ?? "" });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Please write your comment."); return; }
    setBusy(true);
    try { await send({ data: parsed.data }); setSent(true); }
    catch { toast.error("Comment could not be sent, please try again."); }
    finally { setBusy(false); }
  }

  return <>
    <Button type="button" size="icon" aria-label="Write a comment" title="Write a comment" onClick={() => { setSent(false); setOpen(true); }}
      className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-30 size-11 rounded-full shadow-lg [&_svg]:size-5">
      <MessageSquareText />
    </Button>

    <DialogPrimitive.Root open={open} onOpenChange={(o) => { if (!busy) setOpen(o); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content aria-describedby={undefined} className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2.5rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-card p-5 shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <DialogPrimitive.Close aria-label="Close" className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-secondary text-foreground"><X className="size-4" /></DialogPrimitive.Close>
          {sent ? <div className="py-6 text-center">
            <CheckCircle2 className="mx-auto size-12 text-success" strokeWidth={1.5} />
            <DialogPrimitive.Title className="mt-3 text-lg font-semibold">Thank you!</DialogPrimitive.Title>
            <p className="mt-1 text-sm text-muted-foreground">Your comment was sent to the business.</p>
            <DialogPrimitive.Close asChild><Button variant="secondary" className="mt-5">Close</Button></DialogPrimitive.Close>
          </div> : <form onSubmit={submit} className="space-y-3">
            <DialogPrimitive.Title className="pr-10 text-lg font-semibold">Write a comment</DialogPrimitive.Title>
            <p className="-mt-1 text-xs text-muted-foreground">Only the business sees your comment.</p>
            <textarea name="message" aria-label="Your comment" required maxLength={1000} rows={5} placeholder="Write your comment..." className={`${field} resize-none`} />
            <Button type="submit" disabled={busy} className="h-11 w-full">
              <Send className="size-4" />{busy ? "Sending..." : "Send"}
            </Button>
          </form>}
          {accounts.length > 0 && <div className="mt-5 border-t border-border pt-4">
            <p className="text-sm font-semibold">Follow us</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {accounts.map((a) => <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer"
                className="flex flex-col items-center gap-1 rounded-2xl bg-secondary px-2 py-3 text-secondary-foreground transition-colors hover:bg-accent">
                {a.id === "instagram" ? <Instagram className="size-6" /> : a.id === "facebook" ? <Facebook className="size-6" /> : <TikTokIcon />}
                <span className="text-xs font-medium">{socialLabels[a.id]}</span>
              </a>)}
            </div>
          </div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  </>;
}

function TikTokIcon() {
  return <svg viewBox="0 0 24 24" className="size-6" fill="currentColor" aria-hidden="true"><path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.6 2.6 0 0 1-2.59-2.6 2.6 2.6 0 0 1 3.36-2.48V9.66a5.7 5.7 0 0 0-.77-.05A5.67 5.67 0 0 0 4.2 15.3 5.67 5.67 0 0 0 9.86 21a5.67 5.67 0 0 0 5.68-5.67V9.01a7.33 7.33 0 0 0 4.28 1.37V7.3a4.3 4.3 0 0 1-3.22-1.48z"/></svg>;
}
