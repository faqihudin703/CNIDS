import { useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Field, Input, PasswordInput } from "../components/ui/FormControls";
import Button from "../components/ui/Button";

export default function LoginPage() {
  const { user, isLoading: sessionLoading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!sessionLoading && user) {
    const redirectTo = location.state?.from?.pathname || "/";
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(username, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(
        err.response
          ? err.response.data?.error || "Username atau password salah"
          : "Server tidak dapat dihubungi (timeout/jaringan). Periksa koneksi atau konfigurasi proxy /api."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-base-900 px-4 py-8">
      <div className="w-full max-w-sm sm:max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md bg-accent/15 text-lg font-bold text-accent">
            C
          </div>
          <h1 className="text-lg font-semibold text-ink">Masuk ke CNIDS</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Dokumentasi infrastruktur jaringan UPPTIK
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-md border border-base-700 bg-base-800 p-5 sm:p-7">
          <Field label="Username">
            <Input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
              required
            />
          </Field>

          <Field label="Password">
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>

          {error && (
            <p className="rounded bg-signal-down-dim px-3 py-2 text-sm text-signal-down">{error}</p>
          )}

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Memproses...
              </>
            ) : (
              "Masuk"
            )}
          </Button>
        </form>

        <p className="mt-5 text-center text-xs text-ink-faint">
          Akun dibuat oleh Admin Jaringan. Hubungi UPPTIK jika belum memiliki akses.
        </p>
      </div>
    </div>
  );
}
