import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ASSIGNABLE_ROLES, type AssignableRole } from "@/lib/auth/roles";
import { roleLabel } from "@/lib/labels";
import {
  createUser,
  listUsers,
  requestErrorMessage,
  updateUserPassword,
  updateUserRoles,
  validateNewUser,
  validatePassword,
  validateRoles,
  type ManagedUser,
} from "@/lib/users";

export const Route = createFileRoute("/panel/settings")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Налаштування — адмін-панель бістро та магазину" },
      { name: "description", content: "Користувачі та доступи до панелі." },
      { property: "og:title", content: "Налаштування — адмін-панель бістро та магазину" },
      { property: "og:description", content: "Користувачі та доступи до панелі." },
    ],
  }),
  component: SettingsPage,
});

const usersQueryKey = ["users"] as const;

function SettingsPage() {
  const queryClient = useQueryClient();
  const usersQuery = useQuery({
    queryKey: usersQueryKey,
    queryFn: listUsers,
  });

  if (usersQuery.isLoading) return <LoadingState />;
  if (usersQuery.isError || !usersQuery.data) {
    return (
      <ErrorState
        message="Не вдалося завантажити користувачів."
        onRetry={() => {
          void usersQuery.refetch();
        }}
      />
    );
  }

  const refreshUsers = () => queryClient.invalidateQueries({ queryKey: usersQueryKey });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Налаштування</h1>
        <p className="mt-1 text-sm text-muted-foreground">Користувачі та доступи до панелі.</p>
      </div>

      <CreateUserCard onCreated={() => void refreshUsers()} />

      {usersQuery.data.length === 0 ? (
        <EmptyState
          title="Користувачів поки немає"
          description="Створіть користувача з електронною поштою, паролем і роллю."
        />
      ) : (
        <div className="space-y-3">
          {usersQuery.data.map((user) => (
            <UserAccessCard key={user.id} user={user} onChanged={() => void refreshUsers()} />
          ))}
        </div>
      )}
    </div>
  );
}

function CreateUserCard({ onCreated }: { onCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState<AssignableRole[]>([]);
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      setEmail("");
      setPassword("");
      setRoles([]);
      setError(null);
      onCreated();
    },
    onError: (requestError) => {
      setError(requestErrorMessage(requestError, "Не вдалося створити користувача."));
    },
  });

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validateNewUser({ email, password, roles });
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    createMutation.mutate({ email: email.trim(), password, roles });
  };

  return (
    <Card className="space-y-4 p-4">
      <div>
        <h2 className="text-base font-semibold">Новий користувач</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Електронна пошта, пароль і щонайменше одна роль.
        </p>
      </div>
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="new-user-email">Електронна пошта</Label>
            <Input
              id="new-user-email"
              type="email"
              autoComplete="off"
              value={email}
              disabled={createMutation.isPending}
              onChange={(event) => {
                setEmail(event.target.value);
                setError(null);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-user-password">Пароль</Label>
            <Input
              id="new-user-password"
              type="password"
              autoComplete="new-password"
              value={password}
              disabled={createMutation.isPending}
              onChange={(event) => {
                setPassword(event.target.value);
                setError(null);
              }}
            />
          </div>
        </div>
        <RoleFields
          idPrefix="new-user"
          roles={roles}
          disabled={createMutation.isPending}
          onChange={(nextRoles) => {
            setRoles(nextRoles);
            setError(null);
          }}
        />
        {error ? <FieldError message={error} /> : null}
        <Button type="submit" disabled={createMutation.isPending}>
          Створити
        </Button>
      </form>
    </Card>
  );
}

function UserAccessCard({ user, onChanged }: { user: ManagedUser; onChanged: () => void }) {
  const serverRolesKey = user.roles.join(",");
  const [rolesKey, setRolesKey] = useState(serverRolesKey);
  const [roles, setRoles] = useState<AssignableRole[]>(user.roles);
  const [password, setPassword] = useState("");
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [rolesConfirmation, setRolesConfirmation] = useState<string | null>(null);
  const [passwordConfirmation, setPasswordConfirmation] = useState<string | null>(null);

  if (rolesKey !== serverRolesKey) {
    setRolesKey(serverRolesKey);
    setRoles(user.roles);
  }

  const rolesMutation = useMutation({
    mutationFn: (nextRoles: AssignableRole[]) => updateUserRoles(user.id, nextRoles),
    onSuccess: () => {
      setRolesError(null);
      setRolesConfirmation("Ролі збережено.");
      onChanged();
    },
    onError: (requestError) => {
      setRolesConfirmation(null);
      setRolesError(requestErrorMessage(requestError, "Не вдалося змінити ролі."));
    },
  });

  const passwordMutation = useMutation({
    mutationFn: (nextPassword: string) => updateUserPassword(user.id, nextPassword),
    onSuccess: () => {
      setPassword("");
      setPasswordError(null);
      setPasswordConfirmation("Пароль оновлено.");
    },
    onError: (requestError) => {
      setPasswordConfirmation(null);
      setPasswordError(requestErrorMessage(requestError, "Не вдалося оновити пароль."));
    },
  });

  const saveRoles = () => {
    const validationError = validateRoles(roles);
    if (validationError) {
      setRolesConfirmation(null);
      setRolesError(validationError);
      return;
    }

    setRolesError(null);
    rolesMutation.mutate(roles);
  };

  const savePassword = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validatePassword(password);
    if (validationError) {
      setPasswordConfirmation(null);
      setPasswordError(validationError);
      return;
    }

    setPasswordError(null);
    passwordMutation.mutate(password);
  };

  return (
    <Card className="space-y-4 p-4">
      <div>
        <p className="text-sm text-muted-foreground">Електронна пошта</p>
        <p className="font-medium">{user.email}</p>
      </div>
      <div className="space-y-3">
        <RoleFields
          idPrefix={`user-${user.id}`}
          roles={roles}
          disabled={rolesMutation.isPending}
          onChange={(nextRoles) => {
            setRoles(nextRoles);
            setRolesError(null);
            setRolesConfirmation(null);
          }}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" size="sm" disabled={rolesMutation.isPending} onClick={saveRoles}>
            Зберегти ролі
          </Button>
          {rolesConfirmation ? (
            <p className="text-sm text-muted-foreground">{rolesConfirmation}</p>
          ) : null}
        </div>
        {rolesError ? <FieldError message={rolesError} /> : null}
      </div>
      <form className="space-y-3 border-t border-border pt-4" onSubmit={savePassword} noValidate>
        <div className="max-w-sm space-y-2">
          <Label htmlFor={`user-${user.id}-password`}>Новий пароль</Label>
          <Input
            id={`user-${user.id}-password`}
            type="password"
            autoComplete="new-password"
            value={password}
            disabled={passwordMutation.isPending}
            onChange={(event) => {
              setPassword(event.target.value);
              setPasswordError(null);
              setPasswordConfirmation(null);
            }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="sm" variant="outline" disabled={passwordMutation.isPending}>
            Встановити пароль
          </Button>
          {passwordConfirmation ? (
            <p className="text-sm text-muted-foreground">{passwordConfirmation}</p>
          ) : null}
        </div>
        {passwordError ? <FieldError message={passwordError} /> : null}
      </form>
    </Card>
  );
}

function RoleFields({
  idPrefix,
  roles,
  disabled,
  onChange,
}: {
  idPrefix: string;
  roles: readonly AssignableRole[];
  disabled: boolean;
  onChange: (roles: AssignableRole[]) => void;
}) {
  const toggle = (role: AssignableRole, checked: boolean) => {
    const next = checked ? [...roles, role] : roles.filter((item) => item !== role);
    onChange(ASSIGNABLE_ROLES.filter((item) => next.includes(item)));
  };

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-sm font-medium">Ролі</legend>
      <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
        {ASSIGNABLE_ROLES.map((role) => {
          const id = `${idPrefix}-role-${role}`;
          return (
            <label key={role} htmlFor={id} className="flex items-center gap-2 text-sm">
              <Checkbox
                id={id}
                checked={roles.includes(role)}
                disabled={disabled}
                onCheckedChange={(checked) => toggle(role, checked === true)}
              />
              {roleLabel(role)}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function FieldError({ message }: { message: string }) {
  return (
    <p className="text-[0.8rem] font-medium text-destructive" role="alert">
      {message}
    </p>
  );
}
