import { useToastStore } from "../store/toastStore";

describe("toastStore", () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
  });

  it("adds a toast with auto-generated id and createdAt", () => {
    useToastStore.getState().addToast({
      type: "success",
      title: "Test toast",
      duration: 5000,
    });

    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].id).toMatch(/^toast-/);
    expect(toasts[0].title).toBe("Test toast");
    expect(toasts[0].type).toBe("success");
    expect(toasts[0].createdAt).toBeGreaterThan(0);
  });

  it("adds multiple toasts with incrementing ids", () => {
    useToastStore.getState().addToast({ type: "info", title: "First", duration: 5000 });
    useToastStore.getState().addToast({ type: "error", title: "Second", duration: 5000 });

    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(2);
    expect(toasts[0].title).toBe("First");
    expect(toasts[1].title).toBe("Second");
  });

  it("removes a toast by id", () => {
    useToastStore.getState().addToast({ type: "warning", title: "Remove me", duration: 99999 });
    const { toasts } = useToastStore.getState();
    const id = toasts[0].id;

    useToastStore.getState().removeToast(id);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("sets default duration to 4000ms when not provided", () => {
    vi.useFakeTimers();

    useToastStore.getState().addToast({ type: "success", title: "Auto dismiss" });
    expect(useToastStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(4000);
    expect(useToastStore.getState().toasts).toHaveLength(0);

    vi.useRealTimers();
  });
});
