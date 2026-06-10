import { useEffect, useState } from "react";
import { Brain } from "lucide-react";
import { fetchJson } from "../hooks/use-api";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Textarea } from "./ui/textarea";

interface PersonalizationDialogButtonProps {
  readonly className?: string | ((hasMemory: boolean) => string);
  readonly iconClassName?: string | ((hasMemory: boolean) => string);
  readonly iconSize?: number;
  readonly label?: string;
}

export function PersonalizationDialogButton({
  className,
  iconClassName,
  iconSize = 13,
  label = "个性化",
}: PersonalizationDialogButtonProps) {
  const [open, setOpen] = useState(false);
  const [memory, setMemory] = useState("");
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchJson<{ memory?: string }>("/personalization");
        if (cancelled) return;
        const nextMemory = data.memory ?? "";
        setMemory(nextMemory);
        setDraft(nextMemory);
      } catch {
        // Personalization is optional.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const hasMemory = memory.trim().length > 0;
  const resolvedClassName = typeof className === "function" ? className(hasMemory) : className;
  const resolvedIconClassName = typeof iconClassName === "function" ? iconClassName(hasMemory) : iconClassName;

  const save = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const data = await fetchJson<{ memory: string }>("/personalization", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memory: draft }),
      });
      const nextMemory = data.memory ?? "";
      setMemory(nextMemory);
      setDraft(nextMemory);
      setStatus("已保存");
      setOpen(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setDraft(memory);
          setStatus(null);
          setOpen(true);
        }}
        className={resolvedClassName}
      >
        <Brain size={iconSize} className={resolvedIconClassName} />
        <span>{label}</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>个性化 / 模型记忆</DialogTitle>
            <DialogDescription>
              保存后自动注入后续聊天和写作 prompt。
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="例：回答极简，少铺垫，不啰嗦；创作偏好强节奏、强爽点、少解释。"
            className="min-h-36 resize-y"
            maxLength={4000}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{status ?? "最多 4000 字"}</span>
            <span>{draft.length}/4000</span>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDraft("");
                setStatus(null);
              }}
            >
              清空
            </Button>
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
