import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("@workspace/api-client-react", () => ({
  useSendMessage: () => ({ mutate: vi.fn(), isPending: false }),
  useGetSeedStatus: () => ({
    data: { seeded: false, document_count: 0, ticket_count: 0 },
    isLoading: false,
  }),
  useSeedData: () => ({ mutate: vi.fn(), isPending: false }),
  useConnectZendesk: () => ({ mutate: vi.fn(), isPending: false }),
  useConnectConfluence: () => ({ mutate: vi.fn(), isPending: false }),
  getGetSeedStatusQueryKey: () => ["seed-status"] as const,
}));

describe("App", () => {
  it("renders the chat welcome state", () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { name: /how can i help you today/i }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/message supportbrainz/i)).toBeInTheDocument();
  });
});
