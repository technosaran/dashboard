import React from "react";

interface ContactFormProps {
  newName: string;
  setNewName: (name: string) => void;
  newRelationship: string;
  setNewRelationship: (relationship: string) => void;
  submitting: boolean;
  isEditingRecipient: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export default function ContactForm({
  newName,
  setNewName,
  newRelationship,
  setNewRelationship,
  submitting,
  isEditingRecipient,
  onSubmit,
}: ContactFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-3">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">
          Full Name
        </label>
        <input
          autoFocus
          required
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="input-premium"
          placeholder="Enter contact name"
        />
      </div>
      <div className="space-y-3">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">
          Relationship
        </label>
        <input
          required
          type="text"
          value={newRelationship}
          onChange={(e) => setNewRelationship(e.target.value)}
          className="input-premium"
          placeholder="e.g. Brother, Friend"
        />
      </div>
      <div className="pt-4 mt-8">
        <button
          type="submit"
          disabled={submitting || !newName.trim()}
          className="btn-primary w-full h-12 shadow-xl shadow-[--accent-primary]/20"
        >
          {submitting ? "Saving..." : "Save Details"}
        </button>
      </div>
    </form>
  );
}
