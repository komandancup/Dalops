import Tombol from './komponen/Tombol';

export function LayarMemuat() {
  return <p role="status" className="p-8 text-center text-lg text-stone-700">Memuat…</p>;
}

export function LayarGalat({ pesan, onCobaLagi }: { pesan: string; onCobaLagi(): void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-4 p-8 text-center">
      <p className="text-lg font-medium text-red-800">{pesan}</p>
      <Tombol onClick={onCobaLagi} jenis="kedua">Coba lagi</Tombol>
    </div>
  );
}

export function SegeraHadir({ judul }: { judul: string }) {
  return (
    <div className="flex flex-col items-center gap-2 p-8 text-center">
      <h2 className="text-2xl font-bold text-stone-900">{judul}</h2>
      <p className="text-lg text-stone-700">Segera hadir.</p>
    </div>
  );
}

export function KasBelumDibuka() {
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-2 p-6 text-center">
      <h2 className="text-2xl font-bold text-stone-900">Kas belum dibuka.</h2>
      <p className="text-lg text-stone-700">Buka kas dulu di menu Kasir.</p>
    </div>
  );
}
