import { useRef, useState } from "react";
import { compressPhoto } from "../photos";
export function PhotoPicker({
  ids,
  onChange,
  upload,
  max = 12,
  onBusy,
}: {
  ids: string[];
  onChange: (ids: string[]) => void;
  upload: (file: File) => Promise<string>;
  max?: number;
  onBusy?: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false),
    [failed, setFailed] = useState<File[]>([]),
    [message, setMessage] = useState("");
  const retained = useRef(ids);
  if (!busy) retained.current = ids;
  async function process(files: File[]) {
    if (busy) return;
    if (retained.current.length + files.length > max) {
      setMessage(`最多上传${max}张照片`);
      return;
    }
    setBusy(true);
    onBusy?.(true);
    setMessage("正在处理照片…");
    setFailed([]);
    const done: (string | null)[] = files.map(() => null),
      fail: File[] = [];
    let index = 0;
    async function worker() {
      while (index < files.length) {
        const i = index++;
        try {
          done[i] = await upload(await compressPhoto(files[i]));
        } catch {
          fail.push(files[i]);
        }
      }
    }
    await Promise.all([worker(), worker()]);
    retained.current = [
      ...retained.current,
      ...done.filter((id): id is string => id !== null),
    ];
    onChange(retained.current);
    setFailed(fail);
    setBusy(false);
    onBusy?.(false);
    setMessage(
      fail.length ? `${fail.length}张照片未上传，请重试` : "照片已上传",
    );
  }
  return (
    <fieldset disabled={busy}>
      <legend>照片（最多{max}张）</legend>
      <p className="muted">
        图片将随帖子公开展示，请勿上传证件、门牌或他人隐私。
      </p>
      <label className="file-picker">
        添加照片
        <input
          aria-label="添加照片"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple={max > 1}
          onChange={(e) => {
            const files = Array.from(e.currentTarget.files ?? []);
            e.currentTarget.value = "";
            void process(files);
          }}
        />
      </label>
      <ul className="photo-list">
        {retained.current.map((id, i) => (
          <li key={id}>
            照片{i + 1}
            <button
              type="button"
              onClick={() => {
                retained.current = retained.current.filter((x) => x !== id);
                onChange(retained.current);
                setMessage("");
              }}
            >
              移除
            </button>
          </li>
        ))}
      </ul>
      {failed.length > 0 && (
        <button type="button" onClick={() => void process(failed)}>
          重试失败照片
        </button>
      )}
      <p role="status">{message}</p>
    </fieldset>
  );
}
