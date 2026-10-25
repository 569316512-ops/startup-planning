import { useState, useEffect } from "react";
import { api, type Api } from "../client";
export function Photo({
  id,
  alt = "",
  call = api,
}: {
  id?: string | null;
  alt?: string;
  call?: Api;
}) {
  const [url, setUrl] = useState(""),
    [failed, setFailed] = useState(false),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setFailed(false);
    setUrl("");
    if (id)
      void call<Record<string, string>>("photos.urls", { ids: [id] })
        .then((r) => {
          if (active) {
            if (r[id]) setUrl(r[id]);
            else setFailed(true);
          }
        })
        .catch(() => {
          if (active) setFailed(true);
        });
    return () => {
      active = false;
    };
  }, [id, attempt, call]);
  return !id || failed || !url ? (
    <div className="photo-placeholder" aria-label={alt || "暂无照片"}>
      一起租
    </div>
  ) : (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      onError={() => (attempt === 0 ? setAttempt(1) : setFailed(true))}
    />
  );
}
