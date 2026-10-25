// @vitest-environment jsdom
import { it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { AuthForm } from "../src/components/AuthForm";
afterEach(cleanup);
it("shows_real_errors_without_pretending_login_succeeded", async () => {
  const done = vi.fn(),
    call = vi.fn().mockRejectedValue(new Error("账号或密码不正确"));
  render(<AuthForm onDone={done} call={call} />);
  fireEvent.change(screen.getByLabelText("邮箱"), {
    target: { value: "one@example.invalid" },
  });
  fireEvent.change(screen.getByLabelText("密码"), {
    target: { value: "password123" },
  });
  fireEvent.click(screen.getByRole("button", { name: "登录" }));
  await screen.findByText("账号或密码不正确");
  expect(done).not.toHaveBeenCalled();
});
