import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, LockKeyhole } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { signIn } from "@/lib/auth/actions";

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Вхід — адмін-панель бістро та магазину" },
      {
        name: "description",
        content: "Вхід до адмін-панелі POS-системи бістро та продуктового магазину.",
      },
      { property: "og:title", content: "Вхід — адмін-панель бістро та магазину" },
      {
        property: "og:description",
        content: "Вхід до адмін-панелі POS-системи бістро та продуктового магазину.",
      },
    ],
  }),
  component: LoginPage,
});

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { message: "Введіть електронну пошту." })
    .email({ message: "Некоректна електронна пошта." })
    .max(255, { message: "Електронна пошта завдовга." }),
  password: z
    .string()
    .min(6, { message: "Пароль повинен містити щонайменше 6 символів." })
    .max(72, { message: "Пароль завдовгий." }),
});

type LoginValues = z.infer<typeof loginSchema>;

function LoginPage() {
  const navigate = useNavigate();
  const { queryClient } = Route.useRouteContext();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: LoginValues) => {
    setSubmitting(true);
    try {
      await signIn(queryClient, values.email, values.password);
      toast.success("Вхід виконано");
      navigate({ to: "/panel/dashboard", replace: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Невірна електронна пошта або пароль.";
      form.setError("password", { message });
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md border-border">
        <CardHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <CardTitle className="text-xl">Вхід до адмін-панелі</CardTitle>
          <CardDescription>
            Бістро та продуктовий магазин — керування каталогом, чеками та касою.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Електронна пошта</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        placeholder="ваша@пошта.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Пароль</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="current-password"
                        placeholder="Введіть пароль"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Виконуємо вхід...
                  </>
                ) : (
                  "Увійти"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </main>
  );
}
