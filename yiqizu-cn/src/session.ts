export function makeSession() {
  let memory: string | null = null;
  return {
    get() {
      try {
        return memory ?? sessionStorage.getItem("yiqizu-cn:session");
      } catch {
        return memory;
      }
    },
    set(token: string) {
      memory = token;
      try {
        sessionStorage.setItem("yiqizu-cn:session", token);
      } catch {}
    },
    clear() {
      memory = null;
      try {
        sessionStorage.removeItem("yiqizu-cn:session");
      } catch {}
      window.dispatchEvent(new Event("yiqizu-session-cleared"));
    },
  };
}
export const session = makeSession();
