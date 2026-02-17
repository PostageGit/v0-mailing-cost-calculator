"use client"

import { useState, useCallback } from "react"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Trash2, Loader2, UserCog, Shield, User, Pencil, Check, X } from "lucide-react"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface AppUser {
  id: string
  name: string
  email: string
  role: "admin" | "user"
  active: boolean
  created_at: string
  updated_at: string
}

export function UserManagementTab() {
  const { data: users, mutate } = useSWR<AppUser[]>("/api/users", fetcher)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [newRole, setNewRole] = useState<"admin" | "user">("user")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editRole, setEditRole] = useState<"admin" | "user">("user")
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleAdd = useCallback(async () => {
    if (!newName.trim()) return
    setSaving(true)
    await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), email: newEmail.trim(), role: newRole }),
    })
    setNewName("")
    setNewEmail("")
    setNewRole("user")
    setAdding(false)
    setSaving(false)
    mutate()
  }, [newName, newEmail, newRole, mutate])

  const handleSaveEdit = useCallback(async () => {
    if (!editingId || !editName.trim()) return
    setSaving(true)
    await fetch(`/api/users/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim(), email: editEmail.trim(), role: editRole }),
    })
    setEditingId(null)
    setSaving(false)
    mutate()
  }, [editingId, editName, editEmail, editRole, mutate])

  const handleToggleActive = useCallback(async (user: AppUser) => {
    await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !user.active }),
    })
    mutate()
  }, [mutate])

  const handleDelete = useCallback(async (id: string) => {
    setDeletingId(id)
    await fetch(`/api/users/${id}`, { method: "DELETE" })
    setDeletingId(null)
    mutate()
  }, [mutate])

  const startEdit = (user: AppUser) => {
    setEditingId(user.id)
    setEditName(user.name)
    setEditEmail(user.email)
    setEditRole(user.role)
  }

  const admins = users?.filter((u) => u.role === "admin") || []
  const regularUsers = users?.filter((u) => u.role === "user") || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">User Management</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage team members and roles. No login required yet -- this is for assignment and tracking.
          </p>
        </div>
        <Button size="sm" onClick={() => setAdding(true)} disabled={adding} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add User
        </Button>
      </div>

      {/* Add User Form */}
      {adding && (
        <div className="border border-dashed border-primary/40 rounded-xl p-4 bg-primary/5 space-y-3">
          <p className="text-sm font-medium text-foreground">New User</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              placeholder="Full name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="h-9 text-sm"
              autoFocus
            />
            <Input
              placeholder="Email (optional)"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="h-9 text-sm"
            />
            <Select value={newRole} onValueChange={(v) => setNewRole(v as "admin" | "user")}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="user">User</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={saving || !newName.trim()} className="gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setNewName(""); setNewEmail(""); setNewRole("user") }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Admins Section */}
      {admins.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <Shield className="h-3.5 w-3.5" /> Admins ({admins.length})
          </div>
          <div className="space-y-1.5">
            {admins.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                editingId={editingId}
                editName={editName}
                editEmail={editEmail}
                editRole={editRole}
                setEditName={setEditName}
                setEditEmail={setEditEmail}
                setEditRole={setEditRole}
                saving={saving}
                deletingId={deletingId}
                onEdit={startEdit}
                onSaveEdit={handleSaveEdit}
                onCancelEdit={() => setEditingId(null)}
                onToggleActive={handleToggleActive}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}

      {/* Users Section */}
      {regularUsers.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <User className="h-3.5 w-3.5" /> Users ({regularUsers.length})
          </div>
          <div className="space-y-1.5">
            {regularUsers.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                editingId={editingId}
                editName={editName}
                editEmail={editEmail}
                editRole={editRole}
                setEditName={setEditName}
                setEditEmail={setEditEmail}
                setEditRole={setEditRole}
                saving={saving}
                deletingId={deletingId}
                onEdit={startEdit}
                onSaveEdit={handleSaveEdit}
                onCancelEdit={() => setEditingId(null)}
                onToggleActive={handleToggleActive}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {(!users || users.length === 0) && !adding && (
        <div className="text-center py-10 text-muted-foreground">
          <UserCog className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No users yet. Add your first team member.</p>
        </div>
      )}

      {/* Summary */}
      {users && users.length > 0 && (
        <div className="pt-3 border-t border-border flex items-center gap-4 text-xs text-muted-foreground">
          <span>{users.length} total user{users.length !== 1 ? "s" : ""}</span>
          <span>{admins.length} admin{admins.length !== 1 ? "s" : ""}</span>
          <span>{users.filter((u) => u.active).length} active</span>
          <span>{users.filter((u) => !u.active).length} inactive</span>
        </div>
      )}
    </div>
  )
}


/* ─── Individual User Row ─── */

function UserRow({
  user, editingId, editName, editEmail, editRole,
  setEditName, setEditEmail, setEditRole,
  saving, deletingId,
  onEdit, onSaveEdit, onCancelEdit, onToggleActive, onDelete,
}: {
  user: AppUser
  editingId: string | null
  editName: string
  editEmail: string
  editRole: "admin" | "user"
  setEditName: (v: string) => void
  setEditEmail: (v: string) => void
  setEditRole: (v: "admin" | "user") => void
  saving: boolean
  deletingId: string | null
  onEdit: (user: AppUser) => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onToggleActive: (user: AppUser) => void
  onDelete: (id: string) => void
}) {
  const isEditing = editingId === user.id
  const isDeleting = deletingId === user.id

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 p-2.5 rounded-lg border border-primary/30 bg-primary/5">
        <Input
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          className="h-8 text-sm flex-1 min-w-0"
          autoFocus
        />
        <Input
          value={editEmail}
          onChange={(e) => setEditEmail(e.target.value)}
          placeholder="Email"
          className="h-8 text-sm flex-1 min-w-0"
        />
        <Select value={editRole} onValueChange={(v) => setEditRole(v as "admin" | "user")}>
          <SelectTrigger className="h-8 text-sm w-24 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="user">User</SelectItem>
          </SelectContent>
        </Select>
        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-primary" onClick={onSaveEdit} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={onCancelEdit}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors group ${
      user.active ? "border-border bg-card hover:bg-muted/50" : "border-border/50 bg-muted/30 opacity-60"
    }`}>
      {/* Avatar */}
      <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
        user.role === "admin"
          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
          : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
      }`}>
        {user.name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase()}
      </div>

      {/* Name + Email */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate">{user.name}</span>
          <Badge variant={user.role === "admin" ? "default" : "secondary"} className={`text-[10px] px-1.5 py-0 h-4 ${
            user.role === "admin" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20" : ""
          }`}>
            {user.role === "admin" ? "Admin" : "User"}
          </Badge>
          {!user.active && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground">
              Inactive
            </Badge>
          )}
        </div>
        {user.email && (
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Button
          size="icon" variant="ghost" className="h-7 w-7"
          title="Edit" onClick={() => onEdit(user)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon" variant="ghost" className="h-7 w-7"
          title={user.active ? "Deactivate" : "Activate"}
          onClick={() => onToggleActive(user)}
        >
          {user.active ? (
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <Check className="h-3.5 w-3.5 text-green-600" />
          )}
        </Button>
        <Button
          size="icon" variant="ghost" className="h-7 w-7 text-destructive"
          title="Delete" onClick={() => onDelete(user.id)} disabled={isDeleting}
        >
          {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  )
}
