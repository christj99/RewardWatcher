import { createExtensionApiClient } from "./apiClient.js";
import { setExtensionSessionToken } from "./storage.js";

const form = document.querySelector<HTMLFormElement>("#pair-form");
const tokenInput = document.querySelector<HTMLInputElement>("#pair-token");
const message = document.querySelector<HTMLParagraphElement>("#pair-message");
const apiClient = createExtensionApiClient();

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  void pairExtension();
});

async function pairExtension() {
  const token = tokenInput?.value.trim();
  if (!token) return;
  try {
    const session = await apiClient.createExtensionSession(token);
    await setExtensionSessionToken(session.extensionToken);
    if (message) {
      message.textContent = "Extension paired.";
    }
    if (tokenInput) {
      tokenInput.value = "";
    }
  } catch (error) {
    if (message) {
      message.textContent =
        error instanceof Error ? error.message : "Pairing failed.";
    }
  }
}
