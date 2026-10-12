import { AuthForm } from "@/components/auth-form";

export default function RegisterPage() {
  return (
    <div className="mx-auto max-w-md space-y-4 py-8">
      <h1 className="text-2xl font-extrabold text-white">Buat akun MusikKu</h1>
      <p className="text-sm text-zinc-400">Gratis. Data playlist dan favoritmu tersimpan aman.</p>
      <AuthForm mode="register" />
    </div>
  );
}
