import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useUsersApi } from "@horpynka/api-sdk";

import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ASSIGNABLE_ROLES, toApiRoles, type AssignableRole } from "@/lib/auth/roles";
import { roleLabel } from "@/lib/labels";
import {
  requestErrorMessage,
  toManagedUser,
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

function SettingsPage() {
  const { getUsersQuery } = useUsersApi();
  const usersQuery = useQuery(getUsersQuery());

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

  const users = usersQuery.data.map(toManagedUser);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Налаштування</h1>
        <p className="mt-1 text-sm text-muted-foreground">Користувачі та доступи до панелі.</p>
      </div>

      <CreateUserCard />

      {users.length === 0 ? (
        <EmptyState
          title="Користувачів поки немає"
          description="Створіть користувача з електронною поштою, паролем і роллю."
        />
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <UserAccessCard key={user.id} user={user} />
          ))}
        </div>
      )}
    </div>
  );
}

function CreateUserCard() {
  const { mutateCreateUser } = useUsersApi();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState<AssignableRole[]>([]);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validateNewUser({ email, password, roles });
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    mutateCreateUser.mutate(
      {
        params: {
          createUserDto: {
            email: email.trim(),
            password,
            roles: toApiRoles(roles),
          },
        },
      },
      {
        onSuccess: () => {
          setEmail("");
          setPassword("");
          setRoles([]);
          setError(null);
        },
        onError: (requestError) => {
          setError(requestErrorMessage(requestError, "Не вдалося створити користувача."));
        },
      },
    );
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
              disabled={mutateCreateUser.isPending}
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
              disabled={mutateCreateUser.isPending}
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
          disabled={mutateCreateUser.isPending}
          onChange={(nextRoles) => {
            setRoles(nextRoles);
            setError(null);
          }}
        />
        {error ? <FieldError message={error} /> : null}
        <Button type="submit" disabled={mutateCreateUser.isPending}>
          Створити
        </Button>
      </form>
    </Card>
  );
}

function UserAccessCard({ user }: { user: ManagedUser }) {
  const { mutateUpdateRoles, mutateUpdatePassword } = useUsersApi();
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

  const saveRoles = () => {
    const validationError = validateRoles(roles);
    if (validationError) {
      setRolesConfirmation(null);
      setRolesError(validationError);
      return;
    }

    setRolesError(null);
    mutateUpdateRoles.mutate(
      {
        params: {
          id: user.id,
          updateUserRolesDto: { roles: toApiRoles(roles) },
        },
      },
      {
        onSuccess: () => {
          setRolesError(null);
          setRolesConfirmation("Ролі збережено.");
        },
        onError: (requestError) => {
          setRolesConfirmation(null);
          setRolesError(requestErrorMessage(requestError, "Не вдалося змінити ролі."));
        },
      },
    );
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
    mutateUpdatePassword.mutate(
      {
        params: {
          id: user.id,
          updateUserPasswordDto: { password },
        },
      },
      {
        onSuccess: (response) => {
          setPassword("");
          if (response.data.updated === true) {
            setPasswordError(null);
            setPasswordConfirmation("Пароль оновлено.");
            return;
          }
          setPasswordConfirmation(null);
          setPasswordError("Не вдалося оновити пароль.");
        },
        onError: (requestError) => {
          setPasswordConfirmation(null);
          setPasswordError(requestErrorMessage(requestError, "Не вдалося оновити пароль."));
        },
      },
    );
  };

  return (
    <Card className="space-y-4 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Електронна пошта</p>
          <p className="font-medium">{user.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {user.roles.map((role) => (
            <Badge key={role} variant="outline" className="font-normal">
              {roleLabel(role)}
            </Badge>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <RoleFields
          idPrefix={`user-${user.id}`}
          roles={roles}
          disabled={mutateUpdateRoles.isPending}
          onChange={(nextRoles) => {
            setRoles(nextRoles);
            setRolesError(null);
            setRolesConfirmation(null);
          }}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            size="sm"
            disabled={mutateUpdateRoles.isPending}
            onClick={saveRoles}
          >
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
            disabled={mutateUpdatePassword.isPending}
            onChange={(event) => {
              setPassword(event.target.value);
              setPasswordError(null);
              setPasswordConfirmation(null);
            }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={mutateUpdatePassword.isPending}
          >
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
