import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

export function mockFetchQueue(payloads: unknown[]) {
  const fetchMock = vi.fn();
  for (const payload of payloads) {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(payload),
    });
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

export function mockFetchError(status: number, message: string) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: false,
    status,
    text: async () => JSON.stringify({ error: { message } }),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

export function renderWithRouter(ui: React.ReactElement, route = "/") {
  return render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>);
}
