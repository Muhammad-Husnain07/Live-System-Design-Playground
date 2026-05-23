import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ToastContainer from "../components/ui/Toast";
import { useToastStore } from "../store/toastStore";

describe("ToastContainer", () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
  });

  it("renders nothing when no toasts", () => {
    const { container } = render(<ToastContainer />);
    expect(container.firstChild).toBeNull();
  });

  it("renders active toasts", () => {
    useToastStore.getState().addToast({
      type: "success",
      title: "Success!",
      message: "Operation completed",
      duration: 999999,
    });

    render(<ToastContainer />);
    expect(screen.getByText("Success!")).toBeInTheDocument();
    expect(screen.getByText("Operation completed")).toBeInTheDocument();
  });

  it("removes toast on dismiss click", async () => {
    const user = userEvent.setup();
    useToastStore.getState().addToast({
      type: "info",
      title: "Info toast",
      duration: 999999,
    });

    render(<ToastContainer />);
    const dismissBtn = screen.getByRole("button");
    await user.click(dismissBtn);

    expect(screen.queryByText("Info toast")).not.toBeInTheDocument();
  });
});
