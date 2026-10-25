import axios from "axios";

import { isAssignableRole, type AssignableRole } from "@/lib/auth/roles";

export type ManagedUser = {
  id: number;
  email: string;
  roles: AssignableRole[];
};

export type CreateManagedUserInput = {
  email: string;
  password: string;
  roles: AssignableRole[];
};

export function validateNewUser(input: CreateManagedUserInput): string | null {
  const emailError = validateEmail(input.email);
  if (emailError) return emailError;

  const passwordError = validatePassword(input.password);
  if (passwordError) return passwordError;

  return validateRoles(input.roles);
}

export function validateEmail(email: string): string | null {
  const value = email.trim();
  if (!value) return "Введіть електронну пошту.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Некоректна електронна пошта.";
  if (value.length > 255) return "Електронна пошта завдовга.";
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return "Пароль має містити щонайменше 8 символів.";
  if (password.length > 255) return "Пароль завдовгий.";
  return null;
}

export function validateRoles(roles: readonly AssignableRole[]): string | null {
  if (roles.length === 0) return "Оберіть щонайменше одну роль.";
  return null;
}

export function requestErrorMessage(error: unknown, fallback: string): string {
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

export function toManagedUser(value: {
  id: number;
  email: string;
  roles?: readonly string[] | null;
}): ManagedUser {
  return {
    id: value.id,
    email: value.email,
    roles: (value.roles ?? []).filter(isAssignableRole),
  };
}
