import axios from "axios";

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error) || !error.response) {
    return "Не вдалося з’єднатися з сервером. Спробуйте ще раз.";
  }

  const data = error.response.data;
  const message =
    data && typeof data === "object" && "message" in data
      ? (data as { message?: unknown }).message
      : undefined;

  if (typeof message === "string" && message.trim()) return message;
  if (Array.isArray(message)) {
    const lines = message.filter(
      (item): item is string => typeof item === "string" && item.trim().length > 0,
    );
    if (lines.length > 0) return lines.join(" ");
  }

  return fallback;
}
