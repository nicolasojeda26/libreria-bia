"use client";

import Image from "next/image";
import { useState } from "react";
import { api, errorMessage } from "./api";
import { Button, Field, inputClass } from "./ui";

export default function Login({ onLogin }: { onLogin: (username: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = await api<{ username: string }>("/api/auth", { method: "POST", body: { username, password } });
      onLogin(data.username);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-[#dfe4ee] bg-white p-7 shadow-panel">
        <Image src="/logo.jpg" alt="Librería Bia" width={64} height={64} className="mx-auto size-16" priority />
        <h1 className="mt-4 text-center text-xl font-bold">Panel de Librería Bia</h1>
        <p className="mt-1 text-center text-sm text-[#6b7280]">Ingresá para administrar la tienda.</p>

        <div className="mt-6 space-y-4">
          <Field label="Usuario">
            <input className={inputClass} required autoFocus autoComplete="username" autoCapitalize="none" value={username} onChange={(event) => setUsername(event.target.value)} />
          </Field>
          <Field label="Contraseña">
            <input className={inputClass} type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </Field>
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-[#fdecea] px-3 py-2.5 text-sm font-medium text-[#8f1d17]" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" loading={busy} className="mt-6 w-full">
          Ingresar
        </Button>
      </form>
    </div>
  );
}
