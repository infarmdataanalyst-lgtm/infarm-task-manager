// /tim/anggota — admin mengelola siapa yang boleh masuk board (login Google) dan perannya.
// Nama tidak bisa diubah setelah dibuat karena PIC dan pengerja checklist disimpan dengan nama.

import React, { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Trash2, UserPlus } from "lucide-react";
import { refreshAuth } from "../../data/auth";
import { addMember, MEMBER_COLORS, removeMember, updateMember } from "../../data/members";
import { Avatar, Modal, useAction } from "../../components/ui";

const ROLE_LABEL = { designer: "Desainer", admin: "Admin" };

function ColorPicker({ value, onChange, label }) {
  return (
    <div className="color-picker" role="radiogroup" aria-label={label}>
      {MEMBER_COLORS.map((c) => (
        <button key={c} type="button" role="radio" aria-checked={value === c} aria-label={`Warna ${c}`} style={{ background: c }} onClick={() => onChange(c)} />
      ))}
    </div>
  );
}

export default function MembersPage() {
  const { allMembers, member: me, tasks, showToast } = useOutletContext();
  const [run, busy] = useAction(showToast);
  const [form, setForm] = useState({ email: "", name: "", role: "designer", color: MEMBER_COLORS[0] });
  const [confirmRemove, setConfirmRemove] = useState(null);

  const change = (m, fields, message) => run(async () => {
    await updateMember(m.email, fields);
    refreshAuth();
  }, message);

  const add = async (e) => {
    e.preventDefault();
    const ok = await run(async () => {
      await addMember(form);
      refreshAuth();
    }, `${form.name.trim()} ditambahkan.`);
    if (ok) setForm({ email: "", name: "", role: "designer", color: MEMBER_COLORS[0] });
  };

  const activeTasks = (name) => tasks.filter((t) => t.pic === name && t.status !== "finish").length;

  return (
    <>
      <p style={{ color: "var(--zinc-700)" }}>
        Hanya email di daftar ini yang bisa masuk ke board dengan akun Google. Desainer muncul sebagai pilihan PIC; admin tidak.
        Menonaktifkan anggota langsung mengeluarkannya dari semua perangkat; task dan riwayat kerjanya tetap tersimpan.
      </p>

      <section className="card member-list" aria-label="Daftar anggota">
        {allMembers.map((m) => {
          const self = m.email === me.email;
          return (
            <div key={m.email} className={`member-row ${m.active ? "" : "inactive"}`}>
              <Avatar name={m.name} color={m.color} size={36} />
              <span className="grow member-who">
                <strong>{m.name}{self ? " (kamu)" : ""}</strong>
                <span className="small muted">{m.email}</span>
                {m.role === "designer" && activeTasks(m.name) > 0 && <span className="small muted">{activeTasks(m.name)} task aktif sebagai PIC</span>}
              </span>
              <select className="select member-role" aria-label={`Peran ${m.name}`} value={m.role} disabled={busy || self}
                title={self ? "Peranmu sendiri tidak bisa diubah dari sini" : undefined}
                onChange={(e) => change(m, { role: e.target.value }, `${m.name} sekarang ${ROLE_LABEL[e.target.value]}.`)}>
                <option value="designer">Desainer</option>
                <option value="admin">Admin</option>
              </select>
              <ColorPicker value={m.color} label={`Warna ${m.name}`} onChange={(color) => change(m, { color })} />
              <label className="member-active" title={self ? "Akunmu sendiri tidak bisa dinonaktifkan" : undefined}>
                <input type="checkbox" className="checkbox" checked={m.active} disabled={busy || self}
                  onChange={(e) => change(m, { active: e.target.checked }, `${m.name} ${e.target.checked ? "diaktifkan" : "dinonaktifkan"}.`)} />
                Aktif
              </label>
              {!m.active && (
                <button type="button" className="icon-btn icon-btn-plain" style={{ color: "var(--rose-600)" }} aria-label={`Hapus ${m.name}`} onClick={() => setConfirmRemove(m)}>
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          );
        })}
      </section>

      <form className="card card-pad stack" onSubmit={add} aria-labelledby="tambah-anggota">
        <h2 id="tambah-anggota" className="h-section">Tambah anggota</h2>
        <div className="member-form">
          <div className="field">
            <label className="label" htmlFor="m-email">Email Gmail</label>
            <input id="m-email" className="input" type="email" required placeholder="nama@gmail.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="field">
            <label className="label" htmlFor="m-name">Nama tampilan</label>
            <input id="m-name" className="input" required placeholder="Contoh: Rina" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="field">
            <label className="label" htmlFor="m-role">Peran</label>
            <select id="m-role" className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="designer">Desainer</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="field">
            <span className="label">Warna</span>
            <ColorPicker value={form.color} label="Warna anggota baru" onChange={(color) => setForm({ ...form, color })} />
          </div>
        </div>
        <button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-start" }} disabled={busy}>
          <UserPlus size={16} aria-hidden="true" /> Tambah
        </button>
        <p className="hint">
          Bila Google Cloud (Google Auth Platform → Audience) masih berstatus Testing, tambahkan juga Gmail ini di Test users.
          Nama tidak bisa diubah setelah dibuat karena dipakai sebagai PIC di task.
        </p>
      </form>

      {confirmRemove && (
        <Modal labelledBy="hapus-anggota" onClose={() => setConfirmRemove(null)}>
          <h2 id="hapus-anggota" className="h-section">Hapus {confirmRemove.name} dari daftar?</h2>
          <p>
            {confirmRemove.email} tidak bisa masuk lagi. Task yang PIC-nya {confirmRemove.name} tetap ada dengan nama itu
            {activeTasks(confirmRemove.name) ? ` (${activeTasks(confirmRemove.name)} masih aktif; ganti PIC-nya dari detail task)` : ""}.
            Riwayat tetap tersimpan.
          </p>
          <div className="modal-actions">
            <button type="button" className="btn btn-neutral" onClick={() => setConfirmRemove(null)}>Batal</button>
            <button type="button" className="btn btn-danger" disabled={busy}
              onClick={async () => {
                const m = confirmRemove;
                if (await run(async () => { await removeMember(m.email); refreshAuth(); }, `${m.name} dihapus dari daftar.`)) setConfirmRemove(null);
              }}>
              <Trash2 size={16} aria-hidden="true" /> Ya, hapus
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
