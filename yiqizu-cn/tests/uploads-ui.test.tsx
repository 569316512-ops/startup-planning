// @vitest-environment jsdom
import { it, expect, vi } from "vitest";
import {
  render,
  fireEvent,
  screen,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { afterEach } from "vitest";
import { PhotoPicker } from "../src/components/PhotoPicker";
import { useState } from "react";
afterEach(cleanup);
it("uploads_at_most_two_at_once_and_retries_failed_files", async () => {
  let running = 0,
    max = 0,
    failed = false;
  const change = vi.fn();
  const upload = async (file: File) => {
    running++;
    max = Math.max(max, running);
    await new Promise((r) => setTimeout(r, 5));
    running--;
    if (file.name === "b.png" && !failed) {
      failed = true;
      throw new Error("network");
    }
    return file.name;
  };
  function Harness() {
    const [ids, setIds] = useState<string[]>([]);
    return (
      <PhotoPicker
        ids={ids}
        onChange={(x) => {
          setIds(x);
          change(x);
        }}
        upload={upload}
      />
    );
  }
  render(<Harness />);
  fireEvent.change(screen.getByLabelText("添加照片"), {
    target: {
      files: ["a", "b", "c"].map(
        (x) => new File(["x"], x + ".png", { type: "image/png" }),
      ),
    },
  });
  await screen.findByText("重试失败照片");
  expect(max).toBe(2);
  expect(change).toHaveBeenCalledWith(["a.png", "c.png"]);
  fireEvent.click(screen.getByText("重试失败照片"));
  await waitFor(() =>
    expect(change).toHaveBeenCalledWith(["a.png", "c.png", "b.png"]),
  );
});
it("respects_an_external_reset_without_reintroducing_old_photo_ids", () => {
  const { rerender } = render(
    <PhotoPicker ids={["old"]} onChange={() => {}} upload={async () => ""} />,
  );
  rerender(
    <PhotoPicker ids={[]} onChange={() => {}} upload={async () => ""} />,
  );
  expect(screen.queryByText("照片1")).toBeNull();
});
