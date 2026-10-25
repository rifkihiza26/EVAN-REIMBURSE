import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Category } from '../../types';
import { Plus } from 'lucide-react';

export const BossCategoriesPage: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadCategories = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('created_at', { ascending: true });

      if (!error && data) {
        setCategories(data as Category[]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const toggleCategoryActive = async (cat: Category) => {
    try {
      const { error } = await supabase
        .from('categories')
        .update({ is_active: !cat.is_active })
        .eq('id', cat.id);

      if (error) throw error;
      loadCategories();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memperbarui status kategori';
      alert(msg);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('categories').insert({
        name: newName.trim(),
        description: newDesc.trim() || null,
        is_active: true,
      });

      if (error) throw error;
      setNewName('');
      setNewDesc('');
      loadCategories();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menambah kategori';
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Kategori Pengeluaran</h1>
        <p className="text-xs text-slate-500">
          Kelola opsi kategori biaya yang dapat dipilih oleh pegawai saat mengajukan klaim
        </p>
      </div>

      {/* Form Tambah Kategori */}
      <form
        onSubmit={handleAddCategory}
        className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3"
      >
        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
          Tambah Kategori Baru
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="text"
            required
            placeholder="Nama Kategori (contoh: Internet & Pulsa)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
          <input
            type="text"
            placeholder="Deskripsi singkat (opsional)"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </div>
        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs min-h-[40px] flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{isSubmitting ? 'Menyimpan...' : 'Tambah Kategori'}</span>
          </button>
        </div>
      </form>

      {/* List Kategori */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-slate-500">Memuat kategori...</div>
        ) : (
          categories.map((c) => (
            <div
              key={c.id}
              className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-900">{c.name}</span>
                  {!c.is_active && (
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                      Nonaktif
                    </span>
                  )}
                </div>
                {c.description && (
                  <p className="text-xs text-slate-500 mt-0.5">{c.description}</p>
                )}
              </div>

              <button
                onClick={() => toggleCategoryActive(c)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors min-h-[36px] ${
                  c.is_active
                    ? 'border-rose-200 text-rose-600 hover:bg-rose-50'
                    : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                {c.is_active ? 'Nonaktifkan' : 'Aktifkan'}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
