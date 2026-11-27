import { useState, useRef } from "react";
import { Plus, Trash2, ImageOff } from "lucide-react";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import { Field, Input } from "../ui/FormControls";
import { getFileUrl } from "../../api/client";
import { uploadPhoto, deletePhoto } from "../../api/devices";

export default function DevicePhotoTab({ deviceId, photos, canEdit, onChanged }) {
  const [showModal, setShowModal] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  async function handleDelete(photoId) {
    if (!window.confirm("Hapus foto ini?")) return;
    setDeletingId(photoId);
    try {
      await deletePhoto(photoId);
      onChanged();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowModal(true)}>
            <Plus className="h-4 w-4" />
            Unggah Foto
          </Button>
        </div>
      )}

      {photos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <ImageOff className="h-7 w-7 text-ink-faint" strokeWidth={1.5} />
          <p className="text-sm text-ink-muted">Belum ada foto untuk perangkat ini.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((photo) => (
            <div key={photo.id} className="group relative overflow-hidden rounded-md border border-base-700 bg-base-900">
              <img
                src={getFileUrl(photo.fileUrl)}
                alt={photo.caption || "Foto perangkat"}
                className="aspect-square w-full object-cover"
                loading="lazy"
              />
              {photo.caption && (
                <p className="truncate border-t border-base-700 px-2 py-1.5 text-xs text-ink-muted">
                  {photo.caption}
                </p>
              )}
              {canEdit && (
                <button
                  onClick={() => handleDelete(photo.id)}
                  disabled={deletingId === photo.id}
                  className="absolute right-1.5 top-1.5 rounded bg-base-950/80 p-1.5 text-ink-muted opacity-0 transition-opacity hover:text-signal-down group-hover:opacity-100"
                  title="Hapus foto"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <PhotoUploadModal
          deviceId={deviceId}
          onClose={() => setShowModal(false)}
          onUploaded={() => {
            setShowModal(false);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function PhotoUploadModal({ deviceId, onClose, onUploaded }) {
  const fileRef = useRef(null);
  const [caption, setCaption] = useState("");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Pilih file foto terlebih dahulu");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await uploadPhoto(deviceId, file, caption || undefined);
      onUploaded();
    } catch (err) {
      setError(err.response?.data?.error || "Gagal mengunggah foto");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal title="Unggah Foto Perangkat" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="File foto" hint="Format: JPG, PNG, atau WEBP">
          <input
            ref={fileRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            onChange={(e) => setFileName(e.target.files?.[0]?.name || "")}
            className="block w-full text-sm text-ink-muted file:mr-3 file:rounded file:border-0 file:bg-base-700 file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-base-600"
            required
          />
        </Field>

        <Field label="Keterangan (opsional)">
          <Input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Contoh: Kondisi setelah servis"
          />
        </Field>

        {error && <p className="rounded bg-signal-down-dim px-3 py-2 text-sm text-signal-down">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Mengunggah..." : "Unggah"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
