import { AuthForm } from "@/components/auth-form";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md space-y-4 py-8">
      <h1 className="text-2xl font-extrabold text-white">Masuk ke MusikKu</h1>
      <p className="text-sm text-zinc-400">Masuk untuk menyimpan playlist, favorit, dan riwayat di cloud.</p>
      <AuthForm mode="login" />
    </div>
  );
}
